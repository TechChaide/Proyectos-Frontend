
"use client";

import { useMemo, useState } from 'react';
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import type { Actividad, Estado, EstadoActividad, Proyecto } from '@/types/interfaces';
import { estadoActividadService } from '@/services/proyectos/estadoActividad.service';
import { actividadService } from '@/services/proyectos/actividad.service';
import { useAuth } from '@/hooks/use-auth';
import { fechaConHoraActualSQL, fechaISO } from '@/lib/fechas';

// La fecha real elegida se guarda con la hora actual de Ecuador: así el cálculo de
// cumplimiento usa la fecha real del hecho, no el momento en que alguien hizo el papeleo.
const hoyISO = (): string => fechaISO(new Date());

const formSchema = z.object({
    codigo_estado_actividad: z.number().optional(),
    codigo_actividad: z.number({ required_error: "La actividad es requerida." }).min(1, "La actividad es requerida."),
    codigo_estado: z.number({ required_error: "El estado es requerido." }).min(1, "El estado es requerido."),
    url_evidencia: z.string().max(200, "Máximo 200 caracteres; si el enlace es más largo, usa un acortador de enlaces.").optional(),
    fecha_cierre_real: z.string().min(1, "La fecha real de este cambio es requerida.").refine((v) => v <= hoyISO(), "No puedes elegir una fecha futura."),
    estado: z.string({ required_error: "El estado del registro es requerido." }),
});

interface EstadoActividadFormProps {
    record: EstadoActividad | null;
    actividades: Actividad[];
    proyectos: Proyecto[];
    estados: Estado[];
    actividadInicial?: number;
    onSuccess: () => void;
    onCancel: () => void;
}

const fechaISODesde = (value: string | Date | undefined): string => (value && fechaISO(value)) || hoyISO();

