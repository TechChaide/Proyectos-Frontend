// Nomenclatura de niveles del organigrama de procesos (autoreferencial vía codigo_proceso_padre).
// No requiere columna nueva en BD: el nivel se deriva de la profundidad en el árbol.
//
// Obligatorio para cualquier MR/MSP/PI/OI: Macroproceso -> Proceso (profundidad 0,1).
// El Proceso (profundidad 1) es el nivel de anclaje: ahí cuelgan evaluación, recursos y actividades.
// Opcional, solo si el proceso es productivo y se quiere hilar más fino:
// Subproceso -> Línea -> Puesto de Trabajo/Actividad -> Tarea (profundidad 2,3,4,5+).

// Centros habilitados (campo `centro` varchar(4)).
export const CENTROS = ['1000', '2000'];

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
