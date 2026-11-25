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
import { proyectoService } from '@/services/proyectos/proyecto.service';

const num = (s?: string) => { const n = parseFloat((s || '').replace(',', '.')); return Number.isNaN(n) ? 0 : n; };
const norm = (v: string) => (v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export interface RecursoFila {
    nombre: string;
    tipo: string;
    costo: number;
    valor: number;
    subtotal: number;
}

/** Resultados esperados de un proyecto hijo: el Proyecto Integrador no tiene resultados propios, reúne los de sus hijos. */
export interface ResultadosDeHijo {
    proyecto: string;
    /** "Pilar › OKR" del hijo. */
    alineacion: string;
    resultados: string[];
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
    const [resultadosEsperados, setResultadosEsperados] = useState<string[]>([]);
    const [resultadosHijos, setResultadosHijos] = useState<ResultadosDeHijo[]>([]);
    const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
    const [alineacion, setAlineacion] = useState<Alineacion | null>(null);
    const [cargando, setCargando] = useState(false);
    const codigoProyecto = proyecto?.codigo_proyecto ?? null;
    const codigoOkr = proyecto?.codigo_okr ?? null;

    useEffect(() => {
        if (!codigoProyecto) {
            setRecursos([]); setResultadosEsperados([]); setResultadosHijos([]); setObjetivos([]); setAlineacion(null); setCargando(false);
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
                proyectoService.getAll(),
                okrService.getAll(),
                pilarEstrategicoService.getAll(),
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
            setResultadosEsperados(
                resultList
                    .filter((r) => r.codigo_proyecto === codigoProyecto && norm(r.categoria_resultado).includes('esper'))
                    .map((r) => r.descripcion_resultado)
            );
            setObjetivos(datos<Objetivo>(settled[4]).filter((o) => o.estado === 'A'));
            // Proyecto Integrador: sus resultados esperados son los de sus hijos activos (se van sumando al crear cada hijo).
            const hijos = datos<Proyecto>(settled[6]).filter((h) => h.codigo_padre === codigoProyecto && h.estado === 'A');
            const okrList = datos<Okr>(settled[7]);
            const pilarList = datos<PilarEstrategico>(settled[8]);
            const alineacionDe = (codigoOkr: number | null) => {
                const o = okrList.find((x) => x.codigo_okr === codigoOkr);
                if (!o) return 'Sin OKR';
                const pilar = pilarList.find((x) => x.codigo_pilar === o.codigo_pilar)?.nombre_pilar;
                return pilar ? `${pilar} › ${o.nombre_okr}` : o.nombre_okr;
            };
            setResultadosHijos(
                hijos
                    .map((h) => ({
                        proyecto: h.nombre_proyecto,
                        alineacion: alineacionDe(h.codigo_okr),
                        resultados: resultList
                            .filter((r) => r.codigo_proyecto === h.codigo_proyecto && norm(r.categoria_resultado).includes('esper'))
                            .map((r) => r.descripcion_resultado),
                    }))
            );

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

    return { recursos, totalCosto, resultadosEsperados, resultadosHijos, objetivos, alineacion, cargando };
}
