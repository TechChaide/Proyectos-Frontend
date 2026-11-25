"use client";

import { useMemo, useState } from 'react';
import { Boxes, Check, ChevronRight, ClipboardCheck, FolderKanban, Pencil, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Resultado } from '@/types/interfaces';
import { RUBRICAS, type SistemaCalificacion } from '@/lib/rubricas';
import { puntajesDeProyecto, type NodoEvaluacion } from '@/lib/evaluacion-proyectos';
import { formatearFecha } from '@/lib/fechas';
import { cn } from '@/lib/utils';
import { calificarPorcentaje } from '@/app/dashboard/opciones/misActividades/cumplimiento';

const COLUMNAS = 'lg:grid-cols-[minmax(0,3fr)_minmax(0,1.3fr)_minmax(0,2.2fr)_minmax(0,1.5fr)_8rem]';

interface TablaEvaluacionProps {
    arbol: NodoEvaluacion[];
    resultados: Resultado[];
    onEvaluar: (nodo: NodoEvaluacion) => void;
    /** Convierte los códigos guardados del evaluador en nombres. */
    nombresEvaluadores: (crudo: string) => string;
    /** "Pilar › OKR" de un proyecto. */
    alineacionDe: (codigoOkr: number | null) => string;
}

const contar = (nodos: NodoEvaluacion[]): number => nodos.reduce((s, n) => s + 1 + contar(n.hijos), 0);
const idsConHijos = (nodos: NodoEvaluacion[]): number[] => nodos.flatMap((n) => (n.hijos.length ? [n.proyecto.codigo_proyecto, ...idsConHijos(n.hijos)] : []));

