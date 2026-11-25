"use client";

import { useWatch, type UseFormReturn } from 'react-hook-form';
import { Check, Circle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import ObjetivosEditor from './objetivos-editor';
import { MAX_LEN_200, type ProyectoWizardValues } from '../schema';

interface DescripcionObjetivosProps {
    form: UseFormReturn<ProyectoWizardValues>;
    /** Exige al menos un objetivo específico (proyecto hijo). */
    objetivosRequeridos?: boolean;
    /** Etiquetas guiadas: Qué → Por qué → Cómo. */
    guiado?: boolean;
}

const Etapa = ({ texto }: { texto: string }) => (
    <span className="mr-1.5 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">{texto}</span>
);

// Descripción, objetivo principal y objetivos específicos de un proyecto. En un proyecto general van en "Definición de
// Proyecto"; en un proyecto hijo se llenan en el paso de actividades, junto al plan con el que se cumplen.
export default function DescripcionObjetivos({ form, objetivosRequeridos = false, guiado = false }: DescripcionObjetivosProps) {
    return (
        <>
            <FormField
                control={form.control}
                name="descripcion_proyecto"
                render={({ field }) => (
                    <FormItem className="md:col-span-2">
                        <FormLabel>{guiado && <Etapa texto="Qué" />}Descripción del Proyecto</FormLabel>
                        <FormControl>
                            <Textarea placeholder="Describe el alcance del proyecto: qué se va a hacer y dónde" maxLength={MAX_LEN_200} {...field} />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">{field.value?.length ?? 0}/{MAX_LEN_200} caracteres</p>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="objetivo_principal"
                render={({ field }) => (
                    <FormItem className="md:col-span-2">
                        <FormLabel>{guiado && <Etapa texto="Por qué" />}Objetivo Principal</FormLabel>
                        <FormControl>
                            <Textarea placeholder="Describe el propósito general del proyecto" maxLength={MAX_LEN_200} {...field} />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">{field.value?.length ?? 0}/{MAX_LEN_200} caracteres</p>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <ObjetivosEditor form={form} requerido={objetivosRequeridos} />
        </>
    );
}

// Lista de control del paso de actividades de un proyecto hijo: muestra qué falta antes de guardar.
export function ChecklistPasoActividades({ form }: { form: UseFormReturn<ProyectoWizardValues> }) {
    const [descripcion, objetivo, objetivos, actividades] = useWatch({
        control: form.control,
        name: ['descripcion_proyecto', 'objetivo_principal', 'objetivos', 'actividades'],
    });
    const actividadesListas = (actividades || []).filter((a) => a.nombre_actividad?.trim() && a.fecha_inicio_actividad && a.fecha_fin_actividad && a.participantes?.every((p) => p.codigo_responsable)).length;
    const items = [
        { texto: 'Descripción', hecho: !!descripcion?.trim() },
        { texto: 'Objetivo principal', hecho: !!objetivo?.trim() },
        { texto: `Objetivos específicos (${objetivos?.length ?? 0})`, hecho: (objetivos?.length ?? 0) > 0 },
        { texto: `Actividades completas (${actividadesListas})`, hecho: actividadesListas > 0 && actividadesListas === (actividades?.length ?? 0) },
    ];
    const listos = items.filter((i) => i.hecho).length;
    return (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2" aria-label="Lista de control del paso">
            <span className="mr-1 text-xs font-medium text-muted-foreground tabular-nums">Para guardar · {listos}/{items.length}</span>
            {items.map((i) => (
                <span
                    key={i.texto}
                    className={cn(
                        'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
                        i.hecho ? 'border-green-600/40 bg-green-600/10 text-green-800 dark:text-green-300' : 'text-muted-foreground'
                    )}
                >
                    {i.hecho ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />} {i.texto}
                </span>
            ))}
        </div>
    );
}
