
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
//
// SUBACTIVIDADES (2 niveles: actividad → subactividad). La misma autorreferencia guarda también las subactividades de
// una actividad. Para distinguir los dos tipos de hijo, el gestor sigue una regla que él mismo hace cumplir:
//  - Hijo con el MISMO nombre que su padre  → es la PARTICIPACIÓN de una persona en esa actividad.
//  - Hijo con nombre PROPIO                 → es una SUBACTIVIDAD (que a su vez puede tener participaciones).
// (Una subactividad no puede llamarse igual que su actividad: lo valida el formulario.) En todos los casos se califica
// solo lo que no tiene hijos (las "hojas"); toda fila con hijos es un contenedor sin peso.

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

const nombreNormalizado = (v: string) => (v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** ¿La fila hija es la participación de una persona en su padre (mismo nombre) y no una subactividad? */
export function esParticipacion(hijo: Pick<Actividad, 'nombre_actividad'>, padre: Pick<Actividad, 'nombre_actividad'>): boolean {
    return nombreNormalizado(hijo.nombre_actividad) === nombreNormalizado(padre.nombre_actividad);
}

/** Nodo del árbol de actividades: la fila, las participaciones de personas y sus subactividades. */
export interface NodoActividad {
    fila: Actividad;
    /** Filas de participación (hijos con el mismo nombre). Vacío si la actividad es individual o contenedora de subactividades. */
    participaciones: Actividad[];
    subactividades: NodoActividad[];
}

const porInicio = (a: Actividad, b: Actividad) => aFechaSegura(a.fecha_inicio_actividad).getTime() - aFechaSegura(b.fecha_inicio_actividad).getTime();

/** Árbol de actividades (raíces ordenadas por fecha de inicio), separando participaciones de subactividades. */
export function arbolActividades(actividades: Actividad[]): NodoActividad[] {
    const hijos = hijosPorPadre(actividades);
    const nodo = (fila: Actividad): NodoActividad => {
        const hs = hijos.get(fila.codigo_actividad) || [];
        return {
            fila,
            participaciones: hs.filter((h) => esParticipacion(h, fila)),
            subactividades: hs.filter((h) => !esParticipacion(h, fila)).sort(porInicio).map(nodo),
        };
    };
    return actividadesPrincipales(actividades).sort(porInicio).map(nodo);
}

/** Subactividades (no participaciones) de cada actividad: codigo_actividad → subactividades. */
export function subactividadesPorPadre(actividades: Actividad[]): Map<number, Actividad[]> {
    const porCodigo = new Map(actividades.map((a) => [a.codigo_actividad, a]));
    const res = new Map<number, Actividad[]>();
    hijosPorPadre(actividades).forEach((hs, padre) => {
        const fila = porCodigo.get(padre);
        const subs = fila ? hs.filter((h) => !esParticipacion(h, fila)) : [];
        if (subs.length) res.set(padre, subs.sort(porInicio));
    });
    return res;
}

/** Nombre a mostrar de una actividad evaluable: "Actividad › Subactividad" si pertenece a una subactividad. */
export function rutaActividad(a: Actividad, actividades: Actividad[]): string {
    const porCodigo = new Map(actividades.map((x) => [x.codigo_actividad, x]));
    const partes: string[] = [];
    let actual: Actividad | undefined = a;
    let previo: Actividad | undefined;
    for (let i = 0; actual && i < 5; i++) {
        // Una fila de participación repite el nombre de su padre: no se repite en la ruta.
        if (!previo || !esParticipacion(previo, actual)) partes.unshift(actual.nombre_actividad);
        previo = actual;
        actual = actual.codigo_actividad_padre ? porCodigo.get(actual.codigo_actividad_padre) : undefined;
    }
    return partes.join(' › ');
}

/** ¿La fila es la participación de una persona en una actividad compartida (y no una subactividad)? */
export function esFilaDeParticipacion(a: Actividad, actividades: Actividad[]): boolean {
    if (!a.codigo_actividad_padre) return false;
    const padre = actividades.find((x) => x.codigo_actividad === a.codigo_actividad_padre);
    return !!padre && esParticipacion(a, padre);
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

/** Avance (0-1) de cada actividad padre = suma, por hijo, de su participación × su avance (1/0 si es hoja; el avance de
 *  sus propios hijos si es contenedor: así una actividad con subactividades avanza según sus subactividades). */
export function avancePorPadre(actividades: Actividad[], completadas: Set<number>): Map<number, number> {
    const participacion = participacionPorActividad(actividades);
    const hijos = hijosPorPadre(actividades);
    const memo = new Map<number, number>();
    const avance = (codigo: number, profundidad = 0): number => {
        const hs = hijos.get(codigo);
        if (!hs?.length || profundidad > 5) return completadas.has(codigo) ? 1 : 0;
        if (memo.has(codigo)) return memo.get(codigo)!;
        const v = hs.reduce((s, h) => s + (participacion.get(h.codigo_actividad) || 0) * avance(h.codigo_actividad, profundidad + 1), 0);
        memo.set(codigo, v);
        return v;
    };
    const resultado = new Map<number, number>();
    hijos.forEach((_, padre) => resultado.set(padre, avance(padre)));
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