// Calificación 0-5 con barra de color y etiqueta (mismo semáforo que el resto del sistema).
function Calificacion({ nodo }: { nodo: NodoEvaluacion }) {
    if (nodo.nota === null) {
        return <span className="text-xs text-muted-foreground">{nodo.esIntegrador ? 'Sin hijos calificados' : 'Sin calificar'}</span>;
    }
    const pct = (nodo.nota / 5) * 100;
    const { etiqueta, color } = calificarPorcentaje(pct);
    return (
        <div className="flex items-center gap-3">
            <div className="shrink-0">
                <p className="text-lg font-bold leading-none tabular-nums" style={{ color }}>{nodo.nota.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">de 5.00 · {pct.toFixed(0)}%</p>
            </div>
            <div className="min-w-0 flex-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${pct.toFixed(0)}%`}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }} />
                </div>
                <span className="mt-1 inline-block rounded-full px-1.5 py-px text-[10px] font-medium text-white" style={{ backgroundColor: color }}>{etiqueta}</span>
            </div>
        </div>
    );
}

interface FilaProps {
    nodo: NodoEvaluacion;
    nivel: number;
    abiertos: Set<number>;
    alternar: (codigo: number) => void;
    resultados: Resultado[];
    onEvaluar: (nodo: NodoEvaluacion) => void;
    nombresEvaluadores: (crudo: string) => string;
    alineacionDe: (codigoOkr: number | null) => string;
}

const esEsperado = (r: Resultado) => (r.categoria_resultado || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes('esper');

function Fila({ nodo, nivel, abiertos, alternar, resultados, onEvaluar, nombresEvaluadores, alineacionDe }: FilaProps) {
    const p = nodo.proyecto;
    const abierto = abiertos.has(p.codigo_proyecto);
    const puedeExpandir = nodo.hijos.length > 0 || nodo.esIntegrador || !!nodo.sistema;
    const nombreSistema = nodo.sistema && nodo.sistema !== 'INDIVIDUAL' ? nodo.sistema : null;

    const estado = nodo.esIntegrador
        ? (nodo.hijosTotal === 0
            ? { texto: 'Sin hijos', clase: 'text-muted-foreground' }
            : nodo.hijosCalificados === nodo.hijosTotal
                ? { texto: 'Completo', clase: 'bg-green-600 text-white' }
                : { texto: `Parcial · ${nodo.hijosCalificados} de ${nodo.hijosTotal}`, clase: 'bg-amber-500/15 text-amber-800 dark:text-amber-300' })
        : nodo.nota === null
            ? { texto: 'Pendiente', clase: 'bg-amber-500/15 text-amber-800 dark:text-amber-300' }
            : nodo.rubricaCompleta
                ? { texto: 'Calificado', clase: 'bg-green-600 text-white' }
                : { texto: 'Incompleto', clase: 'bg-amber-500/15 text-amber-800 dark:text-amber-300' };

    const puntajes = nombreSistema ? puntajesDeProyecto(resultados, p.codigo_proyecto, nodo.sistema) : {};
    const evaluador = resultados.find((r) => r.codigo_proyecto === p.codigo_proyecto && r.evaluador_asignado)?.evaluador_asignado || '';
    // Resultados esperados con su verificación (solo cuando el proyecto ya fue calificado).
    const esperados = resultados
        .filter((r) => r.codigo_proyecto === p.codigo_proyecto && (r.categoria_resultado || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes('esper'))
        .sort((a, b) => a.codigo_resultado - b.codigo_resultado);
    const verificados = nodo.nota !== null;
    const cumplidos = esperados.filter((r) => r.cumple_propuesta).length;
    const ventana = resultados.find((r) => r.codigo_proyecto === p.codigo_proyecto && r.fecha_inicio_evaluacion && r.fecha_fin_evaluacion);

    return (
        <div className={cn(nivel > 0 && 'ml-4 border-l pl-3 sm:ml-6 sm:pl-4')}>
            <div className={cn('rounded-lg border bg-card transition-shadow', abierto ? 'border-primary/40 shadow-md' : 'hover:shadow-sm')}>
                <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={puedeExpandir ? abierto : undefined}
                    onClick={() => puedeExpandir && alternar(p.codigo_proyecto)}
                    onKeyDown={(e) => { if (puedeExpandir && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); alternar(p.codigo_proyecto); } }}
                    className={cn('grid cursor-pointer items-center gap-x-4 gap-y-2 rounded-lg p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', COLUMNAS, !puedeExpandir && 'cursor-default')}
                >
                    {/* Proyecto */}
                    <div className="flex min-w-0 items-start gap-2">
                        {puedeExpandir
                            ? <ChevronRight className={cn('mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform', abierto && 'rotate-90 text-primary')} />
                            : <span className="w-4 shrink-0" />}
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium leading-snug">
                                {p.nombre_proyecto}
                                {nodo.esIntegrador
                                    ? <Badge variant="secondary" className="gap-1 font-normal"><Boxes className="h-3 w-3" /> Integrador</Badge>
                                    : <Badge variant="outline" className="gap-1 font-normal"><FolderKanban className="h-3 w-3" /> Independiente</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {formatearFecha(p.fecha_inicio)} – {formatearFecha(p.fecha_fin)}
                                {nodo.hijosTotal > 0 && ` · ${nodo.hijosTotal} ${nodo.hijosTotal === 1 ? 'hijo' : 'hijos'}`}
                            </p>
                        </div>
                    </div>

                    {/* Tipo / sistema de calificación */}
                    <div className="text-xs text-muted-foreground">
                        {nodo.esIntegrador ? 'Promedio de hijos' : nombreSistema ? RUBRICAS[nombreSistema as 'MR' | 'MSP' | 'PI'].nombre : nodo.sistema === 'INDIVIDUAL' ? 'Objetivo Individual' : 'Sin rúbrica'}
                    </div>

                    {/* Calificación */}
                    <Calificacion nodo={nodo} />

                    {/* Estado de la evaluación */}
                    <div><span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium', estado.clase)}>{estado.texto}</span></div>

                    {/* Acción: solo los independientes con rúbrica se califican a mano */}
                    <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                        {nombreSistema ? (
                            <Button size="sm" variant={nodo.nota === null ? 'default' : 'outline'} onClick={() => onEvaluar(nodo)}>
                                {nodo.nota === null ? <ClipboardCheck className="mr-1.5 h-4 w-4" /> : <Pencil className="mr-1.5 h-4 w-4" />}
                                {nodo.nota === null ? 'Evaluar' : 'Editar'}
                            </Button>
                        ) : nodo.esIntegrador ? (
                            <span className="text-[11px] text-muted-foreground">Automática</span>
                        ) : null}
                    </div>
                </div>

                {/* Panel expandido */}
                {abierto && (
                    <div className="flex flex-col gap-3 border-t bg-muted/20 p-3">
                        {nodo.esIntegrador ? (
                            <div className="rounded-md border bg-card px-3 py-2 text-sm">
                                <p className="font-medium">Promedio simple de los proyectos hijos (escala 0 a 5)</p>
                                {nodo.hijosCalificados > 0 && nodo.nota !== null ? (
                                    <p className="text-xs text-muted-foreground tabular-nums">
                                        ({nodo.hijos.filter((h) => h.nota !== null).map((h) => (h.nota as number).toFixed(2)).join(' + ')}) ÷ {nodo.hijosCalificados} = <strong className="text-foreground">{nodo.nota.toFixed(2)}</strong>
                                    </p>
                                ) : (
                                    <p className="text-xs text-muted-foreground">Aún no hay hijos calificados.</p>
                                )}
                                {nodo.hijosCalificados < nodo.hijosTotal && (
                                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                                        Faltan por calificar {nodo.hijosTotal - nodo.hijosCalificados} de {nodo.hijosTotal} hijos; el promedio se recalcula al calificarlos.
                                    </p>
                                )}
                                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 border-t pt-2 text-xs text-muted-foreground">
                                    <span>Evaluador(es): <strong>{nombresEvaluadores(evaluador) || 'No asignado'}</strong></span>
                                    <span>Periodo de evaluación: <strong>{ventana ? `${formatearFecha(ventana.fecha_inicio_evaluacion)} – ${formatearFecha(ventana.fecha_fin_evaluacion)}` : 'No definido'}</strong></span>
                                </p>
                                {/* El integrador no tiene alineación ni resultados propios: reúne los de sus hijos aprobados. */}
                                {nodo.hijos.length > 0 && (
                                    <div className="mt-2 border-t pt-2">
                                        <p className="mb-1 text-xs font-medium">Alineación y resultados esperados de sus hijos</p>
                                        <ul className="divide-y rounded-md border">
                                            {nodo.hijos.map((h) => {
                                                const esp = resultados.filter((r) => r.codigo_proyecto === h.proyecto.codigo_proyecto && esEsperado(r)).sort((a, b) => a.codigo_resultado - b.codigo_resultado);
                                                const ok = esp.filter((r) => r.cumple_propuesta).length;
                                                return (
                                                    <li key={h.proyecto.codigo_proyecto} className="flex flex-col gap-1 px-3 py-2">
                                                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                                                            <span className="font-medium">{h.proyecto.nombre_proyecto}</span>
                                                            <span className="text-xs text-muted-foreground">{alineacionDe(h.proyecto.codigo_okr)}</span>
                                                        </div>
                                                        {esp.length === 0 ? (
                                                            <p className="text-xs text-muted-foreground">Sin resultados esperados.</p>
                                                        ) : (
                                                            <ul className="flex flex-col gap-0.5 text-xs">
                                                                {esp.map((r) => (
                                                                    <li key={r.codigo_resultado} className="flex items-start justify-between gap-3">
                                                                        <span className="min-w-0 flex-1">• {r.descripcion_resultado}</span>
                                                                        {h.nota !== null && (r.cumple_propuesta
                                                                            ? <span className="flex shrink-0 items-center gap-1 font-medium text-green-700 dark:text-green-400"><Check className="h-3 w-3" /> Cumplió</span>
                                                                            : <span className="flex shrink-0 items-center gap-1 font-medium text-destructive"><X className="h-3 w-3" /> No cumplió</span>)}
                                                                    </li>
                                                                ))}
                                                                {h.nota !== null && <li className="text-muted-foreground tabular-nums">{ok} de {esp.length} cumplidos</li>}
                                                            </ul>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ) : nombreSistema ? (
                            <div className="flex flex-col gap-3">
                            <div className="rounded-md border bg-card">
                                <p className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 text-sm font-medium">
                                    <span>Resultados esperados ({esperados.length})</span>
                                    {verificados && esperados.length > 0 && <span className="text-xs font-normal text-muted-foreground tabular-nums"><strong className="text-foreground">{cumplidos} de {esperados.length}</strong> cumplidos ({Math.round((cumplidos / esperados.length) * 100)}%)</span>}
                                </p>
                                {esperados.length === 0 ? (
                                    <p className="px-3 py-2 text-xs text-muted-foreground">Este proyecto no registró resultados esperados.</p>
                                ) : (
                                    <ul className="divide-y">
                                        {esperados.map((r, i) => (
                                            <li key={r.codigo_resultado} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                                                <span className="min-w-0 flex-1"><span className="mr-1.5 tabular-nums text-muted-foreground">{i + 1}.</span>{r.descripcion_resultado}</span>
                                                {verificados ? (
                                                    r.cumple_propuesta
                                                        ? <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400"><Check className="h-3.5 w-3.5" /> Cumplió</span>
                                                        : <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-destructive"><X className="h-3.5 w-3.5" /> No cumplió</span>
                                                ) : (
                                                    <span className="shrink-0 text-xs text-muted-foreground">Sin verificar</span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div className="rounded-md border bg-card">
                                <p className="border-b px-3 py-2 text-sm font-medium">Calificación por criterio · {RUBRICAS[nombreSistema as 'MR' | 'MSP' | 'PI'].nombre}</p>
                                <ul className="divide-y">
                                    {RUBRICAS[nombreSistema as 'MR' | 'MSP' | 'PI'].criterios.map((c) => {
                                        const v = puntajes[c.clave];
                                        const nivel = c.niveles.find((n) => n.valor === v);
                                        return (
                                            <li key={c.clave} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2 text-sm">
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-medium">{c.grupo}</p>
                                                    <p className="text-xs text-muted-foreground">{nivel ? nivel.descripcion : 'Sin calificar'}</p>
                                                </div>
                                                <div className="shrink-0 text-right text-xs text-muted-foreground">
                                                    <span className="text-base font-semibold tabular-nums text-foreground">{v ?? '—'}</span> · peso {Math.round(c.peso * 100)}%
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                                <p className="flex flex-wrap gap-x-4 gap-y-0.5 border-t px-3 py-1.5 text-xs text-muted-foreground">
                                    <span>Evaluador(es): <strong>{nombresEvaluadores(evaluador) || 'No asignado'}</strong></span>
                                    <span>Periodo de evaluación: <strong>{ventana ? `${formatearFecha(ventana.fecha_inicio_evaluacion)} – ${formatearFecha(ventana.fecha_fin_evaluacion)}` : 'No definido'}</strong></span>
                                </p>
                            </div>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">Este proyecto no usa una rúbrica de evaluación (se califica por sus actividades).</p>
                        )}

                        {/* Hijos: cada uno se puede expandir a su vez (niveles consecutivos) */}
                        {nodo.hijos.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proyectos hijos ({nodo.hijos.length})</p>
                                {nodo.hijos.map((h) => (
                                    <Fila key={h.proyecto.codigo_proyecto} nodo={h} nivel={nivel + 1} abiertos={abiertos} alternar={alternar} resultados={resultados} onEvaluar={onEvaluar} nombresEvaluadores={nombresEvaluadores} alineacionDe={alineacionDe} />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// Tabla de evaluación: una fila-tarjeta por proyecto. Los integradores se expanden para mostrar sus hijos (y estos, los
// suyos), con el promedio simple de las calificaciones; los independientes muestran su rúbrica.
export default function TablaEvaluacion({ arbol, resultados, onEvaluar, nombresEvaluadores, alineacionDe }: TablaEvaluacionProps) {
    const [abiertos, setAbiertos] = useState<Set<number>>(new Set());
    const alternar = (codigo: number) =>
        setAbiertos((prev) => {
            const sig = new Set(prev);
            if (sig.has(codigo)) sig.delete(codigo);
            else sig.add(codigo);
            return sig;
        });
    const ids = useMemo(() => idsConHijos(arbol), [arbol]);
    const todosAbiertos = ids.length > 0 && ids.every((i) => abiertos.has(i));
    const total = useMemo(() => contar(arbol), [arbol]);

    return (
        <section aria-label="Proyectos a evaluar" className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground"><strong className="text-foreground">{total}</strong> {total === 1 ? 'proyecto' : 'proyectos'} en {arbol.length} {arbol.length === 1 ? 'grupo principal' : 'grupos principales'}</p>
                {ids.length > 0 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAbiertos(todosAbiertos ? new Set() : new Set(ids))}>
                        {todosAbiertos ? 'Contraer todo' : 'Expandir todo'}
                    </Button>
                )}
            </div>

            <div className={cn('hidden gap-x-4 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:grid', COLUMNAS)}>
                <span className="pl-6">Proyecto</span>
                <span>Modo de evaluación</span>
                <span>Calificación (0 a 5)</span>
                <span>Estado</span>
                <span className="text-right">Acción</span>
            </div>

            {arbol.map((n) => (
                <Fila key={n.proyecto.codigo_proyecto} nodo={n} nivel={0} abiertos={abiertos} alternar={alternar} resultados={resultados} onEvaluar={onEvaluar} nombresEvaluadores={nombresEvaluadores} alineacionDe={alineacionDe} />
            ))}
        </section>
    );
}
