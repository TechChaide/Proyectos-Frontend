
"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { differenceInCalendarDays } from 'date-fns';
import { Activity, AlertTriangle, ArrowLeft, CalendarRange, CheckCircle2, CircleDot, Clock, ExternalLink, FolderKanban, Gauge, MoreVertical, Users } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Actividad, Area, AreaSolicitud, Estado, EstadoActividad, FichaSocialHistorica, Proyecto, Resultado, Responsable, TipoProyecto } from '@/types/interfaces';
import { tipoProyectoService } from '@/services/proyectos/tipoProyecto.service';
import { resultadoService } from '@/services/proyectos/resultado.service';
import { notaRubricaDeProyecto, sistemaDeTipo, type SistemaCalificacion } from '@/lib/rubricas';
import { ESTILO_SISTEMA, ORDEN_SISTEMAS } from '@/lib/tipoProyectoVisual';
import TipoBadge from './components/tipo-badge';
import { actividadService } from '@/services/proyectos/actividad.service';
import { proyectoService } from '@/services/proyectos/proyecto.service';
import { responsableService } from '@/services/proyectos/responsable.service';
import { estadoService } from '@/services/proyectos/estado.service';
import { estadoActividadService } from '@/services/proyectos/estadoActividad.service';
import { procesoService } from '@/services/proyectos/proceso.service';
import { areaSolicitudService } from '@/services/proyectos/areaSolicitud.service';
import { serviciosService } from '@/services/proyectos/servicios.service';
import {
    calcularAvanceProyectos,
    calcularCierreRealPorActividad,
    calcularCompletadas,
    calcularCumplimiento,
    calcularEstadosVisuales,
    calificarPorcentaje,
    ESTILO_ESTADO_VISUAL,
    toDateOnly,
    type EstadoVisual,
} from './cumplimiento';
import GaugeCumplimiento from './components/gauge-cumplimiento';
import Gantt, { type GanttFila, type GanttGrupo } from '@/components/gantt/gantt';
import { actividadesEvaluables, actividadesPrincipales, avancePorPadre, hijosPorPadre, participacionEnteraPorActividad } from '@/lib/actividades';
import AvanceProyectos from './components/avance-proyectos';
import ProcesoSelector from '../proyectos/components/proceso-selector';
import type { AreaBlock } from '../proyectos/types';
import { esResponsableDelProyecto, resolverProcesoPorProyecto } from '../proyectos/area-utils';
import { ahoraSQL, formatearFecha, hoyEcuador } from '@/lib/fechas';

// Equipo: vencidas primero, luego en plazo, luego las cerradas.
const ORDEN_ESTADO: Record<EstadoVisual, number> = { vencida: 0, en_ejecucion: 1, pendiente: 2, completada_atraso: 3, completada: 4 };

const ICONOS_ESTADO: Record<EstadoVisual, typeof CheckCircle2> = {
    completada: CheckCircle2,
    completada_atraso: Clock,
    vencida: AlertTriangle,
    en_ejecucion: Activity,
    pendiente: CircleDot,
};

interface ActividadRow {
    actividad: Actividad;
    proyectoNombre: string;
    areaCodigo: number | null;
    estadoVisual: EstadoVisual;
    diasParaVencer: number;
    completada: boolean;
    completadaConAtraso: boolean;
    vencida: boolean;
    ultimaEvidenciaUrl: string;
}

