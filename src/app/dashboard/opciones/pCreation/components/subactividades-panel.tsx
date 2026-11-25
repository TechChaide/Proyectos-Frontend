"use client";

import { useState } from 'react';
import { useFieldArray, useWatch, type UseFormReturn } from 'react-hook-form';
import { AlertCircle, Check, ChevronRight, CornerDownRight, ListChecks, ListTree, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatearFecha } from '@/lib/fechas';
import type { FichaSocialHistorica, Responsable } from '@/types/interfaces';
import { defaultParticipante, parseLocalDate, type ActividadWizardValues, type ProyectoWizardValues, type SubactividadWizardValues } from '../schema';
import ActividadCard from './actividad-card';

/** ¿La tarea (actividad sin subactividades o subactividad) tiene todo lo obligatorio? */
export const tareaCompleta = (t?: Pick<ActividadWizardValues, 'nombre_actividad' | 'descripcion_actividad' | 'fecha_inicio_actividad' | 'fecha_fin_actividad' | 'participantes'>): boolean => {
    if (!t) return false;
    if (!t.nombre_actividad?.trim() || !t.descripcion_actividad?.trim()) return false;
    if (!t.fecha_inicio_actividad || !t.fecha_fin_actividad) return false;
    const participantes = t.participantes || [];
    if (participantes.length === 0) return false;
    const compartida = participantes.length > 1;
    return participantes.every((p) => p?.codigo_responsable && (!compartida || (p.fecha_inicio_actividad && p.fecha_fin_actividad)));
};

export type ModoActividad = 'simple' | 'dividida';

interface ModoActividadSelectorProps {
    modo: ModoActividad;
    onCambiar: (modo: ModoActividad) => void;
    disabled?: boolean;
    /** Sin fechas aún: no se puede dividir (las subactividades deben quedar dentro del rango). */
    sinFechas?: boolean;
}

const OPCIONES_MODO: { modo: ModoActividad; titulo: string; detalle: string; icono: React.ComponentType<{ className?: string }> }[] = [
    { modo: 'simple', titulo: 'Una sola tarea', detalle: 'Los responsables y sus fechas van directo en la actividad.', icono: ListChecks },
    { modo: 'dividida', titulo: 'Con subactividades', detalle: 'La actividad se reparte en tareas, cada una con sus responsables y fechas dentro de la actividad.', icono: ListTree },
];

// Pregunta explícita de cómo se ejecuta la actividad. Dos tarjetas (radio): la opción elegida define qué se llena abajo.
export function ModoActividadSelector({ modo, onCambiar, disabled, sinFechas }: ModoActividadSelectorProps) {
    return (
        <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">¿Cómo se ejecuta esta actividad?</legend>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
                {OPCIONES_MODO.map((o) => {
                    const activo = modo === o.modo;
                    const bloqueada = o.modo === 'dividida' && !activo && sinFechas;
                    const Icono = o.icono;
                    return (
                        <button
                            key={o.modo}
                            type="button"
                            role="radio"
                            aria-checked={activo}
                            disabled={disabled || bloqueada}
                            onClick={() => !activo && onCambiar(o.modo)}
                            title={bloqueada ? 'Define primero las fechas de la actividad' : undefined}
                            className={cn(
                                'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                                activo ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'
                            )}
                        >
                            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', activo ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                                <Icono className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                                    {o.titulo}
                                    <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', activo ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30')}>
                                        {activo && <Check className="h-3 w-3" />}
                                    </span>
                                </span>
                                <span className="block text-xs text-muted-foreground">{o.detalle}</span>
                            </span>
                        </button>
                    );
                })}
            </div>
            {sinFechas && modo === 'simple' && <p className="text-xs text-muted-foreground">Para dividirla en subactividades, define primero las fechas de la actividad.</p>}
        </fieldset>
    );
}

interface SubactividadesPanelProps {
    form: UseFormReturn<ProyectoWizardValues>;
    index: number;
    responsables: Responsable[];
    personas: FichaSocialHistorica[];
    isLoading: boolean;
    /** Al quitar la última subactividad la actividad vuelve a ser una sola tarea. */
    onSinSubactividades: (ultima: SubactividadWizardValues) => void;
}

