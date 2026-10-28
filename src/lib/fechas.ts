
// Manejo centralizado de fechas. Todo se interpreta en hora de Ecuador (America/Guayaquil,
// UTC-5, sin horario de verano), sin importar la zona horaria del navegador. Hacia SQL Server
// se envía datetime2 como "YYYY-MM-DDTHH:mm:ss.SSS" (hora de Ecuador, sin zona).

export const ZONA_HORARIA = 'America/Guayaquil';

const pad = (n: number, len = 2) => n.toString().padStart(len, '0');

interface PartesFecha {
    year: number;
    month: number; // 1-12
    day: number;
    hour: number;
    minute: number;
    second: number;
}

const formateadorEcuador = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
});

const partesEnEcuador = (date: Date): PartesFecha => {
    const p = Object.fromEntries(formateadorEcuador.formatToParts(date).map((x) => [x.type, x.value]));
    return {
        year: Number(p.year),
        month: Number(p.month),
        day: Number(p.day),
        hour: Number(p.hour) % 24,
        minute: Number(p.minute),
        second: Number(p.second),
    };
};

// Un texto sin "Z" ni offset ("2026-09-30" o "2026-09-30T08:00") se toma como hora de Ecuador tal cual;
// uno con zona (lo que devuelve la API, ej. "2026-09-30T05:00:00.000Z") se convierte a hora de Ecuador.
// Un Date a medianoche local exacta es un día de calendario (lo que producen aFecha y los
// calendarios) y se toma tal cual; cualquier otro Date es un instante (ej. new Date()) y se
// convierte a hora de Ecuador.
const esDiaCalendario = (d: Date): boolean =>
    d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0;

const partesDe = (value: string | Date): PartesFecha | null => {
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null;
        if (esDiaCalendario(value)) {
            return { year: value.getFullYear(), month: value.getMonth() + 1, day: value.getDate(), hour: 0, minute: 0, second: 0 };
        }
        return partesEnEcuador(value);
    }
    if (!value) return null;
    const tieneZona = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value.trim());
    if (tieneZona) {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : partesEnEcuador(d);
    }
    const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return null;
    return {
        year: Number(m[1]),
        month: Number(m[2]),
        day: Number(m[3]),
        hour: Number(m[4] || 0),
        minute: Number(m[5] || 0),
        second: Number(m[6] || 0),
    };
};

/** Fecha calendario de Ecuador como Date a medianoche local (para comparar y para calendarios). */
export function aFecha(value: string | Date): Date | null {
    const p = partesDe(value);
    return p ? new Date(p.year, p.month - 1, p.day) : null;
}

/** Igual que aFecha pero nunca nulo (fecha inválida -> fecha mínima). Para cálculos. */
export function aFechaSegura(value: string | Date): Date {
    return aFecha(value) ?? new Date(0);
}

/** Hoy en Ecuador, a medianoche. */
export function hoyEcuador(): Date {
    return aFecha(new Date())!;
}

/** "YYYY-MM-DD" (fecha de Ecuador). */
export function fechaISO(value: string | Date = new Date()): string {
    const p = partesDe(value);
    return p ? `${p.year}-${pad(p.month)}-${pad(p.day)}` : '';
}

/** "dd/MM/yyyy" (fecha de Ecuador) para mostrar. */
export function formatearFecha(value: string | Date | null | undefined): string {
    if (!value) return '-';
    const p = partesDe(value);
    return p ? `${pad(p.day)}/${pad(p.month)}/${p.year}` : '-';
}

/** Fecha+hora actual de Ecuador en formato datetime2 para SQL Server. */
export function ahoraSQL(): string {
    const ms = new Date().getMilliseconds();
    const p = partesEnEcuador(new Date());
    return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}.${pad(ms, 3)}`;
}

/** Una fecha ("YYYY-MM-DD" o Date) como datetime2 a medianoche de Ecuador. */
export function fechaSQL(value: string | Date): string {
    const iso = fechaISO(value);
    return iso ? `${iso}T00:00:00.000` : '';
}

/** Una fecha elegida ("YYYY-MM-DD") combinada con la hora actual de Ecuador, como datetime2. */
export function fechaConHoraActualSQL(fecha: string): string {
    const iso = fechaISO(fecha);
    return iso ? `${iso}${ahoraSQL().slice(10)}` : ahoraSQL();
}

/** Límite de los calendarios: 31 de diciembre del año siguiente (resto del año en curso + el siguiente completo). */
export function limiteCalendario(): Date {
    return new Date(hoyEcuador().getFullYear() + 1, 11, 31);
}

/** 31 de diciembre del año de la fecha dada (un proyecto no puede pasar de su año). */
export function finDeAnio(fecha: Date): Date {
    return new Date(fecha.getFullYear(), 11, 31);
}
