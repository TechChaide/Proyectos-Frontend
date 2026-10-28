
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import type { Area } from '@/types/interfaces';
import { procesoService } from '@/services/proyectos/proceso.service';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { ahoraSQL } from '@/lib/fechas';
import { capitalizar } from '@/lib/texto';
import { CENTROS, nombreNivel } from '@/lib/procesoNiveles';
import CorreoSelector from './correo-selector';

const formSchema = z.object({
    codigo_proceso: z.number().optional(),
    centro: z.string().max(4, "Máximo 4 caracteres.").optional(),
    nombre_proceso: z.string().min(1, "El nombre es requerido.").max(50, "Máximo 50 caracteres."),
    correos_proceso: z.string().min(1, "Los correos son requeridos.").max(50, "Máximo 50 caracteres (limitación de la base de datos); usa menos correos o direcciones más cortas."),
    estado: z.string({ required_error: "El estado es requerido." }),
    usuario_modificacion: z.string().optional(),
    fecha_modificacion: z.date().optional(),
});

interface AreaFormProps {
    record: Area | null;
    /** Proceso padre al crear un hijo (null = proceso raíz). */
    parentId?: number | null;
    parentNombre?: string | null;
    /** Centro y correos del padre, para heredar/pre-llenar en los hijos. */
    parentCentro?: string;
    parentCorreos?: string;
    /** Profundidad del nodo en el organigrama (0 = Macroproceso, 1 = Proceso, 2 = Subproceso...). */
    nivel?: number;
    onSuccess: () => void;
    onCancel: () => void;
}

export default function AreaForm({ record, parentId = null, parentNombre = null, parentCentro = '', parentCorreos = '', nivel = 0, onSuccess, onCancel }: AreaFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth();

    // Un proceso es "hijo" si edita un registro con padre, o si se está creando bajo un padre.
    const esHijo = record ? record.codigo_proceso_padre != null : !!parentId;
    // El centro se hereda del padre en hijos/nietos; solo se escribe en procesos raíz.
    const centroHeredado = esHijo ? (record ? record.centro : parentCentro) : (record?.centro ?? '');

    // Solo 1000 y 2000; si un registro antiguo trae otro valor, se conserva como opción para no perderlo al editar.
    const opcionesCentro = centroHeredado && !CENTROS.includes(centroHeredado) ? [...CENTROS, centroHeredado] : CENTROS;

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            codigo_proceso: record?.codigo_proceso ?? 0,
            centro: centroHeredado ?? '',
            nombre_proceso: record?.nombre_proceso ?? '',
            // Al crear un hijo, se pre-llena con los correos del padre (editable).
            correos_proceso: record?.correos_proceso ?? (parentId ? parentCorreos : ''),
            estado: record?.estado ?? 'A',
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsLoading(true);

        // Construir el objeto según si es creación o edición
        const data: any = {
            codigo_proceso: values.codigo_proceso || 0,
            // Jerarquía: al editar se conserva el padre actual; al crear un hijo se usa parentId; raíz = null.
            codigo_proceso_padre: record ? (record.codigo_proceso_padre ?? null) : (parentId ?? null),
            centro: values.centro || '',
            nombre_proceso: values.nombre_proceso,
            correos_proceso: values.correos_proceso,
            estado: values.estado,
        };

        // Solo agregar campos de modificación si es una edición
        if (record) {
            data.usuario_modificacion = user?.usuario || 'admin';
            data.fecha_modificacion = ahoraSQL();
        }

        try {
            await procesoService.save(data);
            toast({
                title: "Éxito",
                description: `Proceso ${record ? 'actualizado' : 'creado'} correctamente.`,
            });
            onSuccess();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Ocurrió un error inesperado.";
            toast({
                title: "Error al guardar",
                description: errorMessage,
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{record ? 'Editar' : 'Nuevo'} {nombreNivel(nivel)}</CardTitle>
                {!record && parentNombre && (
                    <p className="text-sm text-muted-foreground">{nombreNivel(nivel)} de: <strong>{parentNombre}</strong></p>
                )}
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="grid grid-cols-1 gap-4">
                        {esHijo ? (
                            // En hijos/nietos el centro se hereda del padre: no se pide de nuevo.
                            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                                <span className="text-muted-foreground">Centro (heredado del proceso padre): </span>
                                <strong>{centroHeredado || '—'}</strong>
                            </div>
                        ) : (
                            <FormField
                                control={form.control}
                                name="centro"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Centro</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccione un centro" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {opcionesCentro.map((c) => (
                                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                        <FormField
                            control={form.control}
                            name="nombre_proceso"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre ({nombreNivel(nivel)})</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: Sistemas" maxLength={50} {...field} onChange={(e) => field.onChange(capitalizar(e.target.value))} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="correos_proceso"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Correos ({nombreNivel(nivel)})</FormLabel>
                                    <FormControl>
                                        <CorreoSelector
                                            value={field.value ?? ''}
                                            onChange={field.onChange}
                                            heredado={esHijo ? (record ? '' : parentCorreos) : ''}
                                            placeholder="Ej: sistemas@chaide.com"
                                        />
                                    </FormControl>
                                    <p className="text-xs text-muted-foreground">{field.value?.length ?? 0}/50 caracteres (límite de la base de datos).</p>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="estado"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Estado</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione un estado" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="A">
                                                <div className="flex items-center">
                                                    Activo
                                                    <span className="ml-2 h-2 w-2 rounded-full bg-green-500"></span>
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="I">
                                                <div className="flex items-center">
                                                    Inactivo
                                                    <span className="ml-2 h-2 w-2 rounded-full bg-red-500"></span>
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? (record ? 'Actualizando...' : 'Guardando...') : (record ? 'Actualizar' : 'Guardar')}
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}
