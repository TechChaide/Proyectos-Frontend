"use client";

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Okr, PilarEstrategico } from '@/types/interfaces';
import { okrService } from '@/services/proyectos/okr.service';
import { ahoraSQL } from '@/lib/fechas';

// Longitudes según el modelo v7 (okr).
const MAX_NOMBRE = 100;
const MAX_DESCRIPCION = 200;

interface OkrDialogProps {
    open: boolean;
    pilar: PilarEstrategico | null;
    /** null = nuevo OKR. */
    record: Okr | null;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void;
}

export default function OkrDialog({ open, pilar, record, onOpenChange, onSaved }: OkrDialogProps) {
    const { toast } = useToast();
    const { user } = useAuth();
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [activo, setActivo] = useState(true);
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    // "Guardar y agregar otro" deja el diálogo abierto para cargar varios OKR seguidos.
    const seguir = useRef(false);

    useEffect(() => {
        if (!open) return;
        setNombre(record?.nombre_okr ?? '');
        setDescripcion(record?.descripcion_okr ?? '');
        setActivo((record?.estado ?? 'A') === 'A');
        setError('');
    }, [open, record]);

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pilar) return;
        if (!nombre.trim()) {
            setError('El nombre del OKR es requerido.');
            seguir.current = false;
            return;
        }
        setIsSaving(true);
        try {
            await okrService.save({
                codigo_okr: record?.codigo_okr ?? 0,
                codigo_pilar: pilar.codigo_pilar,
                nombre_okr: nombre.trim(),
                descripcion_okr: descripcion.trim(),
                estado: activo ? 'A' : 'I',
                usuario_modificacion: user?.usuario || 'admin',
                fecha_modificacion: ahoraSQL(),
            });
            toast({ title: 'Éxito', description: record ? 'OKR actualizado.' : 'OKR agregado al pilar.' });
            onSaved();
            if (seguir.current && !record) {
                setNombre('');
                setDescripcion('');
                setActivo(true);
            } else {
                onOpenChange(false);
            }
        } catch (err) {
            toast({ title: 'Error al guardar', description: err instanceof Error ? err.message : 'Ocurrió un error inesperado.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
            seguir.current = false;
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !isSaving && onOpenChange(o)}>
            <DialogContent className="max-w-lg">
                <form onSubmit={guardar} className="flex flex-col gap-4">
                    <DialogHeader>
                        <DialogTitle>{record ? 'Editar OKR' : 'Nuevo OKR'}</DialogTitle>
                        <DialogDescription>Pilar: <strong className="text-foreground">{pilar?.nombre_pilar}</strong></DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-1.5">
                        <Label htmlFor="okr-nombre">Objetivo y resultado clave</Label>
                        <Input
                            id="okr-nombre"
                            placeholder="Ej: Reducir el desperdicio de espuma al 3%"
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
                        <Label htmlFor="okr-descripcion">Descripción <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                        <Textarea
                            id="okr-descripcion"
                            placeholder="Cómo se mide, meta y plazo"
                            maxLength={MAX_DESCRIPCION}
                            rows={3}
                            value={descripcion}
                            onChange={(e) => setDescripcion(e.target.value)}
                        />
                        <span className="text-right text-xs text-muted-foreground">{descripcion.length}/{MAX_DESCRIPCION}</span>
                    </div>

                    <div className="flex items-center justify-between rounded-md border p-3">
                        <div>
                            <Label htmlFor="okr-activo">OKR activo</Label>
                            <p className="text-xs text-muted-foreground">Solo los OKR activos se ofrecen al crear proyectos.</p>
                        </div>
                        <Switch id="okr-activo" checked={activo} onCheckedChange={setActivo} />
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
                        {!record && (
                            <Button type="submit" variant="secondary" disabled={isSaving} onClick={() => { seguir.current = true; }}>
                                Guardar y agregar otro
                            </Button>
                        )}
                        <Button type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {record ? 'Guardar cambios' : 'Agregar OKR'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
