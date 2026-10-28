"use client";

import { Fragment, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Download, Gauge, Search, Users, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import type { Actividad, Area, AreaSolicitud, Estado, EstadoActividad, EstadoSolicitud, FichaSocialHistorica, Proyecto, ProyectoRecurso, Recurso, Responsable, TipoProyecto } from '@/types/interfaces';
import { proyectoService } from '@/services/proyectos/proyecto.service';
import { procesoService } from '@/services/proyectos/proceso.service';
import { areaSolicitudService } from '@/services/proyectos/areaSolicitud.service';
import { estadoService } from '@/services/proyectos/estado.service';
import { estadoSolicitudService } from '@/services/proyectos/estadoSolicitud.service';
import { estadoActividadService } from '@/services/proyectos/estadoActividad.service';
import { actividadService } from '@/services/proyectos/actividad.service';
import { proyectoRecursoService } from '@/services/proyectos/proyectoRecurso.service';
import { recursoService } from '@/services/proyectos/recurso.service';
import { tipoProyectoService } from '@/services/proyectos/tipoProyecto.service';
import { serviciosService } from '@/services/proyectos/servicios.service';
import { responsableService } from '@/services/proyectos/responsable.service';
import { actividadesEvaluables } from '@/lib/actividades';
import { sistemaDeTipo } from '@/lib/rubricas';
import { cn } from '@/lib/utils';
import {
    calcularAvanceProyectos,
    calcularCumplimiento,
    calcularEstadosVisuales,
    calificarPorcentaje,
    ESTILO_ESTADO_VISUAL,
    type EstadoVisual,
} from '../misActividades/cumplimiento';
import { resolverProcesoPorProyecto } from '../proyectos/area-utils';
import TipoBadge from '../misActividades/components/tipo-badge';

const TODOS = 'todos';
const num = (s?: string) => { const n = parseFloat((s || '').replace(',', '.')); return Number.isNaN(n) ? 0 : n; };
const money = (n: number) => `$${n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const norm = (v: string) => (v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const esRechazado = (estado: string) => norm(estado).includes('rechaz');
// Atraso (en puntos de avance) a partir del cual un proyecto se considera "requiere atención".
const UMBRAL_ATRASO = -10;

interface FilaProyecto {
    codigo: number;
    nombre: string;
    procesoCodigo: number | null;
    procesoNombre: string;
    macroCodigo: number | null;
    macroNombre: string;
    responsables: string;
    estadoSolicitud: string;
    total: number;
    completadas: number;
    vencidas: number;
    avance: number;
    esperado: number;
    brecha: number;
    costo: number;
    pctCumplimiento: number | null;
}

// Calificación de una persona (en un proyecto o en el conjunto del alcance).
interface FilaPersona {
    codigo: string;
    nombre: string;
    proyectos: number;
    total: number;
    completadas: number;
    vencidas: number;
    pct: number | null;
    nota: number | null;
}

// Barra de avance efectivo con una marca en lo esperado a hoy.
function BarraAvance({ avance, esperado }: { avance: number; esperado: number }) {
    const brecha = avance - esperado;
    const color = brecha >= 0 ? '#16a34a' : brecha >= -10 ? '#f59e0b' : '#dc2626';
    return (
        <div className="flex items-center gap-2" title={`Avance ${avance.toFixed(0)}% · esperado ${esperado.toFixed(0)}%`}>
            <div className="relative h-2 w-24 shrink-0 rounded-full bg-muted sm:w-32">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, avance))}%`, backgroundColor: color }} />
                <div className="absolute -top-0.5 h-3 w-0.5 bg-foreground/70" style={{ left: `${Math.min(100, Math.max(0, esperado))}%` }} />
            </div>
            <span className="w-10 text-right text-xs font-semibold tabular-nums">{avance.toFixed(0)}%</span>
        </div>
    );
}

