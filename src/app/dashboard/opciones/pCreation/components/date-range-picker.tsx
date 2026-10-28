
"use client";

import { useMemo, useState } from 'react';
import { CalendarIcon, X } from 'lucide-react';
import type { DateRange, Matcher } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { aFecha, fechaISO, formatearFecha, hoyEcuador } from '@/lib/fechas';

interface DateRangePickerProps {
    startValue: string;
    endValue: string;
    onChange: (start: string, end: string) => void;
    disabled?: boolean;
    /** Rango permitido: las fechas fuera de este rango se bloquean en el calendario */
    minDate?: Date;
    maxDate?: Date;
    /** Texto del aviso de rango bajo el selector (por defecto "Rango del proyecto"). */
    rangoLabel?: string;
    /** Color del rango seleccionado en el calendario (para distinguir participantes). */
    color?: string;
}

const parseDate = (value: string): Date | undefined => aFecha(value) ?? undefined;

const formatDisplay = (date?: Date): string => (date ? formatearFecha(date) : '');

export default function DateRangePicker({ startValue, endValue, onChange, disabled, minDate, maxDate, rangoLabel = 'Rango del proyecto', color }: DateRangePickerProps) {
    const [open, setOpen] = useState(false);

    // Pinta el rango seleccionado con el color del participante (ayuda visual para no confundirse).
    const modifiersStyles = color
        ? {
            range_start: { backgroundColor: color, color: '#ffffff' },
            range_end: { backgroundColor: color, color: '#ffffff' },
            range_middle: { backgroundColor: `${color}33`, color: 'inherit' },
        }
        : undefined;

    const range: DateRange | undefined = useMemo(() => {
        const from = parseDate(startValue);
        const to = parseDate(endValue);
        if (!from && !to) return undefined;
        return { from, to };
    }, [startValue, endValue]);

    const disabledMatcher: Matcher[] | undefined = useMemo(() => {
        const matchers: Matcher[] = [];
        if (minDate) matchers.push({ before: minDate });
        if (maxDate) matchers.push({ after: maxDate });
        return matchers.length ? matchers : undefined;
    }, [minDate, maxDate]);

    const handleSelect = (selected: DateRange | undefined) => {
        const from = selected?.from ? fechaISO(selected.from) : '';
        const to = selected?.to ? fechaISO(selected.to) : '';
        onChange(from, to);
        if (selected?.from && selected?.to) {
            setOpen(false);
        }
    };

    const handleClear = () => {
        onChange('', '');
    };

    const label = range?.from
        ? range.to
            ? `${formatDisplay(range.from)} - ${formatDisplay(range.to)}`
            : formatDisplay(range.from)
        : 'Seleccione un rango de fechas';

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={disabled}
                            className={cn(
                                'w-full justify-start text-left font-normal',
                                !range?.from && 'text-muted-foreground'
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                            <span className="truncate">{label}</span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="range"
                            numberOfMonths={2}
                            selected={range}
                            onSelect={handleSelect}
                            defaultMonth={range?.from ?? minDate ?? hoyEcuador()}
                            disabled={disabledMatcher}
                            fromDate={minDate}
                            toDate={maxDate}
                            modifiersStyles={modifiersStyles}
                        />
                        <div className="flex justify-end border-t p-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleClear}
                                disabled={!range?.from && !range?.to}
                            >
                                <X className="mr-1 h-3.5 w-3.5" />
                                Limpiar fechas
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>
                {(range?.from || range?.to) && !disabled && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={handleClear}
                        aria-label="Limpiar fechas"
                        title="Limpiar fechas"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>
            {(minDate || maxDate) && (
                <p className="text-xs text-muted-foreground">
                    {rangoLabel}:{' '}
                    {minDate && maxDate
                        ? `${formatDisplay(minDate)} - ${formatDisplay(maxDate)}`
                        : minDate
                            ? `desde ${formatDisplay(minDate)}`
                            : `hasta ${formatDisplay(maxDate)}`}
                </p>
            )}
        </div>
    );
}
