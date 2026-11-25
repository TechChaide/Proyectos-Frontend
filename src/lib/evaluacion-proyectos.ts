import type { Proyecto } from '@/types/interfaces';
import { RUBRICAS, notaRubricaDeProyecto, sistemaDeTipo, type SistemaCalificacion } from './rubricas';

// Evaluación de proyectos según el tipo de solicitud:
//  - Proyecto INDEPENDIENTE: su calificación es la nota de su rúbrica (MR, MSP o PI), escala 0-5, ya calculada.
//  - Proyecto INTEGRADOR (proyecto de caja): promedio simple de la calificación de sus proyectos hijos, también en
//    escala 0-5. Un hijo puede ser a su vez integrador: entonces aporta su propio promedio (recursivo).

type ResultadoFila = { codigo_proyecto: number; categoria_resultado: string; descripcion_resultado: string };

export interface NodoEvaluacion {
    proyecto: Proyecto;
    /** Rúbrica del tipo de proyecto (MR/MSP/PI); null si no aplica (p. ej. un integrador). */
    sistema: SistemaCalificacion | null;
    esIntegrador: boolean;
    hijos: NodoEvaluacion[];
    /** Calificación 0-5; null mientras no haya nada que calificar. */
    nota: number | null;
    /** Solo independientes: la rúbrica está completa. */
    rubricaCompleta: boolean;
    /** Solo integradores: hijos con calificación / total de hijos. */
    hijosCalificados: number;
    hijosTotal: number;
}

/** Puntajes guardados de un proyecto para una rúbrica (clave de criterio → valor). */
export function puntajesDeProyecto(resultados: ResultadoFila[], codigoProyecto: number, sistema: SistemaCalificacion | null): Record<string, number> {
    const res: Record<string, number> = {};
    if (!sistema || sistema === 'INDIVIDUAL') return res;
    RUBRICAS[sistema].criterios.forEach((c) => {
        const fila = resultados.find((r) => r.codigo_proyecto === codigoProyecto && r.categoria_resultado === `${sistema}:${c.clave}`);
        if (!fila) return;
        const v = parseInt(String(fila.descripcion_resultado), 10);
        if (!Number.isNaN(v)) res[c.clave] = v;
    });
    return res;
}

/**
 * Árbol de proyectos con su calificación. Las raíces son los proyectos sin padre (o cuyo padre no está en la lista).
 * @param tipoNombre        nombre del tipo de cada proyecto (codigo_tipo_proyecto → nombre)
 * @param integradorSolicitud  codigo_solicitud → proyecto_caja
 */
export function construirArbolEvaluacion(
    proyectos: Proyecto[],
    tipoNombre: Map<number, string>,
    integradorSolicitud: Map<number, boolean>,
    resultados: ResultadoFila[]
): NodoEvaluacion[] {
    const porCodigo = new Map(proyectos.map((p) => [p.codigo_proyecto, p]));
    const hijosDe = new Map<number, Proyecto[]>();
    proyectos.forEach((p) => {
        if (p.codigo_padre && porCodigo.has(p.codigo_padre)) hijosDe.set(p.codigo_padre, [...(hijosDe.get(p.codigo_padre) || []), p]);
    });
    const porNombre = (a: Proyecto, b: Proyecto) => a.nombre_proyecto.localeCompare(b.nombre_proyecto);

    const armar = (p: Proyecto, visitados: Set<number>): NodoEvaluacion => {
        const esIntegrador = integradorSolicitud.get(p.codigo_solicitud) === true;
        const sistema = esIntegrador ? null : sistemaDeTipo(tipoNombre.get(p.codigo_tipo_proyecto) || '');
        const siguiente = new Set(visitados).add(p.codigo_proyecto);
        // Protección ante ciclos de datos: un proyecto no se vuelve a incluir dentro de sí mismo.
        const hijos = (hijosDe.get(p.codigo_proyecto) || []).filter((h) => !siguiente.has(h.codigo_proyecto)).sort(porNombre).map((h) => armar(h, siguiente));

        if (esIntegrador) {
            const conNota = hijos.filter((h) => h.nota !== null);
            const nota = conNota.length > 0 ? conNota.reduce((s, h) => s + (h.nota as number), 0) / conNota.length : null;
            return { proyecto: p, sistema, esIntegrador, hijos, nota, rubricaCompleta: false, hijosCalificados: conNota.length, hijosTotal: hijos.length };
        }
        const propio = notaRubricaDeProyecto(resultados, p.codigo_proyecto, sistema);
        return { proyecto: p, sistema, esIntegrador, hijos, nota: propio?.nota ?? null, rubricaCompleta: propio?.completa ?? false, hijosCalificados: 0, hijosTotal: hijos.length };
    };

    return proyectos
        .filter((p) => !p.codigo_padre || !porCodigo.has(p.codigo_padre))
        .sort(porNombre)
        .map((p) => armar(p, new Set()));
}