// Un proyecto con su avance y cumplimiento; al abrirlo muestra la calificación de cada participante.
function FilaProyectoItem({ f, abierto, onToggle, gente }: { f: FilaProyecto; abierto: boolean; onToggle: () => void; gente: FilaPersona[] }) {
    const c = f.pctCumplimiento === null ? null : calificarPorcentaje(f.pctCumplimiento);
    return (
        <div className="rounded-md border bg-background">
            <div className="flex items-center hover:bg-muted/40">
                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={abierto}
                    className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {abierto ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                    <span className="min-w-[140px] flex-1">
                        <span className="block text-sm font-medium">{f.nombre}</span>
                        <span className="block text-xs text-muted-foreground">{f.estadoSolicitud} · {money(f.costo)}</span>
                    </span>
                    <BarraAvance avance={f.avance} esperado={f.esperado} />
                    <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">{f.completadas}/{f.total} act.</span>
                    <span className={cn('w-16 text-right text-xs tabular-nums', f.vencidas > 0 ? 'font-semibold text-red-600' : 'text-muted-foreground')}>{f.vencidas} venc.</span>
                    <span className="w-12 text-right">
                        {c && f.pctCumplimiento !== null ? <span className="text-sm font-semibold tabular-nums" style={{ color: c.color }}>{f.pctCumplimiento.toFixed(0)}%</span> : <span className="text-xs text-muted-foreground">—</span>}
                    </span>
                </button>
            </div>
            {abierto && (
                <div className="flex flex-col gap-1.5 border-t bg-muted/20 px-3 py-2">
                    {gente.map((g) => <FilaPersonaItem key={g.codigo} g={g} compacto />)}
                    {gente.length === 0 && <p className="text-xs text-muted-foreground">Sin actividades asignadas.</p>}
                </div>
            )}
        </div>
    );
}

// Una persona con su cumplimiento: actividades, vencidas y calificación con semáforo.
function FilaPersonaItem({ g, compacto }: { g: FilaPersona; compacto?: boolean }) {
    const c = g.pct === null ? null : calificarPorcentaje(g.pct);
    return (
        <div className={cn('flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 text-sm', compacto ? 'py-1' : 'py-1.5')}>
            <span className="font-medium">{g.nombre}</span>
            <span className="flex items-center gap-4 text-xs">
                {!compacto && <span className="text-muted-foreground tabular-nums">{g.proyectos} {g.proyectos === 1 ? 'proyecto' : 'proyectos'}</span>}
                <span className="text-muted-foreground tabular-nums">{g.completadas}/{g.total} actividades</span>
                {g.vencidas > 0 && <span className="font-semibold text-red-600">{g.vencidas} vencida{g.vencidas === 1 ? '' : 's'}</span>}
                {c && g.pct !== null ? (
                    <span className="inline-flex items-baseline gap-1.5">
                        <span className="text-sm font-semibold tabular-nums" style={{ color: c.color }}>{g.pct.toFixed(0)}%</span>
                        <span style={{ color: c.color }}>{c.etiqueta}</span>
                    </span>
                ) : <span className="text-muted-foreground">Sin actividades exigibles</span>}
            </span>
        </div>
    );
}

export default function ReportesPage() {
    const { toast } = useToast();

    const [proyectos, setProyectos] = useState<Proyecto[]>([]);
    const [tipos, setTipos] = useState<TipoProyecto[]>([]);
    const [areas, setAreas] = useState<Area[]>([]);
    const [areaSolicitudes, setAreaSolicitudes] = useState<AreaSolicitud[]>([]);
    const [estados, setEstados] = useState<Estado[]>([]);
    const [estadoSolicitudes, setEstadoSolicitudes] = useState<EstadoSolicitud[]>([]);
    const [actividades, setActividades] = useState<Actividad[]>([]);
    const [estadosActividad, setEstadosActividad] = useState<EstadoActividad[]>([]);
    const [proyectoRecursos, setProyectoRecursos] = useState<ProyectoRecurso[]>([]);
    const [recursos, setRecursos] = useState<Recurso[]>([]);
    const [personas, setPersonas] = useState<FichaSocialHistorica[]>([]);
    const [responsables, setResponsables] = useState<Responsable[]>([]);
    const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
    // Procesos cuyo estado se invirtió respecto al valor por defecto (cerrado; abierto si hay uno solo).
    const [alternados, setAlternados] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);

    // Alcance del reporte: toda la organización, un macroproceso ("m:ID") o un proceso ("p:ID").
    const [alcance, setAlcance] = useState(TODOS);
    const [busqueda, setBusqueda] = useState('');

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            // Resiliente: si un servicio falla, los demás igual cargan.
            const nombres = ['proyectos', 'tipos de proyecto', 'procesos', 'proceso_solicitud', 'estados', 'estado_solicitud', 'actividades', 'estado_actividad', 'proyecto_recurso', 'recursos', 'personas', 'responsables'];
            const results = await Promise.allSettled([
                proyectoService.getAll(),
                tipoProyectoService.getAll(),
                procesoService.getAll(),
                areaSolicitudService.getAll(),
                estadoService.getAll(),
                estadoSolicitudService.getAll(),
                actividadService.buscar({ estado: 'A' }),
                estadoActividadService.getAll(),
                proyectoRecursoService.getAll(),
                recursoService.getAll(),
                serviciosService.getInformacionPersonas(),
                responsableService.getAll(),
            ]);
            const data = <T,>(i: number): T[] => {
                const r = results[i];
                return r.status === 'fulfilled' ? ((r.value as unknown as { data?: T[] }).data || []) : [];
            };
            setProyectos(data<Proyecto>(0));
            setTipos(data<TipoProyecto>(1));
            setAreas(data<Area>(2));
            setAreaSolicitudes(data<AreaSolicitud>(3));
            setEstados(data<Estado>(4));
            setEstadoSolicitudes(data<EstadoSolicitud>(5));
            setActividades(data<Actividad>(6));
            setEstadosActividad(data<EstadoActividad>(7));
            setProyectoRecursos(data<ProyectoRecurso>(8));
            setRecursos(data<Recurso>(9));
            setPersonas(data<FichaSocialHistorica>(10));
            setResponsables(data<Responsable>(11));
            const fallidos = results.map((r, i) => (r.status === 'rejected' ? nombres[i] : null)).filter(Boolean);
            if (fallidos.length) {
                toast({ title: 'Algunos datos no se cargaron', description: `No se pudieron cargar: ${fallidos.join(', ')}.`, variant: 'destructive' });
            }
            setIsLoading(false);
        };
        loadData();
    }, [toast]);

    const areaMap = useMemo(() => new Map(areas.map((a) => [a.codigo_proceso, a])), [areas]);

    // Proyectos OI (los MR, MSP y PI no entran en este reporte), sin los rechazados.
    const proyectosOI = useMemo(() => {
        const tipoNombre = new Map(tipos.map((t) => [t.codigo_tipo_proyecto, t.nombre_tipo_proyecto]));
        const estadoNombre = new Map(estados.map((e) => [e.codigo_estado, e.nombre_estado]));
        const ultimoEstado = new Map<number, EstadoSolicitud>();
        estadoSolicitudes.filter((es) => es.estado === 'A').forEach((es) => {
            const actual = ultimoEstado.get(es.codigo_solicitud);
            if (!actual || new Date(es.fecha_modificacion) > new Date(actual.fecha_modificacion)) ultimoEstado.set(es.codigo_solicitud, es);
        });
        const procesoPorProyecto = resolverProcesoPorProyecto(proyectos, areaSolicitudes, areas);
        return proyectos
            .filter((p) => p.estado === 'A' && sistemaDeTipo(tipoNombre.get(p.codigo_tipo_proyecto) || '') === 'INDIVIDUAL')
            .map((proyecto) => {
                const proceso = procesoPorProyecto.get(proyecto.codigo_proyecto) || null;
                const macro = proceso?.codigo_proceso_padre ? areaMap.get(proceso.codigo_proceso_padre) ?? proceso : proceso;
                const es = ultimoEstado.get(proyecto.codigo_solicitud);
                return { proyecto, proceso, macro, estadoSolicitud: es ? estadoNombre.get(es.codigo_estado) || 'Sin estado' : 'Sin estado' };
            })
            .filter((v) => !esRechazado(v.estadoSolicitud));
    }, [proyectos, tipos, estados, estadoSolicitudes, areaSolicitudes, areas, areaMap]);

    // Opciones del selector de alcance: macroprocesos y, debajo de cada uno, sus procesos con proyectos OI.
    const opcionesAlcance = useMemo(() => {
        const macros = new Map<number, { nombre: string; procesos: Map<number, string> }>();
        proyectosOI.forEach((v) => {
            if (!v.macro || !v.proceso) return;
            if (!macros.has(v.macro.codigo_proceso)) macros.set(v.macro.codigo_proceso, { nombre: v.macro.nombre_proceso, procesos: new Map() });
            if (v.proceso.codigo_proceso !== v.macro.codigo_proceso) macros.get(v.macro.codigo_proceso)!.procesos.set(v.proceso.codigo_proceso, v.proceso.nombre_proceso);
        });
        return Array.from(macros.entries())
            .map(([codigo, m]) => ({ codigo, nombre: m.nombre, procesos: Array.from(m.procesos.entries()).sort((a, b) => a[1].localeCompare(b[1])) }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [proyectosOI]);

    const enAlcance = useMemo(() => {
        if (alcance === TODOS) return proyectosOI;
        const id = Number(alcance.slice(2));
        return proyectosOI.filter((v) => (alcance.startsWith('m:') ? v.macro?.codigo_proceso === id : v.proceso?.codigo_proceso === id));
    }, [proyectosOI, alcance]);

    const nombreAlcance = useMemo(() => {
        if (alcance === TODOS) return 'Todos los procesos';
        return areaMap.get(Number(alcance.slice(2)))?.nombre_proceso || 'Proceso';
    }, [alcance, areaMap]);

    const personaMap = useMemo(() => new Map(personas.map((p) => [p.CODIGO, p.NOMBRE])), [personas]);

    // Actividades evaluables de los proyectos en alcance y sus estados visuales (vencida, en ejecución, ...).
    const acts = useMemo(() => {
        const codigos = new Set(enAlcance.map((v) => v.proyecto.codigo_proyecto));
        return actividadesEvaluables(actividades.filter((a) => a.estado === 'A' && codigos.has(a.codigo_proyecto)));
    }, [enAlcance, actividades]);
    const visuales = useMemo(() => calcularEstadosVisuales(acts, estadosActividad, estados), [acts, estadosActividad, estados]);

    const conteoEstados = useMemo(() => {
        const c: Record<EstadoVisual, number> = { vencida: 0, en_ejecucion: 0, pendiente: 0, completada_atraso: 0, completada: 0 };
        acts.forEach((a) => { c[visuales.get(a.codigo_actividad) || 'pendiente'] += 1; });
        return c;
    }, [acts, visuales]);

    const costoPorProyecto = useMemo(() => {
        const costoRec = new Map(recursos.map((r) => [r.codigo_recurso, num(r.costo)]));
        const m = new Map<number, number>();
        proyectoRecursos.filter((pr) => pr.estado === 'A').forEach((pr) => {
            m.set(pr.codigo_proyecto, (m.get(pr.codigo_proyecto) || 0) + (costoRec.get(pr.codigo_recurso) || 0) * num(pr.valor_recurso));
        });
        return m;
    }, [proyectoRecursos, recursos]);

    const cumplimiento = useMemo(() => calcularCumplimiento(acts, estadosActividad, estados, proyectos), [acts, estadosActividad, estados, proyectos]);

    const filas = useMemo<FilaProyecto[]>(() => {
        const avances = new Map(calcularAvanceProyectos(acts, estadosActividad, estados, proyectos).map((a) => [a.codigoProyecto, a]));
        const pctPorProyecto = new Map(cumplimiento.proyectos.map((p) => [p.codigoProyecto, p.pctCumplimiento * 100]));
        const vencidasPorProyecto = new Map<number, number>();
        acts.forEach((a) => {
            if (visuales.get(a.codigo_actividad) === 'vencida') vencidasPorProyecto.set(a.codigo_proyecto, (vencidasPorProyecto.get(a.codigo_proyecto) || 0) + 1);
        });
        return enAlcance.map((v) => {
            const cod = v.proyecto.codigo_proyecto;
            const av = avances.get(cod);
            const responsables = (v.proyecto.responsable_proyecto || '').split('&').map((c) => c.trim()).filter(Boolean).map((c) => personaMap.get(c) || c).join(', ');
            return {
                codigo: cod,
                nombre: v.proyecto.nombre_proyecto,
                procesoCodigo: v.proceso?.codigo_proceso ?? null,
                procesoNombre: v.proceso?.nombre_proceso || 'Sin proceso',
                macroCodigo: v.macro?.codigo_proceso ?? null,
                macroNombre: v.macro?.nombre_proceso || '',
                responsables: responsables || 'Sin responsable',
                estadoSolicitud: v.estadoSolicitud,
                total: av?.totalActividades ?? 0,
                completadas: av?.completadas ?? 0,
                vencidas: vencidasPorProyecto.get(cod) || 0,
                avance: av?.avanceEfectivo ?? 0,
                esperado: av?.avanceEsperado ?? 0,
                brecha: (av?.avanceEfectivo ?? 0) - (av?.avanceEsperado ?? 0),
                costo: costoPorProyecto.get(cod) || 0,
                pctCumplimiento: pctPorProyecto.get(cod) ?? null,
            };
        });
    }, [enAlcance, acts, estadosActividad, estados, proyectos, cumplimiento, visuales, personaMap, costoPorProyecto]);

    // Calificación por persona: mismo cálculo que su "Mi Nota de Cumplimiento" (solo actividades OI).
    const { personasPorProyecto, personasPorProceso, personasAlcance } = useMemo(() => {
        const empleadoDe = new Map(responsables.map((r) => [r.codigo_responsable, r.codigo_empleado]));
        const resumir = (codigo: string, lista: Actividad[]): FilaPersona => {
            const res = calcularCumplimiento(lista, estadosActividad, estados, proyectos);
            return {
                codigo,
                nombre: codigo === 'sin' ? 'Sin responsable' : personaMap.get(codigo) || codigo,
                proyectos: new Set(lista.map((a) => a.codigo_proyecto)).size,
                total: lista.length,
                completadas: lista.filter((a) => { const v = visuales.get(a.codigo_actividad); return v === 'completada' || v === 'completada_atraso'; }).length,
                vencidas: lista.filter((a) => visuales.get(a.codigo_actividad) === 'vencida').length,
                pct: res.sinActividadesExigibles ? null : ((res.nota || 0) / 5) * 100,
                nota: res.nota,
            };
        };
        const agrupar = (lista: Actividad[]) => {
            const g = new Map<string, Actividad[]>();
            lista.forEach((a) => {
                const e = empleadoDe.get(a.codigo_responsable) || 'sin';
                g.set(e, [...(g.get(e) || []), a]);
            });
            return g;
        };
        // Primero quien más atención necesita: más vencidas y, luego, menor cumplimiento.
        const ordenar = (a: FilaPersona, b: FilaPersona) => b.vencidas - a.vencidas || (a.pct ?? 101) - (b.pct ?? 101) || a.nombre.localeCompare(b.nombre);

        const porProyecto = new Map<number, FilaPersona[]>();
        const actsPorProyecto = new Map<number, Actividad[]>();
        acts.forEach((a) => actsPorProyecto.set(a.codigo_proyecto, [...(actsPorProyecto.get(a.codigo_proyecto) || []), a]));
        actsPorProyecto.forEach((lista, cod) => {
            porProyecto.set(cod, Array.from(agrupar(lista).entries()).map(([e, l]) => resumir(e, l)).sort(ordenar));
        });
        // Personas agregadas por proceso (todas sus actividades en los proyectos de ese proceso).
        const procesoDeProyecto = new Map(filas.map((f) => [f.codigo, String(f.procesoCodigo ?? 'sin')]));
        const actsPorProceso = new Map<string, Actividad[]>();
        acts.forEach((a) => {
            const k = procesoDeProyecto.get(a.codigo_proyecto) ?? 'sin';
            actsPorProceso.set(k, [...(actsPorProceso.get(k) || []), a]);
        });
        const porProceso = new Map<string, FilaPersona[]>();
        actsPorProceso.forEach((lista, k) => porProceso.set(k, Array.from(agrupar(lista).entries()).map(([e, l]) => resumir(e, l)).sort(ordenar)));
        const global = Array.from(agrupar(acts).entries()).map(([e, l]) => resumir(e, l)).sort(ordenar);
        return { personasPorProyecto: porProyecto, personasPorProceso: porProceso, personasAlcance: global };
    }, [acts, filas, responsables, personaMap, visuales, estadosActividad, estados, proyectos]);

    const toggleProceso = (key: string) =>
        setAlternados((prev) => {
            const n = new Set(prev);
            if (n.has(key)) n.delete(key); else n.add(key);
            return n;
        });

    const toggleProyecto = (codigo: number) =>
        setExpandidos((prev) => {
            const n = new Set(prev);
            if (n.has(codigo)) n.delete(codigo); else n.add(codigo);
            return n;
        });

    // Indicadores generales
    const avancePromedio = filas.length ? filas.reduce((s, f) => s + f.avance, 0) / filas.length : null;
    const esperadoPromedio = filas.length ? filas.reduce((s, f) => s + f.esperado, 0) / filas.length : null;
    const costoTotal = filas.reduce((s, f) => s + f.costo, 0);
    const pctGlobal = cumplimiento.sinActividadesExigibles ? null : ((cumplimiento.nota || 0) / 5) * 100;
    const calGlobal = pctGlobal === null ? null : calificarPorcentaje(pctGlobal);

    // Proyectos que requieren atención: con actividades vencidas o muy atrasados frente a lo esperado.
    const atencion = useMemo(
        () => filas.filter((f) => f.vencidas > 0 || f.brecha <= UMBRAL_ATRASO).sort((a, b) => b.vencidas - a.vencidas || a.brecha - b.brecha),
        [filas]
    );

    // Resumen por proceso: dónde está lo rojo.
    const porProceso = useMemo(() => {
        const grupos = new Map<string, FilaProyecto[]>();
        filas.forEach((f) => {
            const key = String(f.procesoCodigo ?? 'sin');
            grupos.set(key, [...(grupos.get(key) || []), f]);
        });
        return Array.from(grupos.values())
            .map((lista) => {
                const codigos = new Set(lista.map((f) => f.codigo));
                const res = calcularCumplimiento(acts.filter((a) => codigos.has(a.codigo_proyecto)), estadosActividad, estados, proyectos);
                return {
                    key: String(lista[0].procesoCodigo ?? 'sin'),
                    codigo: lista[0].procesoCodigo,
                    nombre: lista[0].procesoNombre,
                    macro: lista[0].macroNombre,
                    proyectos: lista.length,
                    vencidas: lista.reduce((s, f) => s + f.vencidas, 0),
                    avance: lista.reduce((s, f) => s + f.avance, 0) / lista.length,
                    esperado: lista.reduce((s, f) => s + f.esperado, 0) / lista.length,
                    pct: res.sinActividadesExigibles ? null : ((res.nota || 0) / 5) * 100,
                };
            })
            .sort((a, b) => b.vencidas - a.vencidas || a.nombre.localeCompare(b.nombre));
    }, [filas, acts, estadosActividad, estados, proyectos]);

    // Procesos con sus proyectos, filtrados por la búsqueda (proceso, proyecto o persona).
    const procesosVisibles = useMemo(() => {
        const q = norm(busqueda.trim());
        return porProceso
            .map((p) => {
                const filasP = filas.filter((f) => String(f.procesoCodigo ?? 'sin') === p.key).sort((a, b) => b.vencidas - a.vencidas || a.brecha - b.brecha || a.nombre.localeCompare(b.nombre));
                const procesoCoincide = !q || norm(`${p.nombre} ${p.macro}`).includes(q);
                const filasOk = procesoCoincide ? filasP : filasP.filter((f) => norm(`${f.nombre} ${f.responsables}`).includes(q));
                return { ...p, key: p.key, filas: filasOk };
            })
            .filter((p) => p.filas.length > 0);
    }, [porProceso, filas, busqueda]);

    const filasVisibles = useMemo(() => {
        const q = norm(busqueda.trim());
        const base = q ? filas.filter((f) => norm(`${f.nombre} ${f.procesoNombre} ${f.responsables}`).includes(q)) : filas;
        return [...base].sort((a, b) => b.vencidas - a.vencidas || a.brecha - b.brecha || a.nombre.localeCompare(b.nombre));
    }, [filas, busqueda]);

    const descargar = (nombreArchivo: string, cab: string[], filasCsv: (string | number)[][]) => {
        const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
        const blob = new Blob(['\uFEFF' + [cab.map(esc).join(';'), ...filasCsv.map((l) => l.map(esc).join(';'))].join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${norm(nombreArchivo).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const pct1 = (v: number | null) => (v === null ? '' : v.toFixed(1));
    const nota2 = (v: number | null) => (v === null ? '' : v.toFixed(2));

    // Tres archivos distintos, cada uno con su propio nivel de detalle y sin repetir información:
    // por proceso (una fila por proceso), por proyecto (una fila por proyecto) y por persona (una fila por persona).
    const descargarPorProceso = () =>
        descargar(`reporte-por-proceso-${nombreAlcance}`,
            ['Macroproceso', 'Proceso', 'Proyectos', 'Actividades', 'Completadas', 'Vencidas', 'Avance %', 'Esperado %', 'Cumplimiento %', 'Costo recursos'],
            procesosVisibles.map((p) => [
                p.macro, p.nombre, p.filas.length,
                p.filas.reduce((n, f) => n + f.total, 0), p.filas.reduce((n, f) => n + f.completadas, 0), p.vencidas,
                p.avance.toFixed(1), p.esperado.toFixed(1), pct1(p.pct), p.filas.reduce((n, f) => n + f.costo, 0).toFixed(2),
            ]));
    const descargarPorProyecto = () =>
        descargar(`reporte-por-proyecto-${nombreAlcance}`,
            ['Macroproceso', 'Proceso', 'Proyecto', 'Estado de solicitud', 'Responsables', 'Actividades', 'Completadas', 'Vencidas', 'Avance %', 'Esperado %', 'Cumplimiento %', 'Costo recursos'],
            procesosVisibles.flatMap((p) => p.filas).map((f) => [
                f.macroNombre, f.procesoNombre, f.nombre, f.estadoSolicitud, f.responsables, f.total, f.completadas, f.vencidas,
                f.avance.toFixed(1), f.esperado.toFixed(1), pct1(f.pctCumplimiento), f.costo.toFixed(2),
            ]));
    const descargarPorPersona = () =>
        descargar(`reporte-por-persona-${nombreAlcance}`,
            ['Persona', 'Proyectos', 'Actividades', 'Completadas', 'Vencidas', 'Cumplimiento %', 'Nota (0-5)'],
            personasAlcance.map((g) => [g.nombre, g.proyectos, g.total, g.completadas, g.vencidas, pct1(g.pct), nota2(g.nota)]));

    return (
        <div className="flex flex-col gap-4 p-4 md:p-6">
            {/* Encabezado + alcance */}
            <Card>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            Reporte de Objetivos Individuales
                            <TipoBadge sistema="INDIVIDUAL" />
                        </CardTitle>
                        <CardDescription>Seguimiento de cumplimiento para gerencia y jefaturas de proceso. Corte a hoy.</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Select value={alcance} onValueChange={setAlcance}>
                            <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={TODOS}>Todos los procesos</SelectItem>
                                {opcionesAlcance.map((m) => (
                                    <SelectGroup key={m.codigo}>
                                        <SelectLabel className="mt-1">{m.nombre}</SelectLabel>
                                        <SelectItem value={`m:${m.codigo}`}>Todo {m.nombre}</SelectItem>
                                        {m.procesos.map(([codigo, nombre]) => (
                                            <SelectItem key={codigo} value={`p:${codigo}`}>
                                                <span className="pl-3">{nombre}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                ))}
                            </SelectContent>
                        </Select>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" disabled={isLoading || procesosVisibles.length === 0}>
                                    <Download className="mr-2 h-4 w-4" /> Descargar reporte
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64">
                                <DropdownMenuItem onClick={descargarPorProceso} className="flex flex-col items-start gap-0.5">
                                    <span className="font-medium">Por proceso</span>
                                    <span className="text-xs text-muted-foreground">Una fila por proceso</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={descargarPorProyecto} className="flex flex-col items-start gap-0.5">
                                    <span className="font-medium">Por proyecto</span>
                                    <span className="text-xs text-muted-foreground">Una fila por proyecto</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={descargarPorPersona} className="flex flex-col items-start gap-0.5">
                                    <span className="font-medium">Por persona</span>
                                    <span className="text-xs text-muted-foreground">Una fila por persona con su calificación</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
            </Card>

            {isLoading ? (
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
                </div>
            ) : proyectosOI.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                        Todavía no hay proyectos de Objetivos Individuales para reportar.
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Indicadores clave */}
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        <Card style={calGlobal ? { borderLeft: `4px solid ${calGlobal.color}` } : undefined}>
                            <CardHeader className="pb-2">
                                <CardDescription className="flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5" /> Cumplimiento</CardDescription>
                                <CardTitle className="text-3xl tabular-nums" style={calGlobal ? { color: calGlobal.color } : undefined}>
                                    {pctGlobal === null ? '—' : `${pctGlobal.toFixed(0)}%`}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pb-4 text-xs text-muted-foreground">
                                {calGlobal ? calGlobal.etiqueta : 'Sin actividades exigibles aún'}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Avance vs esperado</CardDescription>
                                <CardTitle className="text-3xl tabular-nums">
                                    {avancePromedio === null ? '—' : `${avancePromedio.toFixed(0)}%`}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pb-4 text-xs text-muted-foreground">
                                {esperadoPromedio === null ? '' : `Esperado a hoy: ${esperadoPromedio.toFixed(0)}%`}
                            </CardContent>
                        </Card>
                        <Card style={conteoEstados.vencida > 0 ? { borderLeft: `4px solid ${ESTILO_ESTADO_VISUAL.vencida.color}` } : undefined}>
                            <CardHeader className="pb-2">
                                <CardDescription className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Actividades vencidas</CardDescription>
                                <CardTitle className="text-3xl tabular-nums" style={conteoEstados.vencida > 0 ? { color: ESTILO_ESTADO_VISUAL.vencida.color } : undefined}>
                                    {conteoEstados.vencida}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pb-4 text-xs text-muted-foreground">de {acts.length} actividades · {filas.length} {filas.length === 1 ? 'proyecto' : 'proyectos'}</CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Costo de recursos</CardDescription>
                                <CardTitle className="text-2xl tabular-nums">{money(costoTotal)}</CardTitle>
                            </CardHeader>
                            <CardContent className="pb-4 text-xs text-muted-foreground">Estimado de los proyectos</CardContent>
                        </Card>
                    </div>

                    {/* Estado de las actividades */}
                    {acts.length > 0 && (
                        <Card>
                            <CardContent className="flex flex-col gap-3 pt-6">
                                <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Distribución de actividades por estado">
                                    {(['completada', 'completada_atraso', 'en_ejecucion', 'pendiente', 'vencida'] as EstadoVisual[]).map((e) => (
                                        conteoEstados[e] > 0 ? (
                                            <div key={e} style={{ width: `${(conteoEstados[e] / acts.length) * 100}%`, backgroundColor: ESTILO_ESTADO_VISUAL[e].color }} title={`${ESTILO_ESTADO_VISUAL[e].etiqueta}: ${conteoEstados[e]}`} />
                                        ) : null
                                    ))}
                                </div>
                                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
                                    {(['completada', 'completada_atraso', 'en_ejecucion', 'pendiente', 'vencida'] as EstadoVisual[]).map((e) => (
                                        <span key={e} className="flex items-center gap-1.5">
                                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ESTILO_ESTADO_VISUAL[e].color }} />
                                            {ESTILO_ESTADO_VISUAL[e].etiqueta}
                                            <strong className="tabular-nums">{conteoEstados[e]}</strong>
                                        </span>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Requiere atención */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                {atencion.length > 0 ? <AlertTriangle className="h-4 w-4 text-red-600" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                Requiere atención
                                {atencion.length > 0 && <Badge variant="destructive">{atencion.length}</Badge>}
                            </CardTitle>
                            <CardDescription>Proyectos con actividades vencidas o con un atraso mayor a {Math.abs(UMBRAL_ATRASO)} puntos frente a lo esperado.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {atencion.length === 0 ? (
                                <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">Todo al día: ningún proyecto con vencidas ni atrasos relevantes.</p>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {atencion.slice(0, 6).map((f) => (
                                        <div key={f.codigo} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium">{f.nombre}</p>
                                                <p className="truncate text-xs text-muted-foreground">{f.procesoNombre} · {f.responsables}</p>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-3 text-xs">
                                                {f.vencidas > 0 && (
                                                    <span className="rounded px-2 py-0.5 font-medium text-white" style={{ backgroundColor: ESTILO_ESTADO_VISUAL.vencida.color }}>
                                                        {f.vencidas} vencida{f.vencidas === 1 ? '' : 's'}
                                                    </span>
                                                )}
                                                <span className={cn('font-medium tabular-nums', f.brecha <= UMBRAL_ATRASO ? 'text-red-600' : 'text-muted-foreground')}>
                                                    {f.brecha >= 0 ? '+' : ''}{f.brecha.toFixed(0)} pts vs esperado
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                    {atencion.length > 6 && <p className="text-xs text-muted-foreground">y {atencion.length - 6} más en la tabla de proyectos.</p>}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Procesos → proyectos → personas, con descarga en cada nivel */}
                    <Card>
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                            <div>
                                <CardTitle className="text-base">Procesos · {nombreAlcance}</CardTitle>
                                <CardDescription>
                                    Abre un proceso para ver la calificación de su gente y sus proyectos. La marca de cada barra es lo esperado a hoy.
                                </CardDescription>
                            </div>
                            <div className="relative w-full sm:w-72">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input className="pl-8" placeholder="Buscar proceso, proyecto o persona…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            {procesosVisibles.length === 0 ? (
                                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Sin resultados.</p>
                            ) : (
                                <div className="divide-y rounded-md border">
                                    {procesosVisibles.map((p) => {
                                        const cal = p.pct === null ? null : calificarPorcentaje(p.pct);
                                        const abierto = (procesosVisibles.length === 1) !== alternados.has(p.key);
                                        const gente = personasPorProceso.get(p.key) || [];
                                        return (
                                            <div key={p.key}>
                                                <div className="flex items-center hover:bg-muted/50">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleProceso(p.key)}
                                                        aria-expanded={abierto}
                                                        className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    >
                                                        {abierto ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                                                        <span className="min-w-[160px] flex-1">
                                                            <span className="block font-medium">{p.nombre}</span>
                                                            <span className="block text-xs text-muted-foreground">
                                                                {p.macro && p.macro !== p.nombre ? `${p.macro} · ` : ''}{p.filas.length} {p.filas.length === 1 ? 'proyecto' : 'proyectos'}
                                                            </span>
                                                        </span>
                                                        <BarraAvance avance={p.avance} esperado={p.esperado} />
                                                        <span className={cn('w-20 text-right text-xs tabular-nums', p.vencidas > 0 ? 'font-semibold text-red-600' : 'text-muted-foreground')}>
                                                            {p.vencidas} vencida{p.vencidas === 1 ? '' : 's'}
                                                        </span>
                                                        <span className="w-16 text-right">
                                                            {cal && p.pct !== null ? <span className="font-semibold tabular-nums" style={{ color: cal.color }}>{p.pct.toFixed(0)}%</span> : <span className="text-xs text-muted-foreground">—</span>}
                                                        </span>
                                                    </button>
                                                </div>

                                                {abierto && (
                                                    <div className="flex flex-col gap-5 bg-muted/30 px-4 py-4">
                                                        <section>
                                                            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Users className="h-3.5 w-3.5" /> Calificación por persona</h4>
                                                            <div className="flex flex-col gap-1.5">
                                                                {gente.map((g) => (
                                                                    <FilaPersonaItem key={g.codigo} g={g} />
                                                                ))}
                                                                {gente.length === 0 && <p className="text-xs text-muted-foreground">Sin actividades asignadas.</p>}
                                                            </div>
                                                        </section>
                                                        <section>
                                                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proyectos</h4>
                                                            <div className="flex flex-col gap-1.5">
                                                                {p.filas.map((f) => (
                                                                    <FilaProyectoItem
                                                                        key={f.codigo}
                                                                        f={f}
                                                                        abierto={expandidos.has(f.codigo)}
                                                                        onToggle={() => toggleProyecto(f.codigo)}
                                                                        gente={personasPorProyecto.get(f.codigo) || []}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </section>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
