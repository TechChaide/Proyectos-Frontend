"use client";

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { FichaSocialHistorica, Responsable } from '@/types/interfaces';

const norm = (v: string) => (v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface ResponsableComboboxProps {
    /** codigo_responsable seleccionado (0 = ninguno). */
    value: number;
    responsables: Responsable[];
    /** Mapa CODIGO de empleado → ficha (nombre, departamento). */
    personaMap: Map<string, FichaSocialHistorica>;
    /** Responsables ya elegidos en otros participantes de la misma actividad (no se ofrecen). */
    excluidos?: Set<number | undefined>;
    onChange: (codigoResponsable: number) => void;
    disabled?: boolean;
    isLoading?: boolean;
}

// Selector de participante con buscador por código de empleado, nombre o departamento.
export default function ResponsableCombobox({ value, responsables, personaMap, excluidos, onChange, disabled, isLoading }: ResponsableComboboxProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const opciones = useMemo(
        () => responsables
            .filter((r) => !excluidos?.has(r.codigo_responsable) || r.codigo_responsable === value)
            .map((r) => {
                const persona = personaMap.get(r.codigo_empleado);
                return {
                    codigo: r.codigo_responsable,
                    empleado: r.codigo_empleado,
                    nombre: persona?.NOMBRE || '',
                    departamento: persona?.DEPARTAMENTO || '',
                };
            })
            .sort((a, b) => (a.nombre || a.empleado).localeCompare(b.nombre || b.empleado)),
        [responsables, personaMap, excluidos, value]
    );

    const seleccionado = opciones.find((o) => o.codigo === value);

    const filtradas = useMemo(() => {
        const f = norm(search.trim());
        if (!f) return opciones;
        return opciones.filter((o) => norm(`${o.empleado} ${o.nombre} ${o.departamento}`).includes(f));
    }, [opciones, search]);

    const elegir = (codigo: number) => {
        onChange(codigo);
        setOpen(false);
        setSearch('');
    };

    return (
        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(''); }}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled || isLoading}
                    className="w-full justify-between font-normal"
                >
                    <span className={cn('truncate', !seleccionado && 'text-muted-foreground')}>
                        {isLoading
                            ? 'Cargando...'
                            : seleccionado
                                ? `${seleccionado.empleado}${seleccionado.nombre ? ` - ${seleccionado.nombre}` : ''}`
                                : 'Buscar participante...'}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[300px] p-0" align="start">
                <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <Input
                        placeholder="Buscar por código o nombre..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-10 border-0 px-0 shadow-none focus-visible:ring-0"
                        aria-label="Buscar participante por código o nombre"
                        autoFocus
                    />
                </div>
                <ScrollArea className="max-h-72">
                    <div className="max-h-72 p-1">
                        {filtradas.length === 0 ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">
                                {opciones.length === 0 ? 'No hay responsables disponibles.' : 'Sin coincidencias.'}
                            </p>
                        ) : (
                            filtradas.map((o) => (
                                <button
                                    type="button"
                                    key={o.codigo}
                                    onClick={() => elegir(o.codigo)}
                                    className={cn(
                                        'flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                                        o.codigo === value && 'bg-accent/50'
                                    )}
                                >
                                    <Check className={cn('mt-0.5 h-4 w-4 shrink-0', o.codigo === value ? 'opacity-100' : 'opacity-0')} />
                                    <span className="min-w-0">
                                        <span className="block truncate">
                                            <span className="font-medium tabular-nums">{o.empleado}</span>
                                            {o.nombre ? ` - ${o.nombre}` : ''}
                                        </span>
                                        {o.departamento && <span className="block truncate text-xs text-muted-foreground">{o.departamento}</span>}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
