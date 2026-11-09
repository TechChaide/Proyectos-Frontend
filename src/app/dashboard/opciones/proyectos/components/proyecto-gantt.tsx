"use client";

import { useMemo } from 'react';
import Gantt, { type GanttFila, type GanttGrupo } from '@/components/gantt/gantt';
import type { Actividad, FichaSocialHistorica, Responsable } from '@/types/interfaces';
import { actividadesPrincipales, hijosPorPadre, participacionEnteraPorActividad } from '@/lib/actividades';
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
        principales.forEach((a, i) => {
            const color = colorDeActividad(i);
            const partes = hijos.get(a.codigo_actividad) || [];
            if (partes.length === 0) {
                filas.push({
                    id: `a${a.codigo_actividad}`,
                    nombre: a.nombre_actividad,
                    detalle: nombreDe(a.codigo_responsable),
                    inicio: a.fecha_inicio_actividad,
                    fin: a.fecha_fin_actividad,
                    estado: 'pendiente',
                    color,
                });
                return;
            }
            const bloque = `b${a.codigo_actividad}`;
            filas.push({
                id: `a${a.codigo_actividad}`,
                nombre: a.nombre_actividad,
                detalle: `${partes.length} participantes`,
                inicio: a.fecha_inicio_actividad,
                fin: a.fecha_fin_actividad,
                estado: 'contenedor',
                progreso: 0,
                bloque,
                color,
            });
            partes.forEach((h) => {
                const pct = participacion.get(h.codigo_actividad) ?? 0;
                filas.push({
                    id: `a${a.codigo_actividad}p${h.codigo_actividad}`,
                    nombre: nombreDe(h.codigo_responsable),
                    detalle: `Participación ${pct}%`,
                    inicio: h.fecha_inicio_actividad,
                    fin: h.fecha_fin_actividad,
                    estado: 'pendiente',
                    nivel: 1,
                    bloque,
                    color,
                    etiquetaFin: `${pct}%`,
                    tooltip: [`Participación en la actividad: ${pct}%`],
                });
            });
        });
        return [{ id: 'proyecto', filas }];
    }, [actividades, responsables, personas]);

    return (
        <Gantt
            grupos={grupos}
            titulo={titulo}
            descripcion="Cada actividad tiene su propio color. Las compartidas se muestran como un bloque con la participación de cada persona."
            vacio="Este proyecto no tiene actividades con fechas para mostrar."
            mostrarAvance={false}
        />
    );
}