export default function EstadoActividadForm({ record, actividades, proyectos, estados, actividadInicial, onSuccess, onCancel }: EstadoActividadFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [enlaceTruncado, setEnlaceTruncado] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth();

    const proyectoMap = useMemo(() => new Map(proyectos.map((p) => [p.codigo_proyecto, p])), [proyectos]);
    const actividadMap = useMemo(() => new Map(actividades.map((a) => [a.codigo_actividad, a])), [actividades]);
    const estadoMap = useMemo(() => new Map(estados.map((e) => [e.codigo_estado, e])), [estados]);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            codigo_estado_actividad: record?.codigo_estado_actividad ?? 0,
            codigo_actividad: record?.codigo_actividad ?? actividadInicial ?? 0,
            codigo_estado: record?.codigo_estado ?? 0,
            url_evidencia: record?.url_evidencia ?? '',
            fecha_cierre_real: record ? fechaISODesde(record.fecha_modificacion) : hoyISO(),
            estado: record?.estado ?? 'A',
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsLoading(true);

        const fechaReal = fechaConHoraActualSQL(values.fecha_cierre_real);

        const data: any = {
            codigo_estado_actividad: values.codigo_estado_actividad || 0,
            codigo_actividad: values.codigo_actividad,
            codigo_estado: values.codigo_estado,
            url_evidencia: values.url_evidencia || '',
            estado: values.estado,
            usuario_modificacion: user?.usuario || 'admin',
            fecha_modificacion: fechaReal,
        };

        try {
            await estadoActividadService.save(data);

            // Si el registro queda activo, sincroniza el estado visible de la Actividad
            // (actividad.estado_actividad) para que cards y reportes reflejen el último estado.
            if (values.estado === 'A') {
                const actividad = actividadMap.get(values.codigo_actividad);
                const nombreEstado = estadoMap.get(values.codigo_estado)?.nombre_estado;
                if (actividad && nombreEstado) {
                    await actividadService.save({
                        ...actividad,
                        estado_actividad: nombreEstado,
                        usuario_modificacion: user?.usuario || 'admin',
                        fecha_modificacion: fechaReal,
                    });
                }
            }

            toast({
                title: "Éxito",
                description: `Estado de actividad ${record ? 'actualizado' : 'creado'} correctamente.`,
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
                <CardTitle>{record ? 'Editar Estado de Actividad' : 'Nuevo Estado de Actividad'}</CardTitle>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="grid grid-cols-1 gap-4">
                        <FormField
                            control={form.control}
                            name="codigo_actividad"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Actividad</FormLabel>
                                    <Select
                                        onValueChange={(value) => field.onChange(Number(value))}
                                        value={field.value ? String(field.value) : undefined}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione una actividad" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {actividades.map((a) => {
                                                const proyectoNombre = proyectoMap.get(a.codigo_proyecto)?.nombre_proyecto;
                                                return (
                                                    <SelectItem key={a.codigo_actividad} value={String(a.codigo_actividad)}>
                                                        {a.nombre_actividad}{proyectoNombre ? ` — ${proyectoNombre}` : ''}
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="codigo_estado"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Estado</FormLabel>
                                    <Select
                                        onValueChange={(value) => field.onChange(Number(value))}
                                        value={field.value ? String(field.value) : undefined}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione un estado" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {estados.filter((e) => e.estado === 'A' || e.codigo_estado === field.value).map((e) => (
                                                <SelectItem key={e.codigo_estado} value={String(e.codigo_estado)}>
                                                    {e.nombre_estado}
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
                            name="fecha_cierre_real"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Fecha real de este cambio</FormLabel>
                                    <FormControl>
                                        <Input type="date" max={hoyISO()} {...field} />
                                    </FormControl>
                                    <p className="text-xs text-muted-foreground">
                                        La fecha en que la persona realmente completó (o cambió) la actividad — no la fecha en que tú la
                                        estás registrando. El cálculo de cumplimiento usa esta fecha para medir el atraso real, sin
                                        beneficiar ni perjudicar a nadie por demoras administrativas.
                                    </p>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="url_evidencia"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>URL de Evidencia (opcional)</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="Ej: https://drive.google.com/..."
                                            maxLength={200}
                                            {...field}
                                            onChange={(e) => {
                                                field.onChange(e);
                                                setEnlaceTruncado(false);
                                            }}
                                            onPaste={(e) => {
                                                const pegado = e.clipboardData.getData('text');
                                                if (pegado.length > 200) {
                                                    e.preventDefault();
                                                    setEnlaceTruncado(true);
                                                }
                                            }}
                                        />
                                    </FormControl>
                                    <p className="text-xs text-muted-foreground">{field.value?.length ?? 0}/200 caracteres.</p>
                                    {enlaceTruncado ? (
                                        <Alert variant="destructive">
                                            <AlertDescription className="text-xs">
                                                Ese enlace tiene más de 200 caracteres y la base de datos no lo acepta completo — si lo pegas
                                                tal cual, queda cortado y no se podrá abrir después. Acórtalo primero con{' '}
                                                <a href="https://tinyurl.com" target="_blank" rel="noopener noreferrer" className="underline">tinyurl.com</a>
                                                {' '}o similar, y pega aquí el link corto.
                                            </AlertDescription>
                                        </Alert>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">Pega el enlace compartido de Drive (hasta 200 caracteres).</p>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="estado"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>¿Este registro es válido?</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione un estado" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="A">
                                                <div className="flex items-center">
                                                    Activo (normal)
                                                    <span className="ml-2 h-2 w-2 rounded-full bg-green-500"></span>
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="I">
                                                <div className="flex items-center">
                                                    Inactivo (anular este registro)
                                                    <span className="ml-2 h-2 w-2 rounded-full bg-red-500"></span>
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Deja en <strong>Activo</strong> en casi todos los casos — es lo que hace que este cambio de
                                        estado cuente (sincroniza la actividad y entra en la Nota de cumplimiento). Marca "Inactivo"
                                        solo si quieres anular/descartar este registro por error, no para indicar que la actividad ya
                                        terminó (eso se hace con el campo "Estado" de arriba, eligiendo "Completada").
                                    </p>
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
