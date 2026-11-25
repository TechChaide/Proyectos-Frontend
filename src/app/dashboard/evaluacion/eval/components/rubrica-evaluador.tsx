
"use client";

import { useMemo, useState } from 'react';
import { Check, ClipboardCheck, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { calcularNotaRubrica, type Rubrica } from '@/lib/rubricas';
import { calificarPorcentaje } from '@/app/dashboard/opciones/misActividades/cumplimiento';

/** Resultado esperado del proyecto (fila de `resultado`) con su verificación; cumple null = aún sin verificar. */
export interface ResultadoParaVerificar {
    codigo: number;
    descripcion: string;
    cumple: boolean | null;
}

interface RubricaEvaluadorProps {
    rubrica: Rubrica;
    evaluadorAsignado: string;
    puntajesIniciales: Record<string, number>;
    isSaving: boolean;
    /** Resultados esperados del proyecto: el comité verifica si se cumplieron antes de calificar la rúbrica. */
    resultadosEsperados: ResultadoParaVerificar[];
    onGuardar: (puntajes: Record<string, number>, cumplimientos: Record<number, boolean>) => void;
}

export default function RubricaEvaluador({ rubrica, evaluadorAsignado, puntajesIniciales, isSaving, resultadosEsperados, onGuardar }: RubricaEvaluadorProps) {
    const [puntajes, setPuntajes] = useState<Record<string, number>>(puntajesIniciales);
    // Verificación de cada resultado esperado (código → cumplió / no cumplió). Faltan = sin verificar.
    const [cumplimientos, setCumplimientos] = useState<Record<number, boolean>>(
        () => Object.fromEntries(resultadosEsperados.filter((r) => r.cumple !== null).map((r) => [r.codigo, r.cumple as boolean]))
    );
    const verificados = resultadosEsperados.filter((r) => cumplimientos[r.codigo] !== undefined).length;
    const cumplidos = resultadosEsperados.filter((r) => cumplimientos[r.codigo] === true).length;
    const resultadosCompletos = verificados === resultadosEsperados.length;
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

            {/* Paso previo: ¿se cumplieron los resultados esperados? La rúbrica se califica en función de esto. */}
            <div className="rounded-md border p-3">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                        <p className="flex items-center gap-1.5 text-sm font-semibold"><ClipboardCheck className="h-4 w-4 text-primary" /> Resultados esperados del proyecto</p>
                        <p className="text-xs text-muted-foreground">Verifica si cada resultado se cumplió. Luego califica la rúbrica en función de este cumplimiento.</p>
                    </div>
                    {resultadosEsperados.length > 0 && (
                        <span className="text-xs tabular-nums text-muted-foreground">
                            {resultadosCompletos ? <><strong className="text-foreground">{cumplidos} de {resultadosEsperados.length}</strong> cumplidos ({Math.round((cumplidos / resultadosEsperados.length) * 100)}%)</> : `${verificados} de ${resultadosEsperados.length} verificados`}
                        </span>
                    )}
                </div>
                {resultadosEsperados.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Este proyecto no registró resultados esperados.</p>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {resultadosEsperados.map((r, i) => {
                            const v = cumplimientos[r.codigo];
                            return (
                                <li key={r.codigo} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
                                    <p className="min-w-0 flex-1 text-sm"><span className="mr-1.5 font-medium tabular-nums text-muted-foreground">{i + 1}.</span>{r.descripcion}</p>
                                    <div className="flex shrink-0 gap-1.5" role="group" aria-label={`Verificación del resultado ${i + 1}`}>
                                        <button
                                            type="button"
                                            aria-pressed={v === true}
                                            onClick={() => setCumplimientos((prev) => ({ ...prev, [r.codigo]: true }))}
                                            className={cn('flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', v === true ? 'border-green-600 bg-green-600 text-white' : 'hover:bg-muted')}
                                        >
                                            <Check className="h-3.5 w-3.5" /> Cumplió
                                        </button>
                                        <button
                                            type="button"
                                            aria-pressed={v === false}
                                            onClick={() => setCumplimientos((prev) => ({ ...prev, [r.codigo]: false }))}
                                            className={cn('flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', v === false ? 'border-destructive bg-destructive text-destructive-foreground' : 'hover:bg-muted')}
                                        >
                                            <X className="h-3.5 w-3.5" /> No cumplió
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
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
                {!resultadosCompletos
                    ? <span className="text-xs text-muted-foreground">Verifica todos los resultados esperados para guardar.</span>
                    : !completa && <span className="text-xs text-muted-foreground">Selecciona un nivel en cada criterio para guardar.</span>}
                <Button type="button" onClick={() => onGuardar(puntajes, cumplimientos)} disabled={isSaving || !completa || !resultadosCompletos}>
                    {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando…</> : 'Guardar evaluación'}
                </Button>
            </div>
        </div>
    );
}
