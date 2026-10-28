
import type { Area, AreaSolicitud, Proyecto, Responsable } from '@/types/interfaces';
import type { ProyectoView } from './types';

// Resuelve el proceso de cada proyecto: proyecto -> solicitud -> area_solicitud (activa) -> proceso.
export function resolverAreaPorProyecto(
    proyectos: Proyecto[],
    areaSolicitudes: AreaSolicitud[],
    areas: Area[]
): Map<number, Area> {
    const areaMap = new Map(areas.map((a) => [a.codigo_proceso, a]));
    const areaPorSolicitud = new Map<number, Area>();
    areaSolicitudes
        .filter((as) => as.estado === 'A')
        .forEach((as) => {
            const area = areaMap.get(as.codigo_proceso);
            if (area) areaPorSolicitud.set(as.codigo_solicitud, area);
        });

    const resultado = new Map<number, Area>();
    proyectos.forEach((p) => {
        const area = areaPorSolicitud.get(p.codigo_solicitud);
        if (area) resultado.set(p.codigo_proyecto, area);
    });
    return resultado;
}

// responsable_proyecto guarda los códigos de empleado separados por "&".
export function esResponsableDelProyecto(proyecto: Proyecto, codigoEmpleado: string | undefined): boolean {
    if (!codigoEmpleado || !proyecto.responsable_proyecto) return false;
    return proyecto.responsable_proyecto.split('&').map((c) => c.trim()).includes(codigoEmpleado);
}

// Proyectos donde el usuario participa: los creó, los lidera o tiene actividades en ellos.
export function filtrarPorParticipacion(
    views: ProyectoView[],
    responsables: Responsable[],
    user: { usuario?: string; codigo_empleado?: string } | null | undefined
): ProyectoView[] {
    const codigoEmpleado = user?.codigo_empleado;
    const misCodigosResponsable = new Set(
        responsables.filter((r) => r.codigo_empleado === codigoEmpleado).map((r) => r.codigo_responsable)
    );
    return views.filter((view) =>
        (!!user?.usuario && view.usuarioCreacion === user.usuario) ||
        esResponsableDelProyecto(view.proyecto, codigoEmpleado) ||
        view.actividades.some((a) => misCodigosResponsable.has(a.codigo_responsable))
    );
}

// Igual que resolverAreaPorProyecto, pero si el proyecto está anclado a un nivel más fino
// (Subproceso, Línea, Puesto, Tarea) lo agrupa bajo su Proceso (profundidad 1 del organigrama).
export function resolverProcesoPorProyecto(
    proyectos: Proyecto[],
    areaSolicitudes: AreaSolicitud[],
    areas: Area[]
): Map<number, Area> {
    const porId = new Map(areas.map((a) => [a.codigo_proceso, a]));
    const subirAProceso = (nodo: Area): Area => {
        const ruta: Area[] = [nodo];
        let actual: Area | undefined = nodo;
        while (actual?.codigo_proceso_padre && ruta.length < 20) {
            actual = porId.get(actual.codigo_proceso_padre);
            if (actual) ruta.unshift(actual);
        }
        return ruta[Math.min(1, ruta.length - 1)];
    };
    const resultado = new Map<number, Area>();
    resolverAreaPorProyecto(proyectos, areaSolicitudes, areas).forEach((area, codigo) => resultado.set(codigo, subirAProceso(area)));
    return resultado;
}
