"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, useNavigation, type CaptionProps } from "react-day-picker"
import { addMonths, differenceInCalendarMonths, format, startOfMonth, type Locale } from "date-fns"
import { es } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

type Vista = "dias" | "meses" | "anios"
const ANIOS_POR_PAGINA = 12

// Contexto para que el encabezado de cada mes (que renderiza DayPicker) pueda abrir las vistas de meses y años.
const VistaContext = React.createContext<{ abrir: (vista: Vista, mesMostrado: Date) => void; locale: Locale } | null>(null)


const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Encabezado de cada mes: flechas para avanzar/retroceder y, al centro, el nombre del mes (abre la vista de meses) y el año
// (abre la vista de años) como botones.
function Encabezado({ displayMonth }: CaptionProps) {
  const ctx = React.useContext(VistaContext)
  const { goToMonth, nextMonth, previousMonth, displayMonths } = useNavigation()
  const locale = ctx?.locale ?? es
  const esPrimero = displayMonths[0] && differenceInCalendarMonths(displayMonth, displayMonths[0]) === 0
  const esUltimo = differenceInCalendarMonths(displayMonth, displayMonths[displayMonths.length - 1]) === 0
  const botonNav = cn(buttonVariants({ variant: "outline" }), "absolute h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 disabled:opacity-20")
  const botonTexto = "rounded-md px-1.5 py-0.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return (
    <div className="relative flex items-center justify-center pt-1">
      {esPrimero && (
        <button type="button" className={cn(botonNav, "left-1")} disabled={!previousMonth} onClick={() => previousMonth && goToMonth(previousMonth)} aria-label="Mes anterior">
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      <div className="flex items-center gap-0.5">
        <button type="button" className={botonTexto} onClick={() => ctx?.abrir("meses", displayMonth)} title="Elegir mes">
          {capitalizar(format(displayMonth, "LLLL", { locale }))}
        </button>
        <button type="button" className={botonTexto} onClick={() => ctx?.abrir("anios", displayMonth)} title="Elegir año">
          {format(displayMonth, "yyyy")}
        </button>
      </div>
      {esUltimo && (
        <button type="button" className={cn(botonNav, "right-1")} disabled={!nextMonth} onClick={() => nextMonth && goToMonth(nextMonth)} aria-label="Mes siguiente">
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  // Siempre 6 filas de semanas: así el alto no cambia entre meses de 5 y 6 semanas y las flechas de navegación
  // quedan fijas, permitiendo avanzar o retroceder varios meses con clics consecutivos.
  fixedWeeks = true,
  locale = es,
  ...props
}: CalendarProps) {
  // El mes mostrado se controla aquí para poder saltar a él desde las vistas de meses y años.
  const [mes, setMes] = React.useState<Date>(() => startOfMonth(props.month ?? props.defaultMonth ?? new Date()))
  React.useEffect(() => {
    if (props.month) setMes(startOfMonth(props.month))
  }, [props.month])
  const cambiarMes = (m: Date) => {
    setMes(m)
    props.onMonthChange?.(m)
  }

  // Vista de meses / años: se abre desde el encabezado. `desfase` recuerda qué mes (de los que se muestran juntos) se
  // eligió, para que el mes escogido aparezca en esa misma posición.
  const [vista, setVista] = React.useState<Vista>("dias")
  const [anioVista, setAnioVista] = React.useState(mes.getFullYear())
  const [desfase, setDesfase] = React.useState(0)
  const contenedor = React.useRef<HTMLDivElement>(null)
  const [tamano, setTamano] = React.useState<{ w: number; h: number } | null>(null)

  const abrir = React.useCallback((v: Vista, mesMostrado: Date) => {
    if (contenedor.current) setTamano({ w: contenedor.current.offsetWidth, h: contenedor.current.offsetHeight })
    setDesfase(differenceInCalendarMonths(mesMostrado, mes))
    setAnioVista(mesMostrado.getFullYear())
    setVista(v)
  }, [mes])

  // Límites del calendario (fromDate/toDate o fromYear/toYear), para deshabilitar meses y años fuera de rango.
  const desde = props.fromDate ?? props.fromMonth ?? (props.fromYear ? new Date(props.fromYear, 0, 1) : undefined)
  const hasta = props.toDate ?? props.toMonth ?? (props.toYear ? new Date(props.toYear, 11, 31) : undefined)
  const mesFuera = (anio: number, m: number) =>
    (!!desde && (anio < desde.getFullYear() || (anio === desde.getFullYear() && m < desde.getMonth()))) ||
    (!!hasta && (anio > hasta.getFullYear() || (anio === hasta.getFullYear() && m > hasta.getMonth())))
  const anioFuera = (anio: number) => (!!desde && anio < desde.getFullYear()) || (!!hasta && anio > hasta.getFullYear())

  const elegirMes = (m: number) => {
    cambiarMes(addMonths(new Date(anioVista, m, 1), -desfase))
    setVista("dias")
  }
  const elegirAnio = (anio: number) => {
    setAnioVista(anio)
    setVista("meses")
  }

  const hoy = new Date()
  const mesElegido = addMonths(mes, desfase)
  const inicioPagina = Math.floor(anioVista / ANIOS_POR_PAGINA) * ANIOS_POR_PAGINA
  const celda = (activo: boolean, actual: boolean) =>
    cn(
      buttonVariants({ variant: activo ? "default" : "ghost" }),
      "h-10 w-full text-sm font-normal",
      !activo && actual && "border border-primary/50",
      "disabled:pointer-events-none disabled:opacity-30"
    )
  const botonNav = cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 disabled:opacity-20")

  if (vista !== "dias") {
    const esMeses = vista === "meses"
    return (
      <div
        className={cn("flex flex-col gap-3 p-3", className)}
        style={tamano ? { width: tamano.w, minHeight: tamano.h } : { minWidth: 280 }}
      >
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            className={botonNav}
            aria-label={esMeses ? "Año anterior" : "Años anteriores"}
            disabled={esMeses ? anioFuera(anioVista - 1) : anioFuera(inicioPagina - 1)}
            onClick={() => setAnioVista((a) => (esMeses ? a - 1 : a - ANIOS_POR_PAGINA))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {esMeses ? (
            <button type="button" className="rounded-md px-2 py-0.5 text-sm font-medium hover:bg-accent" onClick={() => setVista("anios")} title="Elegir año">
              {anioVista}
            </button>
          ) : (
            <span className="text-sm font-medium">{inicioPagina} – {inicioPagina + ANIOS_POR_PAGINA - 1}</span>
          )}
          <button
            type="button"
            className={botonNav}
            aria-label={esMeses ? "Año siguiente" : "Años siguientes"}
            disabled={esMeses ? anioFuera(anioVista + 1) : anioFuera(inicioPagina + ANIOS_POR_PAGINA)}
            onClick={() => setAnioVista((a) => (esMeses ? a + 1 : a + ANIOS_POR_PAGINA))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid flex-1 grid-cols-3 content-center gap-2">
          {esMeses
            ? Array.from({ length: 12 }, (_, m) => (
                <button
                  key={m}
                  type="button"
                  className={celda(mesElegido.getFullYear() === anioVista && mesElegido.getMonth() === m, hoy.getFullYear() === anioVista && hoy.getMonth() === m)}
                  disabled={mesFuera(anioVista, m)}
                  onClick={() => elegirMes(m)}
                >
                  {capitalizar(format(new Date(anioVista, m, 1), "LLL", { locale }).replace(".", ""))}
                </button>
              ))
            : Array.from({ length: ANIOS_POR_PAGINA }, (_, i) => inicioPagina + i).map((anio) => (
                <button
                  key={anio}
                  type="button"
                  className={celda(mesElegido.getFullYear() === anio, hoy.getFullYear() === anio)}
                  disabled={anioFuera(anio)}
                  onClick={() => elegirAnio(anio)}
                >
                  {anio}
                </button>
              ))}
        </div>
        <div className="flex justify-end">
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground hover:underline" onClick={() => setVista("dias")}>
            Volver a los días
          </button>
        </div>
      </div>
    )
  }

  return (
    <VistaContext.Provider value={{ abrir, locale }}>
      <div ref={contenedor} className="w-fit">
        <DayPicker
          showOutsideDays={showOutsideDays}
          fixedWeeks={fixedWeeks}
          locale={locale}
          className={cn("p-3", className)}
          classNames={{
            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
            month: "space-y-4",
            caption: "flex justify-center pt-1 relative items-center",
            caption_label: "text-sm font-medium",
            nav: "space-x-1 flex items-center",
            nav_button: cn(
              buttonVariants({ variant: "outline" }),
              "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
            ),
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full border-collapse space-y-1",
            head_row: "flex",
            head_cell:
              "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
            row: "flex w-full mt-2",
            cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
            day: cn(
              buttonVariants({ variant: "ghost" }),
              "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
            ),
            day_range_end: "day-range-end",
            day_selected:
              "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            day_today: "bg-accent text-accent-foreground",
            day_outside:
              "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
            day_disabled: "text-muted-foreground opacity-50",
            day_range_middle:
              "aria-selected:bg-accent aria-selected:text-accent-foreground",
            day_hidden: "invisible",
            ...classNames,
          }}
          {...props}
          month={mes}
          onMonthChange={cambiarMes}
          components={{
            Caption: Encabezado,
            ...props.components,
          }}
        />
      </div>
    </VistaContext.Provider>
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
