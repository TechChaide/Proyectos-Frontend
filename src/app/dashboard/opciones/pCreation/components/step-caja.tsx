"use client";

import { useMemo } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { Boxes, IdCard } from 'lucide-react';
import type { FichaSocialHistorica } from '@/types/interfaces';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatearFecha, hoyEcuador, limiteCalendario } from '@/lib/fechas';
import EmployeeMultiCombobox from './employee-multi-combobox';
import DateRangePicker from './date-range-picker';
import { MAX_LEN_100, MAX_LEN_200, type CajaWizardValues } from '../schema';

/** Proyecto hijo ya guardado de un Proyecto Integrador (al editar el integrador, su rango debe seguir cubriéndolos). */
export interface HijoExistente {
    codigo: number;
    nombre: string;
    inicio: string;
    fin: string;
}

interface StepCajaProps {
    form: UseFormReturn<CajaWizardValues>;
    personas: FichaSocialHistorica[];
    isLoading: boolean;
    /** Edición de un integrador ya guardado: no se limita el inicio a hoy. */
    isEditMode?: boolean;
    hijosExistentes?: HijoExistente[];
}

function Seccion({ icono: Icono, titulo, ayuda, children }: { icono: React.ComponentType<{ className?: string }>; titulo: string; ayuda: string; children: React.ReactNode }) {
    return (
        <section className="flex flex-col gap-4 rounded-lg border p-4">
            <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Icono className="h-4 w-4" /></span>
                <div>
                    <p className="text-sm font-semibold">{titulo}</p>
                    <p className="text-xs text-muted-foreground">{ayuda}</p>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
        </section>
    );
}

// Fase 1 del Proyecto Integrador: nombre, director, fechas y descripción (todo obligatorio). No lleva proceso, tipo, pilar,
// OKR ni objetivos: sus resultados esperados son los de sus hijos y su nota, el promedio de sus hijos aprobados. Una vez
// creado, se abre su vista de estructura para agregarle los proyectos hijos.
export default function StepCaja({ form, personas, isLoading, isEditMode = false, hijosExistentes = [] }: StepCajaProps) {
    const fechaInicio = useWatch({ control: form.control, name: 'fecha_inicio' });
    const fechaFin = useWatch({ control: form.control, name: 'fecha_fin' });

    const handleRangeChange = (start: string, end: string) => {
        form.setValue('fecha_inicio', start, { shouldValidate: true, shouldDirty: true });
        form.setValue('fecha_fin', end, { shouldValidate: true, shouldDirty: true });
    };
    const fechaError = form.formState.errors.fecha_inicio ?? form.formState.errors.fecha_fin;

    // Mismo límite de calendario que un proyecto general: desde hoy hasta el 31/12 del año siguiente.
    const limite = limiteCalendario();
    const minDate = isEditMode ? undefined : hoyEcuador();

    // Al editar, el nuevo rango debe seguir cubriendo a los hijos que ya existen.
    const rangoHijos = useMemo(() => {
        if (hijosExistentes.length === 0) return null;
        return {
            inicio: hijosExistentes.map((h) => h.inicio).sort()[0],
            fin: hijosExistentes.map((h) => h.fin).sort().slice(-1)[0],
        };
    }, [hijosExistentes]);

    return (
        <>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Boxes className="h-5 w-5" /> Datos del Proyecto Integrador</CardTitle>
                <CardDescription>
                    {isEditMode
                        ? 'Actualiza los datos del integrador. Todos los campos son obligatorios.'
                        : 'Todos los campos son obligatorios. Al crear el integrador se abre su estructura, donde agregas los proyectos hijos.'}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <Seccion icono={IdCard} titulo="Identificación" ayuda="Quién lo dirige y en qué periodo se ejecuta. Los proyectos hijos deben quedar dentro de estas fechas.">
                    <FormField
                        control={form.control}
                        name="nombre_proyecto"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nombre del Proyecto Integrador</FormLabel>
                                <FormControl>
                                    <Input placeholder="Ej: Programa de Eficiencia 2027" maxLength={MAX_LEN_100} {...field} />
                                </FormControl>
                                <p className="text-xs text-muted-foreground">{field.value?.length ?? 0}/{MAX_LEN_100} caracteres</p>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="responsable_proyecto"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Director de Proyecto</FormLabel>
                                <FormControl>
                                    <EmployeeMultiCombobox value={field.value} personas={personas} onChange={field.onChange} etiquetaSeleccion="director(es)" disabled={isLoading} />
                                </FormControl>
                                <p className="text-xs text-muted-foreground">Puedes elegir más de un director.</p>
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
                                maxDate={limite}
                                rangoLabel="Rango permitido"
                            />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                            {rangoHijos
                                ? `Debe cubrir las fechas de sus hijos actuales (${formatearFecha(rangoHijos.inicio)} - ${formatearFecha(rangoHijos.fin)}).`
                                : `Hasta el ${formatearFecha(limite)} como máximo.`}
                        </p>
                        {fechaError && <p className="text-sm font-medium text-destructive">{fechaError.message}</p>}
                    </FormItem>
                    <FormField
                        control={form.control}
                        name="descripcion_proyecto"
                        render={({ field }) => (
                            <FormItem className="md:col-span-2">
                                <FormLabel>Descripción del Proyecto</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="¿Qué integra este proyecto y por qué?" maxLength={MAX_LEN_200} {...field} />
                                </FormControl>
                                <p className="text-xs text-muted-foreground">{field.value?.length ?? 0}/{MAX_LEN_200} caracteres</p>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </Seccion>

            </CardContent>
        </>
    );
}
