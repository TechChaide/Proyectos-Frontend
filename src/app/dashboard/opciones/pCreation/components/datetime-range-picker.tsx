
"use client";

import { useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DateTimeRangePickerProps {
    /** Formato "YYYY-MM-DDTHH:mm" */
    startValue: string;
    /** Formato "YYYY-MM-DDTHH:mm" */
    endValue: string;
    onChange: (start: string, end: string) => void;
    disabled?: boolean;
}

const DEFAULT_START_TIME = '08:00';
const DEFAULT_END_TIME = '17:00';

interface ParsedValue {
    date?: Date;
    time: string;
}

const parseValue = (value: string): ParsedValue => {
    if (!value) return { time: '' };
    const [datePart, timePart] = value.split('T');
    const [year, month, day] = (datePart || '').split('-').map(Number);
    if (!year || !month || !day) return { time: timePart || '' };
    return { date: new Date(year, month - 1, day), time: timePart || '' };
};

const combineValue = (date: Date | undefined, time: string): string => {
    if (!date) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    return `${datePart}T${time || '00:00'}`;
};

const formatDisplay = (parsed: ParsedValue): string => {
    if (!parsed.date) return '';
    const dateLabel = parsed.date.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return parsed.time ? `${dateLabel} ${parsed.time}` : dateLabel;
};

export default function DateTimeRangePicker({ startValue, endValue, onChange, disabled }: DateTimeRangePickerProps) {
    const [open, setOpen] = useState(false);

    const startParsed = useMemo(() => parseValue(startValue), [startValue]);
    const endParsed = useMemo(() => parseValue(endValue), [endValue]);

    const range: DateRange | undefined = useMemo(() => {
        if (!startParsed.date && !endParsed.date) return undefined;
        return { from: startParsed.date, to: endParsed.date };
    }, [startParsed.date, endParsed.date]);

    const handleRangeSelect = (selected: DateRange | undefined) => {
        const startTime = startParsed.time || DEFAULT_START_TIME;
        const endTime = endParsed.time || DEFAULT_END_TIME;
        onChange(
            combineValue(selected?.from, startTime),
            combineValue(selected?.to, endTime)
        );
    };

    const handleStartTimeChange = (time: string) => {
        onChange(combineValue(startParsed.date, time), endValue);
    };

    const handleEndTimeChange = (time: string) => {
        onChange(startValue, combineValue(endParsed.date, time));
    };

    const label = startParsed.date
        ? `${formatDisplay(startParsed)} - ${endParsed.date ? formatDisplay(endParsed) : '...'}`
        : 'Seleccione fecha y hora de inicio y fin';

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        'w-full justify-start text-left font-normal',
                        !startParsed.date && 'text-muted-foreground'
                    )}
                >
                    <CalendarClock className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">{label}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="range"
                    numberOfMonths={2}
                    selected={range}
                    onSelect={handleRangeSelect}
                    defaultMonth={range?.from}
                />
                <div className="flex items-center justify-between gap-4 border-t p-3">
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="datetime-range-hora-inicio" className="text-xs text-muted-foreground">
                            Hora de inicio
                        </Label>
                        <Input
                            id="datetime-range-hora-inicio"
                            type="time"
                            value={startParsed.time || DEFAULT_START_TIME}
                            onChange={(e) => handleStartTimeChange(e.target.value)}
                            disabled={!startParsed.date}
                            className="h-8"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="datetime-range-hora-fin" className="text-xs text-muted-foreground">
                            Hora de fin
                        </Label>
                        <Input
                            id="datetime-range-hora-fin"
                            type="time"
                            value={endParsed.time || DEFAULT_END_TIME}
                            onChange={(e) => handleEndTimeChange(e.target.value)}
                            disabled={!endParsed.date}
                            className="h-8"
                        />
                    </div>
                    <Button type="button" size="sm" onClick={() => setOpen(false)}>
                        Listo
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
