
"use client";

import { useMemo, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { calcularNotaRubrica, type Rubrica } from '@/lib/rubricas';
import { calificarPorcentaje } from '@/app/dashboard/opciones/misActividades/cumplimiento';

interface RubricaEvaluadorProps {
    rubrica: Rubrica;
    evaluadorAsignado: string;
    puntajesIniciales: Record<string, number>;
    isSaving: boolean;
    onGuardar: (puntajes: Record<string, number>) => void;
}

export default function RubricaEvaluador({ rubrica, evaluadorAsignado, puntajesIniciales, isSaving, onGuardar }: RubricaEvaluadorProps) {
    const [puntajes, setPuntajes] = useState<Record<string, number>>(puntajesIniciales);
    const { nota, pct, completa } = useMemo(() => calcularNotaRubrica(rubrica, puntajes), [rubrica, puntajes]);
    const { etiqueta, color } = calificarPorcentaje(pct);

    const elegir = (clave: string, valor: number) =>
        setPuntajes((prev) => ({ ...prev, [clave]: valor }));

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 px-4 py-3">
                <div>
                    <p className="text-sm font-medium">{rubrica.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                        Evaluador asignado: <strong>{evaluadorAsignado || 'No asignado'}</strong>
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Calificación</p>
                        <p className="text-3xl font-bold tabular-nums" style={{ color }}>{pct.toFixed(0)}%</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{nota.toFixed(2)} / 5.00</p>
                    </div>
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: color }}>
                        {etiqueta}
                    </span>
                </div>
            </div>

            {rubrica.criterios.map((c) => (
                <div key={c.clave} className="rounded-md border p-3">
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                            <p className="text-sm font-semibold">{c.grupo}</p>
                            {c.detalle && <p className="text-xs text-muted-foreground">{c.detalle}</p>}
                        </div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Peso {Math.round(c.peso * 100)}%</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {c.niveles.map((n) => {
                            const sel = puntajes[c.clave] === n.valor;
                            return (
                                <button
                                    key={n.valor}
                                    type="button"
                                    onClick={() => elegir(c.clave, n.valor)}
                                    aria-pressed={sel}
                                    className={cn(
                                        'flex flex-col gap-1 rounded-md border p-2 text-left text-xs transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                        sel ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-input'
                                    )}
                                >
                                    <span className="flex items-center gap-1.5 font-semibold">
                                        <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[11px]', sel ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                                            {sel ? <Check className="h-3 w-3" /> : n.valor}
                                        </span>
                                        Nivel {n.valor}
                                    </span>
                                    <span className="text-muted-foreground">{n.descripcion}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}

            <div className="flex items-center justify-end gap-3">
                {!completa && <span className="text-xs text-muted-foreground">Selecciona un nivel en cada criterio para guardar.</span>}
                <Button type="button" onClick={() => onGuardar(puntajes)} disabled={isSaving || !completa}>
                    {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando…</> : 'Guardar evaluación'}
                </Button>
            </div>
        </div>
    );
}
