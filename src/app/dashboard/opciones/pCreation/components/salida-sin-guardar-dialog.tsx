"use client";

import { useRef } from 'react';
import { ShieldAlert } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface SalidaSinGuardarDialogProps {
    abierto: boolean;
    onPermanecer: () => void;
    onSalir: () => void;
}

// Aviso al intentar salir de la pantalla con avance sin guardar (clic en el menú, "atrás" o gesto del touchpad).
export default function SalidaSinGuardarDialog({ abierto, onPermanecer, onSalir }: SalidaSinGuardarDialogProps) {
    // Al elegir "Salir", Radix también cierra el diálogo (onOpenChange(false)): sin esta marca eso contaría como "quedarme".
    const saliendo = useRef(false);
    return (
        <AlertDialog open={abierto} onOpenChange={(o) => { if (!o && !saliendo.current) onPermanecer(); saliendo.current = false; }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <ShieldAlert className="h-5 w-5 text-amber-600" />
                        ¿Salir sin guardar?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Tienes avance sin guardar en esta solicitud. Se conserva un <strong className="text-foreground">borrador en este navegador</strong> y
                        podrás recuperarlo al volver, pero lo más seguro es guardar antes de salir.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Quedarme aquí</AlertDialogCancel>
                    <AlertDialogAction onClick={() => { saliendo.current = true; onSalir(); }}>Salir de todos modos</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
