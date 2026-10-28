
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AvanceProyecto } from '../cumplimiento';
import { calificarPorcentaje } from '../cumplimiento';
import Link from 'next/link';
import type { SistemaCalificacion } from '@/lib/rubricas';
import TipoBadge from './tipo-badge';

interface AvanceProyectosProps {
    avances: AvanceProyecto[];
    /** Tipo de cada proyecto (MR / MSP / PI / OI), para rotularlo y mostrar su evaluación. */
    sistemaPorProyecto?: Map<number, SistemaCalificacion | null>;
    /** Nota de rúbrica por proyecto (solo MR/MSP/PI evaluados). */
    evaluacionPorProyecto?: Map<number, { nota: number; pct: number; completa: boolean } | null>;
    /** Nombre del proceso de cada proyecto (se muestra en las tarjetas de calificación). */
    procesoPorProyecto?: Map<number, string>;
}

// Brecha entre lo hecho y lo que se esperaba a hoy: al día / leve atraso / atraso.
const colorBrecha = (brecha: number): string => {
    if (brecha >= 0) return '#16a34a';
    if (brecha >= -10) return '#f59e0b';
    return '#dc2626';
};

function Barra({ valor, color }: { valor: number; color: string }) {
    return (
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, valor))}%`, backgroundColor: color }} />
        </div>
    );
}

export default function AvanceProyectos({ avances, sistemaPorProyecto, evaluacionPorProyecto, procesoPorProyecto }: AvanceProyectosProps) {
    if (avances.length === 0) return null;

    // MR / MSP / PI se califican por rúbrica: de ellos solo interesa la calificación sobre 100%.
    const esRubrica = (codigo: number) => {
        const sistema = sistemaPorProyecto?.get(codigo);
        return !!sistema && sistema !== 'INDIVIDUAL';
    };
    const soloRubrica = avances.every((a) => esRubrica(a.codigoProyecto));

    return (
        <Card>
            <CardHeader>
                {soloRubrica ? (
                    <>
                        <CardTitle className="text-base">Calificación por proyecto</CardTitle>
                        <CardDescription>
                            Calificación por rúbrica, sobre 100%, asignada por el evaluador en{' '}
                            <Link href="/dashboard/evaluacion/eval" className="underline underline-offset-2">Evaluación</Link>.
                            Tú te enfocas en cerrar tus actividades a tiempo.
                        </CardDescription>
                    </>
                ) : (
                    <>
                        <CardTitle className="text-base">Mi avance por proyecto</CardTitle>
                        <CardDescription>
                            Efectivo: lo que ya completaste, ponderado por el peso de cada actividad. Esperado: lo que a hoy
                            deberías llevar según las fechas planificadas.
                        </CardDescription>
                    </>
                )}
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {avances.map((a) => {
                    if (esRubrica(a.codigoProyecto)) {
                        const ev = evaluacionPorProyecto?.get(a.codigoProyecto);
                        const cal = ev ? calificarPorcentaje(ev.pct) : null;
                        return (
                            <div
                                key={a.codigoProyecto}
                                className="flex items-center justify-between gap-3 rounded-md border p-4"
                                style={cal ? { borderColor: cal.color } : undefined}
                            >
                                <div className="min-w-0">
                                    <p className="flex items-start gap-2 font-medium leading-snug">
                                        <TipoBadge sistema={sistemaPorProyecto?.get(a.codigoProyecto)} />
                                        <span>{a.nombreProyecto}</span>
                                    </p>
                                    {procesoPorProyecto?.get(a.codigoProyecto) && (
                                        <p className="mt-1 text-xs text-muted-foreground">Proceso: {procesoPorProyecto.get(a.codigoProyecto)}</p>
                                    )}
                                </div>
                                {ev && cal ? (
                                    <div className="shrink-0 text-right" style={{ color: cal.color }}>
                                        <p className="text-3xl font-bold leading-none tabular-nums">{ev.pct.toFixed(0)}%</p>
                                        <p className="mt-1 text-xs font-medium">{cal.etiqueta}{ev.completa ? '' : ' (parcial)'}</p>
                                    </div>
                                ) : (
                                    <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">Pendiente de evaluación</span>
                                )}
                            </div>
                        );
                    }
                    const brecha = a.avanceEfectivo - a.avanceEsperado;
                    const color = colorBrecha(brecha);
                    return (
                        <div key={a.codigoProyecto} className="flex flex-col gap-3 rounded-md border p-4">
                            <div className="flex items-start justify-between gap-2">
                                <p className="flex items-start gap-2 font-medium leading-snug">
                                    <TipoBadge sistema={sistemaPorProyecto?.get(a.codigoProyecto)} />
                                    <span>{a.nombreProyecto}</span>
                                </p>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                    {a.completadas} de {a.totalActividades} actividades ({a.pctActividades.toFixed(0)}%)
                                </span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-xs">
                                    <span>Avance efectivo</span>
                                    <span className="font-semibold">{a.avanceEfectivo.toFixed(1)}%</span>
                                </div>
                                <Barra valor={a.avanceEfectivo} color={color} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-xs">
                                    <span>Avance esperado a hoy</span>
                                    <span className="font-semibold">{a.avanceEsperado.toFixed(1)}%</span>
                                </div>
                                <Barra valor={a.avanceEsperado} color="#94a3b8" />
                            </div>
                            <p className="text-xs font-medium" style={{ color }}>
                                {brecha >= 0
                                    ? `Al día (${brecha >= 0.05 ? '+' : ''}${brecha.toFixed(1)} pts)`
                                    : `${Math.abs(brecha).toFixed(1)} pts por debajo de lo esperado`}
                            </p>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
