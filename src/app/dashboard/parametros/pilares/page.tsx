"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronsDownUp, ChevronsUpDown, Landmark, Plus, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { Okr, PilarEstrategico } from '@/types/interfaces';
import { pilarEstrategicoService } from '@/services/proyectos/pilarEstrategico.service';
import { okrService } from '@/services/proyectos/okr.service';
import { cn } from '@/lib/utils';
import PilarDialog from './components/pilar-dialog';
import OkrDialog from './components/okr-dialog';
import PilarRow from './components/pilar-row';

type FiltroEstado = 'activos' | 'todos';

export default function PilaresPage() {
    const { toast } = useToast();
    const [pilares, setPilares] = useState<PilarEstrategico[]>([]);
    const [okrs, setOkrs] = useState<Okr[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [abiertos, setAbiertos] = useState<Set<number>>(new Set());
    const [pilarDialog, setPilarDialog] = useState<{ open: boolean; record: PilarEstrategico | null }>({ open: false, record: null });
    const [okrDialog, setOkrDialog] = useState<{ open: boolean; pilar: PilarEstrategico | null; record: Okr | null }>({ open: false, pilar: null, record: null });
    const [filter, setFilter] = useState('');
    const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('activos');
    const inicializado = useRef(false);

    const cargar = useCallback(async () => {
        try {
            const [pilaresResp, okrResp] = await Promise.all([pilarEstrategicoService.getAll(), okrService.getAll()]);
            const lista = pilaresResp.data || [];
            setPilares(lista);
            setOkrs(okrResp.data || []);
            // En la primera carga se despliegan todos los pilares: es la vista completa de la estrategia.
            if (!inicializado.current) {
                inicializado.current = true;
                setAbiertos(new Set(lista.map((p) => p.codigo_pilar)));
            }
        } catch (error) {
            toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudieron cargar los pilares estratégicos.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const okrsPorPilar = useMemo(() => {
        const mapa = new Map<number, Okr[]>();
        okrs.forEach((o) => mapa.set(o.codigo_pilar, [...(mapa.get(o.codigo_pilar) || []), o]));
        return mapa;
    }, [okrs]);

    const pilaresFiltrados = useMemo(() => {
        const f = filter.trim().toLowerCase();
        return pilares
            .filter((p) => filtroEstado === 'todos' || p.estado === 'A')
            .filter((p) => !f || p.nombre_pilar?.toLowerCase().includes(f))
            .sort((a, b) => (a.estado === b.estado ? a.nombre_pilar.localeCompare(b.nombre_pilar) : a.estado === 'A' ? -1 : 1));
    }, [pilares, filter, filtroEstado]);

    const resumen = useMemo(() => {
        const activos = pilares.filter((p) => p.estado === 'A');
        const sinOkr = activos.filter((p) => !(okrsPorPilar.get(p.codigo_pilar) || []).some((o) => o.estado === 'A')).length;
        const okrActivos = okrs.filter((o) => o.estado === 'A' && activos.some((p) => p.codigo_pilar === o.codigo_pilar)).length;
        return { pilaresActivos: activos.length, okrActivos, sinOkr };
    }, [pilares, okrs, okrsPorPilar]);

    const todosAbiertos = pilaresFiltrados.length > 0 && pilaresFiltrados.every((p) => abiertos.has(p.codigo_pilar));

    const alternar = (codigo: number) =>
        setAbiertos((prev) => {
            const sig = new Set(prev);
            if (sig.has(codigo)) sig.delete(codigo);
            else sig.add(codigo);
            return sig;
        });

    const alternarTodos = () => setAbiertos(todosAbiertos ? new Set() : new Set(pilaresFiltrados.map((p) => p.codigo_pilar)));

    const handlePilarGuardado = async (pilar: PilarEstrategico | null) => {
        await cargar();
        // El pilar recién creado queda desplegado para agregarle sus OKR.
        if (pilar?.codigo_pilar) setAbiertos((prev) => new Set(prev).add(pilar.codigo_pilar));
    };

    const handleOkrGuardado = async () => {
        await cargar();
        if (okrDialog.pilar) {
            const codigo = okrDialog.pilar.codigo_pilar;
            setAbiertos((prev) => new Set(prev).add(codigo));
        }
    };

    return (
        <div className="p-4 md:p-6">
        <Card>
            {/* Cabecera: título, resumen en una línea y acción principal */}
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <CardTitle>Pilares Estratégicos y OKR</CardTitle>
                    <CardDescription>Define la estrategia a la que se alinean los proyectos.</CardDescription>
                    {!isLoading && (
                        <p className="pt-1 text-sm text-muted-foreground">
                            <strong className="text-foreground">{resumen.pilaresActivos}</strong> pilares activos ·{' '}
                            <strong className="text-foreground">{resumen.okrActivos}</strong> OKR activos
                            {resumen.sinOkr > 0 && (
                                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                                    <AlertTriangle className="h-3 w-3" /> {resumen.sinOkr} sin OKR
                                </span>
                            )}
                        </p>
                    )}
                </div>
                <Button onClick={() => setPilarDialog({ open: true, record: null })}>
                    <Plus className="mr-2 h-4 w-4" /> Nuevo pilar
                </Button>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
                {/* Barra de herramientas */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input className="pl-8" placeholder="Buscar pilar..." value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Buscar pilar por nombre" />
                    </div>
                    <div className="grid grid-cols-2 rounded-md border p-0.5 text-sm sm:w-56" role="group" aria-label="Filtrar pilares por estado">
                        {(['activos', 'todos'] as FiltroEstado[]).map((f) => (
                            <button
                                key={f}
                                type="button"
                                aria-pressed={filtroEstado === f}
                                onClick={() => setFiltroEstado(f)}
                                className={cn('rounded px-2 py-1 transition-colors', filtroEstado === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
                            >
                                {f === 'activos' ? 'Activos' : `Todos (${pilares.length})`}
                            </button>
                        ))}
                    </div>
                    <Button variant="outline" onClick={alternarTodos} disabled={pilaresFiltrados.length === 0}>
                        {todosAbiertos ? <ChevronsDownUp className="mr-2 h-4 w-4" /> : <ChevronsUpDown className="mr-2 h-4 w-4" />}
                        {todosAbiertos ? 'Contraer' : 'Expandir'}
                    </Button>
                </div>

                {/* Árbol: pilar → OKR */}
                {isLoading ? (
                    <div className="flex flex-col gap-2">
                        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)}
                    </div>
                ) : pilaresFiltrados.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-14 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Landmark className="h-6 w-6" />
                        </div>
                        {pilares.length === 0 ? (
                            <>
                                <div>
                                    <p className="font-medium">Crea tu primer pilar estratégico</p>
                                    <p className="text-sm text-muted-foreground">Luego agrégale sus OKR; en Creación de Proyecto se elige pilar → OKR.</p>
                                </div>
                                <Button onClick={() => setPilarDialog({ open: true, record: null })}>
                                    <Plus className="mr-2 h-4 w-4" /> Nuevo pilar
                                </Button>
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">Ningún pilar coincide con el filtro.</p>
                        )}
                    </div>
                ) : (
                    <ul className="divide-y rounded-lg border">
                        {pilaresFiltrados.map((p) => (
                            <PilarRow
                                key={p.codigo_pilar}
                                pilar={p}
                                okrs={okrsPorPilar.get(p.codigo_pilar) || []}
                                abierto={abiertos.has(p.codigo_pilar)}
                                onToggleAbierto={() => alternar(p.codigo_pilar)}
                                onEditPilar={() => setPilarDialog({ open: true, record: p })}
                                onNuevoOkr={() => setOkrDialog({ open: true, pilar: p, record: null })}
                                onEditOkr={(okr) => setOkrDialog({ open: true, pilar: p, record: okr })}
                                onChanged={cargar}
                            />
                        ))}
                    </ul>
                )}
            </CardContent>

            <PilarDialog
                open={pilarDialog.open}
                record={pilarDialog.record}
                onOpenChange={(open) => setPilarDialog((d) => ({ ...d, open }))}
                onSaved={handlePilarGuardado}
            />
            <OkrDialog
                open={okrDialog.open}
                pilar={okrDialog.pilar}
                record={okrDialog.record}
                onOpenChange={(open) => setOkrDialog((d) => ({ ...d, open }))}
                onSaved={handleOkrGuardado}
            />
        </Card>
        </div>
    );
}
