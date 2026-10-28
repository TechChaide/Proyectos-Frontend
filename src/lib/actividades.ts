
// Jerarquía de actividades (modelo v5: actividad.codigo_actividad_padre).
//
// Una actividad que comparten 2 o 3 personas se guarda como una actividad PADRE (contenedora)
// con una SUBACTIVIDAD por participante. Reglas para que la calificación sea justa y no punitiva:
//  - Cada persona se evalúa SOLO por su propia subactividad (su fecha de fin, su cierre, su
//    evidencia). Si un participante no cumple, solo se afecta su subactividad, no la de los demás.
//  - La participación de cada persona dentro de la actividad es proporcional a los días que se le
//    asignaron (si todos tienen el mismo rango, se reparte en partes iguales).
//  - El avance de la actividad padre es la suma de la participación de las subactividades cerradas.
//  - La actividad padre es solo un contenedor: no se califica ni suma peso a nadie.

import { differenceInCalendarDays } from 'date-fns';
import type { Actividad } from '@/types/interfaces';
import { aFechaSegura } from './fechas';

export const MAX_PARTICIPANTES = 3;

export function duracionDias(inicio: string | Date, fin: string | Date): number {
    return Math.max(1, differenceInCalendarDays(aFechaSegura(fin), aFechaSegura(inicio)) + 1);
}

export function hijosPorPadre(actividades: Actividad[]): Map<number, Actividad[]> {
    const map = new Map<number, Actividad[]>();
    actividades.forEach((a) => {
        if (!a.codigo_actividad_padre) return;
        const list = map.get(a.codigo_actividad_padre) || [];
        list.push(a);
        map.set(a.codigo_actividad_padre, list);
    });
    return map;
}

/** Actividades que se evalúan por persona: todas menos las contenedoras (las que tienen subactividades). */
export function actividadesEvaluables(actividades: Actividad[]): Actividad[] {
    const hijos = hijosPorPadre(actividades);
    return actividades.filter((a) => !hijos.has(a.codigo_actividad));
}

/** Actividades principales (sin padre): lo que se muestra como "tareas" del proyecto. */
export function actividadesPrincipales(actividades: Actividad[]): Actividad[] {
    return actividades.filter((a) => !a.codigo_actividad_padre);
}

/** Fracción de participación (0-1) de cada participante, proporcional a sus días asignados. */
export function participacionPorDuracion(rangos: { inicio: string | Date; fin: string | Date }[]): number[] {
    const duraciones = rangos.map((r) => duracionDias(r.inicio, r.fin));
    const total = duraciones.reduce((s, d) => s + d, 0);
    return duraciones.map((d) => (total > 0 ? d / total : 1 / rangos.length));
}

/** Participación (0-1) de cada subactividad dentro de su padre. Las actividades sin padre valen 1. */
export function participacionPorActividad(actividades: Actividad[]): Map<number, number> {
    const resultado = new Map<number, number>();
    hijosPorPadre(actividades).forEach((hijos) => {
        const fracciones = participacionPorDuracion(
            hijos.map((h) => ({ inicio: h.fecha_inicio_actividad, fin: h.fecha_fin_actividad }))
        );
        hijos.forEach((h, i) => resultado.set(h.codigo_actividad, fracciones[i]));
    });
    actividades.forEach((a) => {
        if (!resultado.has(a.codigo_actividad)) resultado.set(a.codigo_actividad, 1);
    });
    return resultado;
}

/** Avance (0-1) de cada actividad padre = suma de la participación de sus subactividades completadas. */
export function avancePorPadre(actividades: Actividad[], completadas: Set<number>): Map<number, number> {
    const participacion = participacionPorActividad(actividades);
    const resultado = new Map<number, number>();
    hijosPorPadre(actividades).forEach((hijos, padre) => {
        resultado.set(
            padre,
            hijos.reduce((s, h) => s + (completadas.has(h.codigo_actividad) ? participacion.get(h.codigo_actividad) || 0 : 0), 0)
        );
    });
    return resultado;
}

/** Formatea una fracción 0-1 como porcentaje entero que suma 100 dentro del grupo. */
export function porcentajesEnteros(fracciones: number[]): number[] {
    const crudos = fracciones.map((f) => f * 100);
    const pisos = crudos.map((v) => Math.floor(v));
    let residuo = 100 - pisos.reduce((s, v) => s + v, 0);
    const orden = crudos.map((v, i) => ({ i, d: v - Math.floor(v) })).sort((a, b) => b.d - a.d);
    const res = [...pisos];
    for (let k = 0; residuo > 0 && orden.length; k++, residuo--) res[orden[k % orden.length].i] += 1;
    return res;
}

/** Participación en % entero (suma 100 dentro de cada actividad padre). Las actividades sin padre valen 100. */
export function participacionEnteraPorActividad(actividades: Actividad[]): Map<number, number> {
    const resultado = new Map<number, number>();
    hijosPorPadre(actividades).forEach((hijos) => {
        const enteros = porcentajesEnteros(participacionPorDuracion(
            hijos.map((h) => ({ inicio: h.fecha_inicio_actividad, fin: h.fecha_fin_actividad }))
        ));
        hijos.forEach((h, i) => resultado.set(h.codigo_actividad, enteros[i]));
    });
    actividades.forEach((a) => {
        if (!resultado.has(a.codigo_actividad)) resultado.set(a.codigo_actividad, 100);
    });
    return resultado;
}
