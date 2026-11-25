
"use client";

import { useMemo } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import type { FichaSocialHistorica, Okr, PilarEstrategico, Proyecto, TipoProyecto } from '@/types/interfaces';
import { Compass, FileText, IdCard, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import SeccionFormulario from './seccion-formulario';
import EmployeeMultiCombobox from './employee-multi-combobox';
import DescripcionObjetivos from './descripcion-objetivos';
import ResultadosEditor from './resultados-editor';
import DateRangePicker from './date-range-picker';
import { aFecha, formatearFecha, hoyEcuador, limiteCalendario } from '@/lib/fechas';
import { Textarea } from '@/components/ui/textarea';
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MAX_LEN_100, MAX_LEN_200, type ProyectoWizardValues } from '../schema';

interface StepProyectoProps {
    form: UseFormReturn<ProyectoWizardValues>;
    tiposProyecto: TipoProyecto[];
    proyectosPadre: Proyecto[];
    /** Proceso (codigo_proceso) de cada posible proyecto padre, para exigir que hijo y padre sean de la misma proceso. */
    /** Ya no se usa: el padre no se elige en este paso. */
    areaPorProyectoPadre?: Map<number, number | null>;
    personas: FichaSocialHistorica[];
    /** Catálogos de la vista "Pilares Estratégicos y OKR" (incluye inactivos para respetar lo ya asignado). */
    pilares: PilarEstrategico[];
    okrs: Okr[];
    isLoading: boolean;
    /** En edición no se limita el inicio a hoy, para respetar proyectos que ya empezaron. */
    isEditMode?: boolean;
    /** Hijo de un Proyecto Integrador que todavía no se guarda: nombre y fechas del integrador (el padre es la solicitud en curso). */
    rangoPadre?: { inicio: string; fin: string; nombre: string };
    /** Proyecto hijo de un integrador: responsables "de ejecución"; descripción y objetivos van en el paso de actividades. */
    esHijo?: boolean;
}

