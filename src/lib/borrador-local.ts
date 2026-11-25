// Borradores locales: guardan en el navegador (localStorage) el avance de un formulario largo para poder recuperarlo si
// la sesión expira, la pestaña se recarga o se sale de la página sin guardar. Es solo del navegador y del usuario
// (la clave incluye el usuario): no se envía a ningún servidor.
//
// Todo está protegido con try/catch: en modo privado, con el almacenamiento lleno o bloqueado simplemente no hay borrador.

const PREFIJO = 'gestor-proyectos:borrador:';

export interface BorradorGuardado<T> {
    /** Fecha y hora (ISO) del último guardado. */
    guardadoEn: string;
    datos: T;
}

export function leerBorrador<T>(clave: string): BorradorGuardado<T> | null {
    try {
        const crudo = window.localStorage.getItem(PREFIJO + clave);
        if (!crudo) return null;
        const parsed = JSON.parse(crudo);
        if (!parsed || typeof parsed !== 'object' || typeof parsed.guardadoEn !== 'string' || !('datos' in parsed)) return null;
        return parsed as BorradorGuardado<T>;
    } catch {
        return null;
    }
}

/** Guarda el borrador. Devuelve la fecha/hora de guardado, o null si el navegador no lo permitió. */
export function guardarBorrador<T>(clave: string, datos: T): string | null {
    try {
        const guardadoEn = new Date().toISOString();
        window.localStorage.setItem(PREFIJO + clave, JSON.stringify({ guardadoEn, datos } satisfies BorradorGuardado<T>));
        return guardadoEn;
    } catch {
        return null;
    }
}

export function borrarBorrador(clave: string): void {
    try {
        window.localStorage.removeItem(PREFIJO + clave);
    } catch {
        /* sin almacenamiento: no hay nada que borrar */
    }
}
