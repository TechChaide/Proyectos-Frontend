"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { aFecha, fechaISO, formatearFecha } from "@/lib/fechas"
import { cn } from "@/lib/utils"

interface DatePickerProps {
  /** Fecha "YYYY-MM-DD" ('' = sin fecha). */
  value: string
  onChange: (value: string) => void
  minDate?: Date
  maxDate?: Date
  placeholder?: string
  disabled?: boolean
  className?: string
}

// Selector de una sola fecha con el calendario del proyecto (clic en el mes o el año para saltar rápido).
export function DatePicker({ value, onChange, minDate, maxDate, placeholder = "Selecciona una fecha", disabled, className }: DatePickerProps) {
  const [abierto, setAbierto] = React.useState(false)
  const seleccionada = value ? aFecha(value) ?? undefined : undefined

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled} className={cn("w-full justify-start text-left font-normal", !seleccionada && "text-muted-foreground", className)}>
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">{seleccionada ? formatearFecha(seleccionada) : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={seleccionada}
          defaultMonth={seleccionada ?? maxDate}
          onSelect={(d) => { if (d) { onChange(fechaISO(d)); setAbierto(false) } }}
          fromDate={minDate}
          toDate={maxDate}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
