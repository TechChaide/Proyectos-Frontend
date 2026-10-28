import type { SistemaCalificacion } from '@/lib/rubricas';

// Identidad visual de cada tipo de proyecto, para que el usuario los distinga de un vistazo.
export const ESTILO_SISTEMA: Record<SistemaCalificacion, { sigla: string; nombre: string; color: string }> = {
    MR: { sigla: 'MR', nombre: 'Mejoras Rápidas', color: '#0284c7' },
    MSP: { sigla: 'MSP', nombre: 'Solución de Problemas', color: '#7c3aed' },
    PI: { sigla: 'PI', nombre: 'Proyecto de Innovación', color: '#ea580c' },
    INDIVIDUAL: { sigla: 'OI', nombre: 'Objetivos Individuales', color: '#475569' },
};

export const ORDEN_SISTEMAS: SistemaCalificacion[] = ['MR', 'MSP', 'PI', 'INDIVIDUAL'];
