"use client";

import { ArrowRight, Boxes, CalendarRange, Check, FolderKanban, Network } from 'lucide-react';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatearFecha } from '@/lib/fechas';

export type TipoSolicitud = 'general' | 'caja';

/** Proyecto Integrador ya creado, para retomarlo y seguir agregándole hijos. */
export interface IntegradorResumen {
    codigo: number;
    nombre: string;
    inicio: string;
    fin: string;
    hijos: number;
}

interface StepTipoSolicitudProps {
    value: TipoSolicitud | null;
    onChange: (tipo: TipoSolicitud) => void;
    integradores?: IntegradorResumen[];
    onAbrirIntegrador?: (codigo: number) => void;
}

const OPCIONES: { tipo: TipoSolicitud; titulo: string; descripcion: string; puntos: string[]; icono: React.ComponentType<{ className?: string }> }[] = [
    {
        tipo: 'general',
        titulo: 'Proyecto General Independiente',
        descripcion: 'Un proyecto con su proceso, tipo, alineación estratégica, objetivos, recursos y actividades.',
        puntos: ['Se define el proceso solicitante', 'Tipo de proyecto, pilar/OKR, objetivos y resultados esperados', 'Recursos y plan de actividades'],
        icono: FolderKanban,
    },
    {
        tipo: 'caja',
        titulo: 'Proyecto Integrador',
        descripcion: 'Un proyecto que agrupa a otros proyectos (sus hijos) bajo un mismo director y objetivo.',
        puntos: ['1. Creas el integrador: nombre, director y periodo', '2. Se abre su estructura y ahí agregas los proyectos hijos', 'Sus resultados esperados y su nota salen de sus hijos'],
        icono: Boxes,
    },
];

// Primer paso: qué se va a solicitar. Define el resto del flujo.
export default function StepTipoSolicitud({ value, onChange, integradores = [], onAbrirIntegrador }: StepTipoSolicitudProps) {
    return (
        <>
            <CardHeader>
                <CardTitle>Tipo de Solicitud</CardTitle>
                <CardDescription>Elige qué vas a solicitar; el resto de los pasos depende de esta elección.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 md:grid-cols-2" role="radiogroup" aria-label="Tipo de solicitud">
                    {OPCIONES.map((o) => {
                        const activo = value === o.tipo;
                        const Icono = o.icono;
                        return (
                            <button
                                key={o.tipo}
                                type="button"
                                role="radio"
                                aria-checked={activo}
                                onClick={() => onChange(o.tipo)}
                                className={cn(
                                    'flex flex-col gap-3 rounded-lg border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    activo ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <span className={cn('flex h-11 w-11 items-center justify-center rounded-full', activo ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                                        <Icono className="h-5 w-5" />
                                    </span>
                                    <span className={cn('flex h-6 w-6 items-center justify-center rounded-full border-2', activo ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30')}>
                                        {activo && <Check className="h-4 w-4" />}
                                    </span>
                                </div>
                                <div>
                                    <p className="font-semibold">{o.titulo}</p>
                                    <p className="text-sm text-muted-foreground">{o.descripcion}</p>
                                </div>
                                <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                                    {o.puntos.map((p) => <li key={p}>{p}</li>)}
                                </ul>
                            </button>
                        );
                    })}
                </div>

                {/* Fase 2 del integrador: retomar uno ya creado para seguir agregándole proyectos hijos. */}
                {onAbrirIntegrador && integradores.length > 0 && (
                    <div className="mt-6 flex flex-col gap-3 rounded-lg border bg-muted/20 p-4">
                        <div>
                            <p className="flex items-center gap-2 text-sm font-semibold"><Network className="h-4 w-4 text-primary" /> ¿Vas a agregar hijos a un integrador que ya existe?</p>
                            <p className="text-xs text-muted-foreground">Abre su estructura y continúa desde ahí. No necesitas elegir un tipo de solicitud.</p>
                        </div>
                        <ul className="grid max-h-72 gap-2 overflow-y-auto md:grid-cols-2">
                            {integradores.map((i) => (
                                <li key={i.codigo}>
                                    <button
                                        type="button"
                                        onClick={() => onAbrirIntegrador(i.codigo)}
                                        className="group flex w-full items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-left transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-medium">{i.nombre}</span>
                                            <span className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1"><CalendarRange className="h-3 w-3" />{formatearFecha(i.inicio)} – {formatearFecha(i.fin)}</span>
                                                <span>{i.hijos === 0 ? 'Sin hijos' : i.hijos === 1 ? '1 hijo' : `${i.hijos} hijos`}</span>
                                            </span>
                                        </span>
                                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </CardContent>
        </>
    );
}
