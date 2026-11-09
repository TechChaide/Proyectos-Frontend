"use client";

import { useEffect, useMemo, useState } from 'react';
import type { Objetivo, Okr, PilarEstrategico, Proyecto, ProyectoRecurso, Recurso, Resultado, TipoRecurso } from '@/types/interfaces';
import { proyectoRecursoService } from '@/services/proyectos/proyectoRecurso.service';
import { recursoService } from '@/services/proyectos/recurso.service';
import { tipoRecursoService } from '@/services/proyectos/tipoRecurso.service';
import { resultadoService } from '@/services/proyectos/resultado.service';
import { objetivoService } from '@/services/proyectos/objetivo.service';
import { okrService } from '@/services/proyectos/okr.service';
import { pilarEstrategicoService } from '@/services/proyectos/pilarEstrategico.service';

const num = (s?: string) => { const n = parseFloat((s || '').replace(',', '.')); return Number.isNaN(n) ? 0 : n; };
const norm = (v: string) => (v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export interface RecursoFila {
    nombre: string;
    tipo: string;
    costo: number;
    valor: number;
    subtotal: number;
}

export interface Alineacion {
    pilar: string;
    okr: string;
    descripcionOkr: string;
}

// Datos de un proyecto que no vienen en ProyectoView y se cargan al revisarlo: recursos y costo, resultado
// esperado, objetivos específicos y alineación estratégica (OKR y pilar). Resiliente: si un servicio falla, el
// resto igual se muestra.
export function useProyectoDetalle(proyecto: Proyecto | null) {
    const [recursos, setRecursos] = useState<RecursoFila[]>([]);
    const [resultadoEsperado, setResultadoEsperado] = useState('');
    const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
    const [alineacion, setAlineacion] = useState<Alineacion | null>(null);
    const [cargando, setCargando] = useState(false);
    const codigoProyecto = proyecto?.codigo_proyecto ?? null;
    const codigoOkr = proyecto?.codigo_okr ?? null;

    useEffect(() => {
        if (!codigoProyecto) {
            setRecursos([]); setResultadoEsperado(''); setObjetivos([]); setAlineacion(null); setCargando(false);
            return;
        }
        let cancelado = false;
        setCargando(true);
        (async () => {
            const settled = await Promise.allSettled([
                proyectoRecursoService.getAll(),
                recursoService.getAll(),
                tipoRecursoService.getAll(),
                resultadoService.getAll(),
                objetivoService.getByProyecto(codigoProyecto),
                codigoOkr ? okrService.getById(codigoOkr) : Promise.resolve(null),
            ]);
            if (cancelado) return;
            const datos = <T,>(r: PromiseSettledResult<{ data?: T[] }>): T[] => (r.status === 'fulfilled' ? (r.value.data || []) : []);
            const prList = datos<ProyectoRecurso>(settled[0]);
            const recList = datos<Recurso>(settled[1]);
            const tipoList = datos<TipoRecurso>(settled[2]);
            const resultList = datos<Resultado>(settled[3]);
            const recMap = new Map(recList.map((r) => [r.codigo_recurso, r]));
            const tipoMap = new Map(tipoList.map((t) => [t.codigo_tipo_recurso, t.nombre_recurso]));
            setRecursos(
                prList
                    .filter((pr) => pr.codigo_proyecto === codigoProyecto && pr.estado === 'A')
                    .map((pr) => {
                        const rec = recMap.get(pr.codigo_recurso);
                        const costo = num(rec?.costo);
                        const valor = num(pr.valor_recurso);
                        return { nombre: rec?.nombre_recurso || '—', tipo: tipoMap.get(rec?.codigo_tipo_recurso ?? 0) || '', costo, valor, subtotal: costo * valor };
                    })
            );
            const esperado = resultList.find((r) => r.codigo_proyecto === codigoProyecto && norm(r.categoria_resultado).includes('esper'));
            setResultadoEsperado(esperado?.descripcion_resultado || '');
            setObjetivos(datos<Objetivo>(settled[4]).filter((o) => o.estado === 'A'));

            const okr = settled[5].status === 'fulfilled' ? (settled[5].value?.data as Okr | undefined) : undefined;
            if (okr) {
                let pilarNombre = '';
                try {
                    const pilarResp = await pilarEstrategicoService.getById(okr.codigo_pilar);
                    pilarNombre = (pilarResp.data as PilarEstrategico | undefined)?.nombre_pilar || '';
                } catch { /* sin pilar: se muestra solo el OKR */ }
                if (!cancelado) setAlineacion({ pilar: pilarNombre, okr: okr.nombre_okr, descripcionOkr: okr.descripcion_okr || '' });
            } else {
                setAlineacion(null);
            }
            if (!cancelado) setCargando(false);
        })();
        return () => { cancelado = true; };
    }, [codigoProyecto, codigoOkr]);

    const totalCosto = useMemo(() => recursos.reduce((s, r) => s + r.subtotal, 0), [recursos]);

    return { recursos, totalCosto, resultadoEsperado, objetivos, alineacion, cargando };
}
