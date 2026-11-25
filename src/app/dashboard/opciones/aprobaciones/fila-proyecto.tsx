"use client";

import { CalendarRange, ChevronRight, Clock, CornerDownRight, Landmark, Package, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatearFecha } from '@/lib/fechas';
import { duracionDias } from '@/lib/actividades';
import { cn } from '@/lib/utils';
import type { ProyectoView } from '../proyectos/types';
import type { AlineacionResumen, RecursoResumen } from './use-datos-aprobacion';
import ObjetivosNiveles from '../proyectos/components/objetivos-niveles';

// Columnas de la "tabla" de tarjetas: el encabezado y cada fila comparten esta plantilla (solo en pantallas anchas).
export const COLUMNAS_FILA = 'lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_minmax(0,2fr)_minmax(0,1.6fr)_minmax(0,2fr)]';

const money = (n: number) => `$${n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Etiqueta = ({ children }: { children: React.ReactNode }) => (
    <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground lg:hidden">{children}</span>
);

interface FilaProyectoProps {
    view: ProyectoView;
    objetivos: string[];
    recursos: RecursoResumen[];
    alineacion?: AlineacionResumen;
    /** Nombres de los responsables del proyecto (el proyecto guarda sus códigos). */
    responsable?: string[];
    abierto: boolean;
    onToggle: () => void;
    children?: React.ReactNode;
}

// Fila de la bandeja: una tarjeta con lo esencial del proyecto (nombre, objetivos, responsable, estado y recursos).
// Al hacer clic se expande y muestra la revisión completa.
export default function FilaProyecto({ view, objetivos, recursos, alineacion, responsable, abierto, onToggle, children }: FilaProyectoProps) {
    const p = view.proyecto;
    const costo = recursos.reduce((s, r) => s + r.subtotal, 0);
    const esSub = !!view.padreNombre;

    return (
        <div className={cn('rounded-lg border bg-card transition-shadow', abierto ? 'border-primary/50 shadow-md' : 'hover:shadow-sm', esSub && 'lg:ml-6')}>
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={abierto}
                aria-label={`${abierto ? 'Contraer' : 'Expandir'} el proyecto ${p.nombre_proyecto}`}
                className={cn('grid w-full gap-x-4 gap-y-3 rounded-lg p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', COLUMNAS_FILA)}
            >
                {/* 1) Nombre */}
                <div className="flex min-w-0 items-start gap-2">
                    <ChevronRight className={cn('mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform', abierto && 'rotate-90 text-primary')} />
                    <div className="min-w-0">
                        <Etiqueta>Proyecto</Etiqueta>
                        <p className="font-semibold leading-snug">{p.nombre_proyecto}</p>
                        {esSub && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                <CornerDownRight className="h-3 w-3 shrink-0" /> Hijo de: {view.padreNombre}
                            </p>
                        )}
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{view.areaNombre}{view.tipoProyectoNombre ? ` · ${view.tipoProyectoNombre}` : ''}</p>
                        {/* Alineación estratégica: pilar y OKR */}
                        <div className="mt-1.5 flex flex-col gap-0.5 text-xs">
                            {alineacion ? (
                                <>
                                    <p className="flex items-start gap-1 text-muted-foreground"><Landmark className="mt-0.5 h-3 w-3 shrink-0" /><span className="line-clamp-1"><span className="font-medium text-foreground">Pilar:</span> {alineacion.pilar || '—'}</span></p>
                                    <p className="flex items-start gap-1 pl-4 text-muted-foreground"><span className="line-clamp-1"><span className="font-medium text-foreground">OKR:</span> {alineacion.okr}</span></p>
                                </>
                            ) : (
                                <p className="flex items-center gap-1 text-muted-foreground"><Landmark className="h-3 w-3 shrink-0" /> Sin pilar ni OKR</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2) Objetivo principal y secundarios */}
                <div className="min-w-0 pl-6 lg:pl-0">
                    <Etiqueta>Objetivos</Etiqueta>
                    <ObjetivosNiveles principal={p.objetivo_principal} secundarios={objetivos} compacto mostrarSecundarios={abierto} />
                </div>

                {/* 3) Responsable */}
                <div className="min-w-0 pl-6 lg:pl-0">
                    <Etiqueta>Responsable</Etiqueta>
                    {responsable && responsable.length > 0 ? (
                        <ul className="space-y-0.5">
                            {responsable.map((nombre, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-sm">
                                    <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <span className="leading-snug">{nombre}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="flex items-start gap-1.5 text-sm text-muted-foreground"><User className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Sin responsable</p>
                    )}
                </div>

                {/* 4) Estado */}
                <div className="min-w-0 pl-6 lg:pl-0">
                    <Etiqueta>Estado</Etiqueta>
                    <Badge variant="secondary" className="w-fit gap-1 text-amber-700">
                        <Clock className="h-3 w-3" /> {view.estadoSolicitudNombre || 'Pendiente de aprobación'}
                    </Badge>
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarRange className="h-3 w-3 shrink-0" />
                        {formatearFecha(p.fecha_inicio)} – {formatearFecha(p.fecha_fin)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{duracionDias(p.fecha_inicio, p.fecha_fin)} días</p>
                </div>

                {/* 5) Recursos */}
                <div className="min-w-0 pl-6 lg:pl-0">
                    <Etiqueta>Recursos</Etiqueta>
                    {recursos.length > 0 ? (
                        <>
                            <p className="flex items-start gap-1.5 text-sm">
                                <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <span className="font-medium tabular-nums">{money(costo)}</span>
                            </p>
                            <p className="mt-0.5 line-clamp-2 pl-5 text-xs text-muted-foreground">
                                {recursos.length} {recursos.length === 1 ? 'recurso' : 'recursos'}: {recursos.slice(0, 3).map((r) => r.nombre).join(', ')}{recursos.length > 3 ? '…' : ''}
                            </p>
                        </>
                    ) : (
                        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                            <Package className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Sin recursos
                        </p>
                    )}
                </div>
            </button>

            {abierto && <div className="border-t bg-muted/20 p-4">{children}</div>}
        </div>
    );
}
