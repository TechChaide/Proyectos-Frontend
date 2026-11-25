"use client";

import { Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ObjetivosNivelesProps {
    principal?: string;
    secundarios: string[];
    /** Versión para filas de una lista: tipografía y espacios reducidos. */
    compacto?: boolean;
    /** Si es false se muestra solo el objetivo principal (p. ej. con la fila contraída). */
    mostrarSecundarios?: boolean;
    className?: string;
}

// Muestra los objetivos con sus dos niveles bien distintos: el PRINCIPAL (el propósito general) destacado, y debajo
// los SECUNDARIOS (los concretos con los que se logra), numerados, con sangría y en menor jerarquía visual.
export default function ObjetivosNiveles({ principal, secundarios, compacto = false, mostrarSecundarios = true, className }: ObjetivosNivelesProps) {

    return (
        <div className={cn('flex flex-col', compacto ? 'gap-1' : 'gap-2', className)}>
            <div className={cn('rounded-md border-l-[3px] border-primary bg-primary/5', compacto ? 'px-2 py-1' : 'px-2.5 py-1.5')}>
                <p className={cn('flex items-center gap-1 font-semibold uppercase tracking-wide text-primary', compacto ? 'text-[9px]' : 'mb-0.5 text-[10px]')}>
                    <Target className={compacto ? 'h-2.5 w-2.5' : 'h-3 w-3'} /> Principal
                </p>
                <p className={cn('font-medium leading-snug', compacto ? 'line-clamp-2 text-xs' : 'text-sm')}>
                    {principal || <span className="font-normal text-muted-foreground">Sin objetivo principal</span>}
                </p>
            </div>

            {mostrarSecundarios && (
                <div className={cn('ml-3 border-l border-dashed pl-3', compacto && 'ml-2 pl-2')}>
                    <p className={cn('font-semibold uppercase tracking-wide text-muted-foreground', compacto ? 'mb-0.5 text-[9px]' : 'mb-1 text-[10px]')}>
                        Secundarios{secundarios.length > 0 ? ` (${secundarios.length})` : ''}
                    </p>
                    {secundarios.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Sin objetivos secundarios</p>
                    ) : (
                        <ol className="space-y-0.5">
                            {secundarios.map((o, i) => (
                                <li key={i} className={cn('flex gap-1.5 text-muted-foreground', compacto ? 'text-[11px]' : 'text-xs')}>
                                    <span className="shrink-0 font-medium tabular-nums text-foreground/70">{i + 1}.</span>
                                    <span>{o}</span>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            )}
        </div>
    );
}
