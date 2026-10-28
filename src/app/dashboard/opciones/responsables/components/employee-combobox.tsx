
"use client";

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { FichaSocialHistorica } from '@/types/interfaces';

interface EmployeeComboboxProps {
    value: string;
    personas: FichaSocialHistorica[];
    onChange: (codigo: string, persona?: FichaSocialHistorica) => void;
    disabled?: boolean;
}

export default function EmployeeCombobox({ value, personas, onChange, disabled }: EmployeeComboboxProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    // FichaSocialHistorica puede traer varias filas por el mismo empleado (es histórica);
    // nos quedamos con una sola por CODIGO para evitar keys duplicadas y opciones repetidas.
    const uniquePersonas = useMemo(
        () => Array.from(new Map(personas.map(p => [p.CODIGO, p])).values()),
        [personas]
    );

    const selectedPersona = useMemo(
        () => uniquePersonas.find(p => p.CODIGO === value),
        [uniquePersonas, value]
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

    const handleSelect = (persona: FichaSocialHistorica) => {
        onChange(persona.CODIGO, persona);
        setOpen(false);
        setSearch("");
    };

    return (
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
                    <span className={cn("truncate", !value && "text-muted-foreground")}>
                        {value
                            ? `${value} - ${selectedPersona?.NOMBRE ?? ''}`
                            : "Seleccione un empleado..."}
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
                                {group.items.map(persona => (
                                    <button
                                        type="button"
                                        key={persona.CODIGO}
                                        onClick={() => handleSelect(persona)}
                                        className={cn(
                                            "flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-left hover:bg-accent hover:text-accent-foreground",
                                            value === persona.CODIGO && "bg-accent/50"
                                        )}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4 shrink-0",
                                                value === persona.CODIGO ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <span className="truncate">{persona.CODIGO} - {persona.NOMBRE}</span>
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
