
"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarRange, ChevronRight, CornerDownRight, Inbox, Search, User } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { EstadoSolicitud } from '@/types/interfaces';
import { estadoSolicitudService } from '@/services/proyectos/estadoSolicitud.service';
import { useProyectoViews } from '../proyectos/use-proyecto-views';
import { sortProyectoViewsByHierarchy, type ProyectoView } from '../proyectos/types';
import { actividadesPrincipales } from '@/lib/actividades';
import { ahoraSQL, formatearFecha } from '@/lib/fechas';
import { cn } from '@/lib/utils';
import RevisionProyecto from './revision-proyecto';

const normalize = (v: string): string => (v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const esPendiente = (nombre: string) => normalize(nombre).includes('pendiente') && normalize(nombre).includes('aprob');

// Bandeja de aprobación: a la izquierda los proyectos cuya solicitud está "Pendiente de aprobación"; a la derecha
// la revisión completa del seleccionado (objetivos, alineación estratégica, cronograma, equipo y recursos) con la
// decisión de aprobar o rechazar (registra un nuevo estado_solicitud; sin motivo, según lo acordado).
// NOTA: el control por perfil (quién puede aprobar) queda pendiente de definir con el analista.
export default function AprobacionesPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const { proyectoViews, estados, responsables, personas, isLoading, recargar } = useProyectoViews();
    const [procesando, setProcesando] = useState<number | null>(null);
    const [seleccionado, setSeleccionado] = useState<number | null>(null);
    const [busqueda, setBusqueda] = useState('');
    const panelRef = useRef<HTMLDivElement>(null);

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

    // Siempre hay un proyecto en revisión: si el seleccionado ya no está pendiente (se resolvió), pasa al primero.
    useEffect(() => {
        if (isLoading) return;
        if (!pendientes.some((v) => v.proyecto.codigo_proyecto === seleccionado)) {
            setSeleccionado(pendientes[0]?.proyecto.codigo_proyecto ?? null);
        }
    }, [isLoading, pendientes, seleccionado]);

    // Bandeja filtrada por nombre, proceso o responsable (útil cuando hay muchas solicitudes).
    const visibles = useMemo(() => {
        const q = normalize(busqueda.trim());
        if (!q) return pendientes;
        return pendientes.filter((v) => normalize(`${v.proyecto.nombre_proyecto} ${v.areaNombre} ${v.proyecto.responsable_proyecto} ${v.usuarioCreacion}`).includes(q));
    }, [pendientes, busqueda]);

    // En pantallas chicas la revisión queda debajo de la bandeja: al elegir un proyecto se baja a ella.
    const seleccionar = (codigo: number) => {
        setSeleccionado(codigo);
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }
    };

    const vistaSeleccionada: ProyectoView | null = pendientes.find((v) => v.proyecto.codigo_proyecto === seleccionado) ?? null;
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
                        Revisa cada proyecto completo —qué busca, cómo se alinea a la estrategia, cuándo y quién lo ejecuta y cuánto cuesta— y luego apruébalo o recházalo.
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
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                    <Skeleton className="h-64 w-full rounded-lg lg:col-span-4" />
                    <Skeleton className="h-96 w-full rounded-lg lg:col-span-8" />
                </div>
            ) : pendientes.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Inbox className="h-6 w-6" />
                        </div>
                        <p className="font-medium">No hay solicitudes pendientes de aprobación</p>
                        <p className="text-sm text-muted-foreground">Cuando se cree un proyecto aparecerá aquí para su revisión.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                    {/* Bandeja */}
                    <Card className="lg:col-span-4 lg:self-start">
                        <CardHeader className="gap-3 pb-3">
                            <CardTitle className="text-base">
                                Por revisar <span className="font-normal text-muted-foreground">({pendientes.length})</span>
                            </CardTitle>
                            {pendientes.length > 4 && (
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input className="pl-8" placeholder="Buscar proyecto, proceso o persona…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar en la bandeja de aprobaciones" />
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="flex flex-col gap-1.5 lg:max-h-[75vh] lg:overflow-y-auto">
                            {visibles.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Ningún proyecto coincide con la búsqueda.</p>}
                            {visibles.map((v) => {
                                const p = v.proyecto;
                                const activo = p.codigo_proyecto === seleccionado;
                                const n = actividadesPrincipales(v.actividades).length;
                                const esSub = !!v.padreNombre;
                                return (
                                    <button
                                        key={p.codigo_proyecto}
                                        type="button"
                                        aria-pressed={activo}
                                        onClick={() => seleccionar(p.codigo_proyecto)}
                                        className={cn(
                                            'flex w-full items-center gap-2 rounded-md border border-l-4 px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                            activo ? 'border-l-primary bg-primary/5' : 'border-l-transparent hover:bg-muted/50',
                                            esSub && 'ml-4'
                                        )}
                                    >
                                        {esSub && <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium">{p.nombre_proyecto}</p>
                                            <p className="truncate text-xs text-muted-foreground">{v.areaNombre}{v.tipoProyectoNombre ? ` · ${v.tipoProyectoNombre}` : ''}</p>
                                            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                                                <span className="flex items-center gap-1"><User className="h-3 w-3" />{p.responsable_proyecto || 'Sin responsable'}</span>
                                                <span className="flex items-center gap-1"><CalendarRange className="h-3 w-3" />{formatearFecha(p.fecha_inicio)} – {formatearFecha(p.fecha_fin)}</span>
                                                <span>{n} {n === 1 ? 'actividad' : 'actividades'}</span>
                                            </p>
                                            {v.usuarioCreacion && <p className="mt-0.5 text-[11px] text-muted-foreground">Solicitado por {v.usuarioCreacion}</p>}
                                        </div>
                                        <ChevronRight className={cn('h-4 w-4 shrink-0', activo ? 'text-primary' : 'text-muted-foreground/50')} />
                                    </button>
                                );
                            })}
                        </CardContent>
                    </Card>

                    {/* Revisión del proyecto seleccionado */}
                    <div ref={panelRef} className="scroll-mt-4 lg:col-span-8">
                        {vistaSeleccionada && (
                            <RevisionProyecto
                                key={vistaSeleccionada.proyecto.codigo_proyecto}
                                view={vistaSeleccionada}
                                responsables={responsables}
                                personas={personas}
                                procesando={procesando === vistaSeleccionada.proyecto.codigo_proyecto}
                                sinEstados={faltanEstados}
                                onResolver={(aprobar) => resolver(vistaSeleccionada, aprobar)}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
