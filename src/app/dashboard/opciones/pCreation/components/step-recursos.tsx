
"use client";

import { useMemo } from 'react';
import { useFieldArray, useWatch, type UseFormReturn } from 'react-hook-form';
import { Package, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Recurso, TipoRecurso } from '@/types/interfaces';
import type { ProyectoWizardValues } from '../schema';
import { defaultRecursoProyecto } from '../schema';
import { capitalizar } from '@/lib/texto';

interface StepRecursosProps {
    form: UseFormReturn<ProyectoWizardValues>;
    tiposRecurso: TipoRecurso[];
    recursos: Recurso[];
    isLoading: boolean;
}

const NUEVO = '0'; // valor de "crear nuevo" en los selects (código 0)

const num = (s?: string): number => {
    const n = parseFloat((s || '').replace(',', '.'));
    return Number.isNaN(n) ? 0 : n;
};
const money = (n: number): string => `$${n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function StepRecursos({ form, tiposRecurso, recursos, isLoading }: StepRecursosProps) {
    const { fields, append, remove } = useFieldArray({ control: form.control, name: 'recursos' });
    const recursosWatch = useWatch({ control: form.control, name: 'recursos' }) || [];

    const recursoMap = useMemo(() => new Map(recursos.map((r) => [r.codigo_recurso, r])), [recursos]);
    const tiposActivos = useMemo(() => tiposRecurso.filter((t) => t.estado === 'A'), [tiposRecurso]);

    // Costo unitario de una fila (del catálogo si es existente, o el nuevo que se escribe).
    const costoUnitario = (r: ProyectoWizardValues['recursos'][number]): number =>
        r.codigo_recurso ? num(recursoMap.get(r.codigo_recurso)?.costo) : num(r.costo);

    const total = useMemo(
        () => recursosWatch.reduce((s, r) => s + costoUnitario(r) * num(r.valor_recurso), 0),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [recursosWatch, recursoMap]
    );

    const errores = form.formState.errors.recursos;

    const cambiarTipo = (i: number, value: string) => {
        form.setValue(`recursos.${i}.codigo_tipo_recurso`, Number(value), { shouldValidate: true, shouldDirty: true });
        // Al cambiar el tipo, el recurso elegido deja de ser válido: se reinicia.
        form.setValue(`recursos.${i}.codigo_recurso`, 0, { shouldDirty: true });
        form.setValue(`recursos.${i}.nombre_recurso`, '', { shouldDirty: true });
        form.setValue(`recursos.${i}.costo`, '', { shouldDirty: true });
    };

    return (
        <>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                    <CardTitle>3. Recursos del Proyecto</CardTitle>
                    <CardDescription>
                        Opcional. Asigna los recursos que usará el proyecto. El tipo se elige del catálogo
                        administrado en Parámetros; el recurso puede ser uno existente o uno nuevo. El costo total se calcula como costo unitario × valor.
                    </CardDescription>
                </div>
                <Button type="button" size="icon" className="shrink-0 rounded-full" onClick={() => append({ ...defaultRecursoProyecto })} aria-label="Agregar recurso">
                    <Plus className="h-5 w-5" />
                </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                {fields.length === 0 && (
                    <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                        Sin recursos. Usa “Agregar recurso” si este proyecto consume recursos (humanos, materiales, etc.).
                    </p>
                )}

                {fields.map((item, i) => {
                    const r = recursosWatch[i] || ({} as ProyectoWizardValues['recursos'][number]);
                    const tipoNuevo = !r.codigo_tipo_recurso;
                    const recursoNuevo = !r.codigo_recurso;
                    const errP = errores?.[i];
                    const recursosDelTipo = recursos.filter((x) => x.codigo_tipo_recurso === r.codigo_tipo_recurso);
                    const subtotal = costoUnitario(r) * num(r.valor_recurso);

                    return (
                        <div key={item.id} className="flex flex-col gap-3 rounded-md border bg-card p-3">
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                                {/* Tipo */}
                                <div className="lg:col-span-4">
                                    <label className="text-xs font-medium">Tipo de recurso</label>
                                    <Select value={r.codigo_tipo_recurso ? String(r.codigo_tipo_recurso) : undefined} onValueChange={(v) => cambiarTipo(i, v)} disabled={isLoading}>
                                        <SelectTrigger><SelectValue placeholder="Seleccione un tipo" /></SelectTrigger>
                                        <SelectContent>
                                            {tiposActivos.map((t) => (
                                                <SelectItem key={t.codigo_tipo_recurso} value={String(t.codigo_tipo_recurso)}>
                                                    {t.nombre_recurso}{t.proveniencia ? ` · ${t.proveniencia}` : ''}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errP?.codigo_tipo_recurso && <p className="mt-1 text-xs font-medium text-destructive">{errP.codigo_tipo_recurso.message}</p>}
                                </div>

                                {/* Recurso */}
                                <div className="lg:col-span-4">
                                    <label className="text-xs font-medium">Recurso</label>
                                    <Select
                                        value={r.codigo_recurso ? String(r.codigo_recurso) : undefined}
                                        onValueChange={(v) => form.setValue(`recursos.${i}.codigo_recurso`, Number(v), { shouldValidate: true, shouldDirty: true })}
                                        disabled={isLoading || tipoNuevo}
                                    >
                                        <SelectTrigger><SelectValue placeholder={tipoNuevo ? 'Primero elija el tipo' : 'Seleccione'} /></SelectTrigger>
                                        <SelectContent>
                                            {recursosDelTipo.length === 0 && (
                                                <p className="px-2 py-3 text-xs text-muted-foreground">No hay recursos activos de este tipo. Pide al administrador que los registre.</p>
                                            )}
                                            {recursosDelTipo.map((x) => (
                                                <SelectItem key={x.codigo_recurso} value={String(x.codigo_recurso)}>
                                                    {x.nombre_recurso} ({money(num(x.costo))})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errP?.codigo_recurso && <p className="mt-1 text-xs font-medium text-destructive">{errP.codigo_recurso.message}</p>}
                                </div>

                                {/* Valor (cantidad) */}
                                <div className="lg:col-span-2">
                                    <label className="text-xs font-medium">Cantidad</label>
                                    <Input
                                        type="number"
                                        placeholder="Ej: 40"
                                        value={r.valor_recurso ?? ''}
                                        onChange={(e) => form.setValue(`recursos.${i}.valor_recurso`, e.target.value, { shouldValidate: true, shouldDirty: true })}
                                    />
                                    {errP?.valor_recurso && <p className="text-xs font-medium text-destructive">{errP.valor_recurso.message}</p>}
                                </div>

                                {/* Subtotal + eliminar */}
                                <div className="flex items-end justify-between gap-2 lg:col-span-2">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Subtotal</p>
                                        <p className="text-sm font-semibold tabular-nums">{money(subtotal)}</p>
                                        <p className="text-[10px] text-muted-foreground">unit. {money(costoUnitario(r))}</p>
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => remove(i)} aria-label="Quitar recurso">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {fields.length > 0 && (
                    <div className="flex items-center justify-end gap-2 rounded-md border bg-muted/40 px-4 py-3">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Costo total estimado:</span>
                        <span className="text-lg font-bold tabular-nums">{money(total)}</span>
                    </div>
                )}
            </CardContent>
        </>
    );
}
