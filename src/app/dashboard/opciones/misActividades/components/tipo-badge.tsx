"use client";

import type { SistemaCalificacion } from '@/lib/rubricas';
import { ESTILO_SISTEMA } from '@/lib/tipoProyectoVisual';

export default function TipoBadge({ sistema }: { sistema: SistemaCalificacion | null | undefined }) {
    if (!sistema) return null;
    const e = ESTILO_SISTEMA[sistema];
    return (
        <span
            title={e.nombre}
            className="inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white"
            style={{ backgroundColor: e.color }}
        >
            {e.sigla}
        </span>
    );
}
