"use client";

import { useState } from 'react';
import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { MAX_LEN_200 } from '../schema';

interface ListaTextoEditorProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form: UseFormReturn<any>;
    /** Nombre del arreglo en el formulario (p. ej. "objetivos"). */
    nombreLista: string;
    /** Campo de texto de cada elemento (p. ej. "descripcion_objetivo"). */
    campo: string;
    /** Elemento nuevo con el texto escrito (incluye el código en 0 = nuevo). */
    nuevoItem: (texto: string) => Record<string, unknown>;
    titulo: string;
    ayuda: string;
    placeholder: string;
    etiquetaItem: string;
    icono: React.ComponentType<{ className?: string }>;
    /** Obligatorio: se exige al menos un elemento. */
    requerido?: boolean;
}

// Editor de una lista de textos cortos (uno por fila): se escribe, se agrega con el botón o con Enter, y cada fila se
// puede editar o quitar. Lo usan los objetivos específicos y los resultados esperados del proyecto.
export default function ListaTextoEditor({ form, nombreLista, campo, nuevoItem, titulo, ayuda, placeholder, etiquetaItem, icono: Icono, requerido = false }: ListaTextoEditorProps) {
    const { fields, append, remove } = useFieldArray({ control: form.control, name: nombreLista });
    const [nuevo, setNuevo] = useState('');

    const agregar = () => {
        const texto = nuevo.trim();
        if (!texto) return;
        append(nuevoItem(texto.slice(0, MAX_LEN_200)));
        setNuevo('');
        // Agregar un elemento resuelve el error de "al menos uno".
        form.clearErrors(nombreLista);
    };

    // Error de la lista completa (p. ej. "Agrega al menos uno"): RHF lo deja en la raíz del arreglo.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errLista = (form.formState.errors as any)[nombreLista];
    const mensajeLista: string | undefined = fields.length === 0 ? (errLista?.root?.message ?? errLista?.message) : undefined;

    return (
        <div className={cn('flex flex-col gap-3 rounded-lg border p-4 md:col-span-2', requerido ? 'bg-card' : 'bg-muted/20', mensajeLista && 'border-destructive')}>
            <div>
                <p className="flex items-center gap-2 text-sm font-medium">
                    <Icono className="h-4 w-4 text-primary" /> {titulo}{' '}
                    {requerido
                        ? <span className="font-semibold text-destructive" aria-label="obligatorio">*</span>
                        : <span className="font-normal text-muted-foreground">(opcional)</span>}
                </p>
                <p className="text-xs text-muted-foreground">{ayuda}</p>
            </div>

            <div className="flex gap-2">
                <div className="flex-1">
                    <Input
                        placeholder={placeholder}
                        maxLength={MAX_LEN_200}
                        value={nuevo}
                        onChange={(e) => setNuevo(e.target.value)}
                        onKeyDown={(e) => {
                            // Enter agrega el elemento sin enviar el formulario.
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                agregar();
                            }
                        }}
                        aria-label={`Nuevo ${etiquetaItem}`}
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
                                name={`${nombreLista}.${i}.${campo}`}
                                render={({ field }) => (
                                    <FormItem className="flex-1 space-y-1">
                                        <FormLabel className="sr-only">{etiquetaItem} {i + 1}</FormLabel>
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
                                aria-label={`Quitar ${etiquetaItem} ${i + 1}`}
                                title={`Quitar ${etiquetaItem}`}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </li>
                    ))}
                </ol>
            )}

            {mensajeLista && <p className="text-sm font-medium text-destructive">{mensajeLista}</p>}
        </div>
    );
}
