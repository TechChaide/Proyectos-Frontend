// Nomenclatura de niveles del organigrama de procesos (autoreferencial vía codigo_proceso_padre).
// No requiere columna nueva en BD: el nivel se deriva de la profundidad en el árbol.
//
// Obligatorio para cualquier MR/MSP/PI/OI: Macroproceso -> Proceso (profundidad 0,1).
// El Proceso (profundidad 1) es el nivel de anclaje: ahí cuelgan evaluación, recursos y actividades.
// Opcional, solo si el proceso es productivo y se quiere hilar más fino:
// Subproceso -> Línea -> Puesto de Trabajo/Actividad -> Tarea (profundidad 2,3,4,5+).

// Regionales (campo `centro` varchar(4)).
// Macroprocesos y Procesos son COMUNES a todas las regionales (se guardan sin centro).
// La regional se asigna al Subproceso y la heredan sus niveles inferiores (Línea, Puesto, Tarea).

// Regionales base que se ofrecen al registrar un Subproceso, aunque todavía no haya ninguno en la tabla.
export const CENTROS = ['1000', '2000'];

const ordenarCentros = (centros: Iterable<string>) =>
    [...new Set(centros)].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));

// Regionales distintas registradas en la tabla proceso. Orden numérico.
export function centrosDeProcesos(procesos: { centro?: string | null }[]): string[] {
    return ordenarCentros(procesos.map((p) => (p.centro || '').trim()).filter(Boolean));
}

// Regionales que se pueden elegir al crear un Subproceso: las base más cualquiera ya registrada en la tabla.
export function regionalesDisponibles(procesos: { centro?: string | null }[]): string[] {
    return ordenarCentros([...CENTROS, ...centrosDeProcesos(procesos)]);
}

export const NIVELES_PROCESO = [
    'Macroproceso',
    'Proceso',
    'Subproceso',
    'Línea',
    'Puesto de Trabajo',
    'Tarea',
] as const;

// Profundidad (índice 0-based) del nivel "Proceso": el anclaje obligatorio de MR/MSP/PI/OI.
export const PROFUNDIDAD_PROCESO = 1;

// Profundidad del "Subproceso": primer nivel que pertenece a una regional (centro).
export const PROFUNDIDAD_SUBPROCESO = PROFUNDIDAD_PROCESO + 1;

export function nombreNivel(profundidad: number): string {
    if (profundidad < NIVELES_PROCESO.length) return NIVELES_PROCESO[profundidad];
    // Más allá de "Tarea" se sigue permitiendo anidar (p. ej. subtareas), rotulado genérico.
    return `Tarea (nivel ${profundidad - NIVELES_PROCESO.length + 2})`;
}

// Desde "Proceso" en adelante es donde puede anclarse un MR/MSP/PI/OI, y desde donde
// es opcional seguir hilando más fino (Subproceso, Línea, Puesto, Tarea).
export function esNivelAnclaje(profundidad: number): boolean {
    return profundidad >= PROFUNDIDAD_PROCESO;
}

// Antes de "Proceso" (Macroproceso) el nodo es solo estructura organizativa: no se
// le puede anclar directamente un proyecto/MR/MSP/PI.
export function esSoloEstructura(profundidad: number): boolean {
    return profundidad < PROFUNDIDAD_PROCESO;
}

// Procesos vigentes: activos Y con toda su cadena de niveles superiores activa. Un nivel activo bajo uno inactivo
// (dato antiguo) tampoco se muestra ni se ofrece, porque su rama completa quedó fuera de uso.
export function procesosVigentes<T extends { codigo_proceso: number; codigo_proceso_padre?: number | null; estado: string }>(procesos: T[]): T[] {
    const porCodigo = new Map(procesos.map((p) => [p.codigo_proceso, p]));
    const vigente = (p: T): boolean => {
        let actual: T | undefined = p;
        for (let i = 0; actual && i < 20; i++) {
            if (actual.estado !== 'A') return false;
            actual = actual.codigo_proceso_padre ? porCodigo.get(actual.codigo_proceso_padre) : undefined;
        }
        return true;
    };
    return procesos.filter(vigente);
}
