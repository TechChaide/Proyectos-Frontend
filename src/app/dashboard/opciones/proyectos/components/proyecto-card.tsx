
"use client";

import { Building, CalendarRange, CheckCircle2, Clock, CornerDownRight, Edit, Flag, HelpCircle, ListChecks, Package, User, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProyectoView } from '../types';
import { formatearFecha } from '@/lib/fechas';
import { actividadesPrincipales } from '@/lib/actividades';

// Indicador visual del estado de la solicitud del proyecto: Pendiente de aprobación → Aprobado / Rechazado.
const normalizar = (v: string) => (v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function estiloEstadoSolicitud(nombre: string): { color: string; texto: string; Icono: typeof Clock; etiqueta: string } {
    const n = normalizar(nombre);
    if (n.includes('pendiente') && n.includes('aprob')) return { color: '#fab219', texto: '#0b0b0b', Icono: Clock, etiqueta: nombre || 'Pendiente de aprobación' };
    if (n.includes('rechaz')) return { color: '#d03b3b', texto: '#ffffff', Icono: XCircle, etiqueta: nombre || 'Rechazado' };
    if (n.includes('aprob')) return { color: '#0ca30c', texto: '#ffffff', Icono: CheckCircle2, etiqueta: nombre || 'Aprobado' };
    return { color: '#52514e', texto: '#ffffff', Icono: HelpCircle, etiqueta: nombre || 'Sin estado' };
}

interface ProyectoCardProps {
    view: ProyectoView;
    onViewDetail: () => void;
    onEdit?: () => void;
    onRecursos?: () => void;
    onEstado?: () => void;
    mostrarArea?: boolean;
}

export default function ProyectoCard({ view, onViewDetail, onEdit, onRecursos, onEstado, mostrarArea = false }: ProyectoCardProps) {
    const { proyecto, estadoSolicitudNombre, tipoProyectoNombre, actividades, padreNombre, subProyectosCount } = view;
    const estadoEstilo = estiloEstadoSolicitud(estadoSolicitudNombre);

    return (
        <Card
            className={padreNombre ? 'flex flex-col ml-4 border-l-4 lg:ml-6' : 'flex flex-col border-l-4'}
            style={{ borderLeftColor: estadoEstilo.color }}
        >
            <CardHeader className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge className="gap-1" style={{ backgroundColor: estadoEstilo.color, color: estadoEstilo.texto }}>
                        <estadoEstilo.Icono className="h-3 w-3" />
                        {estadoEstilo.etiqueta}
                    </Badge>
                    {tipoProyectoNombre && <Badge variant="outline">{tipoProyectoNombre}</Badge>}
                    <Badge variant={proyecto.estado === 'A' ? 'outline' : 'destructive'}>
                        {proyecto.estado === 'A' ? 'Activo' : 'Inactivo'}
                    </Badge>
                    {subProyectosCount > 0 && (
                        <Badge variant="outline">{subProyectosCount} sub-{subProyectosCount === 1 ? 'proyecto' : 'proyectos'}</Badge>
                    )}
                </div>
                {padreNombre && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CornerDownRight className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Sub-proyecto de: {padreNombre}</span>
                    </div>
                )}
                <CardTitle className="text-base leading-snug">{proyecto.nombre_proyecto}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-2">
                <p className="line-clamp-2 text-sm text-muted-foreground">
                    {proyecto.descripcion_proyecto || 'Sin descripción.'}
                </p>
                {mostrarArea && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Building className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{view.areaNombre}</span>
                    </div>
                )}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{proyecto.responsable_proyecto || 'Sin responsable asignado'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                    <span>{formatearFecha(proyecto.fecha_inicio)} - {formatearFecha(proyecto.fecha_fin)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ListChecks className="h-3.5 w-3.5 shrink-0" />
                    <span>{actividadesPrincipales(actividades).length} {actividadesPrincipales(actividades).length === 1 ? 'actividad' : 'actividades'}</span>
                </div>
            </CardContent>
            <CardFooter className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={onViewDetail}>
                    Ver detalle
                </Button>
                {onEstado && (
                    <Button variant="outline" size="icon" onClick={onEstado} aria-label="Actualizar estado del proyecto" title="Actualizar estado del proyecto">
                        <Flag className="h-4 w-4" />
                    </Button>
                )}
                {onRecursos && (
                    <Button variant="outline" size="icon" onClick={onRecursos} aria-label="Recursos del proyecto" title="Recursos del proyecto">
                        <Package className="h-4 w-4" />
                    </Button>
                )}
                {onEdit && (
                    <Button variant="outline" size="icon" onClick={onEdit} aria-label="Editar proyecto" title="Editar proyecto">
                        <Edit className="h-4 w-4" />
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
}
