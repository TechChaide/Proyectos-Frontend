"use client";

import { cn } from '@/lib/utils';

interface SeccionFormularioProps {
    icono: React.ComponentType<{ className?: string }>;
    titulo: string;
    ayuda?: string;
    /** Número de orden de la sección dentro del paso (opcional). */
    numero?: number;
    className?: string;
    /** Clases de la grilla interna (por defecto, 2 columnas en pantallas medianas). */
    gridClassName?: string;
    children: React.ReactNode;
}

// Bloque con título de un formulario del asistente: agrupa campos relacionados para que el paso se lea en orden.
export default function SeccionFormulario({ icono: Icono, titulo, ayuda, numero, className, gridClassName, children }: SeccionFormularioProps) {
    return (
        <section className={cn('flex flex-col gap-4 rounded-lg border p-4', className)}>
            <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icono className="h-4 w-4" />
                </span>
                <div>
                    <p className="text-sm font-semibold">
                        {numero !== undefined && <span className="mr-1.5 text-muted-foreground tabular-nums">{numero}.</span>}
                        {titulo}
                    </p>
                    {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
                </div>
            </div>
            <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-2', gridClassName)}>{children}</div>
        </section>
    );
}
