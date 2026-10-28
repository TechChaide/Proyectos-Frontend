
import type { Actividad, Area, Proyecto } from '@/types/interfaces';

export interface ProyectoView {
  proyecto: Proyecto;
  areaCodigo: number | null;
  areaNombre: string;
  estadoSolicitudNombre: string;
  tipoProyectoNombre: string;
  actividades: Actividad[];
  padreNombre: string | null;
  subProyectosCount: number;
  usuarioCreacion: string;
}

export interface AreaBlock {
  area: Area;
  count: number;
}

// Ordena una lista de ProyectoView de forma que cada proyecto padre quede seguido
// inmediatamente por sus sub-proyectos (jerarquía a 2 niveles, según codigo_padre).
export function sortProyectoViewsByHierarchy(views: ProyectoView[]): ProyectoView[] {
  const byCodigo = new Map(views.map((v) => [v.proyecto.codigo_proyecto, v]));
  const childrenByPadre = new Map<number, ProyectoView[]>();

  views.forEach((v) => {
    const padre = v.proyecto.codigo_padre;
    if (padre && byCodigo.has(padre)) {
      const list = childrenByPadre.get(padre) || [];
      list.push(v);
      childrenByPadre.set(padre, list);
    }
  });

  const sortByNombre = (a: ProyectoView, b: ProyectoView) =>
    a.proyecto.nombre_proyecto.localeCompare(b.proyecto.nombre_proyecto);

  const topLevel = views
    .filter((v) => !v.proyecto.codigo_padre || !byCodigo.has(v.proyecto.codigo_padre))
    .sort(sortByNombre);

  const result: ProyectoView[] = [];
  topLevel.forEach((parent) => {
    result.push(parent);
    const children = (childrenByPadre.get(parent.proyecto.codigo_proyecto) || []).sort(sortByNombre);
    result.push(...children);
  });

  return result;
}
