"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Power } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Objetivo, Proyecto } from '@/types/interfaces';
import { objetivoService } from '@/services/proyectos/objetivo.service';
import { ahoraSQL } from '@/lib/fechas';

// Modelo v7: objetivo.descripcion_objetivo es varchar(200).
const MAX_DESCRIPCION = 200;

interface ProyectoObjetivosDialogProps {
    proyecto: Proyecto | null;
    onOpenChange: (open: boolean) => void;
}

export default function ProyectoObjetivosDialog({ proyecto, onOpenChange }: ProyectoObjetivosDialogProps) {
    const { toast } = useToast();
    const { user } = useAuth();

    const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editando, setEditando] = useState<Objetivo | null>(null);
    const [descripcion, setDescripcion] = useState('');

    const limpiar = () => {
        setEditando(null);
        setDescripcion('');
    };

    // Los objetivos del proyecto se recuperan con POST /api/objetivo/buscar { codigo_proyecto }.
    const cargar = useCallback(async () => {
        if (!proyecto) return;
        setIsLoading(true);
        try {
            const resp = await objetivoService.getByProyecto(proyecto.codigo_proyecto);
            setObjetivos(resp.data || []);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'No se pudieron cargar los objetivos del proyecto.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, [proyecto, toast]);

    useEffect(() => {
        limpiar();
        setObjetivos([]);
        cargar();
    }, [cargar]);

    const guardar = async (registro: { codigo_objetivo?: number; descripcion_objetivo: string; estado: string }, mensaje: string) => {
        if (!proyecto) return;
        setIsSaving(true);
        try {
            await objetivoService.save({
                codigo_objetivo: registro.codigo_objetivo ?? 0,
                codigo_proyecto: proyecto.codigo_proyecto,
                descripcion_objetivo: registro.descripcion_objetivo,
                estado: registro.estado,
                usuario_modificacion: user?.usuario || 'admin',
                fecha_modificacion: ahoraSQL(),
            });
            toast({ title: 'Éxito', description: mensaje });
            limpiar();
            await cargar();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
            toast({ title: 'Error al guardar', description: errorMessage, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSubmit = () => {
        if (!descripcion.trim()) {
            toast({ title: 'Datos incompletos', description: 'Describe el objetivo.', variant: 'destructive' });
            return;
        }
        guardar(
            { codigo_objetivo: editando?.codigo_objetivo, descripcion_objetivo: descripcion.trim(), estado: editando?.estado ?? 'A' },
            editando ? 'Objetivo actualizado.' : 'Objetivo agregado al proyecto.'
        );
    };

    const handleEditar = (o: Objetivo) => {
        setEditando(o);
        setDescripcion(o.descripcion_objetivo || '');
    };

    const handleToggleEstado = (o: Objetivo) => {
        const nuevoEstado = o.estado === 'A' ? 'I' : 'A';
        guardar(
            { codigo_objetivo: o.codigo_objetivo, descripcion_objetivo: o.descripcion_objetivo, estado: nuevoEstado },
            nuevoEstado === 'A' ? 'Objetivo reactivado.' : 'Objetivo desactivado.'
        );
    };

    const ordenados = useMemo(
        () => [...objetivos].sort((a, b) => (a.estado === b.estado ? a.codigo_objetivo - b.codigo_objetivo : a.estado === 'A' ? -1 : 1)),
        [objetivos]
    );
    const activos = objetivos.filter((o) => o.estado === 'A').length;

    return (
        <Dialog open={!!proyecto} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Objetivos del proyecto</DialogTitle>
                    <DialogDescription>{proyecto?.nombre_proyecto}</DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-2 rounded-md border p-3">
                    <p className="text-sm font-medium">{editando ? 'Editar objetivo' : 'Nuevo objetivo'}</p>
                    <Textarea
                        placeholder="Ej: Reducir los tiempos de entrega en un 15%"
                        maxLength={MAX_DESCRIPCION}
                        value={descripcion}
                        onChange={(e) => setDescripcion(e.target.value)}
                        disabled={isSaving}
                    />
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">{descripcion.length}/{MAX_DESCRIPCION} caracteres</span>
                        <div className="flex gap-2">
                            {editando && (
                                <Button type="button" variant="outline" onClick={limpiar} disabled={isSaving}>
                                    Cancelar
                                </Button>
                            )}
                            <Button type="button" onClick={handleSubmit} disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {editando ? 'Guardar' : 'Agregar'}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10">#</TableHead>
                                <TableHead>Objetivo</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-16 text-center text-sm text-muted-foreground">Cargando...</TableCell>
                                </TableRow>
                            ) : ordenados.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-16 text-center text-sm text-muted-foreground">
                                        Este proyecto aún no tiene objetivos.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                ordenados.map((o, i) => (
                                    <TableRow key={o.codigo_objetivo} className={o.estado === 'A' ? '' : 'opacity-60'}>
                                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                                        <TableCell className="whitespace-pre-wrap">{o.descripcion_objetivo}</TableCell>
                                        <TableCell>
                                            <Badge variant={o.estado === 'A' ? 'default' : 'destructive'} className={o.estado === 'A' ? 'bg-green-600' : ''}>
                                                {o.estado === 'A' ? 'Activo' : 'Inactivo'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" title="Editar" aria-label="Editar objetivo" onClick={() => handleEditar(o)} disabled={isSaving}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title={o.estado === 'A' ? 'Desactivar' : 'Reactivar'}
                                                    aria-label={o.estado === 'A' ? 'Desactivar objetivo' : 'Reactivar objetivo'}
                                                    onClick={() => handleToggleEstado(o)}
                                                    disabled={isSaving}
                                                >
                                                    <Power className={`h-4 w-4 ${o.estado === 'A' ? 'text-destructive' : 'text-green-600'}`} />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <p className="text-right text-sm text-muted-foreground">
                    {activos} {activos === 1 ? 'objetivo activo' : 'objetivos activos'}
                </p>
            </DialogContent>
        </Dialog>
    );
}
