
"use client";

import { useMemo, useRef, useState } from 'react';
import {
    addDays,
    eachDayOfInterval,
    eachMonthOfInterval,
    eachWeekOfInterval,
    endOfMonth,
    format,
    getWeek,
    isWeekend,
    max as maxFecha,
    min as minFecha,
    startOfMonth,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Activity, AlertTriangle, CheckCircle2, Clock, CircleDot, CornerDownRight, Layers, Link2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { aFechaSegura, formatearFecha, hoyEcuador } from '@/lib/fechas';
import { ESTILO_ESTADO_VISUAL, ORDEN_ESTADOS, type EstadoVisual } from '@/lib/estado-visual';

export interface GanttFila {
    id: string;
    nombre: string;
    /** Segunda línea en la columna de nombres (persona, rol, etc.). */
    detalle?: string;
    inicio: string | Date;
    fin: string | Date;
    /** Estado de la barra. "contenedor" = actividad padre con subactividades (muestra avance). */
    estado: EstadoVisual | 'contenedor';
    /** 0 = actividad, 1 = subactividad (participante). */
    nivel?: 0 | 1;
    /** Avance 0-1 (solo contenedores). */
    progreso?: number;
    /** Texto al final de la barra, p. ej. la participación "50%". */
    etiquetaFin?: string;
    /** Líneas extra para el tooltip. */
    tooltip?: string[];
    /** Id de bloque: las filas con el mismo valor se dibujan agrupadas como una sola actividad compartida. */
    bloque?: string;
    /** Color propio de la barra/acento (categórico por actividad). Si se omite, se usa el color del estado. */
    color?: string;
    /** Id(s) de la(s) fila(s) de la(s) que depende (predecesoras): dibuja un conector de fin→inicio. */
    dependeDe?: string | string[];
}

export interface GanttGrupo {
    id: string;
    titulo?: string;
    filas: GanttFila[];
}

interface GanttProps {
    grupos: GanttGrupo[];
    titulo?: string;
    descripcion?: string;
    vacio?: string;
    /** Muestra el % de avance en las actividades compartidas. En creación de proyecto va en false. */
    mostrarAvance?: boolean;
}

const MS_DIA = 24 * 60 * 60 * 1000;
const ANCHO_NOMBRES = 280;
const ALTO_FILA = 44;
const ALTO_BARRA = 18;
const ALTO_TITULO_GRUPO = 32;
type Escala = 'dia' | 'semana' | 'mes';
const ANCHO_COLUMNA: Record<Escala, number> = { dia: 34, semana: 64, mes: 110 };

// Colores de "tinta" y cuadrícula (recesivos): el color se reserva para el estado.
const TINTA_SECUNDARIA = '#52514e';
const CUADRICULA = '#e1e0d9';
const TRACK_CONTENEDOR = '#e9e8e3';
const ACENTO_BLOQUE = '#8a8780';      // acento del bloque de actividad compartida
const CONECTOR = '#9a9790';           // línea de dependencia

const ICONO_ESTADO: Record<EstadoVisual, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
    completada: CheckCircle2,
    completada_atraso: Clock,
    vencida: AlertTriangle,
    en_ejecucion: Activity,
    pendiente: CircleDot,
};

const elegirEscala = (dias: number): Escala => (dias <= 45 ? 'dia' : dias <= 200 ? 'semana' : 'mes');

interface Tooltip {
    fila: GanttFila;
    x: number;
    y: number;
}

