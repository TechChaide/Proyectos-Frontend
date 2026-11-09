"use client";

import { useState } from 'react';
import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import { Plus, Target, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { MAX_LEN_200, type ProyectoWizardValues } from '../schema';

interface ObjetivosEditorProps {
    form: UseFormReturn<ProyectoWizardValues>;
}

// Objetivos específicos del proyecto (tabla `objetivo`, uno o varios por proyecto). Se editan como lista en el
// formulario y se guardan con el `codigo_proyecto` que devuelve el backend al crear/actualizar el proyecto.
export default function ObjetivosEditor({ form }: ObjetivosEditorProps) {
    const { fields, append, remove } = useFieldArray({ control: form.control, name: 'objetivos' });
    const [nuevo, setNuevo] = useState('');

    const agregar = () => {
        const texto = nuevo.trim();
        if (!texto) return;
        append({ codigo_objetivo: 0, descripcion_objetivo: texto.slice(0, MAX_LEN_200) });
        setNuevo('');
    };

    return (
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 md:col-span-2">
            <div>
                <p className="flex items-center gap-2 text-sm font-medium">
                    <Target className="h-4 w-4 text-primary" /> Objetivos específicos <span className="font-normal text-muted-foreground">(opcional)</span>
                </p>
                <p className="text-xs text-muted-foreground">
                    El objetivo principal es el propósito general; aquí van los objetivos concretos con los que se logra. Agrega uno por uno.
                </p>
            </div>

            <div className="flex gap-2">
                <div className="flex-1">
                    <Input
                        placeholder="Ej: Reducir el desperdicio de espuma al 3% en el segundo semestre"
                        maxLength={MAX_LEN_200}
                        value={nuevo}
                        onChange={(e) => setNuevo(e.target.value)}
                        onKeyDown={(e) => {
                            // Enter agrega el objetivo sin enviar el formulario.
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                agregar();
                            }
                        }}
                        aria-label="Nuevo objetivo específico"
                    />
                    <p className="mt-1 text-right text-xs text-muted-foreground">{nuevo.length}/{MAX_LEN_200}</p>
                </div>
                <Button type="button" variant="secondary" onClick={agregar} disabled={!nuevo.trim()}>
                    <Plus className="mr-2 h-4 w-4" /> Agregar
                </Button>
            </div>

            {fields.length > 0 && (
                <ol className="flex flex-col gap-2">
                    {fields.map((item, i) => (
                        <li key={item.id} className="flex items-start gap-2 rounded-md border bg-card p-2">
                            <span className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold tabular-nums text-primary">
                                {i + 1}
                            </span>
                            <FormField
                                control={form.control}
                                name={`objetivos.${i}.descripcion_objetivo`}
                                render={({ field }) => (
                                    <FormItem className="flex-1 space-y-1">
                                        <FormLabel className="sr-only">Objetivo {i + 1}</FormLabel>
                                        <FormControl>
                                            <Input maxLength={MAX_LEN_200} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={() => remove(i)}
                                aria-label={`Quitar objetivo ${i + 1}`}
                                title="Quitar objetivo"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}
