
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
import type { FichaSocialHistorica, Responsable } from '@/types/interfaces';
import type { ActividadWizardValues, ProyectoWizardValues } from '../schema';
import { defaultActividad, defaultParticipante, parseLocalDate } from '../schema';
import { calcularPesosAutomaticos } from '../peso-calculo';
import ActividadCard from './actividad-card';
import GanttChart from './gantt-chart';

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

    // Desplaza N días una actividad y las fechas de todos sus participantes.
    const desplazarActividad = (index: number, dias: number) => {
        const opts = { shouldValidate: true, shouldDirty: true };
        const actividad = form.getValues(`actividades.${index}`);
        if (actividad.fecha_inicio_actividad) form.setValue(`actividades.${index}.fecha_inicio_actividad`, shiftDateString(actividad.fecha_inicio_actividad, dias), opts);
        if (actividad.fecha_fin_actividad) form.setValue(`actividades.${index}.fecha_fin_actividad`, shiftDateString(actividad.fecha_fin_actividad, dias), opts);
        (actividad.participantes || []).forEach((p, j) => {
            if (p.fecha_inicio_actividad) form.setValue(`actividades.${index}.participantes.${j}.fecha_inicio_actividad`, shiftDateString(p.fecha_inicio_actividad, dias), opts);
            if (p.fecha_fin_actividad) form.setValue(`actividades.${index}.participantes.${j}.fecha_fin_actividad`, shiftDateString(p.fecha_fin_actividad, dias), opts);
        });
    };

    const aplicarDesplazamientoProyecto = () => {
        fields.forEach((_, index) => desplazarActividad(index, proyectoDeltaDias));
        setShiftBannerDismissed(true);
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

    // Agrega o quita una predecesora de la actividad `index`.
    const toggleDependeDe = (index: number, predId: string) => {
        const ownId = fields[index]?.id;
        if (!ownId) return;
        setDependencias((prev) => {
            const actuales = prev[ownId] || [];
            let next: string[];
            if (actuales.includes(predId)) {
                next = actuales.filter((x) => x !== predId);
            } else {
                if (dependeTransitivo(predId, ownId)) return prev; // evita ciclo
                next = [...actuales, predId];
            }
            const copia = { ...prev };
            if (next.length) copia[ownId] = next;
            else delete copia[ownId];
            return copia;
        });
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
        selectedIndices.forEach((index) => desplazarActividad(index, dias));
        setSelectedIndices(new Set());
        setBulkShiftDays('');
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
                                minDate={projectStart ?? undefined}
                                maxDate={projectEnd ?? undefined}
                                opcionesDependencia={opcionesDependencia(actividadEnEdicion)}
                                dependeDeIds={dependencias[fields[actividadEnEdicion].id] || []}
                                onToggleDependeDe={(id) => toggleDependeDe(actividadEnEdicion, id)}
                            />
                        </CardContent>
                    </Card>
                )}

                <GanttChart actividades={actividadesValues} responsables={responsables} personas={personas} dependencias={depIndicesMap} />
            </CardContent>
        </>
    );
}
