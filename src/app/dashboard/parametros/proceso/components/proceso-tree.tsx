"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Building2, ChevronDown, ChevronRight, GitBranch, ListChecks, Mail, MoreVertical, Pencil, Plus, Route, Search, UserCog, Workflow,
    type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Area } from '@/types/interfaces';
import { CENTROS, nombreNivel } from '@/lib/procesoNiveles';

interface NodoProceso extends Area {
    children: NodoProceso[];
}

// Un color e ícono por nivel: se distingue el nivel de un vistazo sin repetir una etiqueta en cada fila.
const ESTILO_NIVEL: { icono: LucideIcon; clase: string }[] = [
    { icono: Building2, clase: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100' },     // Macroproceso
    { icono: Workflow, clase: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100' },           // Proceso
    { icono: GitBranch, clase: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-100' }, // Subproceso
    { icono: Route, clase: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-100' },          // Línea
    { icono: UserCog, clase: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-100' }, // Puesto de Trabajo
    { icono: ListChecks, clase: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-100' },         // Tarea
];
const estiloNivel = (nivel: number) => ESTILO_NIVEL[Math.min(nivel, ESTILO_NIVEL.length - 1)];

const norm = (v: string) => (v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Arma el árbol de procesos a partir de la lista plana (codigo_proceso_padre).
function construirArbol(records: Area[]): NodoProceso[] {
    const byId = new Map<number, NodoProceso>();
    records.forEach((r) => byId.set(r.codigo_proceso, { ...r, children: [] }));
    const roots: NodoProceso[] = [];
    byId.forEach((node) => {
        const padre = node.codigo_proceso_padre;
        if (padre && byId.has(padre)) byId.get(padre)!.children.push(node);
        else roots.push(node);
    });
    const ordenar = (ns: NodoProceso[]) => {
        ns.sort((a, b) => a.nombre_proceso.localeCompare(b.nombre_proceso));
        ns.forEach((n) => ordenar(n.children));
    };
    ordenar(roots);
    return roots;
}

const contarDescendientes = (n: NodoProceso): number => n.children.reduce((s, h) => s + 1 + contarDescendientes(h), 0);

interface ProcesoTreeProps {
    records: Area[];
    onAddRoot: () => void;
    onAddChild: (codigoPadre: number) => void;
    onEdit: (record: Area) => void;
}

export default function ProcesoTree({ records, onAddRoot, onAddChild, onEdit }: ProcesoTreeProps) {
    const arbol = useMemo(() => construirArbol(records), [records]);

    const [busqueda, setBusqueda] = useState('');
    const [centro, setCentro] = useState('todos');
    const [verInactivos, setVerInactivos] = useState(true);
    const [abiertos, setAbiertos] = useState<Set<number>>(new Set());
    const inicializado = useRef(false);

    // Vista inicial: macroprocesos abiertos (se ven sus procesos); lo más fino queda plegado.
    useEffect(() => {
        if (inicializado.current || arbol.length === 0) return;
        inicializado.current = true;
        setAbiertos(new Set(arbol.map((n) => n.codigo_proceso)));
    }, [arbol]);

    const q = norm(busqueda.trim());
    const buscando = q.length > 0;

    // Filtra por centro, estado y texto. Si un nodo coincide con la búsqueda, se muestra con todo lo que cuelga de él.
    const visible = useMemo(() => {
        const coincide = (n: NodoProceso) => !q || norm(`${n.nombre_proceso} ${n.correos_proceso}`).includes(q);
        const filtrar = (n: NodoProceso, forzado: boolean): NodoProceso | null => {
            if (!verInactivos && n.estado !== 'A') return null;
            const propio = coincide(n);
            const hijos = n.children.map((h) => filtrar(h, forzado || propio)).filter(Boolean) as NodoProceso[];
            if (!forzado && !propio && hijos.length === 0) return null;
            return { ...n, children: hijos };
        };
        return arbol
            .filter((r) => centro === 'todos' || r.centro === centro)
            .map((r) => filtrar(r, false))
            .filter(Boolean) as NodoProceso[];
    }, [arbol, q, centro, verInactivos]);

    const idsConHijos = useMemo(() => records.filter((r) => records.some((x) => x.codigo_proceso_padre === r.codigo_proceso)).map((r) => r.codigo_proceso), [records]);

    const toggle = (codigo: number) =>
        setAbiertos((prev) => {
            const next = new Set(prev);
            if (next.has(codigo)) next.delete(codigo);
            else next.add(codigo);
            return next;
        });

    const renderNodo = (nodo: NodoProceso, nivel: number, padre: NodoProceso | null) => {
        const tieneHijos = nodo.children.length > 0;
        const abierto = buscando || abiertos.has(nodo.codigo_proceso);
        const inactivo = nodo.estado !== 'A';
        const { icono: Icono, clase } = estiloNivel(nivel);
        const total = tieneHijos ? contarDescendientes(nodo) : 0;
        // El correo solo aporta si es propio de este nodo: el del macroproceso no se pide y el heredado se repite.
        const mostrarCorreo = nivel >= 1 && !!nodo.correos_proceso && (nivel === 1 || nodo.correos_proceso !== padre?.correos_proceso);

        return (
            <div key={nodo.codigo_proceso}>
                <div
                    className={cn(
                        'group flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/60',
                        nivel === 0 && 'mt-2 bg-muted/40 py-1.5',
                        inactivo && 'opacity-60'
                    )}
                >
                    {tieneHijos ? (
                        <button
                            type="button"
                            onClick={() => toggle(nodo.codigo_proceso)}
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                            aria-label={abierto ? 'Colapsar' : 'Expandir'}
                            aria-expanded={abierto}
                        >
                            {abierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                    ) : (
                        <span className="w-4 shrink-0" />
                    )}

                    <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded', clase)} title={nombreNivel(nivel)}>
                        <Icono className="h-3.5 w-3.5" />
                    </span>

                    <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                        <span className={cn('truncate text-sm', nivel === 0 ? 'font-semibold' : 'font-medium', inactivo && 'line-through')}>{nodo.nombre_proceso}</span>
                        <span className="text-[11px] text-muted-foreground">{nombreNivel(nivel)}</span>
                        {total > 0 && <span className="text-[11px] text-muted-foreground">· {total} {total === 1 ? 'nivel inferior' : 'niveles inferiores'}</span>}
                        {inactivo && <span className="rounded bg-destructive/10 px-1.5 text-[10px] font-medium text-destructive">Inactivo</span>}
                    </div>

                    {mostrarCorreo && (
                        <span className="hidden max-w-[260px] items-center gap-1 truncate text-xs text-muted-foreground md:flex" title={nodo.correos_proceso}>
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{nodo.correos_proceso}</span>
                        </span>
                    )}
                    {nivel === 0 && nodo.centro ? (
                        <span className="shrink-0 rounded bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border">Centro {nodo.centro}</span>
                    ) : null}

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100 data-[state=open]:opacity-100"
                                aria-label={`Opciones de ${nodo.nombre_proceso}`}
                            >
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onAddChild(nodo.codigo_proceso)}>
                                <Plus className="mr-2 h-4 w-4" /> Agregar {nombreNivel(nivel + 1)}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEdit(nodo)}>
                                <Pencil className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {tieneHijos && abierto && (
                    <div className="ml-[18px] border-l border-border/70 pl-2">
                        {nodo.children.map((h) => renderNodo(h, nivel + 1, nodo))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-3">
            {/* Barra de herramientas */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-8" placeholder="Buscar proceso o correo…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                </div>
                <Select value={centro} onValueChange={setCentro}>
                    <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos los centros</SelectItem>
                        {CENTROS.map((c) => <SelectItem key={c} value={c}>Centro {c}</SelectItem>)}
                    </SelectContent>
                </Select>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox checked={verInactivos} onCheckedChange={(v) => setVerInactivos(v === true)} />
                    Mostrar inactivos
                </label>
                <div className="ml-auto flex items-center gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAbiertos(new Set(idsConHijos))} disabled={buscando}>Expandir todo</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAbiertos(new Set())} disabled={buscando}>Colapsar todo</Button>
                    <Button type="button" size="sm" onClick={onAddRoot}>
                        <Plus className="mr-2 h-4 w-4" /> Nuevo proceso
                    </Button>
                </div>
            </div>

            {/* Leyenda de niveles */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                {ESTILO_NIVEL.map((e, i) => {
                    const I = e.icono;
                    return (
                        <span key={i} className="flex items-center gap-1">
                            <span className={cn('flex h-4 w-4 items-center justify-center rounded', e.clase)}><I className="h-2.5 w-2.5" /></span>
                            {nombreNivel(i)}
                        </span>
                    );
                })}
            </div>

            {arbol.length === 0 ? (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No hay procesos. Crea el primero con “Nuevo proceso”.
                </div>
            ) : visible.length === 0 ? (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Sin resultados con los filtros actuales.
                </div>
            ) : (
                <div className="flex flex-col">{visible.map((n) => renderNodo(n, 0, null))}</div>
            )}
        </div>
    );
}
