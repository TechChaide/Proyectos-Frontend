
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import type { FichaSocialHistorica, Responsable } from '@/types/interfaces';
import { responsableService } from '@/services/proyectos/responsable.service';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import EmployeeCombobox from './employee-combobox';
import { ahoraSQL } from '@/lib/fechas';

const CORREO_DOMINIO = '@chaideychaide.com';

const formSchema = z.object({
    codigo_responsable: z.number().optional(),
    codigo_empleado: z.string().min(1, "El código de empleado es requerido."),
    correo_responsable: z.string()
        .min(1, "El correo es requerido.")
        .email("Ingrese un correo válido.")
        .refine((v) => v.toLowerCase().endsWith(CORREO_DOMINIO), `El correo debe pertenecer al dominio ${CORREO_DOMINIO}`),
    usuario_modificacion: z.string().optional(),
    fecha_modificacion: z.date().optional(),
});

interface ResponsableFormProps {
    record: Responsable | null;
    personas: FichaSocialHistorica[];
    onSuccess: () => void;
    onCancel: () => void;
}

export default function ResponsableForm({ record, personas, onSuccess, onCancel }: ResponsableFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [correoNoEncontrado, setCorreoNoEncontrado] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            codigo_responsable: record?.codigo_responsable ?? 0,
            codigo_empleado: record?.codigo_empleado ?? '',
            correo_responsable: record?.correo_responsable ?? '',
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsLoading(true);

        // Construir el objeto según si es creación o edición
        const data: any = {
            codigo_responsable: values.codigo_responsable || 0,
            codigo_empleado: values.codigo_empleado,
            correo_responsable: values.correo_responsable,
        };

        // Solo agregar campos de modificación si es una edición
        if (record) {
            data.usuario_modificacion = user?.usuario || 'admin';
            data.fecha_modificacion = ahoraSQL();
        }

        try {
            await responsableService.save(data);
            toast({
                title: "Éxito",
                description: `Responsable ${record ? 'actualizado' : 'creado'} correctamente.`,
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
                <CardTitle>{record ? 'Editar Responsable' : 'Nuevo Responsable'}</CardTitle>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="grid grid-cols-1 gap-4">
                        <FormField
                            control={form.control}
                            name="codigo_empleado"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Empleado</FormLabel>
                                    <FormControl>
                                        <EmployeeCombobox
                                            value={field.value}
                                            personas={personas}
                                            onChange={(codigo, persona) => {
                                                field.onChange(codigo);
                                                if (persona?.MAIL) {
                                                    setCorreoNoEncontrado(false);
                                                    form.setValue('correo_responsable', persona.MAIL, { shouldValidate: true });
                                                } else if (persona) {
                                                    setCorreoNoEncontrado(true);
                                                    form.setValue('correo_responsable', '', { shouldValidate: true });
                                                }
                                            }}
                                            disabled={isLoading}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="correo_responsable"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Correo del Responsable</FormLabel>
                                    <FormControl>
                                        <Input type="email" placeholder="Ej: nombre.apellido@chaideychaide.com" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Se completa automáticamente desde la Ficha Social del empleado. Debe ser un correo {CORREO_DOMINIO}.
                                    </FormDescription>
                                    {correoNoEncontrado && (
                                        <p className="text-sm font-medium text-amber-600">
                                            Este empleado no tiene un correo registrado en Ficha Social. Ingrésalo manualmente.
                                        </p>
                                    )}
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
