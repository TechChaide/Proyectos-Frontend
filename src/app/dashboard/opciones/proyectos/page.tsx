
"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import ProcesoSelector from './components/proceso-selector';
import ProyectoCard from './components/proyecto-card';
import ProyectoDetailDialog from './components/proyecto-detail-dialog';
import ProyectoRecursosDialog from './components/proyecto-recursos-dialog';
import EstadoProyectoDialog from './components/estado-proyecto-dialog';
import type { Proyecto } from '@/types/interfaces';
import { useProyectoViews } from './use-proyecto-views';
import { sortProyectoViewsByHierarchy, type AreaBlock, type ProyectoView } from './types';
import { esResponsableDelProyecto, filtrarPorParticipacion } from './area-utils';
import { useAuth } from '@/hooks/use-auth';
import { sistemaDeTipo } from '@/lib/rubricas';
import { ESTILO_SISTEMA } from '@/lib/tipoProyectoVisual';

// Un proyecto rechazado se oculta por defecto para no generar ruido (no se borra).
const esRechazado = (view: ProyectoView): boolean =>
    (view.estadoSolicitudNombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes('rechaz');

export default function ProyectosPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { proyectoViews: todosLosProyectos, areas, responsables, personas, tiposProyecto, estados, isLoading, recargar } = useProyectoViews();

    const [selectedAreaCode, setSelectedAreaCode] = useState<number | null>(null);
    const [filter, setFilter] = useState('');
    // Filtro por tipo de proyecto (catálogo tipo_proyecto: MR, MSP, PI, OI...); null = todos.
    const [filtroTipo, setFiltroTipo] = useState<number | null>(null);
    const [mostrarRechazados, setMostrarRechazados] = useState(false);
    const [detailView, setDetailView] = useState<ProyectoView | null>(null);
    const [recursosProyecto, setRecursosProyecto] = useState<Proyecto | null>(null);
    const [estadoView, setEstadoView] = useState<ProyectoView | null>(null);

    const proyectoViews = useMemo(
        () => filtrarPorParticipacion(todosLosProyectos, responsables, user),
        [todosLosProyectos, responsables, user]
    );

    // Solo los jefes de proyecto (y, a futuro, el administrador) pueden ver los rechazados.
    // "Jefe de proyecto" = es responsable de al menos un proyecto. El rol de administrador queda
    // pendiente del sistema de perfiles (hoy el usuario no trae un flag confiable de admin).
    const puedeVerRechazados = useMemo(
        () => todosLosProyectos.some((v) => esResponsableDelProyecto(v.proyecto, user?.codigo_empleado)),
        [todosLosProyectos, user]
    );
    const efectivoMostrar = puedeVerRechazados && mostrarRechazados;

    // Por defecto se ocultan los rechazados; el switch (solo para jefes/admin) permite mostrarlos.
    const proyectoViewsSinTipo = useMemo(
        () => (efectivoMostrar ? proyectoViews : proyectoViews.filter((v) => !esRechazado(v))),
        [proyectoViews, efectivoMostrar]
    );

    // Resumen por tipo (sobre los proyectos visibles) para los chips de filtro.
    const chipsTipo = useMemo(() => {
        const conteo = new Map<number, number>();
        proyectoViewsSinTipo.forEach((v) => conteo.set(v.proyecto.codigo_tipo_proyecto, (conteo.get(v.proyecto.codigo_tipo_proyecto) || 0) + 1));
        return tiposProyecto
            .filter((t) => t.estado === 'A' && (conteo.get(t.codigo_tipo_proyecto) || 0) > 0)
            .sort((a, b) => a.nombre_tipo_proyecto.localeCompare(b.nombre_tipo_proyecto))
            .map((t) => {
                const sistema = sistemaDeTipo(t.nombre_tipo_proyecto);
                return {
                    codigo: t.codigo_tipo_proyecto,
                    nombre: t.nombre_tipo_proyecto,
                    sigla: sistema ? ESTILO_SISTEMA[sistema].sigla : null,
                    color: sistema ? ESTILO_SISTEMA[sistema].color : '#64748b',
                    count: conteo.get(t.codigo_tipo_proyecto) || 0,
                };
            });
    }, [proyectoViewsSinTipo, tiposProyecto]);

    const proyectoViewsVisibles = useMemo(
        () => (filtroTipo ? proyectoViewsSinTipo.filter((v) => v.proyecto.codigo_tipo_proyecto === filtroTipo) : proyectoViewsSinTipo),
        [proyectoViewsSinTipo, filtroTipo]
    );
    const tipoSeleccionado = chipsTipo.find((c) => c.codigo === filtroTipo) || null;

    const elegirTipo = (codigo: number | null) => {
        setFiltroTipo(codigo);
        setSelectedAreaCode(null);
        setFilter('');
    };

    const areaBlocks = useMemo<AreaBlock[]>(() => {
        const counts = new Map<number, number>();
        proyectoViewsVisibles.forEach((view) => {
            if (view.areaCodigo === null) return;
            counts.set(view.areaCodigo, (counts.get(view.areaCodigo) || 0) + 1);
        });
        return areas
            .filter((area) => counts.has(area.codigo_proceso))
            .map((area) => ({ area, count: counts.get(area.codigo_proceso) || 0 }))
            .sort((a, b) => a.area.nombre_proceso.localeCompare(b.area.nombre_proceso));
    }, [areas, proyectoViewsVisibles]);

    const selectedArea = useMemo(
        () => areas.find((a) => a.codigo_proceso === selectedAreaCode) || null,
        [areas, selectedAreaCode]
    );

    // Cuántos rechazados hay en el proceso seleccionada (para el aviso del switch).
    const rechazadosEnArea = useMemo(
        () => proyectoViews.filter((v) => v.areaCodigo === selectedAreaCode && esRechazado(v)).length,
        [proyectoViews, selectedAreaCode]
    );

    const filteredViews = useMemo(() => {
        const byArea = proyectoViewsVisibles.filter((view) => view.areaCodigo === selectedAreaCode);
        const f = filter.trim().toLowerCase();
        const matched = f ? byArea.filter((view) => view.proyecto.nombre_proyecto?.toLowerCase().includes(f)) : byArea;
        return sortProyectoViewsByHierarchy(matched);
    }, [proyectoViewsVisibles, selectedAreaCode, filter]);

    const handleBack = () => {
        setSelectedAreaCode(null);
        setFilter('');
    };

    return (
        <div className="flex flex-col gap-4 p-4 md:p-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Administración de Proyectos</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {selectedArea ? `Proyectos del proceso: ${selectedArea.nombre_proceso}` : 'Selecciona un proceso para ver sus proyectos, o filtra por tipo.'}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline">
                            <Link href="/dashboard/parametros/pKind">
                                <Settings2 className="mr-2 h-4 w-4" />
                                Administrar tipos
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link href={filtroTipo ? `/dashboard/opciones/pCreation?tipo=${filtroTipo}` : '/dashboard/opciones/pCreation'}>
                                <Plus className="mr-2 h-4 w-4" />
                                {tipoSeleccionado ? `Nuevo proyecto ${tipoSeleccionado.sigla ?? tipoSeleccionado.nombre}` : 'Nuevo Proyecto'}
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            {/* Filtro por tipo de proyecto */}
            {!isLoading && chipsTipo.length > 0 && (
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por tipo de proyecto">
                    <button
                        type="button"
                        aria-pressed={filtroTipo === null}
                        onClick={() => elegirTipo(null)}
                        className={`rounded-full border px-3 py-1 text-sm transition-colors ${filtroTipo === null ? 'border-primary bg-primary/10 font-medium text-primary' : 'bg-card hover:bg-muted/50'}`}
                    >
                        Todos ({proyectoViewsSinTipo.length})
                    </button>
                    {chipsTipo.map((c) => {
                        const activo = filtroTipo === c.codigo;
                        return (
                            <button
                                key={c.codigo}
                                type="button"
                                aria-pressed={activo}
                                onClick={() => elegirTipo(activo ? null : c.codigo)}
                                className="flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm transition-colors hover:bg-muted/50"
                                style={activo ? { borderColor: c.color, backgroundColor: `${c.color}1a`, fontWeight: 500 } : undefined}
                            >
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                                {c.sigla ? <strong>{c.sigla}</strong> : null}
                                <span className={c.sigla ? 'text-muted-foreground' : ''}>{c.nombre}</span>
                                <span className="text-muted-foreground">({c.count})</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {isLoading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className="h-48 w-full rounded-lg" />
                    ))}
                </div>
            ) : selectedAreaCode === null ? (
                <ProcesoSelector blocks={areaBlocks} onSelect={setSelectedAreaCode} />
            ) : (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <Button variant="outline" size="sm" onClick={handleBack}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver a procesos
                        </Button>
                        <div className="flex flex-wrap items-center gap-3">
                            {puedeVerRechazados && (rechazadosEnArea > 0 || mostrarRechazados) && (
                                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                                    <Checkbox checked={mostrarRechazados} onCheckedChange={(v) => setMostrarRechazados(v === true)} />
                                    Mostrar rechazados{rechazadosEnArea > 0 ? ` (${rechazadosEnArea})` : ''}
                                </label>
                            )}
                            <input
                                type="text"
                                className="border rounded px-3 py-2 w-full max-w-xs text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                placeholder="Filtrar por nombre de proyecto..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                            />
                        </div>
                    </div>

                    {filteredViews.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center text-sm text-muted-foreground">
                                No se encontraron proyectos para este proceso.
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {filteredViews.map((view) => (
                                <ProyectoCard
                                    key={view.proyecto.codigo_proyecto}
                                    view={view}
                                    onViewDetail={() => setDetailView(view)}
                                    onEdit={() => router.push(`/dashboard/opciones/pCreation?codigo_proyecto=${view.proyecto.codigo_proyecto}`)}
                                    onRecursos={() => setRecursosProyecto(view.proyecto)}
                                    onEstado={() => setEstadoView(view)}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}

            <ProyectoDetailDialog
                view={detailView}
                onOpenChange={(open) => !open && setDetailView(null)}
                responsables={responsables}
                personas={personas}
            />

            <EstadoProyectoDialog
                view={estadoView}
                estados={estados}
                onOpenChange={(open) => !open && setEstadoView(null)}
                onSaved={recargar}
            />

            <ProyectoRecursosDialog
                proyecto={recursosProyecto}
                onOpenChange={(open) => !open && setRecursosProyecto(null)}
            />
        </div>
    );
}
