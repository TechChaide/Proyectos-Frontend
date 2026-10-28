
"use client";

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
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
import type { Estado, EstadoSolicitud } from '@/types/interfaces';
import { estadoSolicitudService } from '@/services/proyectos/estadoSolicitud.service';
import { ahoraSQL } from '@/lib/fechas';
import type { ProyectoView } from '../types';

interface EstadoProyectoDialogProps {
    view: ProyectoView | null;
    estados: Estado[];
    onOpenChange: (open: boolean) => void;
    onSaved: () => void;
}

// El estado de un proyecto es el último registro activo de estado_solicitud de su solicitud:
// actualizarlo es agregar un registro nuevo (queda el historial de cambios).
export default function EstadoProyectoDialog({ view, estados, onOpenChange, onSaved }: EstadoProyectoDialogProps) {
    const { toast } = useToast();
    const { user } = useAuth();
    const [codigoEstado, setCodigoEstado] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setCodigoEstado('');
    }, [view]);

    const handleGuardar = async () => {
        if (!view || !codigoEstado) return;
        setIsSaving(true);
        try {
            await estadoSolicitudService.save({
                codigo_estado_solicitud: 0,
                codigo_estado: Number(codigoEstado),
                codigo_solicitud: view.proyecto.codigo_solicitud,
                estado: 'A',
                usuario_modificacion: user?.usuario || 'admin',
                fecha_modificacion: ahoraSQL(),
            } as EstadoSolicitud);
            toast({ title: 'Estado actualizado', description: `El proyecto "${view.proyecto.nombre_proyecto}" cambió de estado.` });
            onOpenChange(false);
            onSaved();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
            toast({ title: 'Error al guardar', description: errorMessage, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={!!view} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Actualizar estado del proyecto</DialogTitle>
                    <DialogDescription>
                        {view?.proyecto.nombre_proyecto} — estado actual: <strong>{view?.estadoSolicitudNombre || 'Sin estado'}</strong>
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Nuevo estado</label>
                    <Select value={codigoEstado} onValueChange={setCodigoEstado} disabled={isSaving}>
                        <SelectTrigger>
                            <SelectValue placeholder="Seleccione un estado" />
                        </SelectTrigger>
                        <SelectContent>
                            {estados.filter((e) => e.estado === 'A').map((e) => (
                                <SelectItem key={e.codigo_estado} value={String(e.codigo_estado)}>
                                    {e.nombre_estado}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        Cancelar
                    </Button>
                    <Button onClick={handleGuardar} disabled={isSaving || !codigoEstado}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
