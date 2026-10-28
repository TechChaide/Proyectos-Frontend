
// Semáforo de actividades. Los colores son la paleta de ESTADO (reservada: no se usa para
// series ni decoración) y siempre se muestran con ícono + etiqueta, nunca solo el color.
// Estados automáticos por fecha (pendiente/en_ejecucion/vencida) + el manual (completada / con atraso).
export type EstadoVisual = 'completada' | 'completada_atraso' | 'vencida' | 'en_ejecucion' | 'pendiente';

export interface EstiloEstado {
    etiqueta: string;
    /** Color de la marca (barra, punto, borde). */
    color: string;
    /** Color de texto legible sobre `color` (para insignias). */
    texto: string;
}

export const ESTILO_ESTADO_VISUAL: Record<EstadoVisual, EstiloEstado> = {
    completada: { etiqueta: 'Completada', color: '#0ca30c', texto: '#ffffff' },
    completada_atraso: { etiqueta: 'Completada con atraso', color: '#fab219', texto: '#0b0b0b' },
    vencida: { etiqueta: 'Vencida', color: '#d03b3b', texto: '#ffffff' },
    en_ejecucion: { etiqueta: 'En ejecución', color: '#2a78d6', texto: '#ffffff' },
    pendiente: { etiqueta: 'Pendiente', color: '#6b6a66', texto: '#ffffff' },
};

// Orden por urgencia (lo que requiere foco primero): vencida → en ejecución → pendiente → completadas.
export const ORDEN_ESTADOS: EstadoVisual[] = ['vencida', 'en_ejecucion', 'pendiente', 'completada_atraso', 'completada'];
