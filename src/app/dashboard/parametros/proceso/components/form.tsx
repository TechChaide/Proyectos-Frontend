
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
import { AlertTriangle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/use-auth';
import { ahoraSQL } from '@/lib/fechas';
import { capitalizar } from '@/lib/texto';
import { PROFUNDIDAD_SUBPROCESO } from '@/lib/procesoNiveles';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
    /** Regional (centro) y correos del padre, para heredar/pre-llenar en los hijos. */
    parentCentro?: string;
    parentCorreos?: string;
    /** Profundidad del nodo en el organigrama (0 = Macroproceso, 1 = Proceso, 2 = Subproceso...). */
    nivel?: number;
    /** Regionales que se pueden elegir para un Subproceso. */
    regionales?: string[];
    /** Descendientes del registro editado: heredan la regional del Subproceso y se inactivan junto con él. */
    descendientes?: Area[];
    /** El nivel superior está activo. Un nivel no puede estar activo si su padre está inactivo. */
    parentActivo?: boolean;
    onSuccess: () => void;
    onCancel: () => void;
}

export default function AreaForm({ record, parentId = null, parentNombre = null, parentCentro = '', parentCorreos = '', nivel = 0, regionales = [], descendientes = [], parentActivo = true, onSuccess, onCancel }: AreaFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth();

    // Regional por nivel: Macroproceso y Proceso son comunes a todas (sin centro); el Subproceso la elige;
    // Línea, Puesto y Tarea la heredan del padre.
    // Un proceso es "hijo" si edita un registro con padre, o si se está creando bajo un padre.
    const esHijo = record ? record.codigo_proceso_padre != null : !!parentId;
    const eligeRegional = nivel === PROFUNDIDAD_SUBPROCESO;
    const heredaRegional = nivel > PROFUNDIDAD_SUBPROCESO;
    const centroHeredado = (parentCentro || '').trim();
    const centroPropio = (record?.centro || '').trim();
    const centroInicial = eligeRegional ? centroPropio : heredaRegional ? centroHeredado : '';

    // Si el registro trae una regional fuera de la lista, se conserva como opción para no perderla al editar.
    const opcionesCentro = centroInicial && !regionales.includes(centroInicial) ? [...regionales, centroInicial] : regionales;
    const [regionalNueva, setRegionalNueva] = useState(false);
    // Valores pendientes de confirmar: inactivar un nivel también inactiva todo lo que cuelga de él.
    const [pendienteInactivar, setPendienteInactivar] = useState<z.infer<typeof formSchema> | null>(null);
    const [entiendo, setEntiendo] = useState(false);
    const descendientesActivos = descendientes.filter((d) => d.estado === 'A');

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            codigo_proceso: record?.codigo_proceso ?? 0,
            centro: centroInicial,
            nombre_proceso: record?.nombre_proceso ?? '',
            // Al crear un hijo, se pre-llena con los correos del padre (editable).
            correos_proceso: record?.correos_proceso ?? (parentId ? parentCorreos : ''),
            // Bajo un nivel inactivo no se puede estar activo.
            estado: !parentActivo ? 'I' : (record?.estado ?? 'A'),
        },
    });

    // Valida y, si inactivar este nivel arrastra niveles inferiores activos, pide confirmación antes de guardar.
    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        const estado = parentActivo ? values.estado : 'I';
        // Inactivar un nivel que estaba activo (o que arrastra niveles activos) siempre pide confirmación.
        if (estado === 'I' && (record?.estado === 'A' || descendientesActivos.length > 0)) {
            setEntiendo(false);
            setPendienteInactivar({ ...values, estado });
            return;
        }
        await guardar({ ...values, estado });
    };

    const guardar = async (values: z.infer<typeof formSchema>) => {
        const centro = eligeRegional ? (values.centro || '').trim() : heredaRegional ? centroHeredado : '';
        if (eligeRegional && !centro) {
            form.setError('centro', { message: 'La regional es requerida.' });
            return;
        }
        setIsLoading(true);

        // Construir el objeto según si es creación o edición
        const data: any = {
            codigo_proceso: values.codigo_proceso || 0,
            // Jerarquía: al editar se conserva el padre actual; al crear un hijo se usa parentId; raíz = null.
            codigo_proceso_padre: record ? (record.codigo_proceso_padre ?? null) : (parentId ?? null),
            centro,
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

            // Los niveles inferiores siguen a este: heredan la regional del Subproceso y, si este nivel queda
            // inactivo, se inactivan también (nada puede estar activo bajo un nivel inactivo).
            const inactivar = values.estado === 'I';
            const aActualizar = record
                ? descendientes.filter((d) => (eligeRegional && (d.centro || '').trim() !== centro) || (inactivar && d.estado === 'A'))
                : [];
            for (const d of aActualizar) {
                await procesoService.save({
                    ...d,
                    centro: eligeRegional ? centro : d.centro,
                    estado: inactivar ? 'I' : d.estado,
                    usuario_modificacion: user?.usuario || 'admin',
                    fecha_modificacion: ahoraSQL(),
                } as Area);
            }

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
                <CardTitle>{record ? 'Editar' : 'Nuevo'} nivel</CardTitle>
                {!record && parentNombre && (
                    <p className="text-sm text-muted-foreground">Se crea dentro de: <strong>{parentNombre}</strong></p>
                )}
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="grid grid-cols-1 gap-4">
                        {eligeRegional ? (
                            <FormField
                                control={form.control}
                                name="centro"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Regional</FormLabel>
                                        <Select
                                            onValueChange={(v) => {
                                                const nueva = v === '__nueva';
                                                setRegionalNueva(nueva);
                                                field.onChange(nueva ? '' : v);
                                            }}
                                            value={regionalNueva ? '__nueva' : field.value || undefined}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccione una regional" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {opcionesCentro.map((c) => (
                                                    <SelectItem key={c} value={c}>Regional {c}</SelectItem>
                                                ))}
                                                <SelectItem value="__nueva">➕ Nueva regional…</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {regionalNueva && (
                                            <Input
                                                placeholder="Código de la regional (ej: 3000)"
                                                maxLength={4}
                                                value={field.value ?? ''}
                                                onChange={(e) => field.onChange(e.target.value.trim())}
                                            />
                                        )}
                                        {record && descendientes.length > 0 && (
                                            <p className="text-xs text-muted-foreground">
                                                Si cambias la regional, también se actualizan sus {descendientes.length} niveles inferiores.
                                            </p>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        ) : heredaRegional ? (
                            // Línea, Puesto y Tarea heredan la regional de su Subproceso.
                            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                                <span className="text-muted-foreground">Regional (heredada del nivel superior): </span>
                                <strong>{centroHeredado || '—'}</strong>
                            </div>
                        ) : (
                            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                                Este nivel es común a todas las regionales. La regional se elige al crear el nivel siguiente.
                            </div>
                        )}
                        <FormField
                            control={form.control}
                            name="nombre_proceso"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre</FormLabel>
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
                                    <FormLabel>Correos</FormLabel>
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
                                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!parentActivo}>
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
                                    {!parentActivo && (
                                        <p className="text-xs text-muted-foreground">El nivel superior está inactivo: este nivel también queda inactivo. Reactiva primero el nivel superior.</p>
                                    )}
                                    {parentActivo && record && descendientes.length > 0 && field.value === 'I' && (
                                        <p className="text-xs text-muted-foreground">Al inactivar este nivel también se inactivan sus {descendientes.length} niveles inferiores.</p>
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

            <AlertDialog open={!!pendienteInactivar} onOpenChange={(o) => { if (!o) setPendienteInactivar(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            ¿Seguro que deseas inactivar este nivel?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Estás por inactivar <strong className="text-foreground">{record?.nombre_proceso}</strong>. Revisa lo que implica antes de continuar:
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <ul className="list-disc space-y-1.5 pl-5 text-sm">
                        <li>Dejará de mostrarse y de ofrecerse, por ejemplo al crear un proyecto.</li>
                        {descendientesActivos.length > 0 && (
                            <li>
                                <strong>Se inactivarán también {descendientesActivos.length} {descendientesActivos.length === 1 ? 'nivel inferior' : 'niveles inferiores'}</strong>, porque ninguno puede estar activo bajo un nivel inactivo.
                            </li>
                        )}
                        <li>Reactivarlo no reactiva automáticamente los niveles inferiores: se reactivan uno a uno, de arriba hacia abajo.</li>
                    </ul>

                    {descendientesActivos.length > 0 && (
                        <ul className="max-h-40 list-disc overflow-y-auto rounded-md border bg-muted/30 py-2 pl-7 pr-3 text-sm">
                            {descendientesActivos.map((d) => <li key={d.codigo_proceso}>{d.nombre_proceso}</li>)}
                        </ul>
                    )}

                    <label className="flex cursor-pointer items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                        <Checkbox checked={entiendo} onCheckedChange={(v) => setEntiendo(v === true)} className="mt-0.5" />
                        <span>Entiendo el impacto de este cambio y quiero continuar.</span>
                    </label>

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar, mantener activo</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={!entiendo}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => { const v = pendienteInactivar; setPendienteInactivar(null); if (v) void guardar(v); }}
                        >
                            Sí, inactivar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
