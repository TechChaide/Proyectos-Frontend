"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Building2, Check, ChevronRight, Mail, Search, Workflow } from 'lucide-react';
import type { Area } from '@/types/interfaces';
import { FormField, FormItem, FormMessage } from '@/components/ui/form';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ProyectoWizardValues } from '../schema';
import { CENTROS, PROFUNDIDAD_PROCESO, nombreNivel } from '@/lib/procesoNiveles';

interface StepAreaProps {
    form: UseFormReturn<ProyectoWizardValues>;
    areas: Area[];
    isLoading: boolean;
}

const UMBRAL_BUSQUEDA = 8;

interface OpcionCardProps {
    titulo: string;
    detalle?: string;
    seleccionada?: boolean;
    onClick: () => void;
    icono?: React.ReactNode;
}

function OpcionCard({ titulo, detalle, seleccionada, onClick, icono }: OpcionCardProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={seleccionada}
            className={cn(
                'flex items-center gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                seleccionada && 'border-primary bg-primary/5 ring-1 ring-primary'
            )}
        >
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', seleccionada ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary')}>
                {seleccionada ? <Check className="h-5 w-5" /> : icono ?? <Workflow className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{titulo}</p>
                {detalle ? <p className="truncate text-xs text-muted-foreground">{detalle}</p> : null}
            </div>
        </button>
    );
}

