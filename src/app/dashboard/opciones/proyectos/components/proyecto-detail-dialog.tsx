
"use client";

import { useEffect, useMemo, useState } from 'react';
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
import type { FichaSocialHistorica, Responsable, ProyectoRecurso, Recurso, TipoRecurso, Resultado } from '@/types/interfaces';
import type { ProyectoView } from '../types';
import { formatearFecha } from '@/lib/fechas';
import { actividadesPrincipales, hijosPorPadre, participacionEnteraPorActividad } from '@/lib/actividades';
import { proyectoRecursoService } from '@/services/proyectos/proyectoRecurso.service';
import { recursoService } from '@/services/proyectos/recurso.service';
import { tipoRecursoService } from '@/services/proyectos/tipoRecurso.service';
import { resultadoService } from '@/services/proyectos/resultado.service';

const num = (s?: string) => { const n = parseFloat((s || '').replace(',', '.')); return Number.isNaN(n) ? 0 : n; };
const money = (n: number) => `$${n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const norm = (v: string) => (v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface RecursoFila { nombre: string; tipo: string; costo: number; valor: number; subtotal: number; }

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

    // Datos extra (recursos y resultado esperado) que se cargan al abrir el detalle de un proyecto.
    const [recursos, setRecursos] = useState<RecursoFila[]>([]);
    const [resultadoEsperado, setResultadoEsperado] = useState('');
    const codigoProyecto = view?.proyecto.codigo_proyecto ?? null;

    useEffect(() => {
        if (!codigoProyecto) { setRecursos([]); setResultadoEsperado(''); return; }
        let cancelado = false;
        (async () => {
            const settled = await Promise.allSettled([
                proyectoRecursoService.getAll(),
                recursoService.getAll(),
                tipoRecursoService.getAll(),
                resultadoService.getAll(),
            ]);
            if (cancelado) return;
            const datos = <T,>(r: PromiseSettledResult<{ data?: T[] }>): T[] => (r.status === 'fulfilled' ? (r.value.data || []) : []);
            const prList = datos<ProyectoRecurso>(settled[0]);
            const recList = datos<Recurso>(settled[1]);
            const tipoList = datos<TipoRecurso>(settled[2]);
            const resultList = datos<Resultado>(settled[3]);
            const recMap = new Map(recList.map((r) => [r.codigo_recurso, r]));
            const tipoMap = new Map(tipoList.map((t) => [t.codigo_tipo_recurso, t.nombre_recurso]));
            const filasRec = prList
                .filter((pr) => pr.codigo_proyecto === codigoProyecto && pr.estado === 'A')
                .map((pr) => {
                    const rec = recMap.get(pr.codigo_recurso);
                    const costo = num(rec?.costo);
                    const valor = num(pr.valor_recurso);
                    return { nombre: rec?.nombre_recurso || '—', tipo: tipoMap.get(rec?.codigo_tipo_recurso ?? 0) || '', costo, valor, subtotal: costo * valor };
                });
            setRecursos(filasRec);
            const esperado = resultList.find((r) => r.codigo_proyecto === codigoProyecto && norm(r.categoria_resultado).includes('esper'));
            setResultadoEsperado(esperado?.descripcion_resultado || '');
        })();
        return () => { cancelado = true; };
    }, [codigoProyecto]);

    const totalCosto = useMemo(() => recursos.reduce((s, r) => s + r.subtotal, 0), [recursos]);

    const filas = useMemo(() => {
        const actividades = view?.actividades || [];
        const hijos = hijosPorPadre(actividades);
        const participacion = participacionEnteraPorActividad(actividades);
        return actividadesPrincipales(actividades)
            .sort((a, b) => new Date(a.fecha_inicio_actividad).getTime() - new Date(b.fecha_inicio_actividad).getTime())
            .flatMap((a) => [
                { actividad: a, nivel: 0, participacion: null as number | null, compartida: hijos.has(a.codigo_actividad) },
                ...(hijos.get(a.codigo_actividad) || []).map((h) => ({
                    actividad: h, nivel: 1, participacion: participacion.get(h.codigo_actividad) ?? 0, compartida: false,
                })),
            ]);
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
                                <p className="text-xs font-medium text-muted-foreground">Objetivo Principal</p>
                                <p>{view.proyecto.objetivo_principal || '-'}</p>
                            </div>
                            {resultadoEsperado && (
                                <div className="col-span-2">
                                    <p className="text-xs font-medium text-muted-foreground">Resultados Esperados</p>
                                    <p>{resultadoEsperado}</p>
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
                                        {filas.map(({ actividad, nivel, participacion, compartida }) => (
                                            <TableRow key={actividad.codigo_actividad} className={nivel === 1 ? 'bg-muted/30' : undefined}>
                                                <TableCell className={nivel === 1 ? 'pl-8 text-xs text-muted-foreground' : 'font-medium'}>
                                                    {nivel === 1 ? `↳ Participación ${participacion}%` : actividad.nombre_actividad}
                                                </TableCell>
                                                <TableCell className={nivel === 1 ? 'text-xs' : undefined}>
                                                    {compartida ? <span className="text-xs text-muted-foreground">Compartida</span> : resolveResponsable(actividad.codigo_responsable)}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-xs">
                                                    {formatearFecha(actividad.fecha_inicio_actividad)} - {formatearFecha(actividad.fecha_fin_actividad)}
                                                </TableCell>
                                                <TableCell className="text-right">{compartida ? '—' : `${actividad.peso_actividad}%`}</TableCell>
                                                <TableCell>{compartida ? '' : actividad.estado_actividad}</TableCell>
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