export default function MisActividadesPage() {
    const { user } = useAuth();
    const { toast } = useToast();

    const [actividades, setActividades] = useState<Actividad[]>([]);
    const [proyectos, setProyectos] = useState<Proyecto[]>([]);
    const [responsables, setResponsables] = useState<Responsable[]>([]);
    const [estados, setEstados] = useState<Estado[]>([]);
    const [estadosActividad, setEstadosActividad] = useState<EstadoActividad[]>([]);
    const [areas, setAreas] = useState<Area[]>([]);
    const [areaSolicitudes, setAreaSolicitudes] = useState<AreaSolicitud[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedAreaCode, setSelectedAreaCode] = useState<number | null>(null);
    const [tiposProyecto, setTiposProyecto] = useState<TipoProyecto[]>([]);
    const [resultados, setResultados] = useState<Resultado[]>([]);
    // Filtro por tipo de proyecto (MR / MSP / PI / OI); null = todos.
    const [filtroTipo, setFiltroTipo] = useState<SistemaCalificacion | null>(null);

    const [dialogActividad, setDialogActividad] = useState<Actividad | null>(null);
    const [urlEvidencia, setUrlEvidencia] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [enlaceTruncado, setEnlaceTruncado] = useState(false);

    // Formulario del jefe (regulariza actividades de su equipo, con fecha real de cierre).
    const [personas, setPersonas] = useState<FichaSocialHistorica[]>([]);
    const [equipoFormOpen, setEquipoFormOpen] = useState(false);
    const [equipoRecord, setEquipoRecord] = useState<EstadoActividad | null>(null);
    const [equipoActividadInicial, setEquipoActividadInicial] = useState<number | undefined>(undefined);

    const fetchData = async () => {
        setIsLoading(true);
        // Resiliente: si un servicio falla, los demás igual cargan.
        const nombres = ['actividades', 'proyectos', 'responsables', 'estados', 'estado_actividad', 'procesos', 'proceso_solicitud', 'personas', 'tipos de proyecto', 'resultados'];
        const results = await Promise.allSettled([
            actividadService.buscar({ estado: 'A' }),
            proyectoService.getAll(),
            responsableService.getAll(),
            estadoService.getAll(),
            estadoActividadService.getAll(),
            procesoService.getAll(),
            areaSolicitudService.getAll(),
            serviciosService.getInformacionPersonas(),
            tipoProyectoService.getAll(),
            resultadoService.getAll(),
        ]);
        const data = <T,>(i: number): T[] => {
            const r = results[i];
            return r.status === 'fulfilled' ? ((r.value as unknown as { data?: T[] }).data || []) : [];
        };
        setActividades(data<Actividad>(0));
        setProyectos(data<Proyecto>(1));
        setResponsables(data<Responsable>(2));
        setEstados(data<Estado>(3));
        setEstadosActividad(data<EstadoActividad>(4));
        setAreas(data<Area>(5));
        setAreaSolicitudes(data<AreaSolicitud>(6));
        setPersonas(data<FichaSocialHistorica>(7));
        setTiposProyecto(data<TipoProyecto>(8));
        setResultados(data<Resultado>(9));
        const fallidos = results.map((r, i) => (r.status === 'rejected' ? nombres[i] : null)).filter(Boolean);
        if (fallidos.length) {
            toast({ title: 'Algunos datos no se cargaron', description: `No se pudieron cargar: ${fallidos.join(', ')}.`, variant: 'destructive' });
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const misCodigosResponsable = useMemo(() => {
        const codigoEmpleado = user?.codigo_empleado;
        if (!codigoEmpleado) return new Set<number>();
        return new Set(responsables.filter((r) => r.codigo_empleado === codigoEmpleado).map((r) => r.codigo_responsable));
    }, [responsables, user]);

    // Modelo v5: las actividades compartidas son un padre contenedor + una subactividad por persona.
    // Solo se evalúan (nota, avance, estado) las subactividades y las actividades individuales.
    const activas = useMemo(() => actividades.filter((a) => a.estado === 'A'), [actividades]);
    const evaluables = useMemo(() => actividadesEvaluables(activas), [activas]);
    const participacionMap = useMemo(() => participacionEnteraPorActividad(activas), [activas]);
    const hijosMap = useMemo(() => hijosPorPadre(activas), [activas]);

    // Tipo de cada proyecto (MR / MSP / PI / OI), deducido del nombre del tipo de proyecto.
    const sistemaPorProyecto = useMemo(() => {
        const nombrePorTipo = new Map(tiposProyecto.map((t) => [t.codigo_tipo_proyecto, t.nombre_tipo_proyecto]));
        return new Map<number, SistemaCalificacion | null>(
            proyectos.map((p) => [p.codigo_proyecto, sistemaDeTipo(nombrePorTipo.get(p.codigo_tipo_proyecto) || '')])
        );
    }, [proyectos, tiposProyecto]);

    const todasLasRows = useMemo<ActividadRow[]>(() => {
        const proyectoMap = new Map(proyectos.map((p) => [p.codigo_proyecto, p.nombre_proyecto]));
        const hoy = hoyEcuador();

        const ultimaEvidenciaPorActividad = new Map<number, EstadoActividad>();
        estadosActividad
            .filter((ea) => ea.estado === 'A' && ea.url_evidencia)
            .forEach((ea) => {
                const actual = ultimaEvidenciaPorActividad.get(ea.codigo_actividad);
                if (!actual || new Date(ea.fecha_modificacion) > new Date(actual.fecha_modificacion)) {
                    ultimaEvidenciaPorActividad.set(ea.codigo_actividad, ea);
                }
            });

        const cierreRealPorActividad = calcularCierreRealPorActividad(estadosActividad, estados);
        const misActividadesActivas = evaluables.filter((a) => misCodigosResponsable.has(a.codigo_responsable));
        const completadas = calcularCompletadas(misActividadesActivas, estadosActividad, estados);
        const estadosVisuales = calcularEstadosVisuales(misActividadesActivas, estadosActividad, estados);
        const areaPorProyecto = resolverProcesoPorProyecto(proyectos, areaSolicitudes, areas);

        return misActividadesActivas
            .map((actividad) => {
                const fin = new Date(actividad.fecha_fin_actividad);
                const diasParaVencer = differenceInCalendarDays(fin, hoy);
                const completada = completadas.has(actividad.codigo_actividad);
                const vencida = !completada && diasParaVencer < 0;
                const cierreReal = cierreRealPorActividad.get(actividad.codigo_actividad);
                const completadaConAtraso = completada && !!cierreReal && cierreReal > toDateOnly(actividad.fecha_fin_actividad);
                return {
                    actividad,
                    proyectoNombre: proyectoMap.get(actividad.codigo_proyecto) || 'Proyecto sin nombre',
                    areaCodigo: areaPorProyecto.get(actividad.codigo_proyecto)?.codigo_proceso ?? null,
                    estadoVisual: estadosVisuales.get(actividad.codigo_actividad) || 'pendiente',
                    diasParaVencer,
                    completada,
                    completadaConAtraso,
                    vencida,
                    ultimaEvidenciaUrl: ultimaEvidenciaPorActividad.get(actividad.codigo_actividad)?.url_evidencia || '',
                };
            })
            .sort((a, b) => {
                if (a.vencida !== b.vencida) return a.vencida ? -1 : 1;
                if (a.completada !== b.completada) return a.completada ? 1 : -1;
                return a.diasParaVencer - b.diasParaVencer;
            });
    }, [evaluables, proyectos, estados, estadosActividad, areas, areaSolicitudes, misCodigosResponsable]);

    // Los proyectos anclados a un nivel fino (Subproceso, Línea, ...) se agrupan bajo su Proceso.
    const areaPorProyecto = useMemo(() => resolverProcesoPorProyecto(proyectos, areaSolicitudes, areas), [proyectos, areaSolicitudes, areas]);

    // Mis actividades según el filtro de tipo de proyecto; todo lo demás (procesos, nota, Gantt) parte de aquí.
    const rows = useMemo(
        () => (filtroTipo ? todasLasRows.filter((r) => sistemaPorProyecto.get(r.actividad.codigo_proyecto) === filtroTipo) : todasLasRows),
        [todasLasRows, filtroTipo, sistemaPorProyecto]
    );

    // Notas de rúbrica (MR / MSP / PI) por proyecto, a partir de las filas de `resultado`.
    const evaluacionPorProyecto = useMemo(() => {
        const map = new Map<number, { nota: number; pct: number; completa: boolean } | null>();
        sistemaPorProyecto.forEach((sistema, codigo) => {
            if (sistema && sistema !== 'INDIVIDUAL') map.set(codigo, notaRubricaDeProyecto(resultados, codigo, sistema));
        });
        return map;
    }, [sistemaPorProyecto, resultados]);

    // Tarjetas-resumen por tipo (también funcionan como filtro): solo de los tipos donde participo.
    const resumenPorTipo = useMemo(() => {
        return ORDEN_SISTEMAS.map((sistema) => {
            const filasTipo = todasLasRows.filter((r) => sistemaPorProyecto.get(r.actividad.codigo_proyecto) === sistema);
            const codigos = Array.from(new Set(filasTipo.map((r) => r.actividad.codigo_proyecto)));
            if (codigos.length === 0) return null;
            if (sistema === 'INDIVIDUAL') {
                const res = calcularCumplimiento(filasTipo.map((r) => r.actividad), estadosActividad, estados, proyectos);
                const pct = res.sinActividadesExigibles ? null : ((res.nota || 0) / 5) * 100;
                return { sistema, proyectos: codigos.length, linea: pct === null ? 'Sin actividades exigibles aún' : `Cumplimiento ${pct.toFixed(1)}%`, color: pct === null ? undefined : calificarPorcentaje(pct).color };
            }
            const evaluadas = codigos.map((c) => evaluacionPorProyecto.get(c)).filter(Boolean) as { nota: number; pct: number }[];
            if (evaluadas.length === 0) return { sistema, proyectos: codigos.length, linea: 'Pendiente de evaluación', color: undefined };
            const promedio = evaluadas.reduce((s, e) => s + e.nota, 0) / evaluadas.length;
            return { sistema, proyectos: codigos.length, linea: `${evaluadas.length} de ${codigos.length} evaluados · ${((promedio / 5) * 100).toFixed(0)}%`, color: calificarPorcentaje((promedio / 5) * 100).color };
        }).filter(Boolean) as { sistema: SistemaCalificacion; proyectos: number; linea: string; color?: string }[];
    }, [todasLasRows, sistemaPorProyecto, evaluacionPorProyecto, estadosActividad, estados, proyectos]);

    // Proyectos que el usuario lidera (es responsable del proyecto): ahí actúa como jefe y
    // puede regularizar las actividades de todo su equipo.
    const proyectosQueLidero = useMemo(
        () => new Set(proyectos.filter((p) => esResponsableDelProyecto(p, user?.codigo_empleado)).map((p) => p.codigo_proyecto)),
        [proyectos, user]
    );

    const actividadesEquipo = useMemo(
        () => evaluables.filter((a) => proyectosQueLidero.has(a.codigo_proyecto) && (!filtroTipo || sistemaPorProyecto.get(a.codigo_proyecto) === filtroTipo)),
        [evaluables, proyectosQueLidero, filtroTipo, sistemaPorProyecto]
    );

    const estadosVisualesEquipo = useMemo(
        () => calcularEstadosVisuales(actividadesEquipo, estadosActividad, estados),
        [actividadesEquipo, estadosActividad, estados]
    );

    // Procesos donde participa: tiene actividades propias o lidera proyectos.
    const areaBlocks = useMemo<AreaBlock[]>(() => {
        const actividadesPorArea = new Map<number, Set<number>>();
        const sumar = (a: Actividad) => {
            const area = areaPorProyecto.get(a.codigo_proyecto);
            if (!area) return;
            if (!actividadesPorArea.has(area.codigo_proceso)) actividadesPorArea.set(area.codigo_proceso, new Set());
            actividadesPorArea.get(area.codigo_proceso)!.add(a.codigo_actividad);
        };
        rows.forEach((r) => sumar(r.actividad));
        return areas
            .filter((a) => actividadesPorArea.has(a.codigo_proceso))
            .map((area) => ({ area, count: actividadesPorArea.get(area.codigo_proceso)!.size }))
            .sort((a, b) => a.area.nombre_proceso.localeCompare(b.area.nombre_proceso));
    }, [rows, actividadesEquipo, areaPorProyecto, areas]);

    // El tipo de proyecto es la primera decisión de la pantalla: siempre hay uno activo (no se mezclan).
    useEffect(() => {
        if (resumenPorTipo.length === 0) return;
        if (!filtroTipo || !resumenPorTipo.some((r) => r.sistema === filtroTipo)) setFiltroTipo(resumenPorTipo[0].sistema);
    }, [resumenPorTipo, filtroTipo]);

    // Si dentro del tipo solo hay un proceso, se abre directo (sin paso intermedio).
    const unSoloProceso = areaBlocks.length === 1;
    useEffect(() => {
        if (unSoloProceso && selectedAreaCode !== areaBlocks[0].area.codigo_proceso) setSelectedAreaCode(areaBlocks[0].area.codigo_proceso);
    }, [unSoloProceso, areaBlocks, selectedAreaCode]);

    // MR / MSP / PI se califican por rúbrica y no se organizan por proceso: se ven todos juntos, sin el paso de elegir proceso.
    const modoRubrica = !!filtroTipo && filtroTipo !== 'INDIVIDUAL';

    const selectedArea = useMemo(() => areas.find((a) => a.codigo_proceso === selectedAreaCode) || null, [areas, selectedAreaCode]);

    const rowsDelArea = useMemo(() => (modoRubrica ? rows : rows.filter((r) => r.areaCodigo === selectedAreaCode)), [rows, selectedAreaCode, modoRubrica]);

    const avancesDelArea = useMemo(
        () => calcularAvanceProyectos(rowsDelArea.map((r) => r.actividad), estadosActividad, estados, proyectos),
        [rowsDelArea, estadosActividad, estados, proyectos]
    );

    const equipoDelArea = useMemo(
        () => actividadesEquipo
            .filter((a) => modoRubrica || areaPorProyecto.get(a.codigo_proyecto)?.codigo_proceso === selectedAreaCode)
            .sort((a, b) => ORDEN_ESTADO[estadosVisualesEquipo.get(a.codigo_actividad) || 'pendiente'] - ORDEN_ESTADO[estadosVisualesEquipo.get(b.codigo_actividad) || 'pendiente']),
        [actividadesEquipo, areaPorProyecto, selectedAreaCode, estadosVisualesEquipo, modoRubrica]
    );

    const codigosEquipoDelArea = useMemo(() => new Set(equipoDelArea.map((a) => a.codigo_actividad)), [equipoDelArea]);
    const historialEquipoDelArea = useMemo(
        () => estadosActividad.filter((ea) => codigosEquipoDelArea.has(ea.codigo_actividad)),
        [estadosActividad, codigosEquipoDelArea]
    );

    const proyectoNombreMap = useMemo(() => new Map(proyectos.map((p) => [p.codigo_proyecto, p.nombre_proyecto])), [proyectos]);
    const responsableMap = useMemo(() => new Map(responsables.map((r) => [r.codigo_responsable, r])), [responsables]);
    const personaMap = useMemo(() => new Map(personas.map((p) => [p.CODIGO, p])), [personas]);
    const nombreResponsable = (codigoResponsable: number): string => {
        const r = responsableMap.get(codigoResponsable);
        if (!r) return 'Sin responsable';
        return personaMap.get(r.codigo_empleado)?.NOMBRE || r.codigo_empleado;
    };

    const ultimaEvidencia = useMemo(() => {
        const map = new Map<number, string>();
        const fechas = new Map<number, number>();
        estadosActividad
            .filter((ea) => ea.estado === 'A' && ea.url_evidencia)
            .forEach((ea) => {
                const t = new Date(ea.fecha_modificacion).getTime();
                if (!fechas.has(ea.codigo_actividad) || t > fechas.get(ea.codigo_actividad)!) {
                    fechas.set(ea.codigo_actividad, t);
                    map.set(ea.codigo_actividad, ea.url_evidencia);
                }
            });
        return map;
    }, [estadosActividad]);

    const abrirFormEquipo = (codigoActividad?: number) => {
        setEquipoRecord(null);
        setEquipoActividadInicial(codigoActividad);
        setEquipoFormOpen(true);
    };

    const editarRegistroEquipo = (record: EstadoActividad) => {
        setEquipoRecord(record);
        setEquipoActividadInicial(undefined);
        setEquipoFormOpen(true);
    };

    const cerrarFormEquipo = () => {
        setEquipoFormOpen(false);
        setEquipoRecord(null);
        setEquipoActividadInicial(undefined);
    };

    // Gantt personal: mis actividades por proyecto; en las compartidas se muestra mi participación.
    const gruposGantt = useMemo<GanttGrupo[]>(() => {
        const porProyecto = new Map<number, GanttGrupo>();
        [...rowsDelArea]
            .sort((a, b) => toDateOnly(a.actividad.fecha_inicio_actividad).getTime() - toDateOnly(b.actividad.fecha_inicio_actividad).getTime())
            .forEach((r) => {
                const a = r.actividad;
                if (!porProyecto.has(a.codigo_proyecto)) {
                    porProyecto.set(a.codigo_proyecto, { id: `p${a.codigo_proyecto}`, titulo: r.proyectoNombre, filas: [] });
                }
                const compartida = !!a.codigo_actividad_padre;
                const pct = participacionMap.get(a.codigo_actividad) ?? 100;

                // En las compartidas, el tooltip explica la continuidad: con quién la compartes y
                // de quién vienes / quién sigue (según las fechas de cada parte).
                let tooltip: string[];
                if (compartida) {
                    const hermanos = hijosMap.get(a.codigo_actividad_padre!) || [];
                    const otros = hermanos.filter((s) => s.codigo_actividad !== a.codigo_actividad);
                    const miIni = toDateOnly(a.fecha_inicio_actividad).getTime();
                    const miFin = toDateOnly(a.fecha_fin_actividad).getTime();
                    const antes = otros
                        .filter((s) => toDateOnly(s.fecha_fin_actividad).getTime() <= miIni)
                        .sort((x, y) => toDateOnly(y.fecha_fin_actividad).getTime() - toDateOnly(x.fecha_fin_actividad).getTime())[0];
                    const despues = otros
                        .filter((s) => toDateOnly(s.fecha_inicio_actividad).getTime() >= miFin)
                        .sort((x, y) => toDateOnly(x.fecha_inicio_actividad).getTime() - toDateOnly(y.fecha_inicio_actividad).getTime())[0];
                    tooltip = [
                        `Actividad compartida (${hermanos.length} participantes) · tu parte ${pct}%`,
                        antes
                            ? `Vienes después de: ${nombreResponsable(antes.codigo_responsable)} (termina ${formatearFecha(antes.fecha_fin_actividad)})`
                            : 'Tu parte abre la actividad',
                        despues
                            ? `Luego continúa: ${nombreResponsable(despues.codigo_responsable)} (empieza ${formatearFecha(despues.fecha_inicio_actividad)})`
                            : 'Tu parte cierra la actividad',
                    ];
                } else {
                    tooltip = [`Peso en el proyecto: ${a.peso_actividad}%`];
                }

                porProyecto.get(a.codigo_proyecto)!.filas.push({
                    id: String(a.codigo_actividad),
                    nombre: a.nombre_actividad,
                    detalle: compartida ? `Compartida · mi participación ${pct}%` : 'Individual',
                    inicio: a.fecha_inicio_actividad,
                    fin: a.fecha_fin_actividad,
                    estado: r.estadoVisual,
                    etiquetaFin: compartida ? `${pct}%` : undefined,
                    tooltip,
                });
            });
        return Array.from(porProyecto.values()).sort((a, b) => (a.titulo || '').localeCompare(b.titulo || ''));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rowsDelArea, participacionMap, hijosMap, responsableMap, personaMap]);

    // Gantt del equipo (proyectos que lidero): cada actividad y, si es compartida, su avance y una fila
    // por participante con su % de participación y su propio estado.
    const gruposGanttEquipo = useMemo<GanttGrupo[]>(() => {
        const completadas = calcularCompletadas(equipoDelArea, estadosActividad, estados);
        const avance = avancePorPadre(activas, completadas);
        const principales = actividadesPrincipales(activas)
            .filter((a) => proyectosQueLidero.has(a.codigo_proyecto) && (modoRubrica || areaPorProyecto.get(a.codigo_proyecto)?.codigo_proceso === selectedAreaCode))
            .sort((a, b) => toDateOnly(a.fecha_inicio_actividad).getTime() - toDateOnly(b.fecha_inicio_actividad).getTime());
        const porProyecto = new Map<number, GanttGrupo>();
        principales.forEach((a) => {
            if (!porProyecto.has(a.codigo_proyecto)) {
                porProyecto.set(a.codigo_proyecto, { id: `e${a.codigo_proyecto}`, titulo: proyectoNombreMap.get(a.codigo_proyecto) || 'Proyecto', filas: [] });
            }
            const filas = porProyecto.get(a.codigo_proyecto)!.filas;
            const hijos = hijosMap.get(a.codigo_actividad) || [];
            if (hijos.length === 0) {
                filas.push({
                    id: String(a.codigo_actividad),
                    nombre: a.nombre_actividad,
                    detalle: nombreResponsable(a.codigo_responsable),
                    inicio: a.fecha_inicio_actividad,
                    fin: a.fecha_fin_actividad,
                    estado: estadosVisualesEquipo.get(a.codigo_actividad) || 'pendiente',
                    tooltip: [`Responsable: ${nombreResponsable(a.codigo_responsable)}`],
                });
                return;
            }
            const bloque = `b${a.codigo_actividad}`;
            filas.push({
                id: String(a.codigo_actividad),
                nombre: a.nombre_actividad,
                detalle: `${hijos.length} participantes`,
                inicio: a.fecha_inicio_actividad,
                fin: a.fecha_fin_actividad,
                estado: 'contenedor',
                progreso: avance.get(a.codigo_actividad) || 0,
                bloque,
            });
            hijos.forEach((h) => {
                const pct = participacionMap.get(h.codigo_actividad) ?? 0;
                const fila: GanttFila = {
                    id: String(h.codigo_actividad),
                    nombre: nombreResponsable(h.codigo_responsable),
                    detalle: `Participación ${pct}%`,
                    inicio: h.fecha_inicio_actividad,
                    fin: h.fecha_fin_actividad,
                    estado: estadosVisualesEquipo.get(h.codigo_actividad) || 'pendiente',
                    nivel: 1,
                    bloque,
                    etiquetaFin: `${pct}%`,
                    tooltip: [`Participación en la actividad: ${pct}%`],
                };
                filas.push(fila);
            });
        });
        return Array.from(porProyecto.values()).sort((a, b) => (a.titulo || '').localeCompare(b.titulo || ''));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activas, equipoDelArea, estadosActividad, estados, proyectosQueLidero, areaPorProyecto, selectedAreaCode, modoRubrica, hijosMap, participacionMap, estadosVisualesEquipo, proyectoNombreMap, responsableMap, personaMap]);

    // "Mi Nota de Cumplimiento" es exclusiva de Objetivos Individuales (OI). Los MR, MSP y PI se
    // califican por rúbrica en Evaluación, así que sus actividades no entran en esta nota.
    const esOI = (codigoProyecto: number) => sistemaPorProyecto.get(codigoProyecto) === 'INDIVIDUAL';
    const rowsOI = useMemo(() => rows.filter((r) => esOI(r.actividad.codigo_proyecto)), [rows, sistemaPorProyecto]); // eslint-disable-line react-hooks/exhaustive-deps
    const rowsDelAreaOI = useMemo(() => rowsDelArea.filter((r) => esOI(r.actividad.codigo_proyecto)), [rowsDelArea, sistemaPorProyecto]); // eslint-disable-line react-hooks/exhaustive-deps

    // Nota GLOBAL (solo OI): mis actividades de proyectos OI (ponderada por proyecto). % + nota/5.
    const resultadoCumplimiento = useMemo(
        () => calcularCumplimiento(rowsOI.map((r) => r.actividad), estadosActividad, estados, proyectos),
        [rowsOI, estadosActividad, estados, proyectos]
    );

    // Cumplimiento del PROCESO seleccionado (solo OI): mismo cálculo pero solo con sus actividades; aquí
    // mostramos únicamente el % (la nota/5 no es relevante dentro del proceso).
    const resultadoCumplimientoArea = useMemo(
        () => calcularCumplimiento(rowsDelAreaOI.map((r) => r.actividad), estadosActividad, estados, proyectos),
        [rowsDelAreaOI, estadosActividad, estados, proyectos]
    );
    const cumplimientoArea = useMemo(() => {
        if (resultadoCumplimientoArea.sinActividadesExigibles) return null;
        const pct = ((resultadoCumplimientoArea.nota || 0) / 5) * 100;
        return { pct, ...calificarPorcentaje(pct) };
    }, [resultadoCumplimientoArea]);

    // Único estado manual: "Completada". Los demás (Pendiente / En ejecución / Vencida) son automáticos
    // y se derivan de las fechas; el usuario no los elige.
    const estadoCompletada = useMemo(
        () => estados.find((e) => e.estado === 'A' && (e.nombre_estado || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes('complet')) || null,
        [estados]
    );

    const handleOpenDialog = (actividad: Actividad) => {
        setDialogActividad(actividad);
        setUrlEvidencia('');
        setEnlaceTruncado(false);
    };

    const handleSave = async () => {
        if (!dialogActividad || !estadoCompletada) return;
        setIsSaving(true);
        // Etiqueta el paso para saber qué tabla/columna se trunca (SQL no lo dice).
        let paso: 'evidencia' | 'actividad' = 'evidencia';
        try {
            const usuario = user?.usuario || 'admin';
            const now = ahoraSQL();

            // Paso 1: registrar la evidencia + el estado "Completada" en estado_actividad.
            paso = 'evidencia';
            await estadoActividadService.save({
                codigo_estado_actividad: 0,
                codigo_actividad: dialogActividad.codigo_actividad,
                codigo_estado: estadoCompletada.codigo_estado,
                url_evidencia: urlEvidencia || '',
                estado: 'A',
                usuario_modificacion: usuario,
                fecha_modificacion: now,
            } as EstadoActividad);

            // Paso 2: marcar la actividad como completada (texto en la tabla actividad).
            paso = 'actividad';
            await actividadService.save({
                ...dialogActividad,
                estado_actividad: estadoCompletada.nombre_estado,
                usuario_modificacion: usuario,
                fecha_modificacion: now,
            });

            toast({ title: 'Actividad completada', description: 'Se marcó como completada y se guardó la evidencia.' });
            setDialogActividad(null);
            fetchData();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
            const esTruncado = /truncat/i.test(errorMessage);
            let descripcion = errorMessage;
            if (esTruncado) {
                descripcion = paso === 'evidencia'
                    ? `Se truncó un dato al registrar la EVIDENCIA (tabla estado_actividad). Revisa el tamaño real de la columna "url_evidencia" (el link enviado tiene ${(urlEvidencia || '').length} caracteres).`
                    : 'Se truncó un dato al actualizar la ACTIVIDAD (tabla actividad). Revisa el tamaño de "estado_actividad", "nombre_actividad" o "descripcion_actividad" en esa tabla.';
            }
            toast({ title: `Error al guardar (${paso === 'evidencia' ? 'evidencia' : 'actividad'})`, description: descripcion, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 p-4 md:p-6">
            <Card>
                <CardHeader>
                    <CardTitle>Mis Actividades</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        El estado es automático según las fechas: <strong>Pendiente</strong> (aún no inicia) →
                        <strong> En ejecución</strong> (en curso, dale foco) → <strong>Vencida</strong> (pasó su fin sin cerrarse).
                        Lo único que haces tú es marcarla como <strong>Completada</strong> desde el menú de la tarjeta.
                    </p>
                </CardHeader>
            </Card>

            {/* Paso 1: tipo de proyecto. Cada tipo tiene su propio seguimiento, por eso no se mezclan. */}
            {!isLoading && resumenPorTipo.length > 0 && (
                <section aria-label="Tipo de proyecto" className="flex flex-col gap-2">
                    <h2 className="text-sm font-semibold">Tipo de proyecto</h2>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="tablist">
                        {resumenPorTipo.map((r) => {
                            const e = ESTILO_SISTEMA[r.sistema];
                            const activo = filtroTipo === r.sistema;
                            return (
                                <button
                                    key={r.sistema}
                                    type="button"
                                    role="tab"
                                    aria-selected={activo}
                                    onClick={() => { if (!activo) { setFiltroTipo(r.sistema); setSelectedAreaCode(null); } }}
                                    className={`flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activo ? '' : 'bg-card opacity-70 hover:opacity-100'}`}
                                    style={activo ? { borderColor: e.color, boxShadow: `0 0 0 2px ${e.color}`, backgroundColor: `${e.color}0d` } : { borderLeft: `4px solid ${e.color}` }}
                                >
                                    <span className="flex items-center gap-2">
                                        <TipoBadge sistema={r.sistema} />
                                        <span className="truncate text-xs text-muted-foreground">{e.nombre}</span>
                                    </span>
                                    <span className="text-lg font-bold tabular-nums">{r.proyectos} <span className="text-xs font-normal text-muted-foreground">{r.proyectos === 1 ? 'proyecto' : 'proyectos'}</span></span>
                                    <span className="text-xs font-medium" style={r.color ? { color: r.color } : undefined}>{r.linea}</span>
                                </button>
                            );
                        })}
                    </div>
                </section>
            )}

            {isLoading ? (
                <Skeleton className="h-32 w-full rounded-lg" />
            ) : rowsOI.length === 0 ? null : (
                <Card>
                    <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Gauge className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle className="flex items-center gap-2 text-base">
                                Mi Nota de Cumplimiento
                                <TipoBadge sistema="INDIVIDUAL" />
                            </CardTitle>
                            <CardDescription>
                                Solo Objetivos Individuales: promedio ponderado de tus actividades ya vencidas, por proyecto (escala 0,00 a 5,00).
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {resultadoCumplimiento.sinActividadesExigibles ? (
                            <p className="text-sm text-muted-foreground">
                                Sin actividades exigibles todavía (ninguna de tus actividades ha llegado a su fecha de fin).
                            </p>
                        ) : (
                            <div className="flex flex-col items-center gap-4 md:flex-row md:items-start">
                                <GaugeCumplimiento
                                    pct={((resultadoCumplimiento.nota || 0) / 5) * 100}
                                    nota={resultadoCumplimiento.nota || 0}
                                />
                                <div className="w-full flex-1 rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Proyecto</TableHead>
                                                <TableHead className="text-right">% Cumpl.</TableHead>
                                                <TableHead className="text-right">Nota</TableHead>
                                                <TableHead className="text-right">Act. Año</TableHead>
                                                <TableHead className="text-right">Peso</TableHead>
                                                <TableHead className="text-right">Aporte</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {resultadoCumplimiento.proyectos.map((p) => {
                                                const { color } = calificarPorcentaje(p.pctCumplimiento * 100);
                                                return (
                                                    <TableRow key={p.codigoProyecto}>
                                                        <TableCell className="font-medium">
                                                            <span className="flex items-center gap-2">
                                                                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                                                                {p.nombreProyecto}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-right">{(p.pctCumplimiento * 100).toFixed(1)}%</TableCell>
                                                        <TableCell className="text-right">{p.nota.toFixed(2)}</TableCell>
                                                        <TableCell className="text-right">{p.actividadesAnio}</TableCell>
                                                        <TableCell className="text-right">{(p.peso * 100).toFixed(1)}%</TableCell>
                                                        <TableCell className="text-right">{p.aporte.toFixed(3)}</TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {isLoading ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-40 w-full rounded-lg" />
                    ))}
                </div>
            ) : areaBlocks.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                        No tienes actividades asignadas ni lideras proyectos todavía.
                    </CardContent>
                </Card>
            ) : !modoRubrica && selectedAreaCode === null ? (
                <ProcesoSelector
                    blocks={areaBlocks}
                    onSelect={setSelectedAreaCode}
                    singular="actividad"
                    plural="actividades"
                    mensajeVacio="Tus actividades no están asociadas a ningún proceso."
                />
            ) : (
                <>
                {!modoRubrica && (
                <div className="flex flex-wrap items-center gap-3">
                    {!unSoloProceso && (
                        <Button variant="outline" size="sm" onClick={() => setSelectedAreaCode(null)}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver a procesos
                        </Button>
                    )}
                    <span className="text-sm font-medium">Proceso: {selectedArea?.nombre_proceso}</span>
                </div>
                )}

                {rowsDelAreaOI.length > 0 && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 py-4">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-base">
                                Cumplimiento del proceso
                                <TipoBadge sistema="INDIVIDUAL" />
                            </CardTitle>
                            <CardDescription>% de cumplimiento de tus actividades OI exigibles en este proceso.</CardDescription>
                        </div>
                        {cumplimientoArea ? (
                            <div className="flex items-center gap-2">
                                <span className="text-3xl font-bold tabular-nums" style={{ color: cumplimientoArea.color }}>
                                    {cumplimientoArea.pct.toFixed(1)}%
                                </span>
                                <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: cumplimientoArea.color }}>
                                    {cumplimientoArea.etiqueta}
                                </span>
                            </div>
                        ) : (
                            <span className="text-sm text-muted-foreground">Sin actividades exigibles todavía</span>
                        )}
                    </CardHeader>
                </Card>
                )}

                <AvanceProyectos
                    avances={avancesDelArea}
                    sistemaPorProyecto={sistemaPorProyecto}
                    evaluacionPorProyecto={evaluacionPorProyecto}
                    procesoPorProyecto={new Map(Array.from(areaPorProyecto.entries()).map(([codigo, a]) => [codigo, a.nombre_proceso]))}
                />

                {rowsDelArea.length > 0 && (
                    <Gantt
                        grupos={gruposGantt}
                        titulo="Mi cronograma"
                        descripcion="Tus actividades en el tiempo, coloreadas por estado. En las compartidas se indica tu porcentaje de participación."
                    />
                )}

                {rowsDelArea.length > 0 && (
                    <h2 className="text-lg font-semibold">Mis actividades</h2>
                )}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {rowsDelArea.map(({ actividad, proyectoNombre, diasParaVencer, estadoVisual, completada, vencida, ultimaEvidenciaUrl }) => {
                        const estilo = ESTILO_ESTADO_VISUAL[estadoVisual];
                        const IconoEstado = ICONOS_ESTADO[estadoVisual];
                        return (
                        <Card key={actividad.codigo_actividad} className="border-l-4" style={{ borderLeftColor: estilo.color }}>
                            <CardHeader className="space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <Badge className="gap-1" style={{ backgroundColor: estilo.color, color: estilo.texto }}>
                                        <IconoEstado className="h-3 w-3" />
                                        {estadoVisual === 'vencida' ? `Vencida hace ${Math.abs(diasParaVencer)} día(s)` : estilo.etiqueta}
                                    </Badge>
                                    {!completada && !vencida && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="-mr-2 -mt-1 h-8 w-8 shrink-0" aria-label="Opciones de la actividad">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleOpenDialog(actividad)}>
                                                    Marcar como completada
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                                <CardTitle className="text-base leading-snug">{actividad.nombre_actividad}</CardTitle>
                                {actividad.codigo_actividad_padre && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Users className="h-3.5 w-3.5 shrink-0" />
                                        <span>
                                            Actividad compartida · tu participación {participacionMap.get(actividad.codigo_actividad) ?? 0}%
                                            {' '}({(hijosMap.get(actividad.codigo_actividad_padre) || []).length} participantes; se te califica solo por tu parte)
                                        </span>
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{proyectoNombre}</span>
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                <p className="line-clamp-2 text-sm text-muted-foreground">
                                    {actividad.descripcion_actividad || 'Sin descripción.'}
                                </p>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                                    <span>
                                        {formatearFecha(actividad.fecha_inicio_actividad)} - {formatearFecha(actividad.fecha_fin_actividad)}
                                        {' · '}Peso {actividad.peso_actividad}%
                                    </span>
                                </div>

                                {ultimaEvidenciaUrl && (
                                    <a
                                        href={ultimaEvidenciaUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                                    >
                                        Ver evidencia <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                )}

                                {vencida && (
                                    <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
                                        Esta actividad venció sin cerrarse. No puedes actualizar su estado ni cargar evidencia.
                                        Contacta a tu jefe de proyecto para regularizarla.
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        );
                    })}
                </div>
                </>
            )}

            <Dialog open={!!dialogActividad} onOpenChange={(open) => !open && setDialogActividad(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Marcar actividad como completada</DialogTitle>
                        <DialogDescription>{dialogActividad?.nombre_actividad}</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                            El estado de la actividad es automático según las fechas (Pendiente → En ejecución → Vencida).
                            Lo único que registras aquí es darla por <strong>completada</strong> y, si quieres, su evidencia.
                        </div>
                        {!estadoCompletada && (
                            <Alert variant="destructive">
                                <AlertDescription className="text-xs">
                                    No se encontró el estado &quot;Completada&quot; en el catálogo de estados. Pide crearlo para poder completar actividades.
                                </AlertDescription>
                            </Alert>
                        )}
                        <div>
                            <label className="text-sm font-medium">URL de Evidencia (opcional)</label>
                            <Input
                                placeholder="Ej: https://drive.google.com/..."
                                maxLength={200}
                                value={urlEvidencia}
                                onChange={(e) => {
                                    setUrlEvidencia(e.target.value);
                                    setEnlaceTruncado(false);
                                }}
                                onPaste={(e) => {
                                    const pegado = e.clipboardData.getData('text');
                                    if (pegado.length > 200) {
                                        e.preventDefault();
                                        setEnlaceTruncado(true);
                                    }
                                }}
                            />
                            <p className="mt-1 text-xs text-muted-foreground">
                                {urlEvidencia.length}/200 caracteres.
                            </p>
                            {enlaceTruncado ? (
                                <Alert variant="destructive" className="mt-2">
                                    <AlertDescription className="text-xs">
                                        Ese enlace tiene más de 200 caracteres y la base de datos no lo acepta completo — si lo pegas
                                        tal cual, queda cortado y <strong>no vas a poder abrirlo después</strong>. Acórtalo primero con{' '}
                                        <a href="https://tinyurl.com" target="_blank" rel="noopener noreferrer" className="underline">tinyurl.com</a>
                                        {' '}o similar, y pega aquí el link corto.
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Pega el enlace compartido de Drive (hasta 200 caracteres).
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogActividad(null)} disabled={isSaving}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving || !estadoCompletada}>
                            {isSaving ? 'Guardando...' : 'Marcar como completada'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
