
"use client";

import { useEffect, useMemo } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import type { FichaSocialHistorica, Proyecto, TipoProyecto } from '@/types/interfaces';
import { Input } from '@/components/ui/input';
import EmployeeMultiCombobox from './employee-multi-combobox';
import DateRangePicker from './date-range-picker';
import { aFecha, finDeAnio, formatearFecha, hoyEcuador, limiteCalendario } from '@/lib/fechas';
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
import { MAX_LEN_50, MAX_LEN_200, type ProyectoWizardValues } from '../schema';

interface StepProyectoProps {
    form: UseFormReturn<ProyectoWizardValues>;
    tiposProyecto: TipoProyecto[];
    proyectosPadre: Proyecto[];
    /** Proceso (codigo_proceso) de cada posible proyecto padre, para exigir que hijo y padre sean de la misma proceso. */
    areaPorProyectoPadre: Map<number, number | null>;
    personas: FichaSocialHistorica[];
    isLoading: boolean;
    /** En edición no se limita el inicio a hoy, para respetar proyectos que ya empezaron. */
    isEditMode?: boolean;
}

export default function StepProyecto({ form, tiposProyecto, proyectosPadre, areaPorProyectoPadre, personas, isLoading, isEditMode = false }: StepProyectoProps) {
    const fechaInicio = useWatch({ control: form.control, name: 'fecha_inicio' });
    const fechaFin = useWatch({ control: form.control, name: 'fecha_fin' });
    const codigoArea = useWatch({ control: form.control, name: 'codigo_proceso' });
    const codigoPadre = useWatch({ control: form.control, name: 'codigo_padre' });

    // Regla 1: solo pueden ser PADRE los proyectos de la MISMA proceso seleccionada en el paso 1.
    const padresFiltrados = useMemo(
        () => proyectosPadre.filter((p) => !codigoArea || areaPorProyectoPadre.get(p.codigo_proyecto) === codigoArea),
        [proyectosPadre, areaPorProyectoPadre, codigoArea]
    );
    const padreSel = useMemo(
        () => (codigoPadre ? proyectosPadre.find((p) => p.codigo_proyecto === codigoPadre) : undefined),
        [proyectosPadre, codigoPadre]
    );
    const padreInicio = padreSel ? aFecha(padreSel.fecha_inicio) : null;
    const padreFin = padreSel ? aFecha(padreSel.fecha_fin) : null;

    // Si cambia el proceso y el padre elegido ya no pertenece a esa proceso, se limpia la selección de padre.
    useEffect(() => {
        if (codigoPadre && !padresFiltrados.some((p) => p.codigo_proyecto === codigoPadre)) {
            form.setValue('codigo_padre', 0, { shouldValidate: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [codigoArea]);

    // Regla 2: las fechas del hijo deben quedar dentro del padre. Si al elegir padre las fechas actuales
    // se salen de su rango, se limpian para que el usuario las vuelva a escoger dentro del padre.
    useEffect(() => {
        if (!padreInicio || !padreFin) return;
        const fi = aFecha(fechaInicio);
        const ff = aFecha(fechaFin);
        const fuera = (fi && fi < padreInicio) || (ff && ff > padreFin) || (fi && fi > padreFin) || (ff && ff < padreInicio);
        if (fuera) {
            form.setValue('fecha_inicio', '', { shouldValidate: true });
            form.setValue('fecha_fin', '', { shouldValidate: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [codigoPadre]);

    const handleRangeChange = (start: string, end: string) => {
        form.setValue('fecha_inicio', start, { shouldValidate: true, shouldDirty: true });
        form.setValue('fecha_fin', end, { shouldValidate: true, shouldDirty: true });
    };

    const fechaError = form.formState.errors.fecha_inicio ?? form.formState.errors.fecha_fin;

    // El calendario ofrece desde hoy hasta el 31/12 del año siguiente; pero un proyecto no puede
    // cruzar de año: una vez elegido el inicio, el fin se limita al 31/12 de ese mismo año.
    const limite = limiteCalendario();
    const inicioElegido = aFecha(fechaInicio);
    const maxBase = inicioElegido && !fechaFin
        ? new Date(Math.min(limite.getTime(), finDeAnio(inicioElegido).getTime()))
        : limite;
    const minBase = isEditMode ? undefined : hoyEcuador();

    // Si hay proyecto padre, el rango se acota además al rango del padre.
    const minDate = padreInicio
        ? new Date(Math.max(minBase ? minBase.getTime() : padreInicio.getTime(), padreInicio.getTime()))
        : minBase;
    const maxDate = padreFin ? new Date(Math.min(maxBase.getTime(), padreFin.getTime())) : maxBase;

    return (
        <>
            <CardHeader>
                <CardTitle>2. Definición de Proyecto</CardTitle>
                <CardDescription>Registra las propiedades del proyecto.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="nombre_proyecto"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nombre del Proyecto</FormLabel>
                            <FormControl>
                                <Input placeholder="Ej: Implementación Módulo Base" maxLength={MAX_LEN_50} {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="codigo_padre"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Proyecto Padre (opcional)</FormLabel>
                            <Select
                                onValueChange={(value) => field.onChange(Number(value))}
                                value={field.value ? String(field.value) : '0'}
                                disabled={isLoading}
                            >
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Ninguno (proyecto independiente)" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="0">Ninguno (proyecto independiente)</SelectItem>
                                    {padresFiltrados.map((p) => (
                                        <SelectItem key={p.codigo_proyecto} value={String(p.codigo_proyecto)}>
                                            {p.nombre_proyecto}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {!codigoArea
                                    ? 'Elige primero el proceso (paso 1) para ver los posibles proyectos padre.'
                                    : padresFiltrados.length === 0
                                        ? 'No hay proyectos de este proceso que puedan ser padre.'
                                        : 'Solo proyectos de la misma proceso. El hijo debe quedar dentro de las fechas del padre.'}
                            </p>
                            <FormMessage />
                        </FormItem>
                    )}
                />

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

                <FormField
                    control={form.control}
                    name="responsable_proyecto"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Responsable del Proyecto</FormLabel>
                            <FormControl>
                                <EmployeeMultiCombobox
                                    value={field.value}
                                    personas={personas}
                                    onChange={field.onChange}
                                    disabled={isLoading}
                                />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">{field.value?.length ?? 0}/{MAX_LEN_50} caracteres</p>
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
                            rangoLabel={padreSel ? 'Dentro del proyecto padre' : 'Rango permitido'}
                        />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                        {padreSel && padreInicio && padreFin
                            ? `Debe quedar dentro del proyecto padre "${padreSel.nombre_proyecto}" (${formatearFecha(padreInicio)} - ${formatearFecha(padreFin)}).`
                            : 'El proyecto y todas sus actividades deben quedar dentro de un mismo año calendario.'}
                    </p>
                    {fechaError && (
                        <p className="text-sm font-medium text-destructive">{fechaError.message}</p>
                    )}
                </FormItem>

                <FormField
                    control={form.control}
                    name="descripcion_proyecto"
                    render={({ field }) => (
                        <FormItem className="md:col-span-2">
                            <FormLabel>Descripción del Proyecto</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Describe el alcance del proyecto" maxLength={MAX_LEN_50} {...field} />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">{field.value?.length ?? 0}/{MAX_LEN_50} caracteres</p>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="objetivo_principal"
                    render={({ field }) => (
                        <FormItem className="md:col-span-2">
                            <FormLabel>Objetivo Principal</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Describe el objetivo principal del proyecto" maxLength={MAX_LEN_50} {...field} />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">{field.value?.length ?? 0}/{MAX_LEN_50} caracteres</p>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="resultados_esperados"
                    render={({ field }) => (
                        <FormItem className="md:col-span-2">
                            <FormLabel>Resultados Esperados (opcional)</FormLabel>
                            <FormControl>
                                <Textarea placeholder="¿Qué resultados se esperan de este proyecto?" maxLength={MAX_LEN_200} {...field} value={field.value ?? ''} />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">{field.value?.length ?? 0}/{MAX_LEN_200} caracteres</p>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </CardContent>
        </>
    );
}