export default function StepProyecto({ form, tiposProyecto, proyectosPadre, personas, pilares, okrs, isLoading, isEditMode = false, rangoPadre, esHijo = false }: StepProyectoProps) {
    const fechaInicio = useWatch({ control: form.control, name: 'fecha_inicio' });
    const fechaFin = useWatch({ control: form.control, name: 'fecha_fin' });
    const codigoPadre = useWatch({ control: form.control, name: 'codigo_padre' });
    const codigoPilar = useWatch({ control: form.control, name: 'codigo_pilar' });
    const codigoOkr = useWatch({ control: form.control, name: 'codigo_okr' });

    // Alineación estratégica: se ofrecen pilares y OKR activos; si el proyecto ya tiene uno inactivo
    // asignado, se mantiene visible para no perderlo al editar.
    const pilaresOpciones = useMemo(() => {
        const okrActual = okrs.find((o) => o.codigo_okr === codigoOkr);
        return pilares
            .filter((p) => p.estado === 'A' || p.codigo_pilar === okrActual?.codigo_pilar || p.codigo_pilar === codigoPilar)
            .sort((a, b) => a.nombre_pilar.localeCompare(b.nombre_pilar));
    }, [pilares, okrs, codigoOkr, codigoPilar]);
    const okrsOpciones = useMemo(
        () => okrs
            .filter((o) => o.codigo_pilar === codigoPilar && (o.estado === 'A' || o.codigo_okr === codigoOkr))
            .sort((a, b) => a.nombre_okr.localeCompare(b.nombre_okr)),
        [okrs, codigoPilar, codigoOkr]
    );
    const okrSel = okrs.find((o) => o.codigo_okr === codigoOkr);

    const handlePilarChange = (value: string) => {
        const nuevo = Number(value);
        form.setValue('codigo_pilar', nuevo, { shouldDirty: true });
        // El OKR elegido debe pertenecer al pilar; si cambia el pilar se limpia.
        if (okrSel && okrSel.codigo_pilar !== nuevo) {
            form.setValue('codigo_okr', 0, { shouldValidate: true, shouldDirty: true });
        }
    };

    // El padre NO se elige aquí: un proyecto independiente no tiene padre y los hijos nacen dentro de un Proyecto
    // Integrador. Un hijo (en el flujo del integrador, o ya guardado, o agregado a un integrador existente) muestra su
    // padre en solo lectura y sus fechas quedan dentro de las del padre.
    const padreSel = useMemo(
        () => (codigoPadre ? proyectosPadre.find((p) => p.codigo_proyecto === codigoPadre) : undefined),
        [proyectosPadre, codigoPadre]
    );
    const padreInicio = rangoPadre ? aFecha(rangoPadre.inicio) : padreSel ? aFecha(padreSel.fecha_inicio) : null;
    const padreFin = rangoPadre ? aFecha(rangoPadre.fin) : padreSel ? aFecha(padreSel.fecha_fin) : null;
    const nombrePadre = rangoPadre?.nombre || padreSel?.nombre_proyecto || '';
    const mostrarPadre = !!padreInicio && !!padreFin;

    const handleRangeChange = (start: string, end: string) => {
        form.setValue('fecha_inicio', start, { shouldValidate: true, shouldDirty: true });
        form.setValue('fecha_fin', end, { shouldValidate: true, shouldDirty: true });
    };

    const fechaError = form.formState.errors.fecha_inicio ?? form.formState.errors.fecha_fin;

    // El calendario ofrece desde hoy hasta el 31/12 del año siguiente. Un proyecto puede cruzar de año dentro
    // de ese límite (p. ej. empezar en noviembre y terminar en 2027).
    const limite = limiteCalendario();
    const maxBase = limite;
    const minBase = isEditMode ? undefined : hoyEcuador();

    // Si hay proyecto padre, el rango se acota además al rango del padre.
    const minDate = padreInicio
        ? new Date(Math.max(minBase ? minBase.getTime() : padreInicio.getTime(), padreInicio.getTime()))
        : minBase;
    const maxDate = padreFin ? new Date(Math.min(maxBase.getTime(), padreFin.getTime())) : maxBase;

    return (
        <>
            <CardHeader>
                <CardTitle>Definición de Proyecto</CardTitle>
                <CardDescription>
                    {esHijo
                        ? 'Qué es el proyecto, a qué se alinea, quién lo ejecuta y cuándo, y qué resultados se esperan. La descripción y los objetivos van en el siguiente paso, junto al plan de actividades.'
                        : 'Qué es el proyecto, a qué se alinea, quién lo ejecuta y cuándo, para qué se hace y qué resultados se esperan.'}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <SeccionFormulario icono={IdCard} numero={1} titulo="Identificación" ayuda={mostrarPadre ? 'El nombre del proyecto y el integrador al que pertenece.' : 'El nombre y el tipo del proyecto.'}>
                <FormField
                    control={form.control}
                    name="nombre_proyecto"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nombre del Proyecto</FormLabel>
                            <FormControl>
                                <Input placeholder="Ej: Implementación Módulo Base" maxLength={MAX_LEN_100} {...field} />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">{field.value?.length ?? 0}/{MAX_LEN_100} caracteres</p>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {mostrarPadre && (
                    <FormItem>
                        <FormLabel>{rangoPadre ? 'Proyecto Integrador' : 'Proyecto Padre'}</FormLabel>
                        <Input value={nombrePadre} disabled readOnly />
                        <p className="text-xs text-muted-foreground">
                            Este proyecto forma parte de un Proyecto Integrador. Sus fechas deben quedar dentro de las del integrador.
                        </p>
                    </FormItem>
                )}

                <FormField
                    control={form.control}
                    name="codigo_tipo_proyecto"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Tipo de Proyecto</FormLabel>
                            <Select
                                onValueChange={(value) => field.onChange(Number(value))}
                                value={field.value ? String(field.value) : undefined}
                                disabled={isLoading}
                            >
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder={isLoading ? "Cargando tipos..." : "Seleccione un tipo"} />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {tiposProyecto.map((tipo) => (
                                        <SelectItem key={tipo.codigo_tipo_proyecto} value={String(tipo.codigo_tipo_proyecto)}>
                                            {tipo.nombre_tipo_proyecto}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                </SeccionFormulario>

                <SeccionFormulario icono={Compass} numero={2} titulo="Alineación estratégica" ayuda="Primero el pilar; luego el OKR de ese pilar al que contribuye el proyecto.">
                <FormItem>
                    <FormLabel>Pilar Estratégico</FormLabel>
                    <Select
                        onValueChange={handlePilarChange}
                        value={codigoPilar ? String(codigoPilar) : undefined}
                        disabled={isLoading}
                    >
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder={isLoading ? 'Cargando pilares...' : pilaresOpciones.length ? 'Seleccione un pilar' : 'No hay pilares registrados'} />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {pilaresOpciones.map((p) => (
                                <SelectItem key={p.codigo_pilar} value={String(p.codigo_pilar)}>
                                    {p.nombre_pilar}{p.estado !== 'A' ? ' (inactivo)' : ''}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        {!isLoading && pilaresOpciones.length === 0
                            ? 'Registra los pilares y sus OKR en Parámetros → Pilares Estratégicos.'
                            : 'Primero elige el pilar; luego el OKR al que se alinea el proyecto.'}
                    </p>
                    {form.formState.errors.codigo_pilar && (
                        <p className="text-sm font-medium text-destructive">{form.formState.errors.codigo_pilar.message}</p>
                    )}
                </FormItem>

                <FormField
                    control={form.control}
                    name="codigo_okr"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>OKR</FormLabel>
                            <Select
                                onValueChange={(value) => field.onChange(Number(value))}
                                value={field.value ? String(field.value) : undefined}
                                disabled={isLoading || !codigoPilar}
                            >
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder={!codigoPilar ? 'Elige primero un pilar' : okrsOpciones.length ? 'Seleccione un OKR' : 'Este pilar no tiene OKR activos'} />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {okrsOpciones.map((o) => (
                                        <SelectItem key={o.codigo_okr} value={String(o.codigo_okr)}>
                                            {o.nombre_okr}{o.estado !== 'A' ? ' (inactivo)' : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {okrSel?.descripcion_okr && <p className="text-xs text-muted-foreground">{okrSel.descripcion_okr}</p>}
                            <FormMessage />
                        </FormItem>
                    )}
                />

                </SeccionFormulario>

                <SeccionFormulario icono={Users} numero={3} titulo="Ejecución" ayuda={mostrarPadre ? 'Quiénes lo ejecutan y en qué periodo (dentro del Proyecto Integrador).' : 'Quién lo dirige y en qué periodo se ejecuta.'}>
                <FormField
                    control={form.control}
                    name="responsable_proyecto"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{esHijo ? 'Responsable/s de Ejecución del Proyecto' : 'Responsable del Proyecto'}</FormLabel>
                            <FormControl>
                                <EmployeeMultiCombobox
                                    value={field.value}
                                    personas={personas}
                                    onChange={field.onChange}
                                    disabled={isLoading}
                                />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">{esHijo ? 'Quiénes ejecutan este proyecto. Puedes elegir más de uno.' : 'Puedes elegir más de un responsable.'}</p>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormItem>
                    <FormLabel>Fecha de Inicio - Fin</FormLabel>
                    <FormControl>
                        <DateRangePicker
                            startValue={fechaInicio}
                            endValue={fechaFin}
                            onChange={handleRangeChange}
                            disabled={isLoading}
                            minDate={minDate}
                            maxDate={maxDate}
                            rangoLabel={mostrarPadre ? 'Dentro del Proyecto Integrador' : 'Rango permitido'}
                        />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                        {mostrarPadre && padreInicio && padreFin
                            ? `Debe quedar dentro del Proyecto Integrador "${nombrePadre}" (${formatearFecha(padreInicio)} - ${formatearFecha(padreFin)}).`
                            : `El proyecto y sus actividades pueden extenderse hasta el ${formatearFecha(limite)}.`}
                    </p>
                    {fechaError && (
                        <p className="text-sm font-medium text-destructive">{fechaError.message}</p>
                    )}
                </FormItem>

                </SeccionFormulario>

                {/* En un proyecto hijo, la descripción y los objetivos se llenan en el paso de actividades. */}
                {!esHijo && (
                    <SeccionFormulario icono={FileText} numero={4} titulo="Descripción y objetivos" ayuda="Qué abarca el proyecto, para qué se hace y cómo se logra.">
                        <DescripcionObjetivos form={form} />
                    </SeccionFormulario>
                )}

                <ResultadosEditor form={form} />
            </CardContent>
        </>
    );
}
