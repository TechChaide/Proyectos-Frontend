
"use client";

import { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useWatch, type UseFormReturn } from 'react-hook-form';
import { addDays, differenceInCalendarDays } from 'date-fns';
import { Check, Info, Link2, Plus, Trash2, UserMinus, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import type { FichaSocialHistorica, Responsable } from '@/types/interfaces';
import { cn } from '@/lib/utils';
import { MAX_PARTICIPANTES, participacionPorDuracion, porcentajesEnteros } from '@/lib/actividades';
import { MAX_LEN_200, parseLocalDate, type ProyectoWizardValues } from '../schema';
import DateRangePicker from './date-range-picker';

// Desplaza una fecha "YYYY-MM-DD" N días conservando el formato.
const shiftDateString = (dateStr: string, days: number): string => {
    const parsed = parseLocalDate(dateStr);
    if (!parsed) return dateStr;
    const s = addDays(parsed, days);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`;
};

interface ActividadCardProps {
    form: UseFormReturn<ProyectoWizardValues>;
    index: number;
    responsables: Responsable[];
    personas: FichaSocialHistorica[];
    isLoading: boolean;
    onRemove: () => void;
    canRemove: boolean;
    minDate?: Date;
    maxDate?: Date;
    /** Otras actividades que pueden ser predecesoras (dependencia), con su nombre visible. */
    opcionesDependencia: { id: string; nombre: string }[];
    /** Ids de las actividades predecesoras seleccionadas ([] = ninguna). */
    dependeDeIds: string[];
    onToggleDependeDe: (id: string) => void;
}

export default function ActividadCard({ form, index, responsables, personas, isLoading, onRemove, canRemove, minDate, maxDate, opcionesDependencia, dependeDeIds, onToggleDependeDe }: ActividadCardProps) {
    const base = `actividades.${index}` as const;
    const { fields, append, remove } = useFieldArray({ control: form.control, name: `${base}.participantes` });

    const fechaInicio = useWatch({ control: form.control, name: `${base}.fecha_inicio_actividad` });
    const fechaFin = useWatch({ control: form.control, name: `${base}.fecha_fin_actividad` });
    const participantes = useWatch({ control: form.control, name: `${base}.participantes` }) || [];

    const personaMap = useMemo(() => new Map(personas.map((p) => [p.CODIGO, p])), [personas]);
    const etiquetaResponsable = (r: Responsable) => {
        const persona = personaMap.get(r.codigo_empleado);
        return persona ? `${r.codigo_empleado} - ${persona.NOMBRE} - ${persona.DEPARTAMENTO}` : r.codigo_empleado;
    };

    const esCompartida = fields.length > 1;
    const participacion = useMemo(
        () => porcentajesEnteros(participacionPorDuracion(
            participantes.map((p) => ({ inicio: p?.fecha_inicio_actividad || fechaInicio, fin: p?.fecha_fin_actividad || fechaFin }))
        )),
        [participantes, fechaInicio, fechaFin]
    );

    const actividadInicio = fechaInicio ? new Date(`${fechaInicio}T00:00:00`) : undefined;
    const actividadFin = fechaFin ? new Date(`${fechaFin}T00:00:00`) : undefined;

    const errores = form.formState.errors.actividades?.[index];
    const fechaError = errores?.fecha_inicio_actividad ?? errores?.fecha_fin_actividad;

    // Colores para distinguir la parte de cada participante en el calendario.
    const COLORES_PARTICIPANTE = ['#2a78d6', '#d9822b', '#2a9d6f'];
    const colorParticipante = (j: number) => COLORES_PARTICIPANTE[j % COLORES_PARTICIPANTE.length];

    // Al cambiar el rango de la actividad:
    //  - Individual: el único participante hace toda la actividad, así que toma ese mismo rango.
    //  - Compartida: NO se tocan las fechas de los participantes (cada quien ingresa su estimado dentro
    //    de la actividad). El rango de la actividad solo acota el máximo permitido por participante.
    const handleRangoActividad = (start: string, end: string) => {
        form.setValue(`${base}.fecha_inicio_actividad`, start, { shouldValidate: true, shouldDirty: true });
        form.setValue(`${base}.fecha_fin_actividad`, end, { shouldValidate: true, shouldDirty: true });
        if (fields.length === 1) {
            form.setValue(`${base}.participantes.0.fecha_inicio_actividad`, start, { shouldDirty: true });
            form.setValue(`${base}.participantes.0.fecha_fin_actividad`, end, { shouldDirty: true });
        }
    };

    const handleRangoParticipante = (j: number, start: string, end: string) => {
        form.setValue(`${base}.participantes.${j}.fecha_inicio_actividad`, start, { shouldValidate: true, shouldDirty: true });
        form.setValue(`${base}.participantes.${j}.fecha_fin_actividad`, end, { shouldValidate: true, shouldDirty: true });
    };

    const agregarParticipante = () => {
        // Al pasar de individual a compartida, se limpia la fecha del primero para que el usuario
        // ingrese el estimado de cada persona (todos los participantes arrancan con el picker vacío).
        if (fields.length === 1) {
            form.setValue(`${base}.participantes.0.fecha_inicio_actividad`, '', { shouldDirty: true });
            form.setValue(`${base}.participantes.0.fecha_fin_actividad`, '', { shouldDirty: true });
        }
        append({
            codigo_actividad: 0,
            codigo_responsable: 0,
            fecha_inicio_actividad: '',
            fecha_fin_actividad: '',
            peso_actividad: 0,
        });
    };

    // Dependencia OPCIONAL entre participantes de esta actividad compartida (solo ayuda visual, no se
    // guarda): id de participante → ids de los participantes de los que depende su parte.
    const [depPart, setDepPart] = useState<Record<string, string[]>>({});

    const nombreParticipante = (j: number): string => {
        const codigo = participantes[j]?.codigo_responsable;
        const r = codigo ? responsables.find((x) => x.codigo_responsable === codigo) : undefined;
        return (r && personaMap.get(r.codigo_empleado)?.NOMBRE) || r?.codigo_empleado || `Participante ${j + 1}`;
    };

    const dependeTransitivoPart = (fromId: string, targetId: string): boolean => {
        const pila = [...(depPart[fromId] || [])];
        const visto = new Set<string>();
        while (pila.length) {
            const actual = pila.pop()!;
            if (actual === targetId) return true;
            if (visto.has(actual)) continue;
            visto.add(actual);
            (depPart[actual] || []).forEach((x) => pila.push(x));
        }
        return false;
    };

    const opcionesPart = (j: number) => {
        const ownId = fields[j]?.id;
        return fields
            .map((f, k) => ({ f, k }))
            .filter(({ f, k }) => k !== j && !dependeTransitivoPart(f.id, ownId))
            .map(({ f, k }) => ({ id: f.id, nombre: nombreParticipante(k) }));
    };

    const toggleDepPart = (j: number, predId: string) => {
        const ownId = fields[j]?.id;
        if (!ownId) return;
        setDepPart((prev) => {
            const actuales = prev[ownId] || [];
            let next: string[];
            if (actuales.includes(predId)) next = actuales.filter((x) => x !== predId);
            else {
                if (dependeTransitivoPart(predId, ownId)) return prev;
                next = [...actuales, predId];
            }
            const copia = { ...prev };
            if (next.length) copia[ownId] = next;
            else delete copia[ownId];
            return copia;
        });
    };

    const handleRemoveParticipante = (j: number) => {
        const removedId = fields[j]?.id;
        remove(j);
        if (removedId) {
            setDepPart((prev) => {
                const next: Record<string, string[]> = {};
                Object.entries(prev).forEach(([k, v]) => {
                    if (k === removedId) return;
                    const f = v.filter((x) => x !== removedId);
                    if (f.length) next[k] = f;
                });
                return next;
            });
        }
    };

    // Reprograma: la parte de un participante con dependencia empieza tras terminar la última de ellas.
    const firmaDepPart = useMemo(() => {
        const d = Object.entries(depPart).map(([k, v]) => `${k}>${[...v].sort().join('+')}`).sort().join('|');
        const f = (participantes || []).map((p) => `${p?.fecha_inicio_actividad}~${p?.fecha_fin_actividad}`).join(',');
        return `${d}::${f}`;
    }, [depPart, participantes]);

    useEffect(() => {
        const parts = form.getValues(`${base}.participantes`) || [];
        const predIdxsOf = (j: number) =>
            (depPart[fields[j]?.id] || [])
                .map((id) => fields.findIndex((x) => x.id === id))
                .filter((k) => k >= 0 && k !== j);
        for (let pass = 0; pass < fields.length; pass++) {
            let algo = false;
            for (let j = 0; j < parts.length; j++) {
                const preds = predIdxsOf(j);
                if (!preds.length) continue;
                let minIni: Date | null = null;
                preds.forEach((k) => {
                    const pf = parseLocalDate(parts[k]?.fecha_fin_actividad || '');
                    if (pf) {
                        const cand = addDays(pf, 1);
                        if (!minIni || cand > minIni) minIni = cand;
                    }
                });
                const depIni = parseLocalDate(parts[j]?.fecha_inicio_actividad || '');
                if (!minIni || !depIni) continue;
                const delta = differenceInCalendarDays(minIni, depIni);
                if (delta > 0) {
                    const ini = parts[j].fecha_inicio_actividad;
                    const fin = parts[j].fecha_fin_actividad;
                    if (ini) form.setValue(`${base}.participantes.${j}.fecha_inicio_actividad`, shiftDateString(ini, delta), { shouldValidate: true, shouldDirty: true });
                    if (fin) form.setValue(`${base}.participantes.${j}.fecha_fin_actividad`, shiftDateString(fin, delta), { shouldValidate: true, shouldDirty: true });
                    parts[j] = form.getValues(`${base}.participantes.${j}`);
                    algo = true;
                }
            }
            if (!algo) break;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firmaDepPart]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                <FormField
                    control={form.control}
                    name={`${base}.nombre_actividad`}
                    render={({ field }) => (
                        <FormItem className="min-w-[200px] lg:flex-[3]">
                            <FormLabel>Nombre de la Actividad</FormLabel>
                            <FormControl>
                                <Input placeholder="Ej: Levantamiento de requerimientos" maxLength={MAX_LEN_200} {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormItem className="min-w-[240px] lg:flex-[2]">
                    <FormLabel>Fecha Inicio - Fin</FormLabel>
                    <FormControl>
                        <DateRangePicker
                            startValue={fechaInicio}
                            endValue={fechaFin}
                            onChange={handleRangoActividad}
                            disabled={isLoading}
                            minDate={minDate}
                            maxDate={maxDate}
                        />
                    </FormControl>
                    {fechaError && <p className="text-sm font-medium text-destructive">{fechaError.message}</p>}
                </FormItem>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive hover:text-destructive lg:mt-8"
                    onClick={onRemove}
                    disabled={!canRemove}
                    aria-label="Eliminar actividad"
                    title="Eliminar actividad"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>

            <FormField
                control={form.control}
                name={`${base}.descripcion_actividad`}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Descripción</FormLabel>
                        <FormControl>
                            <Textarea placeholder="Detalle de la actividad" maxLength={MAX_LEN_200} {...field} />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">{field.value?.length ?? 0}/{MAX_LEN_200} caracteres</p>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium">
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                    Depende de (opcional)
                </label>
                {opcionesDependencia.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Agrega otra actividad para poder marcar dependencias.</p>
                ) : (
                    <>
                        <div className="flex flex-wrap gap-2">
                            {opcionesDependencia.map((o) => {
                                const activo = dependeDeIds.includes(o.id);
                                return (
                                    <button
                                        key={o.id}
                                        type="button"
                                        disabled={isLoading}
                                        onClick={() => onToggleDependeDe(o.id)}
                                        aria-pressed={activo}
                                        className={cn(
                                            'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
                                            activo
                                                ? 'border-primary bg-primary text-primary-foreground'
                                                : 'border-input bg-background text-muted-foreground hover:bg-muted'
                                        )}
                                    >
                                        {activo ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                                        <span className="max-w-[160px] truncate">{o.nombre}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {dependeDeIds.length > 0
                                ? 'Puedes seleccionar varias. Esta actividad comenzará después de que termine la última de ellas; si mueves alguna, se recalcula automáticamente.'
                                : 'Selecciona una o varias actividades que deben terminar antes de que esta comience.'}
                        </p>
                    </>
                )}
            </div>

            <div className="rounded-md border bg-muted/20 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                        Participantes <span className="font-normal text-muted-foreground">({fields.length} de {MAX_PARTICIPANTES})</span>
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={agregarParticipante}
                        disabled={isLoading || fields.length >= MAX_PARTICIPANTES || !fechaInicio || !fechaFin}
                        title={!fechaInicio || !fechaFin ? 'Define primero las fechas de la actividad' : undefined}
                    >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Agregar participante
                    </Button>
                </div>

                <div className="flex flex-col gap-3">
                    {fields.map((item, j) => {
                        const p = participantes[j];
                        const elegidos = new Set(participantes.filter((_, k) => k !== j).map((x) => x?.codigo_responsable));
                        const errP = errores?.participantes?.[j];
                        const opcDep = esCompartida ? opcionesPart(j) : [];
                        const depsDeEste = depPart[item.id] || [];
                        return (
                            <div key={item.id} className="flex flex-col gap-2 rounded-md border bg-card p-3">
                              <div className="flex flex-col gap-2 lg:flex-row lg:items-start">
                                <FormField
                                    control={form.control}
                                    name={`${base}.participantes.${j}.codigo_responsable`}
                                    render={({ field }) => (
                                        <FormItem className="min-w-[200px] lg:flex-[2]">
                                            <FormLabel className="text-xs">Responsable</FormLabel>
                                            <Select
                                                onValueChange={(value) => field.onChange(Number(value))}
                                                value={field.value ? String(field.value) : undefined}
                                                disabled={isLoading}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={isLoading ? 'Cargando...' : 'Seleccione'} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {responsables
                                                        .filter((r) => !elegidos.has(r.codigo_responsable))
                                                        .map((r) => (
                                                            <SelectItem key={r.codigo_responsable} value={String(r.codigo_responsable)}>
                                                                {etiquetaResponsable(r)}
                                                            </SelectItem>
                                                        ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {esCompartida && (
                                    <FormItem className="min-w-[220px] lg:flex-[2]">
                                        <FormLabel className="flex items-center gap-1.5 text-xs">
                                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorParticipante(j) }} />
                                            Su parte (fechas)
                                        </FormLabel>
                                        <DateRangePicker
                                            startValue={p?.fecha_inicio_actividad || ''}
                                            endValue={p?.fecha_fin_actividad || ''}
                                            onChange={(s, e) => handleRangoParticipante(j, s, e)}
                                            disabled={isLoading || !actividadInicio}
                                            minDate={actividadInicio}
                                            maxDate={actividadFin}
                                            rangoLabel="Dentro de la actividad"
                                            color={colorParticipante(j)}
                                        />
                                        {errP?.fecha_fin_actividad && (
                                            <p className="text-sm font-medium text-destructive">{errP.fecha_fin_actividad.message}</p>
                                        )}
                                    </FormItem>
                                )}

                                <div className="flex gap-4 lg:pt-6">
                                    {esCompartida && (
                                        <div className="text-center">
                                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Participación</p>
                                            <p className="text-sm font-semibold tabular-nums">{participacion[j] ?? 0}%</p>
                                        </div>
                                    )}
                                    <div className="text-center" title="Peso de esta parte en la carga total de la persona dentro del proyecto (calculado automáticamente)">
                                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Peso en proyecto</p>
                                        <p className="text-sm font-semibold tabular-nums">{p?.peso_actividad ?? 0}%</p>
                                    </div>
                                </div>

                                {fields.length > 1 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="shrink-0 text-destructive hover:text-destructive lg:mt-5"
                                        onClick={() => handleRemoveParticipante(j)}
                                        aria-label="Quitar participante"
                                        title="Quitar participante"
                                    >
                                        <UserMinus className="h-4 w-4" />
                                    </Button>
                                )}
                              </div>

                              {esCompartida && opcDep.length > 0 && (
                                <div className="flex flex-col gap-1.5 border-t pt-2">
                                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                        <Link2 className="h-3.5 w-3.5" /> Su parte depende de (opcional)
                                    </span>
                                    <div className="flex flex-wrap gap-2">
                                        {opcDep.map((o) => {
                                            const activo = depsDeEste.includes(o.id);
                                            return (
                                                <button
                                                    key={o.id}
                                                    type="button"
                                                    disabled={isLoading}
                                                    onClick={() => toggleDepPart(j, o.id)}
                                                    aria-pressed={activo}
                                                    className={cn(
                                                        'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
                                                        activo ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background text-muted-foreground hover:bg-muted'
                                                    )}
                                                >
                                                    {activo ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                                                    <span className="max-w-[160px] truncate">{o.nombre}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                              )}
                            </div>
                        );
                    })}
                </div>

                {esCompartida && (
                    <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        Actividad compartida: cada participante queda con su propia subactividad y se califica solo por su
                        parte. La participación se reparte según los días asignados a cada uno.
                    </p>
                )}
            </div>
        </div>
    );
}
