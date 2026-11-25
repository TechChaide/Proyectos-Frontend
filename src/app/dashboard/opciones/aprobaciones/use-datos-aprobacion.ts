"use client";

import { useEffect, useState } from 'react';
import type { Objetivo, Okr, PilarEstrategico, ProyectoRecurso, Recurso } from '@/types/interfaces';
import { objetivoService } from '@/services/proyectos/objetivo.service';
import { proyectoRecursoService } from '@/services/proyectos/proyectoRecurso.service';
import { recursoService } from '@/services/proyectos/recurso.service';
import { okrService } from '@/services/proyectos/okr.service';
import { pilarEstrategicoService } from '@/services/proyectos/pilarEstrategico.service';

const num = (s?: string) => { const n = parseFloat((s || '').replace(',', '.')); return Number.isNaN(n) ? 0 : n; };

/** Alineación estratégica de un proyecto: su OKR y el pilar al que pertenece. */
export interface AlineacionResumen {
    codigoOkr: number;
    okr: string;
    codigoPilar: number;
    pilar: string;
}

export interface RecursoResumen {
    nombre: string;
    subtotal: number;
}

// Datos que necesita cada fila de la bandeja (objetivos específicos y recursos con su costo) para TODOS los
// proyectos a la vez: 3 consultas en total, no una por proyecto. Resiliente: si una falla, el resto igual se muestra.
export function useDatosAprobacion() {
    const [objetivos, setObjetivos] = useState<Map<number, string[]>>(new Map());
    const [recursos, setRecursos] = useState<Map<number, RecursoResumen[]>>(new Map());
    const [okrs, setOkrs] = useState<Map<number, AlineacionResumen>>(new Map());
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        let cancelado = false;
        (async () => {
            const [objResp, prResp, recResp, okrResp, pilarResp] = await Promise.allSettled([
                objetivoService.getAll(),
                proyectoRecursoService.getAll(),
                recursoService.getAll(),
                okrService.getAll(),
                pilarEstrategicoService.getAll(),
            ]);
            if (cancelado) return;

            const objMap = new Map<number, string[]>();
            if (objResp.status === 'fulfilled') {
                (objResp.value.data as Objetivo[] || [])
                    .filter((o) => o.estado === 'A')
                    .forEach((o) => objMap.set(o.codigo_proyecto, [...(objMap.get(o.codigo_proyecto) || []), o.descripcion_objetivo]));
            }

            const recMap = new Map<number, Recurso>();
            if (recResp.status === 'fulfilled') (recResp.value.data as Recurso[] || []).forEach((r) => recMap.set(r.codigo_recurso, r));
            const resMap = new Map<number, RecursoResumen[]>();
            if (prResp.status === 'fulfilled') {
                (prResp.value.data as ProyectoRecurso[] || [])
                    .filter((pr) => pr.estado === 'A')
                    .forEach((pr) => {
                        const rec = recMap.get(pr.codigo_recurso);
                        resMap.set(pr.codigo_proyecto, [
                            ...(resMap.get(pr.codigo_proyecto) || []),
                            { nombre: rec?.nombre_recurso || '—', subtotal: num(rec?.costo) * num(pr.valor_recurso) },
                        ]);
                    });
            }

            const pilarMap = new Map<number, PilarEstrategico>();
            if (pilarResp.status === 'fulfilled') (pilarResp.value.data as PilarEstrategico[] || []).forEach((p) => pilarMap.set(p.codigo_pilar, p));
            const okrMap = new Map<number, AlineacionResumen>();
            if (okrResp.status === 'fulfilled') {
                (okrResp.value.data as Okr[] || []).forEach((o) =>
                    okrMap.set(o.codigo_okr, { codigoOkr: o.codigo_okr, okr: o.nombre_okr, codigoPilar: o.codigo_pilar, pilar: pilarMap.get(o.codigo_pilar)?.nombre_pilar || '' })
                );
            }

            setObjetivos(objMap);
            setOkrs(okrMap);
            setRecursos(resMap);
            setCargando(false);
        })();
        return () => { cancelado = true; };
    }, []);

    return { objetivos, recursos, okrs, cargando };
}
