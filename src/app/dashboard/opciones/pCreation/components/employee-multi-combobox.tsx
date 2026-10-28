
"use client";

import { useMemo, useState } from 'react';
import { ChevronsUpDown, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { FichaSocialHistorica } from '@/types/interfaces';

const SEPARATOR = '&';

interface EmployeeMultiComboboxProps {
    value: string;
    personas: FichaSocialHistorica[];
    onChange: (value: string) => void;
    disabled?: boolean;
}

export default function EmployeeMultiCombobox({ value, personas, onChange, disabled }: EmployeeMultiComboboxProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const selectedCodes = useMemo(
        () => value ? value.split(SEPARATOR).map(c => c.trim()).filter(Boolean) : [],
        [value]
    );

    // FichaSocialHistorica puede traer varias filas por el mismo empleado (es histórica);
    // nos quedamos con una sola por CODIGO para evitar keys duplicadas y opciones repetidas.
    const uniquePersonas = useMemo(
        () => Array.from(new Map(personas.map(p => [p.CODIGO, p])).values()),
        [personas]
    );

    const personaMap = useMemo(
        () => new Map(uniquePersonas.map(p => [p.CODIGO, p])),
        [uniquePersonas]
    );

    const selectedPersonas = useMemo(
        () => selectedCodes.map(codigo => personaMap.get(codigo)).filter((p): p is FichaSocialHistorica => !!p),
        [selectedCodes, personaMap]
    );

    const groupedPersonas = useMemo(() => {
        const f = search.trim().toLowerCase();
        const filtered = f
            ? uniquePersonas.filter(p =>
                p.CODIGO?.toLowerCase().includes(f) ||
                p.NOMBRE?.toLowerCase().includes(f) ||
                p.DEPARTAMENTO?.toLowerCase().includes(f)
            )
            : uniquePersonas;

        const groups = new Map<string, FichaSocialHistorica[]>();
        filtered.forEach(p => {
            const key = p.DEPARTAMENTO || 'Sin Departamento';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(p);
        });

        return Array.from(groups.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([departamento, items]) => ({
                departamento,
                items: items.sort((a, b) => a.NOMBRE?.localeCompare(b.NOMBRE) || 0),
            }));
    }, [uniquePersonas, search]);

    const toggleSelection = (persona: FichaSocialHistorica) => {
        const isSelected = selectedCodes.includes(persona.CODIGO);
        const next = isSelected
            ? selectedCodes.filter(c => c !== persona.CODIGO)
            : [...selectedCodes, persona.CODIGO];
        onChange(next.join(SEPARATOR));
    };

    const removeSelection = (codigo: string) => {
        onChange(selectedCodes.filter(c => c !== codigo).join(SEPARATOR));
    };

    return (
        <div className="flex flex-col gap-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        disabled={disabled}
                        className="w-full justify-between font-normal"
                    >
                        <span className={cn("truncate", selectedCodes.length === 0 && "text-muted-foreground")}>
                            {selectedCodes.length > 0
                                ? `${selectedCodes.length} responsable(s) seleccionado(s)`
                                : "Seleccione uno o más empleados..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <div className="flex items-center border-b px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Input
                            placeholder="Buscar por código, nombre o departamento..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="h-10 border-0 shadow-none focus-visible:ring-0 px-0"
                            autoFocus
                        />
                    </div>
                    <ScrollArea className="h-72">
                        <div className="p-1">
                            {groupedPersonas.length === 0 && (
                                <p className="py-6 text-center text-sm text-muted-foreground">No se encontraron empleados.</p>
                            )}
                            {groupedPersonas.map(group => (
                                <div key={group.departamento} className="mb-1">
                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                        {group.departamento}
                                    </div>
                                    {group.items.map(persona => {
                                        const checked = selectedCodes.includes(persona.CODIGO);
                                        return (
                                            <div
                                                key={persona.CODIGO}
                                                role="option"
                                                aria-selected={checked}
                                                tabIndex={0}
                                                onClick={() => toggleSelection(persona)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        toggleSelection(persona);
                                                    }
                                                }}
                                                className={cn(
                                                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left cursor-pointer hover:bg-accent hover:text-accent-foreground",
                                                    checked && "bg-accent/50"
                                                )}
                                            >
                                                <Checkbox checked={checked} className="pointer-events-none" />
                                                <span className="truncate">{persona.CODIGO} - {persona.NOMBRE}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </PopoverContent>
            </Popover>

            {selectedPersonas.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {selectedPersonas.map(persona => (
                        <span
                            key={persona.CODIGO}
                            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs text-secondary-foreground"
                        >
                            {persona.CODIGO} - {persona.NOMBRE}
                            <button
                                type="button"
                                onClick={() => removeSelection(persona.CODIGO)}
                                disabled={disabled}
                                className="rounded-full hover:bg-secondary-foreground/20"
                                aria-label={`Quitar ${persona.NOMBRE}`}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
