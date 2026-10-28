
"use client";

import { useMemo, useState } from 'react';
import { Building, CalendarRange, Check, Clock, Eye, FolderKanban, Loader2, User, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { EstadoSolicitud } from '@/types/interfaces';
import { estadoSolicitudService } from '@/services/proyectos/estadoSolicitud.service';
import { useProyectoViews } from '../proyectos/use-proyecto-views';
import ProyectoDetailDialog from '../proyectos/components/proyecto-detail-dialog';
import { sortProyectoViewsByHierarchy, type ProyectoView } from '../proyectos/types';
import { actividadesPrincipales } from '@/lib/actividades';
import { ahoraSQL, formatearFecha } from '@/lib/fechas';

const normalize = (v: string): string => (v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const esPendiente = (nombre: string) => normalize(nombre).includes('pendiente') && normalize(nombre).includes('aprob');

// Bandeja de aprobación: lista los proyectos cuya solicitud está "Pendiente de aprobación" y permite
// aprobarlos o rechazarlos (registra un nuevo estado_solicitud; sin motivo, según lo acordado).
// NOTA: el control por perfil (quién puede aprobar) queda pendiente de definir con el analista.
export default function AprobacionesPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const { proyectoViews, estados, responsables, personas, isLoading, recargar } = useProyectoViews();
    const [procesando, setProcesando] = useState<number | null>(null);
    const [detailView, setDetailView] = useState<ProyectoView | null>(null);

    const estadoAprobado = useMemo(
        () => estados.find((e) => e.estado === 'A' && normalize(e.nombre_estado).includes('aprob') && !normalize(e.nombre_estado).includes('pendiente')) || null,
        [estados]
    );
    const estadoRechazado = useMemo(
        () => estados.find((e) => e.estado === 'A' && normalize(e.nombre_estado).includes('rechaz')) || null,
        [estados]
    );

    const pendientes = useMemo(
        () => sortProyectoViewsByHierarchy(proyectoViews.filter((v) => esPendiente(v.estadoSolicitudNombre))),
        [proyectoViews]
    );

    const faltanEstados = !estadoAprobado || !estadoRechazado;

    const resolver = async (view: ProyectoView, aprobar: boolean) => {
        const estado = aprobar ? estadoAprobado : estadoRechazado;
        if (!estado) return;
        setProcesando(view.proyecto.codigo_proyecto);
        try {
            await estadoSolicitudService.save({
                codigo_estado_solicitud: 0,
                codigo_estado: estado.codigo_estado,
                codigo_solicitud: view.proyecto.codigo_solicitud,
                estado: 'A',
                usuario_modificacion: user?.usuario || 'admin',
                fecha_modificacion: ahoraSQL(),
            } as EstadoSolicitud);
            toast({
                title: aprobar ? 'Proyecto aprobado' : 'Proyecto rechazado',
                description: `"${view.proyecto.nombre_proyecto}" quedó como ${estado.nombre_estado}.`,
            });
            recargar();
        } catch (error) {
            const mensaje = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
            toast({ title: 'Error al guardar', description: mensaje, variant: 'destructive' });
        } finally {
            setProcesando(null);
        }
    };

    return (
        <div className="flex flex-col gap-4 p-4 md:p-6">
            <Card>
                <CardHeader>
                    <CardTitle>Aprobaciones</CardTitle>
                    <CardDescription>
                        Proyectos cuya solicitud está pendiente de aprobación. Revísalos y apruébalos o recházalos.
                    </CardDescription>
                </CardHeader>
            </Card>

            {faltanEstados && !isLoading && (
                <Card className="border-destructive">
                    <CardContent className="py-4 text-sm text-destructive">
                        Faltan estados en el catálogo: se necesitan <strong>"Aprobado"</strong> y <strong>"Rechazado"</strong> para poder resolver las solicitudes. Créalos en el catálogo de estados.
                    </CardContent>
                </Card>
            )}

            {isLoading ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-56 w-full rounded-lg" />
                    ))}
                </div>
            ) : pendientes.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                        No hay solicitudes pendientes de aprobación.
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {pendientes.map((view) => {
                        const p = view.proyecto;
                        const enProceso = procesando === p.codigo_proyecto;
                        const numActividades = actividadesPrincipales(view.actividades).length;
                        return (
                            <Card key={p.codigo_proyecto} className="flex flex-col">
                                <CardHeader className="space-y-2">
                                    <Badge variant="secondary" className="w-fit text-amber-700">
                                        <Clock className="mr-1 h-3 w-3" /> Pendiente de aprobación
                                    </Badge>
                                    <CardTitle className="text-base leading-snug">{p.nombre_proyecto}</CardTitle>
                                    {view.padreNombre && (
                                        <p className="text-xs text-muted-foreground">Sub-proyecto de: {view.padreNombre}</p>
                                    )}
                                </CardHeader>
                                <CardContent className="flex flex-1 flex-col gap-2 text-xs text-muted-foreground">
                                    <p className="line-clamp-2 text-sm text-muted-foreground">
                                        {p.descripcion_proyecto || 'Sin descripción.'}
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                        <Building className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{view.areaNombre}{view.tipoProyectoNombre ? ` · ${view.tipoProyectoNombre}` : ''}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <User className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{p.responsable_proyecto || 'Sin responsable'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                                        <span>{formatearFecha(p.fecha_inicio)} - {formatearFecha(p.fecha_fin)}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                                        <span>{numActividades} {numActividades === 1 ? 'actividad' : 'actividades'}</span>
                                    </div>
                                    {view.usuarioCreacion && (
                                        <p className="text-[11px] text-muted-foreground">Solicitado por: {view.usuarioCreacion}</p>
                                    )}

                                    <div className="mt-auto flex flex-col gap-2 pt-3">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="w-full"
                                            onClick={() => setDetailView(view)}
                                        >
                                            <Eye className="mr-1 h-4 w-4" />
                                            Ver detalle del proyecto
                                        </Button>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                className="flex-1 bg-green-600 hover:bg-green-700"
                                                disabled={enProceso || faltanEstados}
                                                onClick={() => resolver(view, true)}
                                            >
                                                {enProceso ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                                                Aprobar
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                className="flex-1"
                                                disabled={enProceso || faltanEstados}
                                                onClick={() => resolver(view, false)}
                                            >
                                                <X className="mr-1 h-4 w-4" />
                                                Rechazar
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            <ProyectoDetailDialog
                view={detailView}
                onOpenChange={(open) => !open && setDetailView(null)}
                responsables={responsables}
                personas={personas}
            />
        </div>
    );
}
