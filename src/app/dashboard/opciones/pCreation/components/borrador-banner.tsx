"use client";

import { History } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface BorradorBannerProps {
    /** Fecha y hora (ISO) del borrador. */
    guardadoEn: string;
    /** El borrador ya tiene un proyecto creado a medias en el sistema: al recuperarlo se continúa donde quedó. */
    continuaGuardado: boolean;
    onRecuperar: () => void;
    onDescartar: () => void;
}

// Aviso al abrir la pantalla cuando quedó un borrador de la vez anterior (sesión expirada, recarga, salida sin guardar).
export default function BorradorBanner({ guardadoEn, continuaGuardado, onRecuperar, onDescartar }: BorradorBannerProps) {
    const fecha = new Date(guardadoEn);
    const texto = Number.isNaN(fecha.getTime())
        ? ''
        : fecha.toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    return (
        <Alert className="border-amber-500/50 bg-amber-500/5">
            <History className="h-4 w-4" />
            <AlertTitle>Tienes un borrador sin guardar{texto ? ` (${texto})` : ''}</AlertTitle>
            <AlertDescription>
                <p className="mb-2">
                    Quedó avance de una solicitud que no llegó a guardarse. ¿Quieres continuar donde lo dejaste?
                    {continuaGuardado && ' Este borrador ya tiene un proyecto creado a medias en el sistema: al recuperarlo se continuará donde quedó, sin duplicarlo.'}
                </p>
                <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={onRecuperar}>Recuperar borrador</Button>
                    <Button type="button" size="sm" variant="outline" onClick={onDescartar}>Descartar</Button>
                </div>
            </AlertDescription>
        </Alert>
    );
}
