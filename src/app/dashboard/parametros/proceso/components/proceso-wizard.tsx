"use client";

import { useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { Area } from '@/types/interfaces';
import { procesoService } from '@/services/proyectos/proceso.service';
import { capitalizar } from '@/lib/texto';
import { CENTROS } from '@/lib/procesoNiveles';

const NUEVO = 'nuevo';

interface ProcesoWizardProps {
    records: Area[];
    onSuccess: () => void;
    /** Se llama si falló a mitad de camino (ya se creó el macroproceso) para refrescar el árbol. */
    onRefresh: () => void;
    onCancel: () => void;
}

// Alta guiada de un Proceso: Centro -> Macroproceso -> Proceso.
// El Macroproceso se elige del organigrama existente o se crea en el momento.
export default function ProcesoWizard({ records, onSuccess, onRefresh, onCancel }: ProcesoWizardProps) {
    const { toast } = useToast();
    const { user } = useAuth();
    const [guardando, setGuardando] = useState(false);

    const [centro, setCentro] = useState('');
    const [macroSel, setMacroSel] = useState('');
    const [macroNombre, setMacroNombre] = useState('');
    const [nombre, setNombre] = useState('');
    const [correos, setCorreos] = useState('');

    const macros = useMemo(
        () => records.filter((r) => r.estado === 'A' && !r.codigo_proceso_padre && r.centro === centro),
        [records, centro]
    );
    const macroNuevo = macroSel === NUEVO;

    const cambiarCentro = (v: string) => {
        setCentro(v);
        setMacroSel('');
    };

    const listo = !!centro && !!macroSel && (!macroNuevo || !!macroNombre.trim()) && !!nombre.trim() && !!correos.trim();

    const guardar = async () => {
        if (!listo) return;
        setGuardando(true);
        const crear = async (padre: number | null, nom: string): Promise<number> => {
            const resp = await procesoService.save({
                codigo_proceso: 0,
                codigo_proceso_padre: padre,
                centro,
                nombre_proceso: nom.trim(),
                correos_proceso: correos.trim(), // la BD lo exige; el macroproceso no lo pide y toma el del proceso
                estado: 'A',
                usuario_modificacion: user?.usuario || 'admin',
            } as unknown as Area);
            return resp.data.codigo_proceso;
        };
        let macroCreado = false;
        try {
            let macroId = Number(macroSel);
            if (macroNuevo) {
                macroId = await crear(null, macroNombre);
                macroCreado = true;
            }
            await crear(macroId, nombre);
            toast({ title: 'Éxito', description: 'Proceso creado correctamente dentro de su organigrama.' });
            onSuccess();
        } catch (error) {
            toast({
                title: 'Error al guardar',
                description: error instanceof Error ? error.message : 'Ocurrió un error inesperado.',
                variant: 'destructive',
            });
            if (macroCreado) onRefresh();
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Card className="border-0 shadow-none">
            <CardHeader>
                <CardTitle>Nuevo Proceso</CardTitle>
                <CardDescription>
                    Ubica el proceso en el organigrama: Centro → Macroproceso → Proceso. Si el Macroproceso aún no existe, créalo aquí mismo.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
                <div className="grid gap-1.5">
                    <Label>1. Centro</Label>
                    <Select value={centro || undefined} onValueChange={cambiarCentro}>
                        <SelectTrigger><SelectValue placeholder="Seleccione un centro" /></SelectTrigger>
                        <SelectContent>
                            {CENTROS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid gap-1.5">
                    <Label>2. Macroproceso</Label>
                    <Select value={macroSel || undefined} onValueChange={setMacroSel} disabled={!centro}>
                        <SelectTrigger><SelectValue placeholder={centro ? 'Seleccione o cree un macroproceso' : 'Primero elija el centro'} /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NUEVO}>➕ Nuevo macroproceso…</SelectItem>
                            {macros.map((m) => <SelectItem key={m.codigo_proceso} value={String(m.codigo_proceso)}>{m.nombre_proceso}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    {macroNuevo && (
                        <Input placeholder="Nombre (ej: Operativo)" maxLength={50} value={macroNombre} onChange={(e) => setMacroNombre(capitalizar(e.target.value))} />
                    )}
                </div>

                <div className="grid gap-1.5">
                    <Label>3. Proceso</Label>
                    <Input placeholder="Nombre del proceso (ej: Colchones)" maxLength={50} value={nombre} disabled={!macroSel} onChange={(e) => setNombre(capitalizar(e.target.value))} />
                    <Input placeholder="Correos del proceso (ej: colchones@chaide.com)" maxLength={50} value={correos} disabled={!macroSel} onChange={(e) => setCorreos(e.target.value)} />
                    <p className="text-xs text-muted-foreground">{correos.length}/50 caracteres (límite de la base de datos). Subproceso, Línea, Puesto y Tarea se agregan después desde el menú ⋮ del proceso.</p>
                </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onCancel} disabled={guardando}>Cancelar</Button>
                <Button type="button" onClick={guardar} disabled={!listo || guardando}>{guardando ? 'Guardando...' : 'Guardar'}</Button>
            </CardFooter>
        </Card>
    );
}
