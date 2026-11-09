"use client";

import { useRef } from 'react';
import { ArrowRight, CalendarClock } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatearFecha } from '@/lib/fechas';
import type { RangoFechas } from '@/lib/dependencias';

export interface ReprogramacionItem {
    nombre: string;
    desde: RangoFechas;
    /** null = ya no cabe dentro del rango permitido: se limpian sus fechas. */
    hacia: RangoFechas | null;
}

interface ReprogramacionDialogProps {
    abierto: boolean;
    /** Qué acción del usuario provoca el cambio, p. ej. "Mover la actividad 1". */
    titulo: string;
    /** Qué se mueve: "actividades" o "participaciones". */
    elementos: string;
    items: ReprogramacionItem[];
    onConfirmar: () => void;
    onCancelar: () => void;
}

const rango = (r: RangoFechas) => (r.ini && r.fin ? `${formatearFecha(r.ini)} – ${formatearFecha(r.fin)}` : r.ini ? `${formatearFecha(r.ini)} – …` : 'sin fechas');

// Aviso previo: una dependencia obliga a que lo posterior empiece después de terminar lo anterior, así que este
// cambio movería otras fechas. El usuario ve cuáles y decide.
export default function ReprogramacionDialog({ abierto, titulo, elementos, items, onConfirmar, onCancelar }: ReprogramacionDialogProps) {
    // Al confirmar, Radix también cierra el diálogo (onOpenChange(false)); sin esta marca eso contaría como cancelar.
    const confirmando = useRef(false);
    return (
        <AlertDialog open={abierto} onOpenChange={(o) => { if (!o && !confirmando.current) onCancelar(); confirmando.current = false; }}>
            <AlertDialogContent className="max-w-xl">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <CalendarClock className="h-5 w-5 text-amber-600" />
                        Este cambio moverá otras fechas
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {titulo}. Por la dependencia, ninguna de las {elementos} siguientes puede empezar antes de que termine la anterior,
                        así que se reprogramarían {items.length === 1 ? 'esta' : 'estas'} {items.length}:
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <ul className="max-h-64 divide-y overflow-y-auto rounded-md border text-sm">
                    {items.map((it) => (
                        <li key={it.nombre + it.desde.ini} className="flex flex-col gap-1 px-3 py-2">
                            <span className="font-medium">{it.nombre}</span>
                            {it.hacia ? (
                                <span className="flex flex-wrap items-center gap-2 text-xs tabular-nums text-muted-foreground">
                                    <span>{rango(it.desde)}</span>
                                    <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                                    <span className="font-medium text-foreground">{rango(it.hacia)}</span>
                                </span>
                            ) : (
                                <span className="text-xs text-destructive">
                                    Ya no cabe dentro del rango permitido: se limpiarán sus fechas y deberás volver a elegirlas.
                                </span>
                            )}
                        </li>
                    ))}
                </ul>

                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar, no cambiar nada</AlertDialogCancel>
                    <AlertDialogAction onClick={() => { confirmando.current = true; onConfirmar(); }}>Reprogramar y continuar</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