// Paso 1: selección en cascada Centro › Macroproceso › Proceso (obligatorio) › Subproceso › Línea › Puesto › Tarea (opcional).
export default function StepArea({ form, areas, isLoading }: StepAreaProps) {
    const [centro, setCentro] = useState('');
    const [path, setPath] = useState<number[]>([]); // ids desde el macroproceso hacia abajo
    const [busqueda, setBusqueda] = useState('');
    const inicializado = useRef(false);

    const porId = useMemo(() => new Map(areas.map((a) => [a.codigo_proceso, a])), [areas]);
    const hijosDe = (padre: number | null) =>
        areas
            .filter((a) => (padre === null ? !a.codigo_proceso_padre : a.codigo_proceso_padre === padre))
            .sort((a, b) => a.nombre_proceso.localeCompare(b.nombre_proceso));

    // El proceso seleccionado es el último nodo de la ruta, siempre que ya se haya llegado al nivel "Proceso".
    const aplicar = (nuevoCentro: string, nuevoPath: number[]) => {
        setCentro(nuevoCentro);
        setPath(nuevoPath);
        setBusqueda('');
        const valor = nuevoPath.length > PROFUNDIDAD_PROCESO ? nuevoPath[nuevoPath.length - 1] : 0;
        form.setValue('codigo_proceso', valor, { shouldValidate: valor > 0, shouldDirty: true });
    };

    // Al editar (o al volver al paso) se reconstruye la ruta a partir del proceso ya seleccionado.
    useEffect(() => {
        if (inicializado.current || areas.length === 0) return;
        const actual = Number(form.getValues('codigo_proceso')) || 0;
        if (!actual) return;
        inicializado.current = true;
        const ruta: number[] = [];
        let nodo = porId.get(actual);
        while (nodo && ruta.length < 20) {
            ruta.unshift(nodo.codigo_proceso);
            nodo = nodo.codigo_proceso_padre ? porId.get(nodo.codigo_proceso_padre) : undefined;
        }
        const raiz = porId.get(ruta[0]);
        setCentro(raiz?.centro ?? '');
        setPath(ruta);
    }, [areas, porId, form]);

    const nodos = path.map((id) => porId.get(id)).filter(Boolean) as Area[];
    const seleccionado = path.length > PROFUNDIDAD_PROCESO ? nodos[nodos.length - 1] : undefined;
    const ultimo = path.length ? path[path.length - 1] : null;

    // Opciones de la columna actual: macroprocesos del centro, o hijos del último nodo elegido.
    const opciones = !centro ? [] : hijosDe(path.length === 0 ? null : ultimo).filter((a) => path.length > 0 || a.centro === centro);
    const filtradas = busqueda.trim()
        ? opciones.filter((o) => o.nombre_proceso.toLowerCase().includes(busqueda.trim().toLowerCase()))
        : opciones;
    const nivelActual = path.length; // profundidad de las opciones mostradas
    const afinando = path.length > PROFUNDIDAD_PROCESO; // ya hay proceso elegido; lo que sigue es opcional

    const elegir = (id: number) => aplicar(centro, [...path, id]);

    const titulos = !centro
        ? 'Elige el centro'
        : afinando
            ? `¿Quieres afinar más? Elige un ${nombreNivel(nivelActual)} (opcional)`
            : `Elige el ${nombreNivel(nivelActual)}`;

    return (
        <>
            <CardHeader>
                <CardTitle>1. Definición de Proceso</CardTitle>
                <CardDescription>
                    Avanza de a un nivel: Centro → Macroproceso → Proceso. Desde el Proceso, afinar a Subproceso, Línea, Puesto o Tarea es opcional.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <FormField
                    control={form.control}
                    name="codigo_proceso"
                    render={() => (
                        <FormItem className="flex flex-col gap-4">
                            {isLoading ? (
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
                                </div>
                            ) : areas.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">
                                    No hay procesos activos registrados. Créalos en el catálogo de procesos (Parámetros → Procesos).
                                </p>
                            ) : (
                                <>
                                    {/* Ruta elegida: cada chip permite volver a ese nivel */}
                                    {(centro || path.length > 0) && (
                                        <nav aria-label="Ruta seleccionada" className="flex flex-wrap items-center gap-1 text-sm">
                                            <button type="button" onClick={() => aplicar('', [])} className="rounded-full border bg-muted px-3 py-1 hover:bg-muted/70">
                                                Centro {centro}
                                            </button>
                                            {nodos.map((n, i) => (
                                                <span key={n.codigo_proceso} className="flex items-center gap-1">
                                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <button
                                                        type="button"
                                                        onClick={() => aplicar(centro, path.slice(0, i + 1))}
                                                        className={cn('rounded-full border px-3 py-1 hover:bg-muted/70', n === seleccionado ? 'border-primary bg-primary/10 font-medium text-primary' : 'bg-muted')}
                                                    >
                                                        {n.nombre_proceso}
                                                    </button>
                                                </span>
                                            ))}
                                        </nav>
                                    )}

                                    {/* Resumen del proceso elegido */}
                                    {seleccionado && (
                                        <div className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                                <Check className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs uppercase tracking-wide text-muted-foreground">{nombreNivel(path.length - 1)} seleccionado</p>
                                                <p className="font-semibold">{seleccionado.nombre_proceso}</p>
                                                {seleccionado.correos_proceso ? (
                                                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                                        <Mail className="h-3 w-3" /> {seleccionado.correos_proceso}
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>
                                    )}

                                    {/* Columna actual */}
                                    {(!centro || opciones.length > 0 || !afinando) && (
                                        <div className="flex flex-col gap-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <h3 className="text-sm font-semibold">{titulos}</h3>
                                                {centro && opciones.length > UMBRAL_BUSQUEDA && (
                                                    <div className="relative w-full sm:w-64">
                                                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                                        <Input className="pl-8" placeholder="Buscar…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                                                    </div>
                                                )}
                                            </div>

                                            {!centro ? (
                                                <div className="grid gap-3 sm:grid-cols-2">
                                                    {CENTROS.map((c) => (
                                                        <OpcionCard key={c} titulo={`Centro ${c}`} icono={<Building2 className="h-5 w-5" />} onClick={() => aplicar(c, [])} />
                                                    ))}
                                                </div>
                                            ) : filtradas.length === 0 ? (
                                                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                                                    {opciones.length === 0
                                                        ? `No hay ${nombreNivel(nivelActual).toLowerCase()}s registrados aquí. Créalos en Parámetros → Procesos.`
                                                        : 'Sin resultados para la búsqueda.'}
                                                </p>
                                            ) : (
                                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                                    {filtradas.map((o) => {
                                                        const n = hijosDe(o.codigo_proceso).length;
                                                        return (
                                                            <OpcionCard
                                                                key={o.codigo_proceso}
                                                                titulo={o.nombre_proceso}
                                                                detalle={n ? `${n} ${n === 1 ? 'nivel inferior' : 'niveles inferiores'}` : undefined}
                                                                onClick={() => elegir(o.codigo_proceso)}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {afinando && (
                                                <p className="text-xs text-muted-foreground">
                                                    Si no necesitas más detalle, continúa con “Siguiente”: el proyecto quedará asociado a {seleccionado?.nombre_proceso}.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </CardContent>
        </>
    );
}
