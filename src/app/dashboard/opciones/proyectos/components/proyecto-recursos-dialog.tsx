
"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Power } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type { Proyecto, ProyectoRecurso, Recurso, TipoRecurso } from '@/types/interfaces';
import { proyectoRecursoService } from '@/services/proyectos/proyectoRecurso.service';
import { recursoService } from '@/services/proyectos/recurso.service';
import { tipoRecursoService } from '@/services/proyectos/tipoRecurso.service';
import { ahoraSQL } from '@/lib/fechas';

interface ProyectoRecursosDialogProps {
    proyecto: Proyecto | null;
    onOpenChange: (open: boolean) => void;
}

const aNumero = (valor: string | undefined): number => {
    const n = Number((valor || '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
};

const formatMonto = (n: number): string =>
    n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ProyectoRecursosDialog({ proyecto, onOpenChange }: ProyectoRecursosDialogProps) {
    const { toast } = useToast();
    const { user } = useAuth();

    const [asignaciones, setAsignaciones] = useState<ProyectoRecurso[]>([]);
    const [recursos, setRecursos] = useState<Recurso[]>([]);
    const [tiposRecurso, setTiposRecurso] = useState<TipoRecurso[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [editando, setEditando] = useState<ProyectoRecurso | null>(null);
    const [codigoRecurso, setCodigoRecurso] = useState('');
    const [valor, setValor] = useState('');

    const limpiarFormulario = () => {
        setEditando(null);
        setCodigoRecurso('');
        setValor('');
    };

    const cargar = useCallback(async () => {
        if (!proyecto) return;
        setIsLoading(true);
        try {
            const [asignacionesResp, recursosResp, tiposResp] = await Promise.all([
                proyectoRecursoService.getAll(),
                recursoService.getAll(),
                tipoRecursoService.getAll(),
            ]);
            setAsignaciones((asignacionesResp.data || []).filter((pr) => pr.codigo_proyecto === proyecto.codigo_proyecto));
            setRecursos(recursosResp.data || []);
            setTiposRecurso(tiposResp.data || []);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'No se pudieron cargar los recursos del proyecto.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, [proyecto, toast]);

    useEffect(() => {
        limpiarFormulario();
        cargar();
    }, [cargar]);

    const recursoMap = useMemo(() => new Map(recursos.map((r) => [r.codigo_recurso, r])), [recursos]);
    const tipoMap = useMemo(() => new Map(tiposRecurso.map((t) => [t.codigo_tipo_recurso, t])), [tiposRecurso]);

    // Recursos que se pueden elegir: activos y que no estén ya asignados (activos) a este proyecto.
    const recursosDisponibles = useMemo(() => {
        const asignadosActivos = new Set(
            asignaciones
                .filter((a) => a.estado === 'A' && a.codigo_proyecto_recurso !== editando?.codigo_proyecto_recurso)
                .map((a) => a.codigo_recurso)
        );
        return recursos.filter(
            (r) => (r.estado === 'A' || r.codigo_recurso === editando?.codigo_recurso) && !asignadosActivos.has(r.codigo_recurso)
        );
    }, [recursos, asignaciones, editando]);

    const totalActivo = useMemo(
        () => asignaciones.filter((a) => a.estado === 'A').reduce((s, a) => s + aNumero(a.valor_recurso), 0),
        [asignaciones]
    );

    const guardar = async (registro: Partial<ProyectoRecurso> & { codigo_recurso: number; valor_recurso: string; estado: string }, mensaje: string) => {
        if (!proyecto) return;
        setIsSaving(true);
        try {
            await proyectoRecursoService.save({
                codigo_proyecto_recurso: registro.codigo_proyecto_recurso ?? 0,
                codigo_recurso: registro.codigo_recurso,
                codigo_proyecto: proyecto.codigo_proyecto,
                valor_recurso: registro.valor_recurso,
                estado: registro.estado,
                usuario_modificacion: user?.usuario || 'admin',
                fecha_modificacion: ahoraSQL(),
            } as ProyectoRecurso);
            toast({ title: 'Éxito', description: mensaje });
            limpiarFormulario();
            await cargar();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
            toast({ title: 'Error al guardar', description: errorMessage, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSubmit = () => {
        if (!codigoRecurso || !valor.trim()) {
            toast({ title: 'Datos incompletos', description: 'Selecciona un recurso e ingresa el valor asignado.', variant: 'destructive' });
            return;
        }
        guardar(
            {
                codigo_proyecto_recurso: editando?.codigo_proyecto_recurso,
                codigo_recurso: Number(codigoRecurso),
                valor_recurso: valor.trim(),
                estado: editando?.estado ?? 'A',
            },
            editando ? 'Recurso actualizado.' : 'Recurso asignado al proyecto.'
        );
    };

    const handleEditar = (a: ProyectoRecurso) => {
        setEditando(a);
        setCodigoRecurso(String(a.codigo_recurso));
        setValor(a.valor_recurso || '');
    };

    const handleToggleEstado = (a: ProyectoRecurso) => {
        const nuevoEstado = a.estado === 'A' ? 'I' : 'A';
        guardar(
            { codigo_proyecto_recurso: a.codigo_proyecto_recurso, codigo_recurso: a.codigo_recurso, valor_recurso: a.valor_recurso, estado: nuevoEstado },
            nuevoEstado === 'A' ? 'Recurso reactivado.' : 'Recurso desactivado.'
        );
    };

    const asignacionesOrdenadas = useMemo(
        () => [...asignaciones].sort((a, b) => (a.estado === b.estado ? 0 : a.estado === 'A' ? -1 : 1)),
        [asignaciones]
    );

    return (
        <Dialog open={!!proyecto} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Recursos del proyecto</DialogTitle>
                    <DialogDescription>{proyecto?.nombre_proyecto}</DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-3 rounded-md border p-3">
                    <p className="text-sm font-medium">{editando ? 'Editar recurso asignado' : 'Asignar recurso'}</p>
                    <div className="flex flex-col gap-2 md:flex-row md:items-end">
                        <div className="flex-1">
                            <label className="text-xs text-muted-foreground">Recurso</label>
                            <Select value={codigoRecurso} onValueChange={setCodigoRecurso} disabled={isSaving}>
                                <SelectTrigger>
                                    <SelectValue placeholder={recursosDisponibles.length ? 'Seleccione un recurso' : 'No hay recursos disponibles'} />
                                </SelectTrigger>
                                <SelectContent>
                                    {recursosDisponibles.map((r) => (
                                        <SelectItem key={r.codigo_recurso} value={String(r.codigo_recurso)}>
                                            {r.nombre_recurso}
                                            {tipoMap.get(r.codigo_tipo_recurso) ? ` — ${tipoMap.get(r.codigo_tipo_recurso)!.nombre_recurso}` : ''}
                                            {r.costo ? ` (costo: ${r.costo})` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="md:w-40">
                            <label className="text-xs text-muted-foreground">Valor asignado</label>
                            <Input
                                inputMode="decimal"
                                placeholder="Ej: 1500"
                                maxLength={50}
                                value={valor}
                                onChange={(e) => setValor(e.target.value.replace(/[^0-9.,]/g, ''))}
                                disabled={isSaving}
                            />
                        </div>
                        <div className="flex gap-2">
                            {editando && (
                                <Button type="button" variant="outline" onClick={limpiarFormulario} disabled={isSaving}>
                                    Cancelar
                                </Button>
                            )}
                            <Button type="button" onClick={handleSubmit} disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {editando ? 'Guardar' : 'Asignar'}
                            </Button>
                        </div>
                    </div>
                    {recursos.length === 0 && !isLoading && (
                        <p className="text-xs text-muted-foreground">
                            No hay recursos en el catálogo. Regístralos primero en la opción "Recursos".
                        </p>
                    )}
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Recurso</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead className="text-right">Costo</TableHead>
                                <TableHead className="text-right">Valor asignado</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-16 text-center text-sm text-muted-foreground">Cargando...</TableCell>
                                </TableRow>
                            ) : asignacionesOrdenadas.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-16 text-center text-sm text-muted-foreground">
                                        Este proyecto no tiene recursos asignados.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                asignacionesOrdenadas.map((a) => {
                                    const recurso = recursoMap.get(a.codigo_recurso);
                                    const tipo = recurso ? tipoMap.get(recurso.codigo_tipo_recurso) : undefined;
                                    return (
                                        <TableRow key={a.codigo_proyecto_recurso} className={a.estado === 'A' ? '' : 'opacity-60'}>
                                            <TableCell className="font-medium">{recurso?.nombre_recurso || a.codigo_recurso}</TableCell>
                                            <TableCell>{tipo?.nombre_recurso || '-'}</TableCell>
                                            <TableCell className="text-right">{recurso?.costo || '-'}</TableCell>
                                            <TableCell className="text-right">{a.valor_recurso}</TableCell>
                                            <TableCell>
                                                <Badge variant={a.estado === 'A' ? 'default' : 'destructive'} className={a.estado === 'A' ? 'bg-green-600' : ''}>
                                                    {a.estado === 'A' ? 'Activo' : 'Inactivo'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" title="Editar" aria-label="Editar" onClick={() => handleEditar(a)} disabled={isSaving}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title={a.estado === 'A' ? 'Desactivar' : 'Reactivar'}
                                                        aria-label={a.estado === 'A' ? 'Desactivar' : 'Reactivar'}
                                                        onClick={() => handleToggleEstado(a)}
                                                        disabled={isSaving}
                                                    >
                                                        <Power className={`h-4 w-4 ${a.estado === 'A' ? 'text-destructive' : 'text-green-600'}`} />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex justify-end text-sm">
                    <span className="text-muted-foreground">Total asignado (activos):</span>
                    <span className="ml-2 font-semibold">{formatMonto(totalActivo)}</span>
                </div>
            </DialogContent>
        </Dialog>
    );
}
