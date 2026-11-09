"use client";

import { useState } from 'react';
import { AlertTriangle, ChevronRight, Pencil, Plus, Power } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Okr, PilarEstrategico } from '@/types/interfaces';
import { okrService } from '@/services/proyectos/okr.service';
import { pilarEstrategicoService } from '@/services/proyectos/pilarEstrategico.service';
import { ahoraSQL } from '@/lib/fechas';
import { cn } from '@/lib/utils';

interface PilarRowProps {
    pilar: PilarEstrategico;
    okrs: Okr[];
    abierto: boolean;
    onToggleAbierto: () => void;
    onEditPilar: () => void;
    onNuevoOkr: () => void;
    onEditOkr: (okr: Okr) => void;
    onChanged: () => Promise<void> | void;
}

const EstadoBadge = ({ activo }: { activo: boolean }) => (
    <Badge variant="outline" className={cn('gap-1.5 font-normal', activo ? 'border-green-600/40 text-green-700 dark:text-green-400' : 'border-destructive/40 text-destructive')}>
        <span className={cn('h-1.5 w-1.5 rounded-full', activo ? 'bg-green-600' : 'bg-destructive')} />
        {activo ? 'Activo' : 'Inactivo'}
    </Badge>
);

// Fila de acordeón: el pilar y, desplegados debajo, sus OKR.
export default function PilarRow({ pilar, okrs, abierto, onToggleAbierto, onEditPilar, onNuevoOkr, onEditOkr, onChanged }: PilarRowProps) {
    const { toast } = useToast();
    const { user } = useAuth();
    const [ocupado, setOcupado] = useState<number | 'pilar' | null>(null);

    const pilarActivo = pilar.estado === 'A';
    const activos = okrs.filter((o) => o.estado === 'A').length;
    const ordenados = [...okrs].sort((a, b) => (a.estado === b.estado ? a.nombre_okr.localeCompare(b.nombre_okr) : a.estado === 'A' ? -1 : 1));

    const cambiarEstado = async (tipo: 'pilar' | Okr) => {
        const esPilar = tipo === 'pilar';
        setOcupado(esPilar ? 'pilar' : tipo.codigo_okr);
        try {
            const auditoria = { usuario_modificacion: user?.usuario || 'admin', fecha_modificacion: ahoraSQL() };
            if (esPilar) {
                await pilarEstrategicoService.save({ ...pilar, estado: pilarActivo ? 'I' : 'A', ...auditoria });
                toast({ title: 'Éxito', description: pilarActivo ? 'Pilar desactivado.' : 'Pilar reactivado.' });
            } else {
                await okrService.save({ ...tipo, estado: tipo.estado === 'A' ? 'I' : 'A', ...auditoria });
                toast({ title: 'Éxito', description: tipo.estado === 'A' ? 'OKR desactivado.' : 'OKR reactivado.' });
            }
            await onChanged();
        } catch (err) {
            toast({ title: 'Error', description: err instanceof Error ? err.message : 'No se pudo cambiar el estado.', variant: 'destructive' });
        } finally {
            setOcupado(null);
        }
    };

    return (
        <li className={cn(!pilarActivo && 'bg-muted/20')}>
            {/* Fila del pilar */}
            <div className="flex items-center gap-2 px-3 py-3 sm:px-4">
                <button
                    type="button"
                    onClick={onToggleAbierto}
                    aria-expanded={abierto}
                    aria-label={`${abierto ? 'Contraer' : 'Expandir'} pilar ${pilar.nombre_pilar}`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <ChevronRight className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', abierto && 'rotate-90')} />
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className={cn('font-semibold', !pilarActivo && 'text-muted-foreground')}>{pilar.nombre_pilar}</span>
                            <EstadoBadge activo={pilarActivo} />
                            {pilarActivo && activos === 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                                    <AlertTriangle className="h-3 w-3" /> Sin OKR activos
                                </span>
                            ) : (
                                <span className="text-xs text-muted-foreground">{activos} {activos === 1 ? 'OKR activo' : 'OKR activos'}</span>
                            )}
                        </div>
                        {pilar.descripcion_pilar && <p className="truncate text-sm text-muted-foreground">{pilar.descripcion_pilar}</p>}
                    </div>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                    <Button variant="outline" size="sm" onClick={onNuevoOkr} disabled={!pilarActivo} title={pilarActivo ? 'Agregar OKR a este pilar' : 'Activa el pilar para agregar OKR'}>
                        <Plus className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">OKR</span>
                    </Button>
                    <Button variant="ghost" size="icon" title="Editar pilar" aria-label={`Editar pilar ${pilar.nombre_pilar}`} onClick={onEditPilar}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        title={pilarActivo ? 'Desactivar pilar' : 'Reactivar pilar'}
                        aria-label={`${pilarActivo ? 'Desactivar' : 'Reactivar'} pilar ${pilar.nombre_pilar}`}
                        onClick={() => cambiarEstado('pilar')}
                        disabled={ocupado === 'pilar'}
                    >
                        <Power className={cn('h-4 w-4', pilarActivo ? 'text-destructive' : 'text-green-600')} />
                    </Button>
                </div>
            </div>

            {/* OKR del pilar */}
            {abierto && (
                <div className="pb-3 pl-9 pr-3 sm:pl-12 sm:pr-4">
                    {ordenados.length === 0 ? (
                        <p className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
                            Este pilar aún no tiene OKR.{' '}
                            {pilarActivo && (
                                <button type="button" onClick={onNuevoOkr} className="font-medium text-primary underline-offset-2 hover:underline">
                                    Agregar el primero
                                </button>
                            )}
                        </p>
                    ) : (
                        <ol className="divide-y rounded-md border">
                            {ordenados.map((okr, i) => {
                                const activo = okr.estado === 'A';
                                return (
                                    <li key={okr.codigo_okr} className={cn('flex items-start gap-3 px-3 py-2.5', !activo && 'bg-muted/30')}>
                                        <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums', activo ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                                            {i + 1}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className={cn('text-sm font-medium', !activo && 'text-muted-foreground')}>{okr.nombre_okr}</p>
                                                {!activo && <EstadoBadge activo={false} />}
                                            </div>
                                            {okr.descripcion_okr && <p className="text-sm text-muted-foreground">{okr.descripcion_okr}</p>}
                                        </div>
                                        <div className="flex shrink-0 gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar OKR" aria-label={`Editar OKR ${okr.nombre_okr}`} onClick={() => onEditOkr(okr)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                title={activo ? 'Desactivar' : 'Reactivar'}
                                                aria-label={`${activo ? 'Desactivar' : 'Reactivar'} OKR ${okr.nombre_okr}`}
                                                onClick={() => cambiarEstado(okr)}
                                                disabled={ocupado === okr.codigo_okr}
                                            >
                                                <Power className={cn('h-4 w-4', activo ? 'text-destructive' : 'text-green-600')} />
                                            </Button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </div>
            )}
        </li>
    );
}
