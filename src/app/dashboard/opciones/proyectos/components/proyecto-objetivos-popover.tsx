"use client";

import { useState } from 'react';
import { Target } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Objetivo } from '@/types/interfaces';
import { objetivoService } from '@/services/proyectos/objetivo.service';

interface ProyectoObjetivosPopoverProps {
    codigoProyecto: number;
    objetivoPrincipal?: string;
}

// Contexto rápido de "para qué" es un proyecto: su objetivo principal y los específicos. Los específicos se
// cargan solo al abrir, para no pedir datos por cada tarjeta de la lista.
export default function ProyectoObjetivosPopover({ codigoProyecto, objetivoPrincipal }: ProyectoObjetivosPopoverProps) {
    const [objetivos, setObjetivos] = useState<Objetivo[] | null>(null);
    const [error, setError] = useState(false);

    const cargar = async (abierto: boolean) => {
        if (!abierto || objetivos !== null) return;
        try {
            const resp = await objetivoService.getByProyecto(codigoProyecto);
            setObjetivos((resp.data || []).filter((o) => o.estado === 'A'));
        } catch {
            setError(true);
            setObjetivos([]);
        }
    };

    return (
        <Popover onOpenChange={cargar}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="flex w-fit items-center gap-1.5 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <Target className="h-3.5 w-3.5 shrink-0" /> Para qué es este proyecto
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Objetivo principal</p>
                <p className="mb-3 mt-0.5">{objetivoPrincipal || 'No definido.'}</p>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Objetivos específicos</p>
                {objetivos === null ? (
                    <p className="mt-0.5 text-muted-foreground">Cargando…</p>
                ) : error ? (
                    <p className="mt-0.5 text-destructive">No se pudieron cargar.</p>
                ) : objetivos.length === 0 ? (
                    <p className="mt-0.5 text-muted-foreground">Este proyecto no define objetivos específicos.</p>
                ) : (
                    <ol className="mt-1 list-decimal space-y-1 pl-5">
                        {objetivos.map((o) => <li key={o.codigo_objetivo}>{o.descripcion_objetivo}</li>)}
                    </ol>
                )}
            </PopoverContent>
        </Popover>
    );
}
