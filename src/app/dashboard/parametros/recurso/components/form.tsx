
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { capitalizar } from '@/lib/texto';
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
import type { Recurso, TipoRecurso } from '@/types/interfaces';
import { recursoService } from '@/services/proyectos/recurso.service';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { ahoraSQL } from '@/lib/fechas';

const formSchema = z.object({
    codigo_recurso: z.number().optional(),
    codigo_tipo_recurso: z.number({ required_error: "El tipo de recurso es requerido." }).min(1, "El tipo de recurso es requerido."),
    nombre_recurso: z.string().min(1, "El nombre es requerido."),
    costo: z.string().min(1, "El costo es requerido."),
    estado: z.string({ required_error: "El estado es requerido." }),
});

interface RecursoFormProps {
    record: Recurso | null;
    tiposRecurso: TipoRecurso[];
    onSuccess: () => void;
    onCancel: () => void;
}

export default function RecursoForm({ record, tiposRecurso, onSuccess, onCancel }: RecursoFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            codigo_recurso: record?.codigo_recurso ?? 0,
            codigo_tipo_recurso: record?.codigo_tipo_recurso ?? 0,
            nombre_recurso: record?.nombre_recurso ?? '',
            costo: record?.costo ?? '',
            estado: record?.estado ?? 'A',
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsLoading(true);

        const data: any = {
            codigo_recurso: values.codigo_recurso || 0,
            codigo_tipo_recurso: values.codigo_tipo_recurso,
            nombre_recurso: values.nombre_recurso,
            costo: values.costo,
            estado: values.estado,
        };

        if (record) {
            data.usuario_modificacion = user?.usuario || 'admin';
            data.fecha_modificacion = ahoraSQL();
        }

        try {
            await recursoService.save(data);
            toast({
                title: "Éxito",
                description: `Recurso ${record ? 'actualizado' : 'creado'} correctamente.`,
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
                <CardTitle>{record ? 'Editar Recurso' : 'Nuevo Recurso'}</CardTitle>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="grid grid-cols-1 gap-4">
                        <FormField
                            control={form.control}
                            name="nombre_recurso"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre del Recurso</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: Diseñador Senior" {...field} onChange={(e) => field.onChange(capitalizar(e.target.value))} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="codigo_tipo_recurso"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo de Recurso</FormLabel>
                                    <Select
                                        onValueChange={(value) => field.onChange(Number(value))}
                                        value={field.value ? String(field.value) : undefined}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione un tipo de recurso" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {tiposRecurso.map((t) => (
                                                <SelectItem key={t.codigo_tipo_recurso} value={String(t.codigo_tipo_recurso)}>
                                                    {t.nombre_recurso}
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
                            name="costo"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Costo</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: 1500" {...field} />
                                    </FormControl>
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
