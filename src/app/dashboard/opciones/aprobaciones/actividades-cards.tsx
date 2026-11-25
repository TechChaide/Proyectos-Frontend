"use client";

import { useMemo } from 'react';
import { CalendarRange, CornerDownRight, ListTree, Users } from 'lucide-react';
import type { Actividad, FichaSocialHistorica, Responsable } from '@/types/interfaces';
import { actividadesPrincipales, duracionDias, esParticipacion, hijosPorPadre, participacionEnteraPorActividad } from '@/lib/actividades';
import { aFechaSegura, formatearFecha } from '@/lib/fechas';
import { colorDeActividad } from '../pCreation/components/gantt-chart';

interface ActividadesCardsProps {
    actividades: Actividad[];
    responsables: Responsable[];
    personas: FichaSocialHistorica[];
}

// Actividades del proyecto como tarjetas: nombre, fechas, descripción y, por cada responsable, su peso. En las
// compartidas se detalla cada participante con su participación y su peso.
export default function ActividadesCards({ actividades, responsables, personas }: ActividadesCardsProps) {
    const responsableMap = useMemo(() => new Map(responsables.map((r) => [r.codigo_responsable, r])), [responsables]);
    const personaMap = useMemo(() => new Map(personas.map((p) => [p.CODIGO, p])), [personas]);
    const nombreDe = (codigo: number) => {
        const r = responsableMap.get(codigo);
        if (!r) return 'Sin responsable';
        return personaMap.get(r.codigo_empleado)?.NOMBRE || r.codigo_empleado;
    };

    const hijos = useMemo(() => hijosPorPadre(actividades), [actividades]);
    const participacion = useMemo(() => participacionEnteraPorActividad(actividades), [actividades]);
    const principales = useMemo(
        () => actividadesPrincipales(actividades).sort((a, b) => aFechaSegura(a.fecha_inicio_actividad).getTime() - aFechaSegura(b.fecha_inicio_actividad).getTime()),
        [actividades]
    );

    if (principales.length === 0) {
        return <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">Este proyecto no tiene actividades registradas.</p>;
    }

    return (
        <div className="grid gap-3 md:grid-cols-2">
            {principales.map((a, i) => {
                const hs = hijos.get(a.codigo_actividad) || [];
                const partes = hs.filter((h) => esParticipacion(h, a));
                const subs = hs.filter((h) => !esParticipacion(h, a)).sort((x, y) => aFechaSegura(x.fecha_inicio_actividad).getTime() - aFechaSegura(y.fecha_inicio_actividad).getTime());
                const color = colorDeActividad(i);
                return (
                    <article key={a.codigo_actividad} className="flex flex-col gap-3 rounded-lg border border-l-4 bg-card p-4" style={{ borderLeftColor: color }}>
                        <header>
                            <p className="font-semibold leading-snug">{a.nombre_actividad}</p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                                {formatearFecha(a.fecha_inicio_actividad)} – {formatearFecha(a.fecha_fin_actividad)}
                                <span>· {duracionDias(a.fecha_inicio_actividad, a.fecha_fin_actividad)} días</span>
                            </p>
                        </header>
                        {a.descripcion_actividad && <p className="line-clamp-3 text-sm text-muted-foreground">{a.descripcion_actividad}</p>}

                        {subs.length > 0 ? (
                            <div className="mt-auto flex flex-col gap-1.5">
                                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                    <ListTree className="h-3.5 w-3.5" /> {subs.length} subactividad(es)
                                </p>
                                {subs.map((sub) => {
                                    const partesSub = (hijos.get(sub.codigo_actividad) || []).filter((h) => esParticipacion(h, sub));
                                    const quienes = partesSub.length ? partesSub : [sub];
                                    return (
                                        <div key={sub.codigo_actividad} className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                                            <p className="flex items-center gap-1.5 font-medium"><CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />{sub.nombre_actividad}</p>
                                            <p className="pl-5 text-[11px] text-muted-foreground">{formatearFecha(sub.fecha_inicio_actividad)} – {formatearFecha(sub.fecha_fin_actividad)}</p>
                                            <div className="mt-1 flex flex-col gap-0.5 pl-5">
                                                {quienes.map((h) => (
                                                    <div key={h.codigo_actividad} className="flex items-center justify-between gap-3 text-xs">
                                                        <span className="truncate">{nombreDe(h.codigo_responsable)}</span>
                                                        <span className="shrink-0 text-muted-foreground">
                                                            {partesSub.length > 1 && <>Part. <strong className="text-foreground tabular-nums">{participacion.get(h.codigo_actividad) ?? 0}%</strong>{' · '}</>}
                                                            Peso <strong className="text-foreground tabular-nums">{h.peso_actividad}%</strong>
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : partes.length === 0 ? (
                            <div className="mt-auto flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2 text-sm">
                                <span className="truncate font-medium">{nombreDe(a.codigo_responsable)}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">Peso <strong className="text-foreground tabular-nums">{a.peso_actividad}%</strong></span>
                            </div>
                        ) : (
                            <div className="mt-auto flex flex-col gap-1.5">
                                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                    <Users className="h-3.5 w-3.5" /> Actividad compartida · {partes.length} participantes
                                </p>
                                {partes.map((h) => (
                                    <div key={h.codigo_actividad} className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="truncate font-medium">{nombreDe(h.codigo_responsable)}</span>
                                            <span className="shrink-0 text-xs text-muted-foreground">
                                                Part. <strong className="text-foreground tabular-nums">{participacion.get(h.codigo_actividad) ?? 0}%</strong>
                                                {' · '}Peso <strong className="text-foreground tabular-nums">{h.peso_actividad}%</strong>
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground">{formatearFecha(h.fecha_inicio_actividad)} – {formatearFecha(h.fecha_fin_actividad)}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </article>
                );
            })}
        </div>
    );
}
