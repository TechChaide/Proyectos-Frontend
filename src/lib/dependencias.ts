import { addDays, differenceInCalendarDays } from 'date-fns';
import { aFecha, fechaISO } from '@/lib/fechas';

/** Rango de fechas "YYYY-MM-DD" (vacío = sin definir). */
export interface RangoFechas {
    ini: string;
    fin: string;
}

/** Un elemento cuyas fechas cambiarían al reprogramar; `hacia` null = ya no cabe y se limpiarían sus fechas. */
export interface CambioReprogramado {
    index: number;
    desde: RangoFechas;
    hacia: RangoFechas | null;
}

const sumarDias = (valor: string, dias: number): string => {
    const d = aFecha(valor);
    return d ? fechaISO(addDays(d, dias)) : valor;
};

/** Acota un rango a [min, max]. Devuelve null si no queda ningún día dentro. Con fechas incompletas lo devuelve igual. */
export const acotarRango = (ini: string, fin: string, min: Date | null, max: Date | null): RangoFechas | null => {
    const i = aFecha(ini);
    const f = aFecha(fin);
    if (!i || !f) return { ini, fin };
    if ((max && i > max) || (min && f < min)) return null;
    return { ini: min && i < min ? fechaISO(min) : ini, fin: max && f > max ? fechaISO(max) : fin };
};

/**
 * Simula la reprogramación por dependencias (fin→inicio): un elemento no puede empezar antes del día siguiente al
 * fin de su última predecesora. Se desplaza conservando la duración y sin salirse de [min, max]; si ya no cabe, se
 * limpia. No modifica nada: devuelve solo los elementos cuyas fechas cambiarían, para poder avisar al usuario antes.
 *
 * @param rangos        Fechas actuales (o hipotéticas) de cada elemento.
 * @param predecesoras  Para cada elemento, los índices de los que depende.
 */
export function planificarReprogramacion(
    rangos: RangoFechas[],
    predecesoras: number[][],
    min: Date | null,
    max: Date | null
): CambioReprogramado[] {
    const actuales = rangos.map((r) => ({ ...r }));
    for (let pasada = 0; pasada <= rangos.length; pasada++) {
        let huboCambio = false;
        for (let i = 0; i < actuales.length; i++) {
            const preds = predecesoras[i] || [];
            if (!preds.length) continue;
            let minimoInicio: Date | null = null;
            for (const p of preds) {
                const finPred = aFecha(actuales[p]?.fin || '');
                if (!finPred) continue;
                const candidata = addDays(finPred, 1);
                if (!minimoInicio || candidata > minimoInicio) minimoInicio = candidata;
            }
            const inicio = aFecha(actuales[i].ini);
            if (!minimoInicio || !inicio) continue;
            const delta = differenceInCalendarDays(minimoInicio, inicio);
            if (delta <= 0) continue;
            const desplazado = acotarRango(
                sumarDias(actuales[i].ini, delta),
                actuales[i].fin ? sumarDias(actuales[i].fin, delta) : '',
                min,
                max
            );
            actuales[i] = desplazado ?? { ini: '', fin: '' };
            huboCambio = true;
        }
        if (!huboCambio) break;
    }
    return actuales.flatMap((a, i) =>
        a.ini !== rangos[i].ini || a.fin !== rangos[i].fin
            ? [{ index: i, desde: rangos[i], hacia: a.ini || a.fin ? a : null }]
            : []
    );
}
