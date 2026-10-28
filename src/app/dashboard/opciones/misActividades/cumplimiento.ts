
import { differenceInCalendarDays } from 'date-fns';
import type { Actividad, Estado, EstadoActividad, Proyecto } from '@/types/interfaces';
import { aFechaSegura } from '@/lib/fechas';

// Tabla de tramos de atraso — PARÁMETRO CONFIGURABLE (ajusta los valores aquí,
// no dentro de la lógica de cálculo). "semanasMax" es el límite superior (inclusive)
// de cada tramo, evaluado en orden.
export const TRAMOS_ATRASO: { semanasMax: number; valor: number }[] = [
    { semanasMax: 2, valor: 0.90 },
    { semanasMax: 4, valor: 0.75 },
    { semanasMax: 8, valor: 0.50 },
    { semanasMax: Infinity, valor: 0.25 },
];

const normalize = (value: string): string =>
    (value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const esCompletada = (estadoActividad: string): boolean => normalize(estadoActividad).includes('complet');

// Fecha calendario en hora de Ecuador (ver src/lib/fechas.ts).
export const toDateOnly = (value: string | Date): Date => aFechaSegura(value);

// Última fecha en que cada actividad pasó a un estado "Completada" (cierre real),
// según el historial de EstadoActividad. Se reutiliza tanto para el cálculo de la Nota
// como para marcar en las tarjetas si una actividad se cerró con atraso.
export function calcularCierreRealPorActividad(historialEstados: EstadoActividad[], estados: Estado[]): Map<number, Date> {
    const codigosEstadoCompletada = new Set(
        estados.filter((e) => esCompletada(e.nombre_estado)).map((e) => e.codigo_estado)
    );
    const cierreRealPorActividad = new Map<number, Date>();
    historialEstados
        .filter((ea) => ea.estado === 'A' && codigosEstadoCompletada.has(ea.codigo_estado))
        .forEach((ea) => {
            const fecha = toDateOnly(ea.fecha_modificacion);
            const actual = cierreRealPorActividad.get(ea.codigo_actividad);
            if (!actual || fecha > actual) cierreRealPorActividad.set(ea.codigo_actividad, fecha);
        });
    return cierreRealPorActividad;
}

// Determina si una actividad está completada. La fuente principal es el historial:
// si el último registro activo de EstadoActividad es un estado "Completada", cuenta como
// completada aunque el campo copiado Actividad.estado_actividad no se haya actualizado.
// Si no hay historial, se usa ese campo como respaldo.
export function calcularCompletadas(actividades: Actividad[], historialEstados: EstadoActividad[], estados: Estado[]): Set<number> {
    const estadoPorCodigo = new Map(estados.map((e) => [e.codigo_estado, e]));
    const ultimoPorActividad = new Map<number, EstadoActividad>();
    historialEstados
        .filter((ea) => ea.estado === 'A')
        .forEach((ea) => {
            const actual = ultimoPorActividad.get(ea.codigo_actividad);
            if (!actual || new Date(ea.fecha_modificacion) >= new Date(actual.fecha_modificacion)) {
                ultimoPorActividad.set(ea.codigo_actividad, ea);
            }
        });

    const completadas = new Set<number>();
    actividades.forEach((a) => {
        const ultimo = ultimoPorActividad.get(a.codigo_actividad);
        const completada = ultimo
            ? esCompletada(estadoPorCodigo.get(ultimo.codigo_estado)?.nombre_estado || '')
            : esCompletada(a.estado_actividad);
        if (completada) completadas.add(a.codigo_actividad);
    });
    return completadas;
}

const valorPorAtraso = (semanasAtraso: number): number => {
    const tramo = TRAMOS_ATRASO.find((t) => semanasAtraso <= t.semanasMax);
    return tramo ? tramo.valor : TRAMOS_ATRASO[TRAMOS_ATRASO.length - 1].valor;
};

// Rangos del semáforo de cumplimiento — PARÁMETRO CONFIGURABLE, ordenado de mayor a menor.
export const RANGOS_SEMAFORO: { minPct: number; etiqueta: string; color: string }[] = [
    { minPct: 90, etiqueta: 'Excelente', color: '#16a34a' },
    { minPct: 70, etiqueta: 'Aceptable', color: '#ca8a04' },
    { minPct: 0, etiqueta: 'Necesita atención', color: '#dc2626' },
];

export function calificarPorcentaje(pct: number): { etiqueta: string; color: string } {
    const rango = RANGOS_SEMAFORO.find((r) => pct >= r.minPct);
    return rango || RANGOS_SEMAFORO[RANGOS_SEMAFORO.length - 1];
}

// Semáforo por actividad, compartido por tarjetas, Gantt y la pantalla del jefe.
export { ESTILO_ESTADO_VISUAL, type EstadoVisual } from '@/lib/estado-visual';
import type { EstadoVisual } from '@/lib/estado-visual';

export function calcularEstadosVisuales(
    actividades: Actividad[],
    historialEstados: EstadoActividad[],
    estados: Estado[],
    hoy: Date = new Date()
): Map<number, EstadoVisual> {
    const hoyCorte = toDateOnly(hoy);
    const completadas = calcularCompletadas(actividades, historialEstados, estados);
    const cierreReal = calcularCierreRealPorActividad(historialEstados, estados);
    const resultado = new Map<number, EstadoVisual>();
    actividades.forEach((a) => {
        const inicio = toDateOnly(a.fecha_inicio_actividad);
        const fin = toDateOnly(a.fecha_fin_actividad);
        if (completadas.has(a.codigo_actividad)) {
            const cierre = cierreReal.get(a.codigo_actividad);
            resultado.set(a.codigo_actividad, cierre && cierre > fin ? 'completada_atraso' : 'completada');
        } else if (fin < hoyCorte) {
            resultado.set(a.codigo_actividad, 'vencida');          // pasó su fin sin cerrarse
        } else if (inicio > hoyCorte) {
            resultado.set(a.codigo_actividad, 'pendiente');        // aún no llega a su fecha de inicio
        } else {
            resultado.set(a.codigo_actividad, 'en_ejecucion');     // hoy está dentro del rango
        }
    });
    return resultado;
}

// Avance de las actividades de una persona dentro de cada proyecto (independiente de la Nota global).
export interface AvanceProyecto {
    codigoProyecto: number;
    nombreProyecto: string;
    totalActividades: number;
    completadas: number;
    /** % de actividades completadas (por cantidad). */
    pctActividades: number;
    /** % de avance real, ponderado por el peso de cada actividad. */
    avanceEfectivo: number;
    /** % que a hoy debería estar hecho según las fechas planificadas, ponderado por peso. */
    avanceEsperado: number;
}

// Fracción de la actividad que a hoy debería estar hecha según su plan (0 antes de iniciar, 1 al llegar al fin).
const fraccionEsperada = (a: Actividad, hoy: Date): number => {
    const inicio = toDateOnly(a.fecha_inicio_actividad);
    const fin = toDateOnly(a.fecha_fin_actividad);
    if (hoy < inicio) return 0;
    if (hoy >= fin) return 1;
    const duracion = differenceInCalendarDays(fin, inicio) + 1;
    return (differenceInCalendarDays(hoy, inicio) + 1) / duracion;
};

export function calcularAvanceProyectos(
    actividades: Actividad[],
    historialEstados: EstadoActividad[],
    estados: Estado[],
    proyectos: Proyecto[],
    hoy: Date = new Date()
): AvanceProyecto[] {
    const hoyCorte = toDateOnly(hoy);
    const completadas = calcularCompletadas(actividades, historialEstados, estados);
    const proyectoMap = new Map(proyectos.map((p) => [p.codigo_proyecto, p]));

    const porProyecto = new Map<number, Actividad[]>();
    actividades.forEach((a) => {
        const list = porProyecto.get(a.codigo_proyecto) || [];
        list.push(a);
        porProyecto.set(a.codigo_proyecto, list);
    });

    return Array.from(porProyecto.entries())
        .map(([codigoProyecto, lista]) => {
            const pesos = lista.map((a) => Number(a.peso_actividad) || 0);
            const totalPeso = pesos.reduce((s, p) => s + p, 0);
            // Si no hay pesos cargados, todas las actividades pesan igual.
            const pesoDe = (i: number) => (totalPeso > 0 ? pesos[i] / totalPeso : 1 / lista.length);

            let efectivo = 0;
            let esperado = 0;
            let nCompletadas = 0;
            lista.forEach((a, i) => {
                if (completadas.has(a.codigo_actividad)) {
                    efectivo += pesoDe(i);
                    nCompletadas += 1;
                }
                esperado += pesoDe(i) * fraccionEsperada(a, hoyCorte);
            });

            return {
                codigoProyecto,
                nombreProyecto: proyectoMap.get(codigoProyecto)?.nombre_proyecto || `Proyecto ${codigoProyecto}`,
                totalActividades: lista.length,
                completadas: nCompletadas,
                pctActividades: (nCompletadas / lista.length) * 100,
                avanceEfectivo: efectivo * 100,
                avanceEsperado: esperado * 100,
            };
        })
        .sort((a, b) => a.nombreProyecto.localeCompare(b.nombreProyecto));
}

export interface ProyectoCumplimiento {
    codigoProyecto: number;
    nombreProyecto: string;
    pctCumplimiento: number;
    nota: number;
    actividadesAnio: number;
    peso: number;
    aporte: number;
}

export interface ResultadoCumplimiento {
    sinActividadesExigibles: boolean;
    nota: number | null;
    proyectos: ProyectoCumplimiento[];
}

/**
 * Calcula la Nota de cumplimiento (0.00 a 5.00) de una persona, siguiendo la lógica:
 * 1. Una actividad es "exigible" cuando ya está completada (sin importar si llegó su fecha
 *    de fin — adelantarse cuenta de inmediato) o cuando su fecha_fin_actividad ya pasó sin
 *    haberse cerrado.
 * 2. Valor de cada actividad exigible: 1.0 si se completó a tiempo; según tabla de tramos
 *    si se completó tarde; 0 si venció y no se completó (no registramos % de avance parcial).
 * 3. % Cumplimiento de un proyecto = promedio de los valores de sus actividades exigibles.
 * 4. Nota del proyecto = % Cumplimiento × 5.
 * 5. Peso del proyecto = sus actividades del año (todas, no solo exigibles) ÷ total de
 *    actividades del año de la persona en proyectos evaluables.
 * 6. Nota final = suma ponderada (Nota del proyecto × Peso del proyecto).
 *
 * @param misActividades Actividades (ya filtradas, estado activo) donde la persona es responsable.
 * @param historialEstados Todo el historial de EstadoActividad (para ubicar la fecha de cierre real).
 * @param estados Catálogo de Estado completo (para reconocer cuáles códigos son "Completada").
 * @param proyectos Catálogo de proyectos (para mostrar nombres).
 * @param hoy Fecha de corte (por defecto, hoy).
 */
export function calcularCumplimiento(
    misActividades: Actividad[],
    historialEstados: EstadoActividad[],
    estados: Estado[],
    proyectos: Proyecto[],
    hoy: Date = new Date()
): ResultadoCumplimiento {
    const hoyCorte = toDateOnly(hoy);
    const anioActual = hoyCorte.getFullYear();
    const proyectoMap = new Map(proyectos.map((p) => [p.codigo_proyecto, p]));

    const cierreRealPorActividad = calcularCierreRealPorActividad(historialEstados, estados);
    const completadas = calcularCompletadas(misActividades, historialEstados, estados);

    const valorActividad = (a: Actividad): number => {
        if (!completadas.has(a.codigo_actividad)) return 0; // vencida y no cerrada -> 0 (sin dato de % avance)
        const finPlan = toDateOnly(a.fecha_fin_actividad);
        const cierreReal = cierreRealPorActividad.get(a.codigo_actividad);
        if (!cierreReal || cierreReal <= finPlan) return 1.0;
        const diasAtraso = differenceInCalendarDays(cierreReal, finPlan);
        const semanasAtraso = Math.ceil(diasAtraso / 7);
        return valorPorAtraso(semanasAtraso);
    };

    // Actividades del año en curso (mide la carga anual, no solo lo ya vencido).
    const actividadesDelAnio = misActividades.filter((a) => toDateOnly(a.fecha_fin_actividad).getFullYear() === anioActual);

    const porProyecto = new Map<number, Actividad[]>();
    actividadesDelAnio.forEach((a) => {
        const list = porProyecto.get(a.codigo_proyecto) || [];
        list.push(a);
        porProyecto.set(a.codigo_proyecto, list);
    });

    const intermedios: Omit<ProyectoCumplimiento, 'peso' | 'aporte'>[] = [];

    porProyecto.forEach((actividadesProyecto, codigoProyecto) => {
        const exigibles = actividadesProyecto.filter(
            (a) => completadas.has(a.codigo_actividad) || toDateOnly(a.fecha_fin_actividad) <= hoyCorte
        );
        if (exigibles.length === 0) return; // proyecto no evaluable todavía

        const valores = exigibles.map(valorActividad);
        const pctCumplimiento = valores.reduce((s, v) => s + v, 0) / valores.length;

        intermedios.push({
            codigoProyecto,
            nombreProyecto: proyectoMap.get(codigoProyecto)?.nombre_proyecto || `Proyecto ${codigoProyecto}`,
            pctCumplimiento,
            nota: pctCumplimiento * 5,
            actividadesAnio: actividadesProyecto.length,
        });
    });

    if (intermedios.length === 0) {
        return { sinActividadesExigibles: true, nota: null, proyectos: [] };
    }

    const totalActividadesAnio = intermedios.reduce((s, p) => s + p.actividadesAnio, 0);

    const proyectosFinal: ProyectoCumplimiento[] = intermedios
        .map((p) => {
            const peso = totalActividadesAnio > 0 ? p.actividadesAnio / totalActividadesAnio : 0;
            return { ...p, peso, aporte: p.nota * peso };
        })
        .sort((a, b) => b.peso - a.peso);

    const nota = proyectosFinal.reduce((s, p) => s + p.aporte, 0);

    return { sinActividadesExigibles: false, nota, proyectos: proyectosFinal };
}
