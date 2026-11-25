"use client";

import { useEffect, useState, type KeyboardEvent } from 'react';

// Navegación con teclado para una lista filtrable (buscador de personas): ↑/↓ mueven la opción resaltada y Enter
// elige la resaltada (por defecto la primera coincidencia), sin necesidad de hacer clic.
//
//  - `items`: opciones visibles, en el orden en que se muestran.
//  - `claveReinicio`: cambia cuando cambia la búsqueda, para volver a resaltar la primera opción.
export function useListaNavegable<T>(items: T[], onElegir: (item: T) => void, claveReinicio: string) {
    const [activo, setActivo] = useState(0);

    useEffect(() => {
        setActivo(0);
    }, [claveReinicio, items.length]);

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActivo((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActivo((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            // Enter nunca debe enviar el formulario que contiene el buscador.
            e.preventDefault();
            const elegido = items[activo];
            if (elegido !== undefined) onElegir(elegido);
        }
    };

    // Mantiene visible la opción resaltada al navegar con las flechas.
    const refActivo = (el: HTMLElement | null) => {
        el?.scrollIntoView({ block: 'nearest' });
    };

    return { activo, onKeyDown, refActivo };
}