export default function Gantt({ grupos, titulo = 'Diagrama de Gantt', descripcion, vacio = 'No hay actividades con fechas para mostrar.', mostrarAvance = true }: GanttProps) {
    const contenedorRef = useRef<HTMLDivElement>(null);
    const [tooltip, setTooltip] = useState<Tooltip | null>(null);

    const filas = useMemo(() => grupos.flatMap((g) => g.filas), [grupos]);

    const escala = useMemo(() => {
        if (filas.length === 0) return null;
        const inicios = filas.map((f) => aFechaSegura(f.inicio));
        const fines = filas.map((f) => aFechaSegura(f.fin));
        const minimo = minFecha(inicios);
        const maximo = maxFecha(fines);
        const totalDias = Math.max(1, (maximo.getTime() - minimo.getTime()) / MS_DIA);
        const tipo = elegirEscala(totalDias);

        let desde: Date;
        let hasta: Date;
        let columnas: { key: string; etiqueta: string; inicio: Date; finDeSemana?: boolean }[];
        if (tipo === 'dia') {
            desde = addDays(minimo, -1);
            hasta = addDays(maximo, 1);
            columnas = eachDayOfInterval({ start: desde, end: hasta }).map((d) => ({
                key: d.toISOString(), etiqueta: format(d, 'd'), inicio: d, finDeSemana: isWeekend(d),
            }));
        } else if (tipo === 'semana') {
            desde = addDays(minimo, -7);
            hasta = addDays(maximo, 7);
            // Semana del AÑO (1..52/53): la primera semana de enero es la 1. Se muestra el nº de semana
            // bajo la banda de meses, para que la vista compacta sea legible con rangos largos.
            columnas = eachWeekOfInterval({ start: desde, end: hasta }, { weekStartsOn: 1 }).map((d) => ({
                key: d.toISOString(), etiqueta: `S${getWeek(d, { weekStartsOn: 1, firstWeekContainsDate: 1 })}`, inicio: d,
            }));
            desde = columnas[0].inicio;
            hasta = addDays(columnas[columnas.length - 1].inicio, 6);
        } else {
            desde = startOfMonth(minimo);
            hasta = endOfMonth(maximo);
            columnas = eachMonthOfInterval({ start: desde, end: hasta }).map((d) => ({
                key: d.toISOString(), etiqueta: format(d, 'MMM', { locale: es }), inicio: d,
            }));
        }

        const anchoLinea = columnas.length * ANCHO_COLUMNA[tipo];
        const totalMs = hasta.getTime() + MS_DIA - desde.getTime();
        const xDe = (fecha: Date) => ((fecha.getTime() - desde.getTime()) / totalMs) * anchoLinea;

        // Banda superior de meses (en escala día/semana) o de años (en escala mes).
        const bandas = (tipo === 'mes'
            ? Array.from(new Set(columnas.map((c) => c.inicio.getFullYear()))).map((anio) => {
                const ini = maxFecha([new Date(anio, 0, 1), desde]);
                const fin = minFecha([new Date(anio, 11, 31), hasta]);
                return { key: `a${anio}`, etiqueta: String(anio), x: xDe(ini), ancho: xDe(addDays(fin, 1)) - xDe(ini) };
            })
            : eachMonthOfInterval({ start: desde, end: hasta }).map((m) => {
                const ini = maxFecha([m, desde]);
                const fin = minFecha([endOfMonth(m), hasta]);
                return { key: m.toISOString(), etiqueta: format(m, 'MMMM yyyy', { locale: es }), x: xDe(ini), ancho: xDe(addDays(fin, 1)) - xDe(ini) };
            }));

        const hoy = hoyEcuador();
        const xHoy = hoy >= desde && hoy <= hasta ? xDe(hoy) + (tipo === 'dia' ? ANCHO_COLUMNA.dia / 2 : 0) : null;

        return { tipo, columnas, anchoLinea, xDe, bandas, xHoy };
    }, [filas]);

    // En la leyenda de estados solo contamos las filas que usan el color del estado (no las categóricas).
    const estadosPresentes = useMemo(() => {
        const set = new Set(filas.filter((f) => !f.color).map((f) => f.estado));
        return { estados: ORDEN_ESTADOS.filter((e) => set.has(e)), contenedor: set.has('contenedor') };
    }, [filas]);

    const predecesorasDe = (f: GanttFila): string[] =>
        Array.isArray(f.dependeDe) ? f.dependeDe : f.dependeDe ? [f.dependeDe] : [];

    const hayDependencias = useMemo(() => filas.some((f) => predecesorasDe(f).length > 0), [filas]);
    const hayBloques = useMemo(() => filas.some((f) => !!f.bloque), [filas]);

    // Geometría vertical del cuerpo (sin encabezado): posición de cada fila para dibujar conectores
    // de dependencia. Coordenadas X en absoluto (incluyen la columna de nombres).
    const layout = useMemo(() => {
        const mapa = new Map<string, { top: number; x0: number; x1: number; centro: number }>();
        if (!escala) return { mapa, alto: 0 };
        let y = 0;
        grupos.forEach((g) => {
            if (g.titulo) y += ALTO_TITULO_GRUPO;
            g.filas.forEach((f) => {
                const x0 = ANCHO_NOMBRES + escala.xDe(aFechaSegura(f.inicio));
                const x1 = ANCHO_NOMBRES + escala.xDe(addDays(aFechaSegura(f.fin), 1));
                mapa.set(f.id, { top: y, x0, x1, centro: y + ALTO_FILA / 2 });
                y += ALTO_FILA;
            });
        });
        return { mapa, alto: y };
    }, [grupos, escala]);

    const conectores = useMemo(() => {
        if (!escala) return [];
        return filas.flatMap((f) => {
            if (!layout.mapa.has(f.id)) return [];
            const dep = layout.mapa.get(f.id)!;
            return predecesorasDe(f)
                .filter((predId) => layout.mapa.has(predId))
                .map((predId) => {
                    const pred = layout.mapa.get(predId)!;
                    return { id: `${f.id}<-${predId}`, x0: pred.x1, y0: pred.centro, salida: pred.x1 + 11, y1: dep.centro, x1: dep.x0 };
                });
        });
    }, [filas, layout, escala]);

    const mostrarTooltip = (e: React.MouseEvent, fila: GanttFila) => {
        const rect = contenedorRef.current?.getBoundingClientRect();
        if (!rect) return;
        setTooltip({ fila, x: e.clientX - rect.left + 12, y: e.clientY - rect.top + 12 });
    };

    const renderBarra = (fila: GanttFila) => {
        if (!escala) return null;
        const inicio = aFechaSegura(fila.inicio);
        const fin = aFechaSegura(fila.fin);
        const x = escala.xDe(inicio);
        const ancho = Math.max(10, escala.xDe(addDays(fin, 1)) - x);
        const top = (ALTO_FILA - ALTO_BARRA) / 2;

        const eventos = {
            onMouseEnter: (e: React.MouseEvent) => mostrarTooltip(e, fila),
            onMouseMove: (e: React.MouseEvent) => mostrarTooltip(e, fila),
            onMouseLeave: () => setTooltip(null),
        };

        if (fila.estado === 'contenedor') {
            const progreso = Math.max(0, Math.min(1, fila.progreso ?? 0));
            const colorTrack = fila.color ? `${fila.color}22` : TRACK_CONTENEDOR;
            const colorFill = fila.color ?? ESTILO_ESTADO_VISUAL.completada.color;
            return (
                <>
                    {/* Zona de hover más grande que la marca */}
                    <div className="absolute cursor-default" style={{ left: x, width: ancho, top: 4, bottom: 4 }} {...eventos} />
                    <div className="pointer-events-none absolute overflow-hidden rounded" style={{ left: x, width: ancho, top, height: ALTO_BARRA, backgroundColor: colorTrack }}>
                        <div className="h-full" style={{ width: `${progreso * 100}%`, backgroundColor: colorFill }} />
                    </div>
                    {mostrarAvance && (
                        <span className="pointer-events-none absolute whitespace-nowrap text-xs font-medium tabular-nums" style={{ left: x + ancho + 8, top: top + 1, color: TINTA_SECUNDARIA }}>
                            {Math.round(progreso * 100)}% avance
                        </span>
                    )}
                </>
            );
        }

        const colorBarra = fila.color ?? ESTILO_ESTADO_VISUAL[fila.estado].color;
        return (
            <>
                <div className="absolute cursor-default" style={{ left: x, width: ancho, top: 4, bottom: 4 }} {...eventos} />
                <div
                    className="pointer-events-none absolute rounded"
                    style={{ left: x, width: ancho, top, height: ALTO_BARRA, backgroundColor: colorBarra }}
                />
                {fila.etiquetaFin && (
                    <span className="pointer-events-none absolute whitespace-nowrap text-xs font-medium tabular-nums" style={{ left: x + ancho + 8, top: top + 1, color: TINTA_SECUNDARIA }}>
                        {fila.etiquetaFin}
                    </span>
                )}
            </>
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">{titulo}</CardTitle>
                {descripcion && <CardDescription>{descripcion}</CardDescription>}
            </CardHeader>
            <CardContent>
                {!escala ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">{vacio}</p>
                ) : (
                    <div ref={contenedorRef} className="relative">
                        <div className="overflow-x-auto rounded-md border" style={{ borderColor: CUADRICULA }}>
                            <div style={{ width: ANCHO_NOMBRES + escala.anchoLinea, minWidth: '100%' }}>
                                {/* Encabezado: banda de meses/años + escala */}
                                <div className="flex border-b bg-muted/40" style={{ borderColor: CUADRICULA }}>
                                    <div className="sticky left-0 z-20 flex shrink-0 items-end border-r bg-muted/40 px-3 pb-2 text-xs font-medium text-muted-foreground backdrop-blur" style={{ width: ANCHO_NOMBRES, borderColor: CUADRICULA }}>
                                        Actividad
                                    </div>
                                    <div className="relative" style={{ width: escala.anchoLinea }}>
                                        <div className="relative h-6 border-b" style={{ borderColor: CUADRICULA }}>
                                            {escala.bandas.map((b) => (
                                                <div key={b.key} className="absolute top-0 flex h-full items-center border-l px-2 text-xs font-semibold capitalize text-foreground" style={{ left: b.x, width: b.ancho, borderColor: CUADRICULA }}>
                                                    <span className="truncate">{b.etiqueta}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex h-7">
                                            {escala.columnas.map((c) => (
                                                <div
                                                    key={c.key}
                                                    className={cn('flex shrink-0 items-center justify-center border-l text-[11px] capitalize tabular-nums text-muted-foreground', c.finDeSemana && 'bg-muted/60')}
                                                    style={{ width: ANCHO_COLUMNA[escala.tipo], borderColor: CUADRICULA }}
                                                >
                                                    {c.etiqueta}
                                                </div>
                                            ))}
                                        </div>
                                        {escala.xHoy !== null && (
                                            <span className="absolute bottom-0.5 z-10 -translate-x-1/2 rounded bg-foreground px-1.5 py-px text-[10px] font-semibold text-background" style={{ left: escala.xHoy }}>
                                                Hoy
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Cuerpo: filas + capa de conectores de dependencia */}
                                <div className="relative">
                                    {conectores.length > 0 && (
                                        <svg
                                            className="pointer-events-none absolute left-0 top-0 z-[5]"
                                            width={ANCHO_NOMBRES + escala.anchoLinea}
                                            height={layout.alto}
                                        >
                                            <defs>
                                                <marker id="gantt-flecha" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
                                                    <path d="M0,0 L6,3 L0,6 Z" fill={CONECTOR} />
                                                </marker>
                                            </defs>
                                            {conectores.map((c) => (
                                                <path
                                                    key={c.id}
                                                    d={`M ${c.x0} ${c.y0} H ${c.salida} V ${c.y1} H ${Math.max(c.x1 - 2, c.salida)}`}
                                                    fill="none"
                                                    stroke={CONECTOR}
                                                    strokeWidth={1.5}
                                                    markerEnd="url(#gantt-flecha)"
                                                />
                                            ))}
                                        </svg>
                                    )}

                                    {grupos.map((grupo) => (
                                        <div key={grupo.id}>
                                            {grupo.titulo && (
                                                <div className="flex border-b bg-muted/20" style={{ borderColor: CUADRICULA, height: ALTO_TITULO_GRUPO }}>
                                                    <div className="sticky left-0 z-10 flex shrink-0 items-center border-r bg-muted/20 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur" style={{ width: ANCHO_NOMBRES, borderColor: CUADRICULA }}>
                                                        <span className="line-clamp-1">{grupo.titulo}</span>
                                                    </div>
                                                    <div style={{ width: escala.anchoLinea }} />
                                                </div>
                                            )}
                                            {grupo.filas.map((fila, j) => {
                                                const esSub = fila.nivel === 1;
                                                const Icono = fila.estado === 'contenedor' ? Layers : ICONO_ESTADO[fila.estado];
                                                const colorIcono = fila.color ?? (fila.estado === 'contenedor' ? TINTA_SECUNDARIA : ESTILO_ESTADO_VISUAL[fila.estado].color);
                                                const enBloque = !!fila.bloque;
                                                const inicioBloque = enBloque && grupo.filas[j - 1]?.bloque !== fila.bloque;
                                                const finBloque = enBloque && grupo.filas[j + 1]?.bloque !== fila.bloque;
                                                const acento = fila.color ?? ACENTO_BLOQUE;
                                                // Bordes: línea de cuadrícula normal entre filas; marco de 2px del color de la
                                                // actividad arriba/abajo del bloque. El acento lateral marca todo el bloque.
                                                const estiloFila: React.CSSProperties = { height: ALTO_FILA, borderBottomColor: CUADRICULA };
                                                if (inicioBloque) { estiloFila.borderTopWidth = 2; estiloFila.borderTopColor = acento; }
                                                if (finBloque) { estiloFila.borderBottomWidth = 2; estiloFila.borderBottomColor = acento; }
                                                return (
                                                    <div
                                                        key={fila.id}
                                                        className="group flex border-b last:border-b-0 hover:bg-muted/30"
                                                        style={estiloFila}
                                                    >
                                                        <div
                                                            className={cn('sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r bg-card group-hover:bg-muted/40', enBloque && 'bg-muted/20')}
                                                            style={{
                                                                width: ANCHO_NOMBRES,
                                                                borderColor: CUADRICULA,
                                                                paddingLeft: esSub ? 28 : 12,
                                                                borderLeft: enBloque ? `3px solid ${acento}` : undefined,
                                                            }}
                                                        >
                                                            {esSub && <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                                                            <Icono className="h-3.5 w-3.5 shrink-0" style={{ color: colorIcono }} />
                                                            <div className="min-w-0">
                                                                <p className={cn('truncate text-sm', esSub ? 'font-normal' : 'font-medium')}>{fila.nombre}</p>
                                                                {fila.detalle && <p className="truncate text-xs text-muted-foreground">{fila.detalle}</p>}
                                                            </div>
                                                        </div>
                                                        <div className={cn('relative', enBloque && 'bg-muted/10')} style={{ width: escala.anchoLinea }}>
                                                            <div className="absolute inset-0 flex">
                                                                {escala.columnas.map((c) => (
                                                                    <div key={c.key} className={cn('shrink-0 border-l', c.finDeSemana && 'bg-muted/40')} style={{ width: ANCHO_COLUMNA[escala.tipo], borderColor: CUADRICULA }} />
                                                                ))}
                                                            </div>
                                                            {escala.xHoy !== null && (
                                                                <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-foreground/40" style={{ left: escala.xHoy }} />
                                                            )}
                                                            {renderBarra(fila)}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {tooltip && (
                            <div
                                className="pointer-events-none absolute z-30 w-64 rounded-md border bg-popover p-3 text-xs shadow-lg"
                                style={{ left: tooltip.x, top: tooltip.y }}
                            >
                                <p className="mb-1 text-sm font-semibold text-foreground">{tooltip.fila.nombre}</p>
                                {tooltip.fila.detalle && <p className="text-muted-foreground">{tooltip.fila.detalle}</p>}
                                <p className="mt-1 tabular-nums text-foreground">
                                    {formatearFecha(tooltip.fila.inicio)} – {formatearFecha(tooltip.fila.fin)}
                                </p>
                                {tooltip.fila.estado === 'contenedor' ? (
                                    mostrarAvance ? (
                                        <p className="mt-1 text-foreground">Avance: {Math.round((tooltip.fila.progreso ?? 0) * 100)}%</p>
                                    ) : (
                                        <p className="mt-1 text-muted-foreground">Actividad compartida</p>
                                    )
                                ) : (
                                    <p className="mt-1 flex items-center gap-1.5 text-foreground">
                                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ESTILO_ESTADO_VISUAL[tooltip.fila.estado].color }} />
                                        {ESTILO_ESTADO_VISUAL[tooltip.fila.estado].etiqueta}
                                    </p>
                                )}
                                {tooltip.fila.tooltip?.map((linea) => (
                                    <p key={linea} className="mt-1 text-muted-foreground">{linea}</p>
                                ))}
                            </div>
                        )}

                        {/* Leyenda: ícono + color + etiqueta (nunca solo color) */}
                        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                            {estadosPresentes.estados.map((e) => {
                                const Icono = ICONO_ESTADO[e];
                                return (
                                    <span key={e} className="flex items-center gap-1.5">
                                        <span className="inline-block h-2.5 w-5 rounded-sm" style={{ backgroundColor: ESTILO_ESTADO_VISUAL[e].color }} />
                                        <Icono className="h-3.5 w-3.5" style={{ color: ESTILO_ESTADO_VISUAL[e].color }} />
                                        {ESTILO_ESTADO_VISUAL[e].etiqueta}
                                    </span>
                                );
                            })}
                            {(estadosPresentes.contenedor || hayBloques) && (
                                <span className="flex items-center gap-1.5">
                                    <span className="inline-block h-3 w-5 rounded-sm border-2" style={{ borderColor: ACENTO_BLOQUE }} />
                                    <Layers className="h-3.5 w-3.5" />
                                    Actividad compartida (un bloque)
                                </span>
                            )}
                            {hayDependencias && (
                                <span className="flex items-center gap-1.5">
                                    <Link2 className="h-3.5 w-3.5" style={{ color: CONECTOR }} />
                                    Dependencia (una tras otra)
                                </span>
                            )}
                            {escala.xHoy !== null && (
                                <span className="flex items-center gap-1.5">
                                    <span className="inline-block h-0 w-5 border-t-2 border-dashed border-foreground/40" />
                                    Hoy ({formatearFecha(hoyEcuador())})
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
