
"use client";

import { useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from '@/components/ui/table';
import type { FichaSocialHistorica, Responsable } from '@/types/interfaces';
import type { ProyectoView } from '../types';
import { useProyectoDetalle } from '../use-proyecto-detalle';
import ObjetivosNiveles from './objetivos-niveles';
import { formatearFecha } from '@/lib/fechas';
import { actividadesPrincipales, esParticipacion, hijosPorPadre, participacionEnteraPorActividad } from '@/lib/actividades';
import type { Actividad } from '@/types/interfaces';

const money = (n: number) => `$${n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface ProyectoDetailDialogProps {
    view: ProyectoView | null;
    onOpenChange: (open: boolean) => void;
    responsables: Responsable[];
    personas: FichaSocialHistorica[];
}

export default function ProyectoDetailDialog({ view, onOpenChange, responsables, personas }: ProyectoDetailDialogProps) {
    const responsableMap = useMemo(() => new Map(responsables.map((r) => [r.codigo_responsable, r])), [responsables]);
    const personaMap = useMemo(() => new Map(personas.map((p) => [p.CODIGO, p])), [personas]);

    const resolveResponsable = (codigoResponsable: number): string => {
        const responsable = responsableMap.get(codigoResponsable);
        if (!responsable) return 'Sin responsable';
        const persona = personaMap.get(responsable.codigo_empleado);
        return persona?.NOMBRE || responsable.codigo_empleado;
    };

    // Recursos, resultado esperado, objetivos y alineación estratégica (compartido con Aprobaciones).
    const { recursos, totalCosto, resultadosEsperados, resultadosHijos, objetivos, alineacion } = useProyectoDetalle(view?.proyecto ?? null);

    const filas = useMemo(() => {
        const actividades = view?.actividades || [];
        const hijos = hijosPorPadre(actividades);
        const participacion = participacionEnteraPorActividad(actividades);
        const porInicio = (a: Actividad, b: Actividad) => new Date(a.fecha_inicio_actividad).getTime() - new Date(b.fecha_inicio_actividad).getTime();
        type Fila = { actividad: Actividad; nivel: number; tipo: 'actividad' | 'subactividad' | 'participacion'; participacion: number | null; contenedor: string | null };
        // Árbol: actividad → (participaciones | subactividades → participaciones).
        const filasDe = (a: Actividad, nivel: number, tipo: Fila['tipo']): Fila[] => {
            const hs = (hijos.get(a.codigo_actividad) || []).sort(porInicio);
            const partes = hs.filter((h) => esParticipacion(h, a));
            const subs = hs.filter((h) => !esParticipacion(h, a));
            const contenedor = subs.length ? `${subs.length} subactividad(es)` : partes.length ? 'Compartida' : null;
            return [
                { actividad: a, nivel, tipo, participacion: tipo === 'participacion' ? participacion.get(a.codigo_actividad) ?? 0 : null, contenedor },
                ...partes.map((h) => ({ actividad: h, nivel: nivel + 1, tipo: 'participacion' as const, participacion: participacion.get(h.codigo_actividad) ?? 0, contenedor: null })),
                ...subs.flatMap((h) => filasDe(h, nivel + 1, 'subactividad')),
            ];
        };
        return actividadesPrincipales(actividades).sort(porInicio).flatMap((a) => filasDe(a, 0, 'actividad'));
    }, [view]);
    const totalPrincipales = filas.filter((f) => f.nivel === 0).length;

    return (
        <Dialog open={!!view} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                {view && (
                    <>
                        <DialogHeader>
                            <DialogTitle>{view.proyecto.nombre_proyecto}</DialogTitle>
                            <DialogDescription>{view.proyecto.descripcion_proyecto || 'Sin descripción.'}</DialogDescription>
                        </DialogHeader>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Proceso</p>
                                <p>{view.areaNombre || '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Tipo de Proyecto</p>
                                <p>{view.tipoProyectoNombre || '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Responsable</p>
                                <p>{view.proyecto.responsable_proyecto || '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Estado de la Solicitud</p>
                                <div>
                                    {view.estadoSolicitudNombre
                                        ? <Badge variant="secondary">{view.estadoSolicitudNombre}</Badge>
                                        : '-'}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Fecha Inicio</p>
                                <p>{formatearFecha(view.proyecto.fecha_inicio)}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Fecha Fin</p>
                                <p>{formatearFecha(view.proyecto.fecha_fin)}</p>
                            </div>
                            {(view.padreNombre || view.subProyectosCount > 0) && (
                                <div className="col-span-2">
                                    <p className="text-xs font-medium text-muted-foreground">Jerarquía</p>
                                    <p>
                                        {view.padreNombre && `Sub-proyecto de: ${view.padreNombre}`}
                                        {view.padreNombre && view.subProyectosCount > 0 && ' · '}
                                        {view.subProyectosCount > 0 && `${view.subProyectosCount} sub-proyecto(s) asociado(s)`}
                                    </p>
                                </div>
                            )}
                            <div className="col-span-2">
                                <p className="text-xs font-medium text-muted-foreground">Alineación estratégica</p>
                                <p>{alineacion ? `${alineacion.pilar ? `${alineacion.pilar} → ` : ''}${alineacion.okr}` : 'Sin OKR asignado'}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Objetivos</p>
                                <ObjetivosNiveles principal={view.proyecto.objetivo_principal} secundarios={objetivos.map((o) => o.descripcion_objetivo)} />
                            </div>
                            {resultadosEsperados.length > 0 && (
                                <div className="col-span-2">
                                    <p className="text-xs font-medium text-muted-foreground">Resultados Esperados ({resultadosEsperados.length})</p>
                                    <ol className="list-decimal space-y-0.5 pl-5">
                                        {resultadosEsperados.map((r, i) => <li key={i}>{r}</li>)}
                                    </ol>
                                </div>
                            )}
                            {resultadosHijos.length > 0 && (
                                <div className="col-span-2">
                                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Alineación y resultados esperados de sus proyectos hijos ({resultadosHijos.reduce((n, h) => n + h.resultados.length, 0)})</p>
                                    <div className="flex flex-col gap-2">
                                        {resultadosHijos.map((h) => (
                                            <div key={h.proyecto}>
                                                <p className="text-xs font-medium">{h.proyecto} <span className="font-normal text-muted-foreground">· {h.alineacion}</span></p>
                                                {h.resultados.length > 0
                                                    ? <ol className="list-decimal space-y-0.5 pl-5">{h.resultados.map((r, i) => <li key={i}>{r}</li>)}</ol>
                                                    : <p className="text-xs text-muted-foreground">Sin resultados esperados.</p>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {recursos.length > 0 && (
                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <p className="text-sm font-medium">Recursos ({recursos.length})</p>
                                    <p className="text-sm">Costo total: <strong className="tabular-nums">{money(totalCosto)}</strong></p>
                                </div>
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Recurso</TableHead>
                                                <TableHead>Tipo</TableHead>
                                                <TableHead className="text-right">Costo unit.</TableHead>
                                                <TableHead className="text-right">Cantidad</TableHead>
                                                <TableHead className="text-right">Subtotal</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {recursos.map((r, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="font-medium">{r.nombre}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{r.tipo || '—'}</TableCell>
                                                    <TableCell className="text-right tabular-nums">{money(r.costo)}</TableCell>
                                                    <TableCell className="text-right tabular-nums">{r.valor}</TableCell>
                                                    <TableCell className="text-right tabular-nums">{money(r.subtotal)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        <div>
                            <p className="mb-2 text-sm font-medium">Actividades ({totalPrincipales})</p>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nombre</TableHead>
                                            <TableHead>Responsable</TableHead>
                                            <TableHead>Fechas</TableHead>
                                            <TableHead className="text-right">Peso</TableHead>
                                            <TableHead>Estado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filas.map(({ actividad, nivel, tipo, participacion, contenedor }) => (
                                            <TableRow key={actividad.codigo_actividad} className={nivel > 0 ? 'bg-muted/30' : undefined}>
                                                <TableCell className={tipo === 'actividad' ? 'font-medium' : tipo === 'subactividad' ? 'text-sm' : 'text-xs text-muted-foreground'} style={{ paddingLeft: 16 + nivel * 18 }}>
                                                    {tipo === 'participacion' ? `↳ Participación ${participacion}%` : tipo === 'subactividad' ? `↳ ${actividad.nombre_actividad}` : actividad.nombre_actividad}
                                                </TableCell>
                                                <TableCell className={nivel > 0 ? 'text-xs' : undefined}>
                                                    {contenedor ? <span className="text-xs text-muted-foreground">{contenedor}</span> : resolveResponsable(actividad.codigo_responsable)}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-xs">
                                                    {formatearFecha(actividad.fecha_inicio_actividad)} - {formatearFecha(actividad.fecha_fin_actividad)}
                                                </TableCell>
                                                <TableCell className="text-right">{contenedor ? '—' : `${actividad.peso_actividad}%`}</TableCell>
                                                <TableCell>{contenedor ? '' : actividad.estado_actividad}</TableCell>
                                            </TableRow>
                                        ))}
                                        {filas.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-16 text-center text-sm text-muted-foreground">
                                                    Este proyecto no tiene actividades registradas.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
