
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
import type { TipoRecurso } from '@/types/interfaces';
import { tipoRecursoService } from '@/services/proyectos/tipoRecurso.service';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { ahoraSQL } from '@/lib/fechas';
import { capitalizar } from '@/lib/texto';

const formSchema = z.object({
    codigo_tipo_recurso: z.number().optional(),
    nombre_recurso: z.string().min(1, "El nombre es requerido."),
    proveniencia: z.string().min(1, "La proveniencia es requerida."),
    estado: z.string({ required_error: "El estado es requerido." }),
    usuario_modificacion: z.string().optional(),
    fecha_modificacion: z.date().optional(),
});

interface TipoRecursoFormProps {
    record: TipoRecurso | null;
    onSuccess: () => void;
    onCancel: () => void;
}

export default function TipoRecursoForm({ record, onSuccess, onCancel }: TipoRecursoFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            codigo_tipo_recurso: record?.codigo_tipo_recurso ?? 0,
            nombre_recurso: record?.nombre_recurso ?? '',
            proveniencia: record?.proveniencia ?? '',
            estado: record?.estado ?? 'A',
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsLoading(true);

        // Construir el objeto según si es creación o edición
        const data: any = {
            codigo_tipo_recurso: values.codigo_tipo_recurso || 0,
            nombre_recurso: values.nombre_recurso,
            proveniencia: values.proveniencia,
            estado: values.estado,
        };

        // Solo agregar campos de modificación si es una edición
        if (record) {
            data.usuario_modificacion = user?.usuario || 'admin';
            data.fecha_modificacion = ahoraSQL();
        }

        try {
            await tipoRecursoService.save(data);
            toast({
                title: "Éxito",
                description: `Tipo de recurso ${record ? 'actualizado' : 'creado'} correctamente.`,
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
                <CardTitle>{record ? 'Editar Tipo de Recurso' : 'Nuevo Tipo de Recurso'}</CardTitle>
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
                                        <Input placeholder="Ej: Consultor" {...field} onChange={(e) => field.onChange(capitalizar(e.target.value))} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="proveniencia"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Proveniencia</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: Interno" {...field} onChange={(e) => field.onChange(capitalizar(e.target.value))} />
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
