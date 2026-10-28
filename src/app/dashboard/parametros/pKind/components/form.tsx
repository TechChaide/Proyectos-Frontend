
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
import type { TipoProyecto } from '@/types/interfaces';
import { tipoProyectoService } from '@/services/proyectos/tipoProyecto.service';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { ahoraSQL } from '@/lib/fechas';

const formSchema = z.object({
    codigo_tipo_proyecto: z.number().optional(),
    nombre_tipo_proyecto: z.string().min(1, "El nombre es requerido."),
    estado: z.string({ required_error: "El estado es requerido." }),
    usuario_modificacion: z.string().optional(),
    fecha_modificacion: z.date().optional(),
});

interface TipoProyectoFormProps {
    record: TipoProyecto | null;
    onSuccess: () => void;
    onCancel: () => void;
}

export default function TipoProyectoForm({ record, onSuccess, onCancel }: TipoProyectoFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            codigo_tipo_proyecto: record?.codigo_tipo_proyecto ?? 0,
            nombre_tipo_proyecto: record?.nombre_tipo_proyecto ?? '',
            estado: record?.estado ?? 'A',
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsLoading(true);

        // Construir el objeto según si es creación o edición
        const data: any = {
            codigo_tipo_proyecto: values.codigo_tipo_proyecto || 0,
            nombre_tipo_proyecto: values.nombre_tipo_proyecto,
            estado: values.estado,
        };

        // Solo agregar campos de modificación si es una edición
        if (record) {
            data.usuario_modificacion = user?.usuario || 'admin';
            data.fecha_modificacion = ahoraSQL();
        }

        try {
            await tipoProyectoService.save(data);
            toast({
                title: "Éxito",
                description: `Tipo de proyecto ${record ? 'actualizado' : 'creado'} correctamente.`,
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
                <CardTitle>{record ? 'Editar Tipo de Proyecto' : 'Nuevo Tipo de Proyecto'}</CardTitle>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="grid grid-cols-1 gap-4">
                        <FormField
                            control={form.control}
                            name="nombre_tipo_proyecto"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre del Tipo de Proyecto</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: Interno" {...field} />
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
