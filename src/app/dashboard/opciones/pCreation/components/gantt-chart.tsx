
"use client";

import { useMemo } from 'react';
import Gantt, { type GanttFila, type GanttGrupo } from '@/components/gantt/gantt';
import type { FichaSocialHistorica, Responsable } from '@/types/interfaces';
import { participacionPorDuracion, porcentajesEnteros } from '@/lib/actividades';
import type { ActividadWizardValues } from '../schema';

interface GanttChartProps {
    actividades: ActividadWizardValues[];
    responsables: Responsable[];
    personas: FichaSocialHistorica[];
    /** Dependencias (solo ayuda visual): índice de actividad → índices de sus actividades predecesoras. */
    dependencias?: Record<number, number[] | null>;
}

// Paleta categórica para distinguir cada actividad (colores diferenciables entre sí). El color
// identifica la actividad; en las compartidas, los participantes comparten el color de su actividad.
const PALETA_ACTIVIDADES = [
    '#2a78d6', // azul
    '#d9822b', // naranja
    '#2a9d6f', // verde azulado
    '#9b5de5', // púrpura
    '#d6456f', // frambuesa
    '#0e7fa8', // cian oscuro
    '#b59400', // mostaza
    '#5e6ad2', // índigo
    '#c2410c', // naranja quemado
    '#4d7c0f', // oliva
];
export const colorDeActividad = (i: number) => PALETA_ACTIVIDADES[i % PALETA_ACTIVIDADES.length];

// Vista previa del plan en el wizard: cada actividad con su propio color y, si es compartida, una fila
// por participante con su % de participación. Las dependencias conectan una actividad con la siguiente.
export default function GanttChart({ actividades, responsables, personas, dependencias }: GanttChartProps) {
    const grupos = useMemo<GanttGrupo[]>(() => {
        const responsableMap = new Map(responsables.map((r) => [r.codigo_responsable, r]));
        const personaMap = new Map(personas.map((p) => [p.CODIGO, p]));
        const nombreDe = (codigo: number) => {
            const r = responsableMap.get(codigo);
            if (!r) return 'Sin responsable';
            return personaMap.get(r.codigo_empleado)?.NOMBRE || r.codigo_empleado;
        };
        const dependeDeDe = (i: number): string[] | undefined => {
            const preds = dependencias?.[i];
            return preds && preds.length ? preds.map((p) => `a${p}`) : undefined;
        };

        const filas: GanttFila[] = [];
        type Tarea = Pick<ActividadWizardValues, 'fecha_inicio_actividad' | 'fecha_fin_actividad' | 'participantes'>;
        // Filas de una tarea (actividad sin subactividades o subactividad): una sola fila si es individual; si es
        // compartida, una fila resumen y una por participante con su % de participación.
        const agregarTarea = (t: Tarea, id: string, nombre: string, color: string, nivel: 0 | 1, bloqueExterno?: string, dependeDe?: string[]) => {
            const participantes = (t.participantes || []).filter(Boolean);
            if (participantes.length <= 1) {
                const p = participantes[0];
                filas.push({
                    id, nombre, color, nivel, dependeDe, bloque: bloqueExterno,
                    detalle: p?.codigo_responsable ? nombreDe(p.codigo_responsable) : 'Sin responsable',
                    inicio: t.fecha_inicio_actividad,
                    fin: t.fecha_fin_actividad,
                    estado: 'pendiente',
                });
                return;
            }
            const participacion = porcentajesEnteros(participacionPorDuracion(
                participantes.map((p) => ({ inicio: p.fecha_inicio_actividad || t.fecha_inicio_actividad, fin: p.fecha_fin_actividad || t.fecha_fin_actividad }))
            ));
            const bloque = bloqueExterno ?? `b${id}`;
            filas.push({
                id, nombre, color, nivel, dependeDe, bloque,
                detalle: `${participantes.length} participantes`,
                inicio: t.fecha_inicio_actividad,
                fin: t.fecha_fin_actividad,
                estado: 'contenedor',
                progreso: 0,
            });
            participantes.forEach((p, j) => {
                filas.push({
                    id: `${id}p${j}`,
                    nombre: p.codigo_responsable ? nombreDe(p.codigo_responsable) : 'Sin responsable',
                    detalle: `Participación ${participacion[j]}%`,
                    inicio: p.fecha_inicio_actividad || t.fecha_inicio_actividad,
                    fin: p.fecha_fin_actividad || t.fecha_fin_actividad,
                    estado: 'pendiente',
                    nivel: (nivel + 1) as 1 | 2,
                    bloque,
                    color,
                    etiquetaFin: `${participacion[j]}%`,
                    tooltip: [`Participación en la actividad: ${participacion[j]}%`],
                });
            });
        };

        (actividades || []).forEach((a, i) => {
            if (!a?.fecha_inicio_actividad || !a?.fecha_fin_actividad) return;
            const nombre = a.nombre_actividad?.trim() || `Actividad ${i + 1}`;
            const color = colorDeActividad(i);
            const subs = (a.subactividades || []).filter((sub) => sub?.fecha_inicio_actividad && sub?.fecha_fin_actividad);
            if (!a.subactividades?.length) {
                agregarTarea(a, `a${i}`, nombre, color, 0, undefined, dependeDeDe(i));
                return;
            }
            // Actividad dividida en subactividades: barra resumen y, debajo, cada subactividad con sus participantes.
            const bloque = `b${i}`;
            filas.push({
                id: `a${i}`,
                nombre,
                detalle: `${a.subactividades.length} subactividad(es)`,
                inicio: a.fecha_inicio_actividad,
                fin: a.fecha_fin_actividad,
                estado: 'contenedor',
                progreso: 0,
                bloque,
                color,
                dependeDe: dependeDeDe(i),
            });
            subs.forEach((sub, k) => agregarTarea(sub, `a${i}s${k}`, `${i + 1}.${k + 1} ${sub.nombre_actividad?.trim() || 'Subactividad'}`, color, 1, bloque));
        });
        return [{ id: 'plan', filas }];
    }, [actividades, responsables, personas, dependencias]);

    return (
        <Gantt
            grupos={grupos}
            titulo="Diagrama de Gantt"
            descripcion="Vista previa del plan. Cada actividad tiene su propio color; las que tienen subactividades o varios participantes se muestran como un bloque, y las dependencias conectan una actividad con la siguiente."
            vacio="Agrega actividades con fecha de inicio y fin para visualizar el diagrama de Gantt."
            mostrarAvance={false}
        />
    );
}