// Subactividades de una actividad (segundo y último nivel). Todas quedan dentro de las fechas de la actividad.
export default function SubactividadesPanel({ form, index, responsables, personas, isLoading, onSinSubactividades }: SubactividadesPanelProps) {
    const ruta = `actividades.${index}.subactividades` as const;
    const { fields, append, remove } = useFieldArray({ control: form.control, name: ruta });
    const subs = (useWatch({ control: form.control, name: ruta }) || []) as SubactividadWizardValues[];
    const actIni = useWatch({ control: form.control, name: `actividades.${index}.fecha_inicio_actividad` });
    const actFin = useWatch({ control: form.control, name: `actividades.${index}.fecha_fin_actividad` });
    const [abierta, setAbierta] = useState<number | null>(fields.length === 1 ? 0 : null);

    const minDate = parseLocalDate(actIni) ?? undefined;
    const maxDate = parseLocalDate(actFin) ?? undefined;

    const agregar = () => {
        append({ codigo_actividad: 0, nombre_actividad: '', descripcion_actividad: '', fecha_inicio_actividad: '', fecha_fin_actividad: '', participantes: [{ ...defaultParticipante }] });
        setAbierta(fields.length);
    };

    const quitar = (k: number) => {
        if (fields.length === 1) {
            onSinSubactividades(form.getValues(`${ruta}.${k}`) as SubactividadWizardValues);
            return;
        }
        remove(k);
        setAbierta((prev) => (prev === null ? null : prev === k ? null : prev > k ? prev - 1 : prev));
    };

    return (
        <div className="flex flex-col gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <p className="flex items-center gap-1.5 text-sm font-medium"><ListTree className="h-4 w-4 text-primary" /> Subactividades <span className="font-normal text-muted-foreground">({fields.length})</span></p>
                    <p className="text-xs text-muted-foreground">
                        Dentro de {actIni && actFin ? <strong className="text-foreground">{formatearFecha(actIni)} – {formatearFecha(actFin)}</strong> : 'las fechas de la actividad'}. Cada persona se califica por sus subactividades.
                    </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={agregar} disabled={isLoading}>
                    <Plus className="mr-2 h-4 w-4" /> Agregar subactividad
                </Button>
            </div>

            {fields.map((item, k) => {
                const s = subs[k];
                const completa = tareaCompleta(s);
                const abiertaEsta = abierta === k;
                return (
                    <div key={item.id} className={cn('rounded-md border bg-card', abiertaEsta && 'border-primary/50')}>
                        <button
                            type="button"
                            onClick={() => setAbierta(abiertaEsta ? null : k)}
                            aria-expanded={abiertaEsta}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <ChevronRight className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', abiertaEsta && 'rotate-90 text-primary')} />
                            <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="tabular-nums text-muted-foreground">{index + 1}.{k + 1}</span>
                            <span className={cn('min-w-0 flex-1 truncate font-medium', !s?.nombre_actividad?.trim() && 'font-normal text-muted-foreground')}>{s?.nombre_actividad?.trim() || 'Sin nombre'}</span>
                            <span className="hidden whitespace-nowrap text-xs tabular-nums text-muted-foreground sm:inline">
                                {s?.fecha_inicio_actividad && s?.fecha_fin_actividad ? `${formatearFecha(s.fecha_inicio_actividad)} – ${formatearFecha(s.fecha_fin_actividad)}` : '—'}
                            </span>
                            {completa
                                ? <Badge className="bg-green-600 hover:bg-green-600"><Check className="mr-1 h-3 w-3" /> Completa</Badge>
                                : <Badge variant="secondary" className="text-amber-700"><AlertCircle className="mr-1 h-3 w-3" /> Falta completar</Badge>}
                        </button>
                        {abiertaEsta && (
                            <div className="border-t p-3">
                                <ActividadCard
                                    key={item.id}
                                    form={form}
                                    index={index}
                                    ruta={`${ruta}.${k}`}
                                    etiqueta="Subactividad"
                                    responsables={responsables}
                                    personas={personas}
                                    isLoading={isLoading}
                                    onRemove={() => quitar(k)}
                                    canRemove
                                    minDate={minDate}
                                    maxDate={maxDate}
                                    rangoLabel="Dentro de la actividad"
                                    opcionesDependencia={[]}
                                    dependeDeIds={[]}
                                    onToggleDependeDe={() => {}}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
