
"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Actividad, Area, AreaSolicitud, Estado, EstadoSolicitud, FichaSocialHistorica, Proyecto, Responsable, Solicitud, TipoProyecto } from '@/types/interfaces';
import { solicitudService } from '@/services/proyectos/solicitud.service';
import { proyectoService } from '@/services/proyectos/proyecto.service';
import { procesoService } from '@/services/proyectos/proceso.service';
import { areaSolicitudService } from '@/services/proyectos/areaSolicitud.service';
import { estadoService } from '@/services/proyectos/estado.service';
import { estadoSolicitudService } from '@/services/proyectos/estadoSolicitud.service';
import { tipoProyectoService } from '@/services/proyectos/tipoProyecto.service';
import { actividadService } from '@/services/proyectos/actividad.service';
import { responsableService } from '@/services/proyectos/responsable.service';
import { serviciosService } from '@/services/proyectos/servicios.service';
import type { ProyectoView } from './types';

// Carga y arma los ProyectoView (proyecto enriquecido con proceso, estado, tipo, actividades
// y datos de jerarquía padre/hijo) reutilizados por las distintas vistas de "Proyectos".
export function useProyectoViews() {
    const { toast } = useToast();

    const [proyectos, setProyectos] = useState<Proyecto[]>([]);
    const [areas, setAreas] = useState<Area[]>([]);
    const [areaSolicitudes, setAreaSolicitudes] = useState<AreaSolicitud[]>([]);
    const [estados, setEstados] = useState<Estado[]>([]);
    const [estadoSolicitudes, setEstadoSolicitudes] = useState<EstadoSolicitud[]>([]);
    const [tiposProyecto, setTiposProyecto] = useState<TipoProyecto[]>([]);
    const [actividades, setActividades] = useState<Actividad[]>([]);
    const [responsables, setResponsables] = useState<Responsable[]>([]);
    const [personas, setPersonas] = useState<FichaSocialHistorica[]>([]);
    const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const recargar = useCallback(async () => {
            setIsLoading(true);
            // Resiliente: si un servicio falla, los demás igual cargan (no queda la pantalla en blanco).
            const nombres = ['proyectos', 'procesos', 'proceso_solicitud', 'estados', 'estado_solicitud', 'tipos de proyecto', 'actividades', 'responsables', 'personas', 'solicitudes'];
            const results = await Promise.allSettled([
                proyectoService.getAll(),
                procesoService.getAll(),
                areaSolicitudService.getAll(),
                estadoService.getAll(),
                estadoSolicitudService.getAll(),
                tipoProyectoService.getAll(),
                actividadService.buscar({ estado: 'A' }),
                responsableService.getAll(),
                serviciosService.getInformacionPersonas(),
                solicitudService.getAll(),
            ]);
            const data = <T,>(i: number): T[] => {
                const r = results[i];
                return r.status === 'fulfilled' ? ((r.value as unknown as { data?: T[] }).data || []) : [];
            };
            setProyectos(data<Proyecto>(0));
            setAreas(data<Area>(1));
            setAreaSolicitudes(data<AreaSolicitud>(2));
            setEstados(data<Estado>(3));
            setEstadoSolicitudes(data<EstadoSolicitud>(4));
            setTiposProyecto(data<TipoProyecto>(5));
            setActividades(data<Actividad>(6));
            setResponsables(data<Responsable>(7));
            setPersonas(data<FichaSocialHistorica>(8));
            setSolicitudes(data<Solicitud>(9));

            const fallidos = results.map((r, i) => (r.status === 'rejected' ? nombres[i] : null)).filter(Boolean);
            if (fallidos.length) {
                toast({ title: 'Algunos datos no se cargaron', description: `No se pudieron cargar: ${fallidos.join(', ')}.`, variant: 'destructive' });
            }
            setIsLoading(false);
    }, [toast]);

    useEffect(() => {
        recargar();
    }, [recargar]);

    const proyectoViews = useMemo<ProyectoView[]>(() => {
        const areaMap = new Map(areas.map((a) => [a.codigo_proceso, a]));
        const estadoMap = new Map(estados.map((e) => [e.codigo_estado, e]));
        const tipoMap = new Map(tiposProyecto.map((t) => [t.codigo_tipo_proyecto, t]));
        const proyectoNombreMap = new Map(proyectos.map((p) => [p.codigo_proyecto, p.nombre_proyecto]));
        const creadorPorSolicitud = new Map(solicitudes.map((s) => [s.codigo_solicitud, s.usuario_creacion]));

        const areaBySolicitud = new Map<number, Area>();
        areaSolicitudes
            .filter((as) => as.estado === 'A')
            .forEach((as) => {
                const area = areaMap.get(as.codigo_proceso);
                if (area) areaBySolicitud.set(as.codigo_solicitud, area);
            });

        const estadoBySolicitud = new Map<number, EstadoSolicitud>();
        estadoSolicitudes
            .filter((es) => es.estado === 'A')
            .forEach((es) => {
                const current = estadoBySolicitud.get(es.codigo_solicitud);
                if (!current || new Date(es.fecha_modificacion) > new Date(current.fecha_modificacion)) {
                    estadoBySolicitud.set(es.codigo_solicitud, es);
                }
            });

        const actividadesByProyecto = new Map<number, Actividad[]>();
        actividades.forEach((a) => {
            const list = actividadesByProyecto.get(a.codigo_proyecto) || [];
            list.push(a);
            actividadesByProyecto.set(a.codigo_proyecto, list);
        });

        const subProyectosCountByPadre = new Map<number, number>();
        proyectos.forEach((p) => {
            if (p.codigo_padre) {
                subProyectosCountByPadre.set(p.codigo_padre, (subProyectosCountByPadre.get(p.codigo_padre) || 0) + 1);
            }
        });

        return proyectos.map((proyecto) => {
            const area = areaBySolicitud.get(proyecto.codigo_solicitud) || null;
            const estadoSolicitud = estadoBySolicitud.get(proyecto.codigo_solicitud);
            const estado = estadoSolicitud ? estadoMap.get(estadoSolicitud.codigo_estado) : undefined;

            return {
                proyecto,
                areaCodigo: area?.codigo_proceso ?? null,
                areaNombre: area?.nombre_proceso ?? 'Sin proceso',
                estadoSolicitudNombre: estado?.nombre_estado ?? '',
                tipoProyectoNombre: tipoMap.get(proyecto.codigo_tipo_proyecto)?.nombre_tipo_proyecto ?? '',
                actividades: actividadesByProyecto.get(proyecto.codigo_proyecto) || [],
                padreNombre: proyecto.codigo_padre ? proyectoNombreMap.get(proyecto.codigo_padre) ?? null : null,
                subProyectosCount: subProyectosCountByPadre.get(proyecto.codigo_proyecto) || 0,
                usuarioCreacion: creadorPorSolicitud.get(proyecto.codigo_solicitud) || '',
            };
        });
    }, [proyectos, areas, areaSolicitudes, estados, estadoSolicitudes, tiposProyecto, actividades, solicitudes]);

    return { proyectoViews, areas, responsables, personas, tiposProyecto, estados, isLoading, recargar };
}
