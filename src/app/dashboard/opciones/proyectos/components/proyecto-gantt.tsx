"use client";

import { useMemo } from 'react';
import Gantt, { type GanttFila, type GanttGrupo } from '@/components/gantt/gantt';
import type { Actividad, FichaSocialHistorica, Responsable } from '@/types/interfaces';
import { actividadesPrincipales, esParticipacion, hijosPorPadre, participacionEnteraPorActividad } from '@/lib/actividades';
import { aFechaSegura } from '@/lib/fechas';
import { colorDeActividad } from '../../pCreation/components/gantt-chart';

interface ProyectoGanttProps {
    actividades: Actividad[];
    responsables: Responsable[];
    personas: FichaSocialHistorica[];
    titulo?: string;
}

// Cronograma de un proyecto ya registrado (para revisarlo): cada actividad con su propio color y, si es
// compartida, un bloque con una fila por participante y su porcentaje de participación.
export default function ProyectoGantt({ actividades, responsables, personas, titulo = 'Cronograma del proyecto' }: ProyectoGanttProps) {
    const grupos = useMemo<GanttGrupo[]>(() => {
        const responsableMap = new Map(responsables.map((r) => [r.codigo_responsable, r]));
        const personaMap = new Map(personas.map((p) => [p.CODIGO, p]));
        const nombreDe = (codigo: number) => {
            const r = responsableMap.get(codigo);
            if (!r) return 'Sin responsable';
            return personaMap.get(r.codigo_empleado)?.NOMBRE || r.codigo_empleado;
        };
        const hijos = hijosPorPadre(actividades);
        const participacion = participacionEnteraPorActividad(actividades);

        const principales = actividadesPrincipales(actividades).sort(
            (a, b) => aFechaSegura(a.fecha_inicio_actividad).getTime() - aFechaSegura(b.fecha_inicio_actividad).getTime()
        );

        const filas: GanttFila[] = [];
        const porInicio = (x: (typeof actividades)[number], y: (typeof actividades)[number]) => aFechaSegura(x.fecha_inicio_actividad).getTime() - aFechaSegura(y.fecha_inicio_actividad).getTime();
        // Una tarea (actividad o subactividad): individual = una fila; compartida = resumen + una fila por participación.
        const agregarTarea = (t: (typeof actividades)[number], nivel: 0 | 1, color: string, bloqueExterno?: string, prefijo = '') => {
            const partes = (hijos.get(t.codigo_actividad) || []).filter((h) => esParticipacion(h, t)).sort(porInicio);
            if (partes.length === 0) {
                filas.push({ id: `a${t.codigo_actividad}`, nombre: `${prefijo}${t.nombre_actividad}`, detalle: nombreDe(t.codigo_responsable), inicio: t.fecha_inicio_actividad, fin: t.fecha_fin_actividad, estado: 'pendiente', color, nivel, bloque: bloqueExterno });
                return;
            }
            const bloque = bloqueExterno ?? `b${t.codigo_actividad}`;
            filas.push({ id: `a${t.codigo_actividad}`, nombre: `${prefijo}${t.nombre_actividad}`, detalle: `${partes.length} participantes`, inicio: t.fecha_inicio_actividad, fin: t.fecha_fin_actividad, estado: 'contenedor', progreso: 0, bloque, color, nivel });
            partes.forEach((h) => {
                const pct = participacion.get(h.codigo_actividad) ?? 0;
                filas.push({
                    id: `p${h.codigo_actividad}`,
                    nombre: nombreDe(h.codigo_responsable),
                    detalle: `Participación ${pct}%`,
                    inicio: h.fecha_inicio_actividad,
                    fin: h.fecha_fin_actividad,
                    estado: 'pendiente',
                    nivel: (nivel + 1) as 1 | 2,
                    bloque,
                    color,
                    etiquetaFin: `${pct}%`,
                    tooltip: [`Participación: ${pct}%`],
                });
            });
        };
        principales.forEach((a, i) => {
            const color = colorDeActividad(i);
            const subs = (hijos.get(a.codigo_actividad) || []).filter((h) => !esParticipacion(h, a)).sort(porInicio);
            if (subs.length === 0) {
                agregarTarea(a, 0, color);
                return;
            }
            // Actividad con subactividades: barra resumen y, debajo, cada subactividad con sus participaciones.
            const bloque = `b${a.codigo_actividad}`;
            filas.push({ id: `a${a.codigo_actividad}`, nombre: a.nombre_actividad, detalle: `${subs.length} subactividad(es)`, inicio: a.fecha_inicio_actividad, fin: a.fecha_fin_actividad, estado: 'contenedor', progreso: 0, bloque, color });
            subs.forEach((sub) => agregarTarea(sub, 1, color, bloque));
        });
        return [{ id: 'proyecto', filas }];
    }, [actividades, responsables, personas]);

    return (
        <Gantt
            grupos={grupos}
            titulo={titulo}
            descripcion="Cada actividad tiene su propio color. Las que tienen subactividades o varios participantes se muestran como un bloque."
            vacio="Este proyecto no tiene actividades con fechas para mostrar."
            mostrarAvance={false}
        />
    );
}
