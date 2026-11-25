
import { duracionDias, participacionPorDuracion } from '@/lib/actividades';
import type { ActividadWizardValues } from './schema';

/**
 * Peso (%) de cada participante de cada actividad dentro del proyecto. Devuelve pesos[i][j]
 * para la actividad i y su participante j.
 *
 * 1. Carga de cada participante en una actividad = días de la actividad × su participación
 *    (participación proporcional a los días asignados; igual para todos si comparten el rango).
 *    Con un solo participante, la carga es la duración completa de la actividad.
 * 2. Por persona, el peso de cada una de sus participaciones es su carga sobre su carga total en
 *    el proyecto, así que los pesos de una misma persona siempre suman 100.
 * 3. Redondeo a enteros por mayor residuo y mínimo 1% por participación (el campo es de solo
 *    lectura: nunca debe quedar en 0 y bloquear el guardado).
 */
export function calcularPesosAutomaticos(actividades: ActividadWizardValues[]): number[][] {
    const cargas: number[][] = actividades.map((a) => {
        const durActividad = duracionDias(a.fecha_inicio_actividad, a.fecha_fin_actividad);
        if (a.participantes.length <= 1) return a.participantes.map(() => durActividad);
        const fracciones = participacionPorDuracion(
            a.participantes.map((p) => ({ inicio: p.fecha_inicio_actividad, fin: p.fecha_fin_actividad }))
        );
        return fracciones.map((f) => durActividad * f);
    });

    // Agrupa por persona: lista de [i, j]
    const posicionesPorPersona = new Map<number, [number, number][]>();
    actividades.forEach((a, i) =>
        a.participantes.forEach((p, j) => {
            const list = posicionesPorPersona.get(p.codigo_responsable) || [];
            list.push([i, j]);
            posicionesPorPersona.set(p.codigo_responsable, list);
        })
    );

    const pesos: number[][] = actividades.map((a) => a.participantes.map(() => 0));

    posicionesPorPersona.forEach((posiciones) => {
        const total = posiciones.reduce((s, [i, j]) => s + cargas[i][j], 0);
        if (total <= 0) return;

        const crudos = posiciones.map(([i, j]) => (cargas[i][j] / total) * 100);
        const finales = crudos.map((v) => Math.floor(v));
        let residuo = 100 - finales.reduce((s, v) => s + v, 0);
        const orden = crudos.map((v, idx) => ({ idx, d: v - Math.floor(v) })).sort((a, b) => b.d - a.d);
        for (let k = 0; residuo > 0; k++, residuo--) finales[orden[k % orden.length].idx] += 1;

        if (posiciones.length <= 100) {
            for (let k = 0; k < finales.length; k++) {
                if (finales[k] === 0) {
                    const mayor = finales.reduce((best, v, idx) => (v > finales[best] ? idx : best), 0);
                    finales[mayor] -= 1;
                    finales[k] = 1;
                }
            }
        }

        posiciones.forEach(([i, j], idx) => {
            pesos[i][j] = finales[idx];
        });
    });

    return pesos;
}

/** Tarea final del plan (lo que lleva participantes y peso): una actividad sin subactividades o una subactividad. */
export interface TareaDelPlan {
    /** Ruta en el formulario: "actividades.i" o "actividades.i.subactividades.k". */
    ruta: string;
    tarea: Pick<ActividadWizardValues, 'fecha_inicio_actividad' | 'fecha_fin_actividad' | 'participantes'>;
}

export function tareasDelPlan(actividades: ActividadWizardValues[]): TareaDelPlan[] {
    return (actividades || []).flatMap((a, i) => {
        const subs = a?.subactividades ?? [];
        return subs.length
            ? subs.map((s, k) => ({ ruta: `actividades.${i}.subactividades.${k}`, tarea: s }))
            : [{ ruta: `actividades.${i}`, tarea: a }];
    });
}

/** Pesos de todo el plan con subactividades: ruta del participante ("<ruta de la tarea>.participantes.j") → peso. Las
 *  actividades contenedoras no llevan peso (sus participantes van en las subactividades). */
export function calcularPesosDelPlan(actividades: ActividadWizardValues[]): Map<string, number> {
    const tareas = tareasDelPlan(actividades);
    const pesos = calcularPesosAutomaticos(tareas.map((t) => ({ ...t.tarea, codigo_actividad: 0, nombre_actividad: '', descripcion_actividad: '' }) as ActividadWizardValues));
    const res = new Map<string, number>();
    tareas.forEach((t, i) => (pesos[i] || []).forEach((peso, j) => res.set(`${t.ruta}.participantes.${j}`, peso)));
    return res;
}
