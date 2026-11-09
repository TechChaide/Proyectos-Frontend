
"use client";

import { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useWatch, type UseFormReturn } from 'react-hook-form';
import { addDays, differenceInCalendarDays } from 'date-fns';
import { AlertCircle, CalendarClock, Check, Link2, Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { fechaISO } from '@/lib/fechas';
import { acotarRango, planificarReprogramacion, type CambioReprogramado, type RangoFechas } from '@/lib/dependencias';
import type { FichaSocialHistorica, Responsable } from '@/types/interfaces';
import type { ActividadWizardValues, ProyectoWizardValues } from '../schema';
import { defaultActividad, defaultParticipante, parseLocalDate } from '../schema';
import { calcularPesosAutomaticos } from '../peso-calculo';
import ActividadCard from './actividad-card';
import GanttChart from './gantt-chart';
import ReprogramacionDialog from './reprogramacion-dialog';

// ¿La actividad tiene todo lo obligatorio? (nombre, descripción, fechas y cada participante con responsable;
// en las compartidas, además las fechas de cada quien).
const actividadCompleta = (a?: ActividadWizardValues): boolean => {
    if (!a) return false;
    if (!a.nombre_actividad?.trim() || !a.descripcion_actividad?.trim()) return false;
    if (!a.fecha_inicio_actividad || !a.fecha_fin_actividad) return false;
    const participantes = a.participantes || [];
    if (participantes.length === 0) return false;
    const compartida = participantes.length > 1;
    return participantes.every((p) => p?.codigo_responsable && (!compartida || (p.fecha_inicio_actividad && p.fecha_fin_actividad)));
};

const formatDisplay = (date: Date | null): string =>
    date ? date.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

// Desplaza una fecha "YYYY-MM-DD" N días, conservando el formato.
const shiftDateString = (dateStr: string, days: number): string => {
    const parsed = parseLocalDate(dateStr);
    if (!parsed) return dateStr;
    const shifted = addDays(parsed, days);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())}`;
};

interface StepActividadesProps {
    form: UseFormReturn<ProyectoWizardValues>;
    responsables: Responsable[];
    personas: FichaSocialHistorica[];
    isLoading: boolean;
    /** Fechas originales del proyecto (solo en modo edición), para detectar desplazamientos. */
    editOriginalFechas?: { fecha_inicio: string; fecha_fin: string } | null;
}

export default function StepActividades({ form, responsables, personas, isLoading, editOriginalFechas }: StepActividadesProps) {
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'actividades',
    });

    const [openIndex, setOpenIndex] = useState<number | null>(0);
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
    const [bulkShiftDays, setBulkShiftDays] = useState('');
    const [shiftBannerDismissed, setShiftBannerDismissed] = useState(false);
    // Cambio en espera de confirmación porque movería actividades dependientes.
    const [pendiente, setPendiente] = useState<{ titulo: string; cambios: CambioReprogramado[]; aplicar: () => void; cancelar?: () => void } | null>(null);
    // Dependencias (solo ayuda visual, no se guardan): id de actividad → ids de sus predecesoras.
    const [dependencias, setDependencias] = useState<Record<string, string[]>>({});

    const actividadesValues = useWatch({ control: form.control, name: 'actividades' });
    const proyectoFechaInicio = useWatch({ control: form.control, name: 'fecha_inicio' });
    const proyectoFechaFin = useWatch({ control: form.control, name: 'fecha_fin' });

    const projectStart = useMemo(() => parseLocalDate(proyectoFechaInicio), [proyectoFechaInicio]);
    const projectEnd = useMemo(() => parseLocalDate(proyectoFechaFin), [proyectoFechaFin]);

    // Delta (en días) entre la fecha de inicio original del proyecto y la actual, solo en edición.
    const proyectoDeltaDias = useMemo(() => {
        if (!editOriginalFechas) return 0;
        const original = parseLocalDate(editOriginalFechas.fecha_inicio);
        const actual = parseLocalDate(proyectoFechaInicio);
        if (!original || !actual) return 0;
        return differenceInCalendarDays(actual, original);
    }, [editOriginalFechas, proyectoFechaInicio]);

    const mostrarBannerDesplazamiento = !!editOriginalFechas && proyectoDeltaDias !== 0 && !shiftBannerDismissed;

    // Firma estable (fechas de cada actividad + responsable y fechas de cada participante) que
    // dispara el recálculo de pesos SOLO cuando algo relevante cambia, nunca por el propio
    // peso_actividad que este efecto escribe (evita un loop infinito).
    const firmaParaPeso = useMemo(() => {
        return (actividadesValues || [])
            .map((a) => `${a?.fecha_inicio_actividad}|${a?.fecha_fin_actividad}|` +
                (a?.participantes || []).map((p) => `${p?.codigo_responsable}:${p?.fecha_inicio_actividad}:${p?.fecha_fin_actividad}`).join(','))
            .join(';;');
    }, [actividadesValues]);

    useEffect(() => {
        const actuales = form.getValues('actividades') || [];
        const pesos = calcularPesosAutomaticos(actuales);
        pesos.forEach((pesosActividad, i) => {
            pesosActividad.forEach((peso, j) => {
                if (actuales[i]?.participantes?.[j]?.peso_actividad !== peso) {
                    form.setValue(`actividades.${i}.participantes.${j}.peso_actividad`, peso);
                }
            });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firmaParaPeso]);

    const opcionesSet = { shouldValidate: true, shouldDirty: true };

    // Escribe el rango de una actividad y deja a sus participantes dentro de él: el único participante de una
    // actividad individual toma el mismo rango; en las compartidas cada parte se acota a la actividad
    // (si no queda ningún día, se limpia). `trasladar` mueve además las partes N días antes de acotarlas.
    const escribirActividad = (index: number, rango: { ini: string; fin: string } | null, trasladar = 0) => {
        const actividad = form.getValues(`actividades.${index}`);
        const participantes = actividad.participantes || [];
        const vacio = { ini: '', fin: '' };
        const r = rango ?? vacio;
        form.setValue(`actividades.${index}.fecha_inicio_actividad`, r.ini, opcionesSet);
        form.setValue(`actividades.${index}.fecha_fin_actividad`, r.fin, opcionesSet);
        const actIni = parseLocalDate(r.ini);
        const actFin = parseLocalDate(r.fin);
        participantes.forEach((p, j) => {
            let pr: { ini: string; fin: string } | null;
            if (!rango) pr = null;
            else if (participantes.length === 1) pr = r;
            else {
                const pi = p.fecha_inicio_actividad ? shiftDateString(p.fecha_inicio_actividad, trasladar) : '';
                const pf = p.fecha_fin_actividad ? shiftDateString(p.fecha_fin_actividad, trasladar) : '';
                pr = acotarRango(pi, pf, actIni, actFin);
            }
            const v = pr ?? vacio;
            form.setValue(`actividades.${index}.participantes.${j}.fecha_inicio_actividad`, v.ini, opcionesSet);
            form.setValue(`actividades.${index}.participantes.${j}.fecha_fin_actividad`, v.fin, opcionesSet);
        });
    };

    // Desplaza N días una actividad y sus participantes SIN salirse de las fechas del proyecto: si el final
    // se pasa, se recorta al fin del proyecto; si ya no cabe ningún día, se limpian las fechas.
    const desplazarActividad = (index: number, dias: number) => {
        const actividad = form.getValues(`actividades.${index}`);
        const ini = actividad.fecha_inicio_actividad ? shiftDateString(actividad.fecha_inicio_actividad, dias) : '';
        const fin = actividad.fecha_fin_actividad ? shiftDateString(actividad.fecha_fin_actividad, dias) : '';
        escribirActividad(index, acotarRango(ini, fin, projectStart, projectEnd), dias);
    };

    // Actividades con alguna fecha fuera del rango del proyecto (p. ej. tras cambiar las fechas del paso 2).
    const fueraDeRango = useMemo(() => {
        if (!projectStart && !projectEnd) return [] as number[];
        return (actividadesValues || []).flatMap((a, i) => {
            const ini = parseLocalDate(a?.fecha_inicio_actividad || '');
            const fin = parseLocalDate(a?.fecha_fin_actividad || '');
            const fuera = (ini && ((projectStart && ini < projectStart) || (projectEnd && ini > projectEnd)))
                || (fin && ((projectStart && fin < projectStart) || (projectEnd && fin > projectEnd)));
            return fuera ? [i] : [];
        });
    }, [actividadesValues, projectStart, projectEnd]);

    const ajustarAlProyecto = () => {
        fueraDeRango.forEach((i) => {
            const a = form.getValues(`actividades.${i}`);
            escribirActividad(i, acotarRango(a.fecha_inicio_actividad, a.fecha_fin_actividad, projectStart, projectEnd));
        });
    };

    // Rango que quedaría en una actividad al desplazarla N días (acotado al proyecto).
    const rangoDesplazado = (index: number, dias: number): RangoFechas => {
        const a = form.getValues(`actividades.${index}`);
        const ini = a.fecha_inicio_actividad ? shiftDateString(a.fecha_inicio_actividad, dias) : '';
        const fin = a.fecha_fin_actividad ? shiftDateString(a.fecha_fin_actividad, dias) : '';
        return acotarRango(ini, fin, projectStart, projectEnd) ?? { ini: '', fin: '' };
    };

    const aplicarDesplazamientoProyecto = () => {
        const hipotesis = new Map<number, RangoFechas>(fields.map((_, i) => [i, rangoDesplazado(i, proyectoDeltaDias)]));
        confirmarReprogramacion(
            'Desplazar todas las actividades con el proyecto',
            hipotesis,
            () => {
                fields.forEach((_, index) => desplazarActividad(index, proyectoDeltaDias));
                setShiftBannerDismissed(true);
            }
        );
    };

    // ¿fromId depende (directa o transitivamente) de targetId? Evita ciclos al elegir dependencias.
    const dependeTransitivo = (fromId: string, targetId: string): boolean => {
        const pila = [...(dependencias[fromId] || [])];
        const visto = new Set<string>();
        while (pila.length) {
            const actual = pila.pop()!;
            if (actual === targetId) return true;
            if (visto.has(actual)) continue;
            visto.add(actual);
            (dependencias[actual] || []).forEach((x) => pila.push(x));
        }
        return false;
    };

    // Opciones de predecesora para la actividad `index`: las demás actividades que no generarían ciclo.
    const opcionesDependencia = (index: number) => {
        const ownId = fields[index]?.id;
        return fields
            .map((f, j) => ({ f, j }))
            .filter(({ f, j }) => j !== index && !dependeTransitivo(f.id, ownId))
            .map(({ f, j }) => ({ id: f.id, nombre: actividadesValues?.[j]?.nombre_actividad?.trim() || `Actividad ${j + 1}` }));
    };

    // Primer día disponible para la actividad `index`: el día siguiente al fin de su(s) predecesora(s), nunca antes
    // del inicio del proyecto. `sinEspacio` = ya no cabe dentro del proyecto.
    const limiteActividad = (index: number): { min: Date | null; sinEspacio: boolean; hastaNombre?: string } => {
        let min: Date | null = projectStart;
        let hastaNombre: string | undefined;
        for (const id of dependencias[fields[index]?.id] || []) {
            const k = fields.findIndex((x) => x.id === id);
            const fin = k >= 0 ? parseLocalDate(actividadesValues?.[k]?.fecha_fin_actividad || '') : null;
            if (!fin) continue;
            const cand = addDays(fin, 1);
            if (!min || cand > min) {
                min = cand;
                hastaNombre = actividadesValues?.[k]?.nombre_actividad?.trim() || `Actividad ${k + 1}`;
            }
        }
        return { min, sinEspacio: !!(min && projectEnd && min > projectEnd), hastaNombre };
    };

    // Predecesoras como índices (para simular la reprogramación) según un mapa de dependencias.
    const predecesorasPorIndice = (deps: Record<string, string[]>): number[][] =>
        fields.map((f) => (deps[f.id] || []).map((id) => fields.findIndex((x) => x.id === id)).filter((k) => k >= 0));

    // Simula el cambio ANTES de aplicarlo: si movería otras actividades por las dependencias, abre el aviso con el
    // detalle y solo aplica si el usuario confirma. `hipotesis` = rangos que el cambio dejaría en ciertas actividades.
    const confirmarReprogramacion = (
        titulo: string,
        hipotesis: Map<number, RangoFechas>,
        aplicar: () => void,
        cancelar?: () => void,
        deps: Record<string, string[]> = dependencias
    ) => {
        const rangos = (form.getValues('actividades') || []).map((a, i) =>
            hipotesis.get(i) ?? { ini: a.fecha_inicio_actividad || '', fin: a.fecha_fin_actividad || '' }
        );
        const cambios = planificarReprogramacion(rangos, predecesorasPorIndice(deps), projectStart, projectEnd);
        if (cambios.length === 0) {
            aplicar();
            return;
        }
        setPendiente({ titulo, cambios, aplicar, cancelar });
    };

    // Agrega o quita una predecesora de la actividad `index`.
    const toggleDependeDe = (index: number, predId: string) => {
        const ownId = fields[index]?.id;
        if (!ownId) return;
        const actuales = dependencias[ownId] || [];
        let next: string[];
        if (actuales.includes(predId)) {
            next = actuales.filter((x) => x !== predId);
        } else {
            if (dependeTransitivo(predId, ownId)) return; // evita ciclo
            next = [...actuales, predId];
        }
        const copia = { ...dependencias };
        if (next.length) copia[ownId] = next;
        else delete copia[ownId];
        const aplicar = () => setDependencias(copia);
        // Quitar una dependencia nunca mueve fechas; agregarla sí puede: se avisa antes.
        if (next.length < actuales.length) aplicar();
        else confirmarReprogramacion(`Agregar esta dependencia a la actividad ${index + 1}`, new Map(), aplicar, undefined, copia);
    };

    // Índices de predecesoras por actividad (para el Gantt): id → índices actuales.
    const depIndicesMap = useMemo(() => {
        const map: Record<number, number[]> = {};
        fields.forEach((f, i) => {
            const ids = dependencias[f.id] || [];
            map[i] = ids.map((id) => fields.findIndex((x) => x.id === id)).filter((p) => p >= 0 && p !== i);
        });
        return map;
    }, [fields, dependencias]);

    // Reprograma: una actividad con dependencias no puede empezar antes de que termine la última de ellas.
    const firmaDependencias = useMemo(() => {
        const dep = Object.entries(dependencias).map(([k, v]) => `${k}>${[...v].sort().join('+')}`).sort().join('|');
        const fechas = (actividadesValues || []).map((a) => `${a?.fecha_inicio_actividad}~${a?.fecha_fin_actividad}`).join(',');
        return `${dep}::${fechas}`;
    }, [dependencias, actividadesValues]);

    useEffect(() => {
        const acts = form.getValues('actividades') || [];
        const predIdxsOf = (i: number) =>
            (dependencias[fields[i]?.id] || [])
                .map((id) => fields.findIndex((x) => x.id === id))
                .filter((p) => p >= 0 && p !== i);
        for (let pass = 0; pass < fields.length; pass++) {
            let algo = false;
            for (let i = 0; i < acts.length; i++) {
                const preds = predIdxsOf(i);
                if (!preds.length) continue;
                let minIni: Date | null = null;
                preds.forEach((p) => {
                    const pf = parseLocalDate(acts[p]?.fecha_fin_actividad);
                    if (pf) {
                        const cand = addDays(pf, 1);
                        if (!minIni || cand > minIni) minIni = cand;
                    }
                });
                const depIni = parseLocalDate(acts[i]?.fecha_inicio_actividad);
                if (!minIni || !depIni) continue;
                const delta = differenceInCalendarDays(minIni, depIni);
                if (delta > 0) {
                    desplazarActividad(i, delta);
                    acts[i] = form.getValues(`actividades.${i}`);
                    algo = true;
                }
            }
            if (!algo) break;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firmaDependencias]);

    const handleAppend = () => {
        setOpenIndex(fields.length);
        append({ ...defaultActividad, participantes: [{ ...defaultParticipante }] });
    };

    const handleRemove = (index: number) => {
        const newLength = fields.length - 1;
        const removedId = fields[index]?.id;
        remove(index);
        if (removedId) {
            setDependencias((prev) => {
                const next: Record<string, string[]> = {};
                Object.entries(prev).forEach(([k, v]) => {
                    if (k === removedId) return;
                    const filtrado = v.filter((x) => x !== removedId);
                    if (filtrado.length) next[k] = filtrado;
                });
                return next;
            });
        }
        setSelectedIndices((prev) => {
            const next = new Set<number>();
            prev.forEach((i) => {
                if (i === index) return;
                next.add(i > index ? i - 1 : i);
            });
            return next;
        });
        setOpenIndex((prev) => {
            if (newLength <= 0) return null;
            if (prev === null) return prev;
            if (prev === index) return Math.min(index, newLength - 1);
            if (prev > index) return prev - 1;
            return prev;
        });
    };

    const toggleSelected = (index: number) => {
        setSelectedIndices((prev) => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    const aplicarDesplazamientoSeleccion = () => {
        const dias = Number(bulkShiftDays);
        if (!dias || Number.isNaN(dias)) return;
        const hipotesis = new Map<number, RangoFechas>([...selectedIndices].map((i) => [i, rangoDesplazado(i, dias)]));
        confirmarReprogramacion(
            `Mover ${selectedIndices.size} actividad(es) ${dias > 0 ? '+' : ''}${dias} día(s)`,
            hipotesis,
            () => {
                selectedIndices.forEach((index) => desplazarActividad(index, dias));
                setSelectedIndices(new Set());
                setBulkShiftDays('');
            }
        );
    };

    // Datos para la tabla compacta.
    const responsableMap = useMemo(() => new Map(responsables.map((r) => [r.codigo_responsable, r])), [responsables]);
    const personaMap = useMemo(() => new Map(personas.map((p) => [p.CODIGO, p])), [personas]);
    const nombreResponsable = (codigo?: number): string => {
        if (!codigo) return '';
        const r = responsableMap.get(codigo);
        if (!r) return '';
        return personaMap.get(r.codigo_empleado)?.NOMBRE || r.codigo_empleado;
    };
    const resumenParticipantes = (a?: ActividadWizardValues): string => {
        const nombres = (a?.participantes || []).map((p) => nombreResponsable(p?.codigo_responsable)).filter(Boolean);
        return nombres.length ? nombres.join(', ') : 'Sin asignar';
    };
    const rangoFechas = (a?: ActividadWizardValues): string => {
        const ini = parseLocalDate(a?.fecha_inicio_actividad || '');
        const fin = parseLocalDate(a?.fecha_fin_actividad || '');
        return ini && fin ? `${formatDisplay(ini)} – ${formatDisplay(fin)}` : '—';
    };
    const predecesoresTexto = (index: number): string => {
        const preds = depIndicesMap[index] || [];
        if (!preds.length) return '—';
        return preds.map((p) => actividadesValues?.[p]?.nombre_actividad?.trim() || `Actividad ${p + 1}`).join(', ');
    };

    const erroresActividades = form.formState.errors.actividades;
    const actividadEnEdicion = openIndex !== null && fields[openIndex] ? openIndex : null;

    return (
        <>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                    <CardTitle>3. Definición de Actividades</CardTitle>
                    <CardDescription>
                        {projectStart && projectEnd
                            ? `Agrega las actividades del proyecto. Deben ubicarse entre ${formatDisplay(projectStart)} y ${formatDisplay(projectEnd)}.`
                            : 'Define las fechas del proyecto en el paso 2 para acotar las actividades a ese rango.'}
                    </CardDescription>
                </div>
                <Button
                    type="button"
                    size="icon"
                    className="rounded-full shrink-0"
                    onClick={handleAppend}
                    aria-label="Agregar Actividad"
                >
                    <Plus className="h-5 w-5" />
                </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                {mostrarBannerDesplazamiento && (
                    <Alert>
                        <CalendarClock className="h-4 w-4" />
                        <AlertTitle>El proyecto se movió {Math.abs(proyectoDeltaDias)} día(s)</AlertTitle>
                        <AlertDescription>
                            <p className="mb-2">
                                ¿Deseas desplazar automáticamente las {fields.length} actividad(es) {proyectoDeltaDias > 0 ? 'hacia adelante' : 'hacia atrás'} para conservar sus fechas relativas dentro del proyecto?
                            </p>
                            <div className="flex gap-2">
                                <Button type="button" size="sm" onClick={aplicarDesplazamientoProyecto}>
                                    Sí, desplazar todas
                                </Button>
                                <Button type="button" size="sm" variant="outline" onClick={() => setShiftBannerDismissed(true)}>
                                    No, ajustar manualmente
                                </Button>
                            </div>
                        </AlertDescription>
                    </Alert>
                )}

                {!mostrarBannerDesplazamiento && fueraDeRango.length > 0 && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Hay actividades fuera de las fechas del proyecto</AlertTitle>
                        <AlertDescription>
                            <p className="mb-2">
                                {fueraDeRango.map((i) => `#${i + 1}`).join(', ')} se salen del rango {formatDisplay(projectStart)} – {formatDisplay(projectEnd)}. Ninguna actividad puede quedar fuera del proyecto.
                            </p>
                            <Button type="button" size="sm" variant="outline" onClick={ajustarAlProyecto}>
                                Ajustar al rango del proyecto
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}

                {selectedIndices.size > 0 && (
                    <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed bg-muted/40 p-3">
                        <span className="text-sm font-medium">{selectedIndices.size} seleccionada(s)</span>
                        <Input
                            type="number"
                            placeholder="± días"
                            value={bulkShiftDays}
                            onChange={(e) => setBulkShiftDays(e.target.value)}
                            className="h-8 w-24"
                        />
                        <Button type="button" size="sm" onClick={aplicarDesplazamientoSeleccion} disabled={!bulkShiftDays}>
                            Mover selección
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedIndices(new Set())}>
                            Cancelar selección
                        </Button>
                    </div>
                )}

                {/* Tabla compacta: una fila por actividad; clic en una fila la abre para editar abajo. */}
                <div className="overflow-x-auto rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-8"></TableHead>
                                <TableHead className="w-8">#</TableHead>
                                <TableHead>Actividad</TableHead>
                                <TableHead>Fechas</TableHead>
                                <TableHead>Participante(s)</TableHead>
                                <TableHead>Depende de</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="w-20 text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((item, index) => {
                                const a = actividadesValues?.[index];
                                const completa = actividadCompleta(a);
                                const conError = !!erroresActividades?.[index];
                                const enEdicion = actividadEnEdicion === index;
                                return (
                                    <TableRow
                                        key={item.id}
                                        onClick={() => setOpenIndex(index)}
                                        className={cn(
                                            'cursor-pointer',
                                            enEdicion && 'bg-muted/60',
                                            conError && 'bg-destructive/5'
                                        )}
                                    >
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={selectedIndices.has(index)}
                                                onCheckedChange={() => toggleSelected(index)}
                                                aria-label={`Seleccionar actividad ${index + 1}`}
                                            />
                                        </TableCell>
                                        <TableCell className="text-muted-foreground tabular-nums">{index + 1}</TableCell>
                                        <TableCell className="max-w-[220px]">
                                            <span className={cn('block truncate font-medium', !a?.nombre_actividad?.trim() && 'font-normal text-muted-foreground')}>
                                                {a?.nombre_actividad?.trim() || 'Sin definir'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{rangoFechas(a)}</TableCell>
                                        <TableCell className="max-w-[180px]">
                                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                {(a?.participantes?.length || 0) > 1 && <Users className="h-3.5 w-3.5 shrink-0" />}
                                                <span className="truncate">{resumenParticipantes(a)}</span>
                                            </span>
                                        </TableCell>
                                        <TableCell className="max-w-[140px]">
                                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                {(depIndicesMap[index]?.length || 0) > 0 && <Link2 className="h-3.5 w-3.5 shrink-0" />}
                                                <span className="truncate">{predecesoresTexto(index)}</span>
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {completa ? (
                                                <Badge className="bg-green-600 hover:bg-green-600">
                                                    <Check className="mr-1 h-3 w-3" /> Completa
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="text-amber-700">
                                                    <AlertCircle className="mr-1 h-3 w-3" /> Falta completar
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => setOpenIndex(enEdicion ? null : index)}
                                                    aria-label={`Editar actividad ${index + 1}`}
                                                    title="Editar"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={() => handleRemove(index)}
                                                    disabled={fields.length <= 1}
                                                    aria-label={`Eliminar actividad ${index + 1}`}
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    <div className="border-t p-2">
                        <Button type="button" variant="ghost" size="sm" onClick={handleAppend} className="w-full justify-center">
                            <Plus className="mr-2 h-4 w-4" /> Agregar actividad
                        </Button>
                    </div>
                </div>

                {/* Panel de edición de la actividad seleccionada. */}
                {actividadEnEdicion !== null && (
                    <Card className="border-primary/40">
                        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 py-3">
                            <CardTitle className="text-base">
                                Editar actividad {actividadEnEdicion + 1}
                                {actividadesValues?.[actividadEnEdicion]?.nombre_actividad?.trim() ? ` · ${actividadesValues[actividadEnEdicion].nombre_actividad}` : ''}
                            </CardTitle>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setOpenIndex(null)}>
                                <X className="mr-1 h-4 w-4" /> Cerrar
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <ActividadCard
                                key={fields[actividadEnEdicion].id}
                                form={form}
                                index={actividadEnEdicion}
                                responsables={responsables}
                                personas={personas}
                                isLoading={isLoading}
                                onRemove={() => handleRemove(actividadEnEdicion)}
                                canRemove={fields.length > 1}
                                minDate={limiteActividad(actividadEnEdicion).min ?? undefined}
                                maxDate={projectEnd ?? undefined}
                                rangoLabel={limiteActividad(actividadEnEdicion).hastaNombre ? `Desde que termina ${limiteActividad(actividadEnEdicion).hastaNombre}` : undefined}
                                sinEspacio={limiteActividad(actividadEnEdicion).sinEspacio}
                                confirmarCambioRango={(nuevo, aplicar, cancelar) =>
                                    confirmarReprogramacion(
                                        `Cambiar las fechas de la actividad ${actividadEnEdicion + 1}`,
                                        new Map([[actividadEnEdicion, nuevo]]),
                                        aplicar,
                                        cancelar
                                    )
                                }
                                opcionesDependencia={opcionesDependencia(actividadEnEdicion)}
                                dependeDeIds={dependencias[fields[actividadEnEdicion].id] || []}
                                onToggleDependeDe={(id) => toggleDependeDe(actividadEnEdicion, id)}
                            />
                        </CardContent>
                    </Card>
                )}

                <ReprogramacionDialog
                    abierto={!!pendiente}
                    titulo={pendiente?.titulo ?? ''}
                    elementos="actividades"
                    items={(pendiente?.cambios ?? []).map((c) => ({
                        nombre: `${c.index + 1}. ${actividadesValues?.[c.index]?.nombre_actividad?.trim() || `Actividad ${c.index + 1}`}`,
                        desde: c.desde,
                        hacia: c.hacia,
                    }))}
                    onConfirmar={() => {
                        const p = pendiente;
                        setPendiente(null);
                        p?.aplicar();
                    }}
                    onCancelar={() => {
                        const p = pendiente;
                        setPendiente(null);
                        p?.cancelar?.();
                    }}
                />

                <GanttChart actividades={actividadesValues} responsables={responsables} personas={personas} dependencias={depIndicesMap} />
            </CardContent>
        </>
    );
}
