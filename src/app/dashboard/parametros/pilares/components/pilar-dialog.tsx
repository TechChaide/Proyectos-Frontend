"use client";

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { PilarEstrategico } from '@/types/interfaces';
import { pilarEstrategicoService } from '@/services/proyectos/pilarEstrategico.service';
import { ahoraSQL } from '@/lib/fechas';

// Longitudes según el modelo v7 (pilar_estrategico).
const MAX_NOMBRE = 100;
const MAX_DESCRIPCION = 200;

interface PilarDialogProps {
    open: boolean;
    /** null = nuevo pilar. */
    record: PilarEstrategico | null;
    onOpenChange: (open: boolean) => void;
    /** Devuelve el pilar guardado (con su código) para seleccionarlo. */
    onSaved: (pilar: PilarEstrategico | null) => void;
}

export default function PilarDialog({ open, record, onOpenChange, onSaved }: PilarDialogProps) {
    const { toast } = useToast();
    const { user } = useAuth();
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [activo, setActivo] = useState(true);
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setNombre(record?.nombre_pilar ?? '');
        setDescripcion(record?.descripcion_pilar ?? '');
        setActivo((record?.estado ?? 'A') === 'A');
        setError('');
    }, [open, record]);

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nombre.trim()) {
            setError('El nombre del pilar es requerido.');
            return;
        }
        setIsSaving(true);
        try {
            const resp = await pilarEstrategicoService.save({
                codigo_pilar: record?.codigo_pilar ?? 0,
                nombre_pilar: nombre.trim(),
                descripcion_pilar: descripcion.trim(),
                estado: activo ? 'A' : 'I',
                usuario_modificacion: user?.usuario || 'admin',
                fecha_modificacion: ahoraSQL(),
            });
            toast({ title: 'Éxito', description: `Pilar ${record ? 'actualizado' : 'creado'} correctamente.` });
            onSaved(resp?.data ?? null);
            onOpenChange(false);
        } catch (err) {
            toast({ title: 'Error al guardar', description: err instanceof Error ? err.message : 'Ocurrió un error inesperado.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !isSaving && onOpenChange(o)}>
            <DialogContent className="max-w-lg">
                <form onSubmit={guardar} className="flex flex-col gap-4">
                    <DialogHeader>
                        <DialogTitle>{record ? 'Editar pilar estratégico' : 'Nuevo pilar estratégico'}</DialogTitle>
                        <DialogDescription>
                            {record ? 'Actualiza el nombre, la descripción o el estado del pilar.' : 'Después de crearlo podrás agregarle sus OKR.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-1.5">
                        <Label htmlFor="pilar-nombre">Nombre</Label>
                        <Input
                            id="pilar-nombre"
                            placeholder="Ej: Excelencia Operacional"
                            maxLength={MAX_NOMBRE}
                            value={nombre}
                            onChange={(e) => { setNombre(e.target.value); setError(''); }}
                            aria-invalid={!!error}
                            autoFocus
                        />
                        <div className="flex justify-between text-xs">
                            <span className="text-destructive">{error}</span>
                            <span className="text-muted-foreground">{nombre.length}/{MAX_NOMBRE}</span>
                        </div>
                    </div>

                    <div className="grid gap-1.5">
                        <Label htmlFor="pilar-descripcion">Descripción <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                        <Textarea
                            id="pilar-descripcion"
                            placeholder="¿Qué busca la organización con este pilar?"
                            maxLength={MAX_DESCRIPCION}
                            rows={3}
                            value={descripcion}
                            onChange={(e) => setDescripcion(e.target.value)}
                        />
                        <span className="text-right text-xs text-muted-foreground">{descripcion.length}/{MAX_DESCRIPCION}</span>
                    </div>

                    <div className="flex items-center justify-between rounded-md border p-3">
                        <div>
                            <Label htmlFor="pilar-activo">Pilar activo</Label>
                            <p className="text-xs text-muted-foreground">Solo los pilares activos se ofrecen al crear proyectos.</p>
                        </div>
                        <Switch id="pilar-activo" checked={activo} onCheckedChange={setActivo} />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {record ? 'Guardar cambios' : 'Crear pilar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
