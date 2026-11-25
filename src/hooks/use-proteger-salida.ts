"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { environment } from '@/environments/environments.prod';

type Destino = { tipo: 'enlace'; ruta: string } | { tipo: 'historial' };

// Pokayoke contra salidas accidentales de una pantalla con avance sin guardar. Mientras `activo` sea true:
//  1. Recargar (F5) o cerrar la pestaña: el navegador pide confirmación.
//  2. Botón "atrás" o gesto de deslizar con el touchpad: se intercepta y se muestra un aviso propio.
//  3. Clic en cualquier enlace interno (menú lateral, etc.): se intercepta y se muestra el mismo aviso.
//
// Devuelve `salidaPendiente` (mostrar el diálogo) y las dos respuestas: `permanecer` y `salir`.
// Limitación: la navegación hecha por código (router.push desde un botón) no se puede interceptar.
export function useProtegerSalida(activo: boolean) {
    const router = useRouter();
    const [destino, setDestino] = useState<Destino | null>(null);
    const activoRef = useRef(activo);
    const saliendoRef = useRef(false);
    const centinelaRef = useRef(false);
    activoRef.current = activo;

    // 1) Recargar o cerrar la pestaña.
    useEffect(() => {
        if (!activo) return;
        const avisar = (e: BeforeUnloadEvent) => {
            if (saliendoRef.current) return;
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', avisar);
        return () => window.removeEventListener('beforeunload', avisar);
    }, [activo]);

    // 2) Atrás/adelante (botón o gesto del touchpad). Se agrega una entrada "centinela" al historial con el mismo
    //    estado y URL: el primer "atrás" cae sobre esta misma página y se puede interceptar sin salir.
    useEffect(() => {
        if (!activo) return;
        // Se agrega una sola vez por visita a la pantalla (no cada vez que el aviso se activa o desactiva).
        if (!centinelaRef.current) {
            window.history.pushState(window.history.state, '', window.location.href);
            centinelaRef.current = true;
        }
        const alNavegar = () => {
            if (!activoRef.current || saliendoRef.current) return;
            setDestino({ tipo: 'historial' });
        };
        window.addEventListener('popstate', alNavegar);
        return () => window.removeEventListener('popstate', alNavegar);
    }, [activo]);

    // 3) Clic en enlaces internos (en fase de captura, antes de que el router de Next los procese).
    useEffect(() => {
        if (!activo) return;
        const alHacerClic = (e: MouseEvent) => {
            if (saliendoRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const ancla = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
            if (!ancla || ancla.target === '_blank' || ancla.hasAttribute('download')) return;
            const url = new URL(ancla.href, window.location.href);
            if (url.origin !== window.location.origin) return;
            if (url.pathname === window.location.pathname && url.search === window.location.search) return;
            e.preventDefault();
            e.stopPropagation();
            // El router de Next agrega el basePath por su cuenta: se quita para no duplicarlo.
            const base = (environment.basePath || '').replace(/\/+$/, '');
            const ruta = (base && url.pathname.startsWith(base) ? url.pathname.slice(base.length) || '/' : url.pathname) + url.search + url.hash;
            setDestino({ tipo: 'enlace', ruta });
        };
        document.addEventListener('click', alHacerClic, true);
        return () => document.removeEventListener('click', alHacerClic, true);
    }, [activo]);

    const permanecer = () => {
        // Si el aviso vino de "atrás", se vuelve a poner la entrada centinela para seguir protegiendo.
        if (destino?.tipo === 'historial') window.history.pushState(window.history.state, '', window.location.href);
        setDestino(null);
    };

    const salir = () => {
        const d = destino;
        setDestino(null);
        saliendoRef.current = true;
        if (d?.tipo === 'enlace') router.push(d.ruta);
        else window.history.back();
    };

    return { salidaPendiente: destino !== null, permanecer, salir };
}
