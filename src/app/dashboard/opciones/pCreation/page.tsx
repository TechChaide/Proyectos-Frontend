
"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFormState, useWatch, type FieldErrors, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Check, FileText, ListChecks, Loader2, Network, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import type { Area, TipoProyecto, Responsable, Estado, Solicitud, EstadoSolicitud, AreaSolicitud, Proyecto, Actividad, FichaSocialHistorica, Resultado, TipoRecurso, Recurso, ProyectoRecurso, PilarEstrategico, Okr, Objetivo } from '@/types/interfaces';
import { procesoService } from '@/services/proyectos/proceso.service';
import { resultadoService } from '@/services/proyectos/resultado.service';
import { tipoRecursoService } from '@/services/proyectos/tipoRecurso.service';
import { recursoService } from '@/services/proyectos/recurso.service';
import { proyectoRecursoService } from '@/services/proyectos/proyectoRecurso.service';
import { tipoProyectoService } from '@/services/proyectos/tipoProyecto.service';
import { responsableService } from '@/services/proyectos/responsable.service';
import { serviciosService } from '@/services/proyectos/servicios.service';
import { estadoService } from '@/services/proyectos/estado.service';
import { solicitudService } from '@/services/proyectos/solicitud.service';
import { estadoSolicitudService } from '@/services/proyectos/estadoSolicitud.service';
import { areaSolicitudService } from '@/services/proyectos/areaSolicitud.service';
import { proyectoService } from '@/services/proyectos/proyecto.service';
import { actividadService } from '@/services/proyectos/actividad.service';
import { pilarEstrategicoService } from '@/services/proyectos/pilarEstrategico.service';
import { okrService } from '@/services/proyectos/okr.service';
import { objetivoService } from '@/services/proyectos/objetivo.service';
import StepperHeader from './components/stepper-header';
import StepArea from './components/step-area';
import StepProyecto from './components/step-proyecto';
import StepActividades from './components/step-actividades';
import StepRecursos from './components/step-recursos';
import StepTipoSolicitud, { type IntegradorResumen, type TipoSolicitud } from './components/step-tipo-solicitud';
import StepCaja from './components/step-caja';
import type { HijoExistente } from './components/step-caja';
import EstructuraIntegrador from './components/estructura-integrador';
import DescripcionObjetivos, { ChecklistPasoActividades } from './components/descripcion-objetivos';
import SeccionFormulario from './components/seccion-formulario';
import ImportarExcel from './components/importar-excel';
import BorradorBanner from './components/borrador-banner';
import SalidaSinGuardarDialog from './components/salida-sin-guardar-dialog';
import { borrarBorrador, guardarBorrador, leerBorrador, type BorradorGuardado } from '@/lib/borrador-local';
import { useProtegerSalida } from '@/hooks/use-proteger-salida';
import { proyectoWizardSchema, defaultWizardValues, defaultActividad, defaultParticipante, cajaWizardSchema, defaultCajaValues, type ProyectoWizardValues, type CajaWizardValues } from './schema';
import { ahoraSQL, fechaISO, fechaSQL, formatearFecha } from '@/lib/fechas';
import { actividadesPrincipales, esParticipacion, hijosPorPadre } from '@/lib/actividades';
import { procesosVigentes } from '@/lib/procesoNiveles';
import { resolverAreaPorProyecto } from '../proyectos/area-utils';

const normalize = (value: string): string =>
    value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Los pasos dependen del tipo de solicitud: general = Proceso → Proyecto → Recursos → Actividades;
// Proyecto Integrador = sus datos (fase 1). Al crearlo se abre su estructura (?integrador=<codigo>, fase 2), desde donde se
// agregan los hijos uno a uno (?padre=<codigo>), cada uno con el flujo general.
type PasoKey = 'tipo' | 'proceso' | 'proyecto' | 'recursos' | 'actividades' | 'caja';
const INFO_PASOS: Record<PasoKey, { title: string; description: string }> = {
    tipo: { title: 'Solicitud', description: 'Tipo de solicitud' },
    proceso: { title: 'Proceso', description: 'Proceso solicitante' },
    proyecto: { title: 'Proyecto', description: 'Datos del proyecto' },
    recursos: { title: 'Recursos', description: 'Recursos del proyecto' },
    actividades: { title: 'Actividades', description: 'Plan de actividades' },
    caja: { title: 'Integrador', description: 'Datos del proyecto integrador' },
};
// El paso de Recursos está oculto por ahora (no se asignan recursos al crear proyectos); su código se conserva.
const FLUJO_PROYECTO: PasoKey[] = ['proceso', 'proyecto', 'actividades'];
// Al editar un Proyecto Integrador ya guardado solo hay un paso: sus datos.
const FLUJO_INTEGRADOR_EDICION: PasoKey[] = ['caja'];

const stepFields: Partial<Record<PasoKey, (keyof ProyectoWizardValues)[]>> = {
    proceso: ['codigo_proceso'],
    proyecto: ['codigo_tipo_proyecto', 'nombre_proyecto', 'descripcion_proyecto', 'codigo_pilar', 'codigo_okr', 'responsable_proyecto', 'objetivo_principal', 'objetivos', 'resultados_esperados', 'fecha_inicio', 'fecha_fin'],
    recursos: ['recursos'],
};
// En un proyecto hijo, la descripción y los objetivos se llenan en el paso de actividades.
const CAMPOS_EN_ACTIVIDADES_HIJO: (keyof ProyectoWizardValues)[] = ['descripcion_proyecto', 'objetivo_principal', 'objetivos'];
const camposDelPaso = (k: PasoKey, esHijo: boolean): (keyof ProyectoWizardValues)[] | undefined => {
    if (!esHijo) return stepFields[k];
    if (k === 'proyecto') return stepFields.proyecto!.filter((c) => !CAMPOS_EN_ACTIVIDADES_HIJO.includes(c));
    if (k === 'actividades') return CAMPOS_EN_ACTIVIDADES_HIJO;
    return stepFields[k];
};

// Datos para crear un proyecto nuevo (solicitud + estado + proceso + proyecto).
interface DatosBase {
    /** null = sin proceso (proyecto de caja). */
    codigoProceso: number | null;
    codigoPadre: number | null;
    proyectoCaja: boolean;
    /** null = sin tipo (proyecto de caja). */
    codigoTipoProyecto: number | null;
    codigoOkr: number | null;
    nombre: string;
    descripcion: string;
    responsable: string;
    fechaInicio: string;
    fechaFin: string;
    objetivoPrincipal: string;
}

// Avance de la creación de un proyecto EN EL SISTEMA. Si un guardado falla a medias (p. ej. se vence la sesión), permite
// reintentar continuando donde quedó, sin duplicar la solicitud ni el proyecto ya creados.
interface LibroProyecto {
    codigoSolicitud?: number;
    estadoHecho?: boolean;
    areaHecha?: boolean;
    codigoProyecto?: number;
    /** Todo el detalle del proyecto (objetivos, actividades, resultados y recursos) ya se guardó. */
    completo?: boolean;
}

// Lo que se conserva en el navegador para poder recuperar el avance de una solicitud.
interface BorradorPCreation {
    version: 2;
    tipoSolicitud: TipoSolicitud | null;
    pasoKey: PasoKey;
    form: ProyectoWizardValues;
    caja: CajaWizardValues;
    libroGeneral: LibroProyecto;
    libroCaja: LibroProyecto;
}

// ¿El formulario de un proyecto tiene algo escrito? (elegir solo el proceso no cuenta como avance).
const valoresConContenido = (v?: Partial<ProyectoWizardValues>): boolean =>
    !!v && !!(
        v.nombre_proyecto?.trim() || v.descripcion_proyecto?.trim() || v.objetivo_principal?.trim() ||
        v.objetivos?.length || v.resultados_esperados?.length || v.recursos?.length ||
        v.actividades?.some((a) => a.nombre_actividad?.trim() || a.descripcion_actividad?.trim())
    );
const cajaConContenido = (c?: Partial<CajaWizardValues>): boolean =>
    !!c && !!(c.nombre_proyecto?.trim() || c.descripcion_proyecto?.trim() || c.responsable_proyecto?.trim());
const esSesionExpirada = (mensaje: string) => /sesi[oó]n|expirad|autenticaci|unauthorized|401/i.test(mensaje);
const RUTA = '/dashboard/opciones/pCreation';

interface EditContext {
    codigoProyecto: number;
    codigoSolicitud: number;
    codigoAreaSolicitud: number;
    proyectoEstado: string;
    actividadCodigosOriginales: number[];
    actividadEstadoMap: Map<number, string>;
    actividadPadreMap: Map<number, number | null>;
    /** Resultados "Esperados" existentes del proyecto (filas de resultado), para eliminar los que se quiten. */
    resultadoCodigosOriginales: number[];
    /** Asignaciones de recurso (proyecto_recurso) originales, para eliminar las que se quiten. */
    proyectoRecursoCodigosOriginales: number[];
    /** Objetivos (tabla objetivo) activos originales, para desactivar los que se quiten. */
    objetivoCodigosOriginales: number[];
    fechaInicioOriginal: string;
    fechaFinOriginal: string;
}

export default function ProyectoCreationPage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const editCodigoProyecto = searchParams.get('codigo_proyecto');
    const tipoInicial = searchParams.get('tipo');
    const isEditMode = !!editCodigoProyecto;
    // Agregar un proyecto hijo a un Proyecto Integrador que ya existe (?padre=<codigo del integrador>).
    const padreParam = searchParams.get('padre');
    const codigoPadreParam = !isEditMode && padreParam && Number(padreParam) > 0 ? Number(padreParam) : null;
    // Fase 2 del Proyecto Integrador: su estructura en cascada (?integrador=<codigo>).
    const integradorParam = searchParams.get('integrador');
    const codigoIntegradorVista = !isEditMode && !codigoPadreParam && integradorParam && Number(integradorParam) > 0 ? Number(integradorParam) : null;
    // Se llegó desde la estructura de un integrador (para volver a ella al guardar o cancelar).
    const desdeEstructura = searchParams.get('origen') === 'estructura';

    // Al editar un proyecto existente se abre directo en el paso 2 (Datos del Proyecto); al crear, en el paso 1.
    const [currentStep, setCurrentStep] = useState(isEditMode ? 2 : 1);
    const [tipoSolicitud, setTipoSolicitud] = useState<TipoSolicitud | null>(codigoPadreParam ? 'general' : null);
    const [isSaving, setIsSaving] = useState(false);

    const [areas, setAreas] = useState<Area[]>([]);
    const [tiposProyecto, setTiposProyecto] = useState<TipoProyecto[]>([]);
    const [proyectosPadre, setProyectosPadre] = useState<Proyecto[]>([]);
    const [integradores, setIntegradores] = useState<IntegradorResumen[]>([]);
    const [areaSolicitudes, setAreaSolicitudes] = useState<AreaSolicitud[]>([]);
    const [tiposRecurso, setTiposRecurso] = useState<TipoRecurso[]>([]);
    const [recursos, setRecursos] = useState<Recurso[]>([]);
    const [responsables, setResponsables] = useState<Responsable[]>([]);
    const [estados, setEstados] = useState<Estado[]>([]);
    const [personas, setPersonas] = useState<FichaSocialHistorica[]>([]);
    const [pilares, setPilares] = useState<PilarEstrategico[]>([]);
    const [okrs, setOkrs] = useState<Okr[]>([]);
    const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(true);
    const [editContext, setEditContext] = useState<EditContext | null>(null);
    // Edición de un Proyecto Integrador ya guardado (datos propios + lista de sus hijos actuales).
    const [esIntegradorEdicion, setEsIntegradorEdicion] = useState(false);
    const [hijosExistentes, setHijosExistentes] = useState<HijoExistente[]>([]);
    // Borrador local: aviso de recuperación, estado de "revisado" y última vez que se guardó automáticamente.
    const [borradorPendiente, setBorradorPendiente] = useState<BorradorGuardado<BorradorPCreation> | null>(null);
    const [borradorRevisado, setBorradorRevisado] = useState(false);
    const [ultimoGuardado, setUltimoGuardado] = useState<string | null>(null);
    const [pasoPendiente, setPasoPendiente] = useState<PasoKey | null>(null);
    const [hayAvance, setHayAvance] = useState(false);
    const libroGeneral = useRef<LibroProyecto>({});
    const libroCaja = useRef<LibroProyecto>({});
    // Integradores creados antes del cambio pueden tener OKR y objetivo principal: al editarlos se conservan tal cual.
    const cajaLegado = useRef<{ codigoOkr: number | null; objetivoPrincipal: string }>({ codigoOkr: null, objetivoPrincipal: '' });

    const form = useForm<ProyectoWizardValues>({
        resolver: zodResolver(proyectoWizardSchema),
        defaultValues: defaultWizardValues,
    });
    // Datos del proyecto de caja (proyecto padre).
    const formCaja = useForm<CajaWizardValues>({
        resolver: zodResolver(cajaWizardSchema),
        defaultValues: defaultCajaValues,
    });
    const formActivo = form;
    // En edición: ¿hay cambios sin guardar respecto a lo cargado?
    const { isDirty: formSucio } = useFormState({ control: form.control });
    const { isDirty: cajaSucio } = useFormState({ control: formCaja.control });

    useEffect(() => {
        const loadCatalogs = async () => {
            setIsLoadingCatalogs(true);
            try {
                // Resiliente: si un catálogo falla (p. ej. /api/proyecto da 500), los demás igual cargan.
                const nombresCatalogo = ['procesos', 'tipos de proyecto', 'responsables', 'estados', 'personas', 'proyectos', 'proceso_solicitud', 'tipos de recurso', 'recursos', 'pilares estratégicos', 'OKR', 'solicitudes'];
                const results = await Promise.allSettled([
                    procesoService.getAll(),
                    tipoProyectoService.getAll(),
                    responsableService.getAll(),
                    estadoService.getAll(),
                    serviciosService.getInformacionPersonas(),
                    proyectoService.getAll(),
                    areaSolicitudService.getAll(),
                    tipoRecursoService.getAll(),
                    recursoService.getAll(),
                    pilarEstrategicoService.getAll(),
                    okrService.getAll(),
                    solicitudService.getAll(),
                ]);
                const asData = (r: PromiseSettledResult<{ data?: any[] }>) => (r.status === 'fulfilled' ? r.value : { data: [] });
                const [areasResp, tiposResp, responsablesResp, estadosResp, personasResp, proyectosResp, areaSolResp, tiposRecResp, recursosResp, pilaresResp, okrsResp, solicitudesCatResp] = results.map(asData);

                const fallidos = results
                    .map((r, i) => (r.status === 'rejected' ? nombresCatalogo[i] : null))
                    .filter(Boolean);
                if (fallidos.length > 0) {
                    toast({
                        title: 'Algunos catálogos no se cargaron',
                        description: `No se pudieron cargar: ${fallidos.join(', ')}. Revisa el backend de esos endpoints.`,
                        variant: 'destructive',
                    });
                }

                setAreas(procesosVigentes(areasResp.data || []));
                setTiposProyecto((tiposResp.data || []).filter((t) => t.estado === 'A'));
                setResponsables(responsablesResp.data || []);
                setEstados(estadosResp.data || []);
                setTiposRecurso(tiposRecResp.data || []);
                setRecursos((recursosResp.data || []).filter((r) => r.estado === 'A'));
                setPersonas(personasResp.data || []);
                setAreaSolicitudes(areaSolResp.data || []);
                // Se guardan todos (también inactivos) para poder mostrar el OKR ya asignado al editar.
                setPilares(pilaresResp.data || []);
                setOkrs(okrsResp.data || []);

                const todosProyectos = proyectosResp.data || [];
                const codigoProyectoNum = editCodigoProyecto ? Number(editCodigoProyecto) : null;
                setProyectosPadre(
                    todosProyectos.filter((p) => !p.codigo_padre && p.estado === 'A' && p.codigo_proyecto !== codigoProyectoNum)
                );
                // Integradores existentes, para retomarlos desde el primer paso (los más recientes primero).
                const solicitudesCaja = new Set(((solicitudesCatResp.data || []) as Solicitud[]).filter((sol) => !!sol.proyecto_caja).map((sol) => sol.codigo_solicitud));
                setIntegradores(
                    (todosProyectos as Proyecto[])
                        .filter((p) => p.estado === 'A' && !p.codigo_padre && solicitudesCaja.has(p.codigo_solicitud))
                        .sort((a, b) => b.codigo_proyecto - a.codigo_proyecto)
                        .map((p) => ({
                            codigo: p.codigo_proyecto,
                            nombre: p.nombre_proyecto,
                            inicio: fechaISO(p.fecha_inicio),
                            fin: fechaISO(p.fecha_fin),
                            hijos: (todosProyectos as Proyecto[]).filter((h) => h.codigo_padre === p.codigo_proyecto && h.estado === 'A').length,
                        }))
                );

                // Creación desde "Proyectos por Tipo": deja el tipo ya seleccionado.
                if (!codigoProyectoNum && tipoInicial && Number(tipoInicial) > 0) {
                    form.setValue('codigo_tipo_proyecto', Number(tipoInicial));
                }

                // Agregar un hijo a un Proyecto Integrador existente: el padre queda fijo.
                if (!codigoProyectoNum && codigoPadreParam) {
                    if (!todosProyectos.some((p) => p.codigo_proyecto === codigoPadreParam)) {
                        toast({ title: "Proyecto no encontrado", description: "No se encontró el Proyecto Integrador al que quieres agregar un hijo.", variant: "destructive" });
                        router.push('/dashboard/opciones/proyectos');
                        return;
                    }
                    form.setValue('codigo_padre', codigoPadreParam);
                }

                if (codigoProyectoNum) {
                    const proyectoExistente = todosProyectos.find((p) => p.codigo_proyecto === codigoProyectoNum);
                    if (!proyectoExistente) {
                        toast({ title: "Proyecto no encontrado", description: "No se pudo cargar el proyecto a editar.", variant: "destructive" });
                        router.push('/dashboard/opciones/proyectos');
                        return;
                    }

                    // Proyecto Integrador (proyecto de caja): se edita con su propio formulario (datos y fechas).
                    const esIntegrador = ((solicitudesCatResp.data || []) as Solicitud[]).some((sol) => sol.codigo_solicitud === proyectoExistente.codigo_solicitud && !!sol.proyecto_caja);
                    if (esIntegrador) {
                        cajaLegado.current = { codigoOkr: proyectoExistente.codigo_okr ?? null, objetivoPrincipal: proyectoExistente.objetivo_principal || '' };
                        const inicioCaja = fechaISO(proyectoExistente.fecha_inicio);
                        const finCaja = fechaISO(proyectoExistente.fecha_fin);
                        setEsIntegradorEdicion(true);
                        setHijosExistentes(
                            todosProyectos
                                .filter((p) => p.codigo_padre === codigoProyectoNum && p.estado === 'A')
                                .map((p) => ({ codigo: p.codigo_proyecto, nombre: p.nombre_proyecto, inicio: fechaISO(p.fecha_inicio), fin: fechaISO(p.fecha_fin) }))
                        );
                        setEditContext({
                            codigoProyecto: codigoProyectoNum,
                            codigoSolicitud: proyectoExistente.codigo_solicitud,
                            codigoAreaSolicitud: 0,
                            proyectoEstado: proyectoExistente.estado,
                            actividadCodigosOriginales: [],
                            actividadEstadoMap: new Map(),
                            actividadPadreMap: new Map(),
                            resultadoCodigosOriginales: [],
                            proyectoRecursoCodigosOriginales: [],
                            objetivoCodigosOriginales: [],
                            fechaInicioOriginal: inicioCaja,
                            fechaFinOriginal: finCaja,
                        });
                        formCaja.reset({
                            nombre_proyecto: proyectoExistente.nombre_proyecto,
                            descripcion_proyecto: proyectoExistente.descripcion_proyecto,
                            responsable_proyecto: proyectoExistente.responsable_proyecto,
                            fecha_inicio: inicioCaja,
                            fecha_fin: finCaja,
                        });
                        setCurrentStep(1);
                        return;
                    }

                    const [areaSolicitudesResp, actividadesResp, resultadosResp, proyRecResp, objetivosResp] = await Promise.all([
                        areaSolicitudService.getAll(),
                        actividadService.getAll(),
                        resultadoService.getAll(),
                        proyectoRecursoService.getAll(),
                        // Objetivos del proyecto (POST /api/objetivo/buscar). Si falla, el resto del proyecto igual carga.
                        objetivoService.getByProyecto(codigoProyectoNum).catch(() => ({ data: [] as Objetivo[] })),
                    ]);
                    const objetivosProyecto = (objetivosResp.data || []).filter((o) => o.estado === 'A');

                    const resultadosEsperados = (resultadosResp.data || []).filter(
                        (r) => r.codigo_proyecto === codigoProyectoNum && normalize(r.categoria_resultado || '').includes('esper')
                    );

                    // Recursos ya asignados al proyecto (para precargar el paso de recursos).
                    const recursoCatMap = new Map((recursosResp.data || []).map((r) => [r.codigo_recurso, r]));
                    const asignacionesProyecto = (proyRecResp.data || []).filter((pr) => pr.codigo_proyecto === codigoProyectoNum && pr.estado === 'A');
                    const recursosRows = asignacionesProyecto.map((pr) => {
                        const rec = recursoCatMap.get(pr.codigo_recurso);
                        return {
                            codigo_proyecto_recurso: pr.codigo_proyecto_recurso,
                            codigo_tipo_recurso: rec?.codigo_tipo_recurso ?? 0,
                            nombre_tipo: '',
                            proveniencia: '',
                            codigo_recurso: pr.codigo_recurso,
                            nombre_recurso: '',
                            costo: '',
                            valor_recurso: pr.valor_recurso ?? '',
                        };
                    });

                    const areaSolicitudExistente = (areaSolicitudesResp.data || [])
                        .filter((as) => as.codigo_solicitud === proyectoExistente.codigo_solicitud && as.estado === 'A')
                        .sort((a, b) => new Date(b.fecha_modificacion).getTime() - new Date(a.fecha_modificacion).getTime())[0];

                    const actividadesExistentes = (actividadesResp.data || []).filter((a) => a.codigo_proyecto === codigoProyectoNum);
                    const principales = actividadesPrincipales(actividadesExistentes);
                    const hijos_ = hijosPorPadre(actividadesExistentes);

                    const fechaInicioOriginal = fechaISO(proyectoExistente.fecha_inicio);
                    const fechaFinOriginal = fechaISO(proyectoExistente.fecha_fin);

                    setEditContext({
                        codigoProyecto: codigoProyectoNum,
                        codigoSolicitud: proyectoExistente.codigo_solicitud,
                        codigoAreaSolicitud: areaSolicitudExistente?.codigo_proceso_solicitud ?? 0,
                        proyectoEstado: proyectoExistente.estado,
                        actividadCodigosOriginales: actividadesExistentes.map((a) => a.codigo_actividad),
                        actividadEstadoMap: new Map(actividadesExistentes.map((a) => [a.codigo_actividad, a.estado_actividad])),
                        actividadPadreMap: new Map(actividadesExistentes.map((a) => [a.codigo_actividad, a.codigo_actividad_padre ?? null])),
                        resultadoCodigosOriginales: resultadosEsperados.map((r) => r.codigo_resultado),
                        proyectoRecursoCodigosOriginales: asignacionesProyecto.map((pr) => pr.codigo_proyecto_recurso),
                        objetivoCodigosOriginales: objetivosProyecto.map((o) => o.codigo_objetivo),
                        fechaInicioOriginal,
                        fechaFinOriginal,
                    });

                    form.reset({
                        codigo_proceso: areaSolicitudExistente?.codigo_proceso ?? 0,
                        codigo_padre: proyectoExistente.codigo_padre || 0,
                        codigo_tipo_proyecto: proyectoExistente.codigo_tipo_proyecto,
                        codigo_okr: proyectoExistente.codigo_okr || 0,
                        codigo_pilar: ((okrsResp.data || []) as Okr[]).find((o) => o.codigo_okr === proyectoExistente.codigo_okr)?.codigo_pilar ?? 0,
                        nombre_proyecto: proyectoExistente.nombre_proyecto,
                        descripcion_proyecto: proyectoExistente.descripcion_proyecto,
                        responsable_proyecto: proyectoExistente.responsable_proyecto,
                        objetivo_principal: proyectoExistente.objetivo_principal,
                        resultados_esperados: resultadosEsperados.map((r) => ({ codigo_resultado: r.codigo_resultado, descripcion_resultado: r.descripcion_resultado })),
                        objetivos: objetivosProyecto.map((o) => ({ codigo_objetivo: o.codigo_objetivo, descripcion_objetivo: o.descripcion_objetivo })),
                        recursos: recursosRows,
                        fecha_inicio: fechaInicioOriginal,
                        fecha_fin: fechaFinOriginal,
                        actividades: principales.length > 0
                            ? principales.map((a) => {
                                const hijos = hijos_.get(a.codigo_actividad) || [];
                                const aParticipante = (fila: Actividad) => ({
                                    codigo_actividad: fila.codigo_actividad,
                                    codigo_responsable: fila.codigo_responsable,
                                    fecha_inicio_actividad: fechaISO(fila.fecha_inicio_actividad),
                                    fecha_fin_actividad: fechaISO(fila.fecha_fin_actividad),
                                    peso_actividad: Number(fila.peso_actividad) || 0,
                                });
                                // Tarea: individual (la fila es del propio participante; codigo_actividad de la tarea
                                // queda en 0) o compartida (la fila es el contenedor y sus hijos con el MISMO nombre son
                                // las participaciones). Los hijos con nombre propio son subactividades.
                                const aTarea = (fila: Actividad, hs: Actividad[]) => ({
                                    codigo_actividad: hs.length > 0 ? fila.codigo_actividad : 0,
                                    nombre_actividad: fila.nombre_actividad,
                                    descripcion_actividad: fila.descripcion_actividad,
                                    fecha_inicio_actividad: fechaISO(fila.fecha_inicio_actividad),
                                    fecha_fin_actividad: fechaISO(fila.fecha_fin_actividad),
                                    participantes: hs.length > 0 ? hs.map(aParticipante) : [aParticipante(fila)],
                                });
                                const participaciones = hijos.filter((h) => esParticipacion(h, a));
                                const subs = hijos.filter((h) => !esParticipacion(h, a))
                                    .sort((x, y) => fechaISO(x.fecha_inicio_actividad).localeCompare(fechaISO(y.fecha_inicio_actividad)));
                                if (subs.length === 0) return { ...aTarea(a, participaciones), subactividades: [] };
                                return {
                                    codigo_actividad: a.codigo_actividad,
                                    nombre_actividad: a.nombre_actividad,
                                    descripcion_actividad: a.descripcion_actividad,
                                    fecha_inicio_actividad: fechaISO(a.fecha_inicio_actividad),
                                    fecha_fin_actividad: fechaISO(a.fecha_fin_actividad),
                                    participantes: [],
                                    subactividades: subs.map((sub) => aTarea(sub, (hijos_.get(sub.codigo_actividad) || []).filter((h) => esParticipacion(h, sub)))),
                                };
                            })
                            : [{ ...defaultActividad, participantes: [{ ...defaultParticipante }] }],
                    });
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "No se pudieron cargar los catálogos.";
                toast({ title: "Error al cargar catálogos", description: errorMessage, variant: "destructive" });
            } finally {
                setIsLoadingCatalogs(false);
            }
        };
        loadCatalogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toast, editCodigoProyecto, tipoInicial, codigoPadreParam, router]);

    const estadoCreacion = useMemo(() => {
        return estados.find((e) => {
            const nombre = normalize(e.nombre_estado || '');
            return nombre.includes('creacion') && nombre.includes('proyecto');
        }) || null;
    }, [estados]);

    // Proceso (codigo_proceso) de cada posible proyecto padre, para exigir que hijo y padre sean de la misma proceso.
    const areaPorProyectoPadre = useMemo(() => {
        const mapa = resolverAreaPorProyecto(proyectosPadre, areaSolicitudes, areas);
        const res = new Map<number, number | null>();
        proyectosPadre.forEach((p) => res.set(p.codigo_proyecto, mapa.get(p.codigo_proyecto)?.codigo_proceso ?? null));
        return res;
    }, [proyectosPadre, areaSolicitudes, areas]);

    // Estado inicial de la solicitud: un proyecto nuevo nace "Pendiente de aprobación".
    const estadoPendiente = useMemo(() => {
        return estados.find((e) => {
            const nombre = normalize(e.nombre_estado || '');
            return nombre.includes('pendiente') && nombre.includes('aprob');
        }) || null;
    }, [estados]);

    // Pasos del flujo actual (según edición, tipo de solicitud y si se agrega un hijo a un integrador).
    const flujoActual = useMemo<PasoKey[]>(() => {
        if (esIntegradorEdicion) return FLUJO_INTEGRADOR_EDICION;
        if (isEditMode || codigoPadreParam) return FLUJO_PROYECTO;
        return ['tipo', ...(tipoSolicitud === 'caja' ? (['caja'] as PasoKey[]) : FLUJO_PROYECTO)];
    }, [esIntegradorEdicion, isEditMode, codigoPadreParam, tipoSolicitud]);
    // Proyecto hijo de un integrador (nuevo con ?padre= o uno ya guardado que se edita): cambia la ubicación de algunos campos.
    const codigoPadreForm = useWatch({ control: form.control, name: 'codigo_padre' });
    const esHijo = !!codigoPadreParam || (isEditMode && !esIntegradorEdicion && !!codigoPadreForm);
    const steps = flujoActual.map((k, i) => ({ id: i + 1, ...INFO_PASOS[k] }));
    const pasoFinal = flujoActual.length;
    const pasoKey: PasoKey = flujoActual[currentStep - 1] ?? flujoActual[0];

    // ---------------------------------------------------------------------------------------------------------
    // Borrador local y protección de salida. El avance se conserva en el navegador (por si vence la sesión, se
    // recarga la página o se sale por accidente) y se pide confirmación antes de abandonar la pantalla con trabajo
    // sin guardar.
    // ---------------------------------------------------------------------------------------------------------
    const estadoRef = useRef({ tipoSolicitud, pasoKey, esIntegradorEdicion, formSucio, cajaSucio });
    estadoRef.current = { tipoSolicitud, pasoKey, esIntegradorEdicion, formSucio, cajaSucio };

    const usuarioBorrador: string | undefined = user?.usuario;
    const claveBorrador = usuarioBorrador && !codigoIntegradorVista
        ? `pcreation:${usuarioBorrador}:${isEditMode ? `editar-${editCodigoProyecto}` : codigoPadreParam ? `hijo-de-${codigoPadreParam}` : 'nuevo'}`
        : null;
    // El guardado automático arranca cuando ya se resolvió qué hacer con un borrador anterior (recuperar o descartar).
    const autosaveActivo = !!claveBorrador && borradorRevisado && !borradorPendiente;
    const autosaveRef = useRef({ clave: claveBorrador, activo: autosaveActivo });
    autosaveRef.current = { clave: claveBorrador, activo: autosaveActivo };
    // Tras guardar con éxito no debe quedar ningún borrador (ni siquiera el que se escribe al salir de la pantalla).
    const guardadoRef = useRef(false);

    const calcularHayAvance = (): boolean => {
        const e = estadoRef.current;
        if (isEditMode) return e.esIntegradorEdicion ? e.cajaSucio : e.formSucio;
        // Un proyecto que ya se creó a medias en el sistema siempre cuenta como avance pendiente.
        if (libroGeneral.current.codigoProyecto || libroCaja.current.codigoProyecto) return true;
        if (e.tipoSolicitud === 'caja') return cajaConContenido(formCaja.getValues());
        return valoresConContenido(form.getValues());
    };

    const instantaneaBorrador = (): BorradorPCreation => {
        const e = estadoRef.current;
        return {
            version: 2,
            tipoSolicitud: e.tipoSolicitud,
            pasoKey: e.pasoKey,
            form: form.getValues(),
            caja: formCaja.getValues(),
            libroGeneral: libroGeneral.current,
            libroCaja: libroCaja.current,
        };
    };

    const guardarBorradorYa = () => {
        const { clave, activo } = autosaveRef.current;
        if (!clave || !activo) return;
        if (guardadoRef.current || !calcularHayAvance()) {
            borrarBorrador(clave);
            setUltimoGuardado(null);
            return;
        }
        const guardadoEn = guardarBorrador(clave, instantaneaBorrador());
        if (guardadoEn) setUltimoGuardado(guardadoEn);
    };
    const guardarBorradorRef = useRef<() => void>(() => {});
    guardarBorradorRef.current = guardarBorradorYa;

    const temporizadorBorrador = useRef<ReturnType<typeof setTimeout> | null>(null);
    const alCambiarRef = useRef<() => void>(() => {});
    alCambiarRef.current = () => {
        setHayAvance(calcularHayAvance());
        if (temporizadorBorrador.current) clearTimeout(temporizadorBorrador.current);
        temporizadorBorrador.current = setTimeout(() => guardarBorradorRef.current(), 700);
    };

    // Cualquier cambio en los formularios actualiza el aviso de "avance sin guardar" y programa el guardado del borrador.
    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const suscripciones = ([form, formCaja] as UseFormReturn<any>[]).map((f) =>
            f.watch((_valores, info) => {
                // Una edición del usuario (no un reinicio del formulario) vuelve a habilitar el borrador tras guardar.
                if (info?.type === 'change') guardadoRef.current = false;
                alCambiarRef.current();
            })
        );
        const guardarAlSalir = () => guardarBorradorRef.current();
        window.addEventListener('beforeunload', guardarAlSalir);
        return () => {
            suscripciones.forEach((sus) => sus.unsubscribe());
            window.removeEventListener('beforeunload', guardarAlSalir);
            if (temporizadorBorrador.current) clearTimeout(temporizadorBorrador.current);
            guardarBorradorRef.current(); // no se pierde lo último escrito al salir de la pantalla
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        alCambiarRef.current();
    }, [tipoSolicitud, currentStep, formSucio, cajaSucio, esIntegradorEdicion, autosaveActivo]);

    // Al abrir la pantalla: si quedó un borrador de la vez anterior, se ofrece recuperarlo. En edición se espera a que
    // el proyecto termine de cargar.
    useEffect(() => {
        if (borradorRevisado || !claveBorrador) return;
        if (isEditMode && (isLoadingCatalogs || !editContext)) return;
        const guardado = leerBorrador<BorradorPCreation>(claveBorrador);
        if (guardado && guardado.datos?.version === 2) setBorradorPendiente(guardado);
        else if (guardado) borrarBorrador(claveBorrador);
        setBorradorRevisado(true);
    }, [borradorRevisado, claveBorrador, isEditMode, isLoadingCatalogs, editContext]);

    const recuperarBorrador = () => {
        const b = borradorPendiente?.datos;
        if (!b) return;
        if (isEditMode) {
            // Se conservan los valores originales como referencia: lo recuperado cuenta como cambios sin guardar.
            if (esIntegradorEdicion) formCaja.reset(b.caja, { keepDefaultValues: true });
            else form.reset(b.form, { keepDefaultValues: true });
        } else {
            libroGeneral.current = b.libroGeneral ?? {};
            libroCaja.current = b.libroCaja ?? {};
            setTipoSolicitud(b.tipoSolicitud);
            form.reset(b.form);
            formCaja.reset(b.caja);
        }
        setPasoPendiente(b.pasoKey);
        setBorradorPendiente(null);
        toast({ title: 'Borrador recuperado', description: 'Continúa donde lo dejaste. Recuerda guardar para que quede en el sistema.' });
    };
    const descartarBorrador = () => {
        if (claveBorrador) borrarBorrador(claveBorrador);
        setBorradorPendiente(null);
        toast({ title: 'Borrador descartado' });
    };
    // Después de recuperar, vuelve al paso en el que estaba (el flujo depende del estado recuperado).
    useEffect(() => {
        if (!pasoPendiente) return;
        const i = flujoActual.indexOf(pasoPendiente);
        if (i >= 0) setCurrentStep(i + 1);
        setPasoPendiente(null);
    }, [pasoPendiente, flujoActual]);

    // Pokayoke: recargar, "atrás", el gesto del touchpad o un clic en el menú piden confirmación si hay avance sin guardar.
    const { salidaPendiente, permanecer, salir } = useProtegerSalida(hayAvance);

    // Tras guardar con éxito: no queda borrador ni avance pendiente.
    const limpiarTrasGuardar = () => {
        guardadoRef.current = true;
        if (claveBorrador) borrarBorrador(claveBorrador);
        libroGeneral.current = {};
        libroCaja.current = {};
        setUltimoGuardado(null);
        setHayAvance(false);
    };

    // Aviso de un guardado fallido. Si fue por la sesión vencida se explica cómo seguir; en todos los casos el avance queda
    // como borrador en el navegador.
    const avisarFallo = (etapa: string, mensaje: string, extra = '') => {
        const expirada = esSesionExpirada(mensaje);
        const aSalvo = ' Tu avance quedó como borrador en este navegador: al volver puedes recuperarlo y continuar donde quedó.';
        toast({
            title: expirada ? 'Tu sesión expiró: tu avance está a salvo' : `Error al guardar ${etapa}`,
            description: expirada ? `Inicia sesión de nuevo y vuelve a esta pantalla.${aSalvo}${extra}` : `${mensaje}${extra}${aSalvo}`,
            variant: 'destructive',
        });
    };

    const handleNext = async () => {
        if (pasoKey === 'tipo') {
            if (!tipoSolicitud) {
                toast({ title: 'Elige el tipo de solicitud', description: 'Selecciona si es un Proyecto General Independiente o un Proyecto Integrador.', variant: 'destructive' });
                return;
            }
            setCurrentStep(2);
            return;
        }
        if (pasoKey === 'caja') {
            if (await formCaja.trigger()) setCurrentStep((s) => Math.min(s + 1, pasoFinal));
            return;
        }
        const campos = camposDelPaso(pasoKey, esHijo);
        const valid = campos ? await formActivo.trigger(campos) : true;
        if (valid) setCurrentStep((s) => Math.min(s + 1, pasoFinal));
    };

    const handleBack = () => setCurrentStep((s) => Math.max(s - 1, 1));

    // El formulario nunca se envía solo: ignoramos cualquier envío implícito (Enter en un campo,
    // reutilización del botón al cambiar de paso, etc.). Guardar se dispara únicamente desde el
    // clic explícito en el botón "Guardar/Actualizar Proyecto" (ver footer).
    const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
    };

    const handleGuardarClick = () => {
        formActivo.handleSubmit(onSubmit, onInvalid)();
    };

    // Al intentar guardar con campos obligatorios vacíos: avisa y salta al primer paso con error.
    const onInvalid = (errors: FieldErrors<ProyectoWizardValues>) => {
        let key: PasoKey = 'actividades';
        for (const k of flujoActual) {
            if (camposDelPaso(k, esHijo)?.some((campo) => errors[campo])) { key = k; break; }
        }
        const mensajes: Partial<Record<PasoKey, string>> = {
            recursos: 'Revisa los recursos: hay datos obligatorios marcados en rojo (tipo, recurso o cantidad).',
            actividades: esHijo
                ? 'Revisa el paso de actividades: falta la descripción, el objetivo principal, al menos un objetivo específico o datos de las actividades (marcados en rojo).'
                : 'Revisa las actividades: hay campos obligatorios marcados en rojo (nombre, descripción, fechas o responsable).',
        };
        const paso = Math.max(flujoActual.indexOf(key), 0) + 1;
        setCurrentStep(paso);
        toast({
            title: 'Faltan campos por completar',
            description: mensajes[key] || `Completa los campos obligatorios marcados en rojo en el paso ${paso} antes de guardar.`,
            variant: 'destructive',
        });
    };

    // Guarda una lista de objetivos específicos con el codigo_proyecto que devolvió el backend (nuevos = código 0) y anota en
    // cada uno el código recibido, para que un reintento los actualice en vez de duplicarlos. Los originales que se
    // quitaron se desactivan (DELETE inactiva).
    const sincronizarObjetivos = async (
        codigoProyecto: number,
        lista: { codigo_objetivo: number; descripcion_objetivo: string }[],
        originales: number[],
        usuario: string,
        now: string
    ) => {
        const vigentes = new Set<number>();
        for (const o of lista) {
            const resp = await objetivoService.save({
                codigo_objetivo: o.codigo_objetivo || 0,
                codigo_proyecto: codigoProyecto,
                descripcion_objetivo: o.descripcion_objetivo.trim(),
                estado: 'A',
                usuario_modificacion: usuario,
                fecha_modificacion: now,
            } as Objetivo);
            o.codigo_objetivo = resp.data.codigo_objetivo;
            vigentes.add(resp.data.codigo_objetivo);
        }
        for (const codigo of originales) {
            if (!vigentes.has(codigo)) await objetivoService.delete(codigo);
        }
    };

    // Funciones de guardado del detalle de un proyecto (actividades, resultado, objetivos y recursos), parametrizadas
    // por los valores del proyecto: sirven para el proyecto general y para cada hijo de una solicitud de caja.
    const crearGuardadores = (values: ProyectoWizardValues, usuario: string, now: string) => {
        // Guarda el plan respetando la jerarquía del modelo v5 y devuelve los códigos vigentes:
        // - 1 participante  → una sola fila (actividad principal, sin padre).
        // - 2-3 participantes → fila contenedora (peso 0, no se califica) + una subactividad por persona.
        // Las filas existentes se reutilizan (conservan su historial de estados) aunque la actividad
        // pase de individual a compartida o viceversa.
        const guardarActividades = async (codigoProyecto: number): Promise<Set<number>> => {
            const vigentes = new Set<number>();
            const estadoDe = (codigo?: number) =>
                (codigo && editContext?.actividadEstadoMap.get(codigo)) || estadoCreacion?.nombre_estado || '';
            const guardarFila = async (fila: {
                codigo: number; padre: number | null; responsable: number; inicio: string; fin: string; peso: number;
                nombre: string; descripcion: string;
            }) => {
                const resp = await actividadService.save({
                    codigo_actividad: fila.codigo,
                    codigo_proyecto: codigoProyecto,
                    codigo_actividad_padre: fila.padre,
                    codigo_responsable: fila.responsable,
                    nombre_actividad: fila.nombre,
                    descripcion_actividad: fila.descripcion,
                    fecha_inicio_actividad: fechaSQL(fila.inicio),
                    fecha_fin_actividad: fechaSQL(fila.fin),
                    estado_actividad: estadoDe(fila.codigo),
                    peso_actividad: String(fila.peso),
                    estado: 'A',
                    usuario_modificacion: usuario,
                    fecha_modificacion: now,
                } as Actividad);
                vigentes.add(resp.data.codigo_actividad);
                return resp.data.codigo_actividad;
            };

            // Una tarea (actividad sin subactividades o subactividad) colgando de `padre` (null = primer nivel):
            // 1 participante → una sola fila; 2-3 → fila contenedora con el nombre de la tarea + una fila por persona con ese
            // MISMO nombre (así se reconocen como participaciones y no como subactividades).
            type Tarea = { codigo_actividad?: number; nombre_actividad: string; descripcion_actividad: string; fecha_inicio_actividad: string; fecha_fin_actividad: string; participantes: ProyectoWizardValues['actividades'][number]['participantes'] };
            const guardarTarea = async (t: Tarea, padre: number | null) => {
                const participantes = t.participantes;
                if (participantes.length === 1) {
                    const p = participantes[0];
                    // Se anota el código recibido: si hay que reintentar, la fila se actualiza en vez de duplicarse.
                    p.codigo_actividad = await guardarFila({
                        codigo: p.codigo_actividad || 0,
                        padre,
                        responsable: p.codigo_responsable,
                        inicio: t.fecha_inicio_actividad,
                        fin: t.fecha_fin_actividad,
                        peso: p.peso_actividad,
                        nombre: t.nombre_actividad,
                        descripcion: t.descripcion_actividad,
                    });
                    return;
                }
                const codigoTarea = await guardarFila({
                    codigo: t.codigo_actividad || 0,
                    padre,
                    responsable: participantes[0].codigo_responsable,
                    inicio: t.fecha_inicio_actividad,
                    fin: t.fecha_fin_actividad,
                    peso: 0,
                    nombre: t.nombre_actividad,
                    descripcion: t.descripcion_actividad,
                });
                t.codigo_actividad = codigoTarea;
                for (const p of participantes) {
                    p.codigo_actividad = await guardarFila({
                        codigo: p.codigo_actividad || 0,
                        padre: codigoTarea,
                        responsable: p.codigo_responsable,
                        inicio: p.fecha_inicio_actividad || t.fecha_inicio_actividad,
                        fin: p.fecha_fin_actividad || t.fecha_fin_actividad,
                        peso: p.peso_actividad,
                        nombre: t.nombre_actividad,
                        descripcion: t.descripcion_actividad,
                    });
                }
            };

            for (const actividad of values.actividades) {
                const subs = actividad.subactividades ?? [];
                if (subs.length === 0) {
                    await guardarTarea(actividad, null);
                    continue;
                }
                // Actividad con subactividades: fila contenedora (sin peso; responsable = el primero de sus subactividades,
                // porque la base exige uno) y cada subactividad colgando de ella con su propio nombre.
                const codigoActividad = await guardarFila({
                    codigo: actividad.codigo_actividad || 0,
                    padre: null,
                    responsable: subs[0].participantes[0]?.codigo_responsable,
                    inicio: actividad.fecha_inicio_actividad,
                    fin: actividad.fecha_fin_actividad,
                    peso: 0,
                    nombre: actividad.nombre_actividad,
                    descripcion: actividad.descripcion_actividad,
                });
                actividad.codigo_actividad = codigoActividad;
                for (const sub of subs) await guardarTarea(sub, codigoActividad);
            }
            return vigentes;
        };

        // Guarda los "resultados esperados": una fila de la tabla resultado (categoría "Esperado") por cada uno, con el
        // codigo_proyecto que devolvió el backend. En edición se eliminan los que se quitaron.
        const guardarResultadosEsperados = async (codigoProyecto: number) => {
            const vigentes = new Set<number>();
            for (const r of values.resultados_esperados || []) {
                const resp = await resultadoService.save({
                    codigo_resultado: r.codigo_resultado || 0,
                    codigo_proyecto: codigoProyecto,
                    categoria_resultado: 'Esperado',
                    descripcion_resultado: r.descripcion_resultado.trim(),
                    evaluador_asignado: '',
                    cumple_propuesta: false,
                    usuario_modificacion: usuario,
                    fecha_modificacion: now,
                } as Resultado);
                r.codigo_resultado = resp.data.codigo_resultado;
                vigentes.add(resp.data.codigo_resultado);
            }
            if (editContext) {
                for (const codigo of editContext.resultadoCodigosOriginales) {
                    if (!vigentes.has(codigo)) await resultadoService.delete(codigo);
                }
            }
        };

        // Guarda los objetivos específicos con el codigo_proyecto que devolvió el backend al crear/actualizar el proyecto.
        const guardarObjetivos = async (codigoProyecto: number) => {
            await sincronizarObjetivos(codigoProyecto, values.objetivos || [], editContext?.objetivoCodigosOriginales ?? [], usuario, now);
        };

        // Guarda los recursos del proyecto: crea tipos/recursos nuevos al vuelo y registra las
        // asignaciones (proyecto_recurso). En edición elimina las que se quitaron.
        const guardarRecursos = async (codigoProyecto: number) => {
            const filas = values.recursos || [];
            const vigentes = new Set<number>();

            for (const r of filas) {

                const codigoRecurso = r.codigo_recurso;

                const resp = await proyectoRecursoService.save({
                    codigo_proyecto_recurso: r.codigo_proyecto_recurso || 0,
                    codigo_recurso: codigoRecurso,
                    codigo_proyecto: codigoProyecto,
                    valor_recurso: r.valor_recurso || '0',
                    estado: 'A',
                    usuario_modificacion: usuario,
                    fecha_modificacion: now,
                } as ProyectoRecurso);
                r.codigo_proyecto_recurso = resp.data.codigo_proyecto_recurso;
                vigentes.add(resp.data.codigo_proyecto_recurso);
            }

            if (editContext) {
                for (const codigo of editContext.proyectoRecursoCodigosOriginales) {
                    if (!vigentes.has(codigo)) await proyectoRecursoService.delete(codigo);
                }
            }
        };

        return { guardarActividades, guardarResultadosEsperados, guardarObjetivos, guardarRecursos };
    };

    // Crea la solicitud, su estado inicial (Pendiente de aprobación), el proceso (si aplica) y el proyecto. Cada paso queda
    // anotado en el `libro`: si un intento falla a medias, el siguiente continúa desde ahí (el proyecto se actualiza) en
    // lugar de duplicar lo ya creado. Devuelve el codigo_proyecto de la respuesta del backend.
    const crearBase = async (d: DatosBase, libro: LibroProyecto, usuario: string, now: string, etapa: (s: string) => void): Promise<number> => {
        if (!libro.codigoSolicitud) {
            etapa('la solicitud');
            const solicitudResp = await solicitudService.save({
                codigo_solicitud: 0,
                // Modelo v6: por defecto el solicitante de la solución es el mismo usuario que crea.
                usuario_solicitante_solucion: usuario,
                // Modelo v8: solicitud de Proyecto Integrador = proyecto de caja.
                proyecto_caja: d.proyectoCaja,
                usuario_creacion: usuario,
                fecha_creacion: now,
                estado: 'A',
                usuario_modificacion: usuario,
                fecha_modificacion: now,
            } as Solicitud);
            libro.codigoSolicitud = solicitudResp.data.codigo_solicitud;
            guardarBorradorRef.current();
        }
        const codigoSolicitud = libro.codigoSolicitud;

        if (!libro.estadoHecho) {
            // El proyecto nace "Pendiente de aprobación".
            etapa('el estado de la solicitud');
            await estadoSolicitudService.save({
                codigo_estado_solicitud: 0,
                codigo_estado: estadoPendiente!.codigo_estado,
                codigo_solicitud: codigoSolicitud,
                estado: 'A',
                usuario_modificacion: usuario,
                fecha_modificacion: now,
            } as EstadoSolicitud);
            libro.estadoHecho = true;
            guardarBorradorRef.current();
        }

        // El Proyecto Integrador no lleva proceso.
        if (d.codigoProceso && !libro.areaHecha) {
            etapa('el proceso de la solicitud');
            await areaSolicitudService.save({
                codigo_proceso_solicitud: 0,
                codigo_proceso: d.codigoProceso,
                codigo_solicitud: codigoSolicitud,
                estado: 'A',
                usuario_modificacion: usuario,
                fecha_modificacion: now,
            } as AreaSolicitud);
            libro.areaHecha = true;
            guardarBorradorRef.current();
        }

        etapa('el proyecto');
        const proyectoResp = await proyectoService.save({
            codigo_proyecto: libro.codigoProyecto ?? 0,
            codigo_okr: d.codigoOkr,
            codigo_padre: d.codigoPadre,
            codigo_solicitud: codigoSolicitud,
            codigo_tipo_proyecto: d.codigoTipoProyecto,
            nombre_proyecto: d.nombre,
            descripcion_proyecto: d.descripcion,
            responsable_proyecto: d.responsable,
            fecha_inicio: fechaSQL(d.fechaInicio),
            fecha_fin: fechaSQL(d.fechaFin),
            objetivo_principal: d.objetivoPrincipal,
            estado: 'A',
            usuario_modificacion: usuario,
            fecha_modificacion: now,
        } as unknown as Proyecto);
        libro.codigoProyecto = proyectoResp.data.codigo_proyecto;
        guardarBorradorRef.current();
        return libro.codigoProyecto;
    };

    // Datos de un proyecto general (o de un hijo) para crearBase.
    const datosBaseDe = (v: ProyectoWizardValues, codigoPadre: number | null): DatosBase => ({
        codigoProceso: v.codigo_proceso,
        codigoPadre,
        proyectoCaja: false,
        codigoTipoProyecto: v.codigo_tipo_proyecto,
        codigoOkr: v.codigo_okr || null,
        nombre: v.nombre_proyecto,
        descripcion: v.descripcion_proyecto,
        responsable: v.responsable_proyecto,
        fechaInicio: v.fecha_inicio,
        fechaFin: v.fecha_fin,
        objetivoPrincipal: v.objetivo_principal,
    });

    const onSubmit = async (values: ProyectoWizardValues) => {
        if (!isEditMode && !estadoPendiente) {
            toast({
                title: "Estado no configurado",
                description: "No se encontró el estado 'Pendiente de aprobación' en el catálogo de estados. Créalo para poder enviar proyectos a aprobación.",
                variant: "destructive",
            });
            return;
        }

        setIsSaving(true);
        const usuario = user?.usuario || 'admin';
        const now = ahoraSQL();
        let stage = isEditMode ? 'el proceso de la solicitud' : 'la solicitud';

        const { guardarActividades, guardarResultadosEsperados, guardarObjetivos, guardarRecursos } = crearGuardadores(values, usuario, now);

        try {
            if (isEditMode && editContext) {
                // Actualiza el proceso de la solicitud (por si el usuario la cambió)
                await areaSolicitudService.save({
                    codigo_proceso_solicitud: editContext.codigoAreaSolicitud,
                    codigo_proceso: values.codigo_proceso,
                    codigo_solicitud: editContext.codigoSolicitud,
                    estado: 'A',
                    usuario_modificacion: usuario,
                    fecha_modificacion: now,
                } as AreaSolicitud);

                // Actualiza el proyecto
                stage = 'el proyecto';
                await proyectoService.save({
                    codigo_proyecto: editContext.codigoProyecto,
                    codigo_okr: values.codigo_okr || null,
                    codigo_padre: values.codigo_padre || null,
                    codigo_solicitud: editContext.codigoSolicitud,
                    codigo_tipo_proyecto: values.codigo_tipo_proyecto,
                    nombre_proyecto: values.nombre_proyecto,
                    descripcion_proyecto: values.descripcion_proyecto,
                    responsable_proyecto: values.responsable_proyecto,
                    fecha_inicio: fechaSQL(values.fecha_inicio),
                    fecha_fin: fechaSQL(values.fecha_fin),
                    objetivo_principal: values.objetivo_principal,
                    estado: editContext.proyectoEstado,
                    usuario_modificacion: usuario,
                    fecha_modificacion: now,
                } as Proyecto);

                stage = 'los objetivos';
                await guardarObjetivos(editContext.codigoProyecto);

                // Actualiza/crea actividades y elimina las que el usuario quitó del plan
                stage = 'las actividades';
                const codigosVigentes = await guardarActividades(editContext.codigoProyecto);
                // Elimina lo que se quitó del plan: primero subactividades, luego padres (FK autorreferencial).
                // Profundidad de cada fila (0 = primer nivel): se eliminan primero las más profundas (FK autorreferencial).
                const profundidad = (codigo: number): number => {
                    let d = 0;
                    let padre = editContext.actividadPadreMap.get(codigo);
                    while (padre != null && d < 5) { d++; padre = editContext.actividadPadreMap.get(padre); }
                    return d;
                };
                const eliminar = editContext.actividadCodigosOriginales
                    .filter((codigo) => !codigosVigentes.has(codigo))
                    .sort((a, b) => profundidad(b) - profundidad(a));
                for (const codigoOriginal of eliminar) {
                    await actividadService.delete(codigoOriginal);
                }

                stage = 'los resultados esperados';
                await guardarResultadosEsperados(editContext.codigoProyecto);

                stage = 'los recursos';
                await guardarRecursos(editContext.codigoProyecto);

                toast({
                    title: "Proyecto actualizado",
                    description: `El proyecto "${values.nombre_proyecto}" se actualizó correctamente.`,
                });
                limpiarTrasGuardar();
                // Un hijo editado desde la estructura de su integrador vuelve a ella.
                router.push(desdeEstructura && values.codigo_padre ? `${RUTA}?integrador=${values.codigo_padre}` : '/dashboard/opciones/proyectos');
                return;
            }

            // 1-4. Solicitud, estado, proceso y proyecto (el código del proyecto viene de la respuesta del backend)
            const codigoProyecto = await crearBase(datosBaseDe(values, values.codigo_padre || null), libroGeneral.current, usuario, now, (e) => { stage = e; });

            // 5. Objetivos específicos (con el codigo_proyecto de la respuesta de creación)
            stage = 'los objetivos';
            await guardarObjetivos(codigoProyecto);

            // 6. Actividades del proyecto
            stage = 'las actividades';
            await guardarActividades(codigoProyecto);

            // 6. Resultados esperados (tabla resultado)
            stage = 'los resultados esperados';
            await guardarResultadosEsperados(codigoProyecto);

            // 7. Recursos del proyecto
            stage = 'los recursos';
            await guardarRecursos(codigoProyecto);

            toast({
                title: "Proyecto creado",
                description: `El proyecto "${values.nombre_proyecto}" se creó correctamente con ${values.actividades.length} actividad(es).`,
            });

            limpiarTrasGuardar();
            form.reset(defaultWizardValues);
            // Un hijo agregado a un integrador vuelve a la estructura del integrador, para seguir agregando.
            if (codigoPadreParam) {
                router.push(`${RUTA}?integrador=${codigoPadreParam}`);
                return;
            }
            setTipoSolicitud(null);
            setCurrentStep(1);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Ocurrió un error inesperado.";
            // El backend (Sequelize) devuelve "Proyecto is not associated to Actividad!" cuando la
            // asociación Actividad→Proyecto no está definida tras migrar el modelo a v5. El registro
            // suele insertarse igual; el error ocurre al re-leerlo para devolverlo. Es un arreglo
            // del backend proyectosBA, no del frontend.
            const esAsociacionBackend = /is not associated/i.test(errorMessage);
            // Se conservan los códigos de lo que ya se creó (un reintento actualiza en vez de duplicar) y el borrador.
            form.reset(values, isEditMode ? { keepDefaultValues: true } : undefined);
            guardarBorradorRef.current();
            avisarFallo(
                stage,
                esAsociacionBackend
                    ? 'El servidor no pudo devolver la actividad con su proyecto asociado (falta definir la asociación Actividad→Proyecto en el backend proyectosBA). Es posible que el registro se haya guardado parcialmente; revisa la base. Este arreglo es del backend.'
                    : errorMessage
            );
        } finally {
            setIsSaving(false);
        }
    };

    // Fase 1 del Proyecto Integrador: crea el proyecto padre (proyecto_caja = true, sin proceso ni tipo) con sus objetivos.
    // Al terminar se abre su estructura (fase 2), donde se agregan los hijos. Si un intento falla a medias, el siguiente
    // continúa donde quedó (lo ya guardado se actualiza, no se duplica).
    const handleGuardarCaja = async () => {
        if (!(await formCaja.trigger())) {
            setCurrentStep(flujoActual.indexOf('caja') + 1);
            toast({ title: 'Faltan campos por completar', description: 'Completa los campos obligatorios marcados en rojo antes de crear el Proyecto Integrador.', variant: 'destructive' });
            return;
        }
        if (!estadoPendiente) {
            toast({
                title: "Estado no configurado",
                description: "No se encontró el estado 'Pendiente de aprobación' en el catálogo de estados. Créalo para poder enviar proyectos a aprobación.",
                variant: "destructive",
            });
            return;
        }

        setIsSaving(true);
        const usuario = user?.usuario || 'admin';
        const now = ahoraSQL();
        let etapa = 'la solicitud del Proyecto Integrador';
        // Copia editable: los códigos que devuelve el backend se anotan aquí y, si hay un fallo, se vuelven a poner en el formulario.
        const caja = JSON.parse(JSON.stringify(formCaja.getValues())) as CajaWizardValues;
        try {
            const codigoCaja = await crearBase({
                codigoProceso: null,
                codigoPadre: null,
                proyectoCaja: true,
                codigoTipoProyecto: null,
                codigoOkr: null,
                nombre: caja.nombre_proyecto,
                descripcion: caja.descripcion_proyecto,
                responsable: caja.responsable_proyecto,
                fechaInicio: caja.fecha_inicio,
                fechaFin: caja.fecha_fin,
                // El integrador no tiene objetivos ni resultados propios: sus resultados esperados son los de sus hijos.
                objetivoPrincipal: '',
            }, libroCaja.current, usuario, now, (e) => { etapa = `${e} del Proyecto Integrador`; });

            toast({
                title: 'Proyecto Integrador creado',
                description: `"${caja.nombre_proyecto}" quedó pendiente de aprobación. Ahora agrégale sus proyectos hijos.`,
            });
            limpiarTrasGuardar();
            formCaja.reset(defaultCajaValues);
            setTipoSolicitud(null);
            setCurrentStep(1);
            router.push(`${RUTA}?integrador=${codigoCaja}`);
        } catch (error) {
            const mensaje = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
            // Se vuelven a poner en el formulario los códigos ya recibidos, para que el reintento continúe sin duplicar.
            formCaja.reset(caja);
            guardarBorradorRef.current();
            avisarFallo(etapa, mensaje, libroCaja.current.codigoProyecto ? ' El Proyecto Integrador ya existe en el sistema; al reintentar se completa lo que faltó.' : '');
        } finally {
            setIsSaving(false);
        }
    };

    // Edición de un Proyecto Integrador ya guardado: actualiza sus datos, fechas y objetivos. Los hijos se agregan aparte.
    const handleActualizarCaja = async () => {
        if (!editContext) return;
        if (!(await formCaja.trigger())) return;
        const caja = JSON.parse(JSON.stringify(formCaja.getValues())) as CajaWizardValues;
        // El rango del integrador debe seguir cubriendo a sus hijos actuales.
        if (hijosExistentes.length > 0) {
            const desde = hijosExistentes.map((h) => h.inicio).sort()[0];
            const hasta = hijosExistentes.map((h) => h.fin).sort().slice(-1)[0];
            if (caja.fecha_inicio > desde || caja.fecha_fin < hasta) {
                toast({
                    title: 'Las fechas no cubren a los hijos',
                    description: `El Proyecto Integrador debe cubrir las fechas de sus hijos actuales (${formatearFecha(desde)} - ${formatearFecha(hasta)}).`,
                    variant: 'destructive',
                });
                return;
            }
        }

        setIsSaving(true);
        const usuario = user?.usuario || 'admin';
        const now = ahoraSQL();
        let etapa = 'el Proyecto Integrador';
        try {
            await proyectoService.save({
                codigo_proyecto: editContext.codigoProyecto,
                codigo_okr: cajaLegado.current.codigoOkr,
                codigo_padre: null,
                codigo_solicitud: editContext.codigoSolicitud,
                codigo_tipo_proyecto: null,
                nombre_proyecto: caja.nombre_proyecto,
                descripcion_proyecto: caja.descripcion_proyecto,
                responsable_proyecto: caja.responsable_proyecto,
                fecha_inicio: fechaSQL(caja.fecha_inicio),
                fecha_fin: fechaSQL(caja.fecha_fin),
                objetivo_principal: cajaLegado.current.objetivoPrincipal,
                estado: editContext.proyectoEstado,
                usuario_modificacion: usuario,
                fecha_modificacion: now,
            } as unknown as Proyecto);

            toast({ title: 'Proyecto Integrador actualizado', description: `"${caja.nombre_proyecto}" se actualizó correctamente.` });
            limpiarTrasGuardar();
            router.push(desdeEstructura ? `${RUTA}?integrador=${editContext.codigoProyecto}` : '/dashboard/opciones/proyectos');
        } catch (error) {
            const mensaje = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
            formCaja.reset(caja, { keepDefaultValues: true });
            guardarBorradorRef.current();
            avisarFallo(etapa, mensaje);
        } finally {
            setIsSaving(false);
        }
    };

    const formDelPaso = (pasoKey === 'caja' ? formCaja : formActivo) as unknown as UseFormReturn<ProyectoWizardValues>;
    const nombreDelPadre = codigoPadreParam ? (proyectosPadre.find((p) => p.codigo_proyecto === codigoPadreParam)?.nombre_proyecto ?? '') : '';
    const horaGuardado = ultimoGuardado ? new Date(ultimoGuardado).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : null;
    const borradorConProyectoCreado = !!(borradorPendiente?.datos.libroGeneral?.codigoProyecto || borradorPendiente?.datos.libroCaja?.codigoProyecto);

    // Integrador cuya estructura se puede retomar desde este formulario: el padre del hijo que se crea o edita, o el propio
    // integrador que se edita. Si se llegó desde la estructura, se ofrece volver a ella.
    const padreDelForm = form.watch('codigo_padre');
    const integradorDeVuelta = codigoPadreParam ?? (esIntegradorEdicion ? editContext?.codigoProyecto ?? null : desdeEstructura && padreDelForm ? padreDelForm : null);

    const accionFinal = pasoKey === 'caja' ? (esIntegradorEdicion ? handleActualizarCaja : handleGuardarCaja) : handleGuardarClick;
    const etiquetaFinal = esIntegradorEdicion
        ? 'Actualizar Proyecto Integrador'
        : isEditMode
            ? 'Actualizar Proyecto'
            : pasoKey === 'caja' ? 'Crear Proyecto Integrador' : codigoPadreParam ? 'Guardar proyecto hijo' : 'Guardar Proyecto';

    // Fase 2: estructura en cascada del integrador. Agregar o editar un hijo abre el flujo general dentro de este mismo menú.
    if (codigoIntegradorVista) {
        return (
            <div className="flex flex-col gap-4 p-4 md:p-6">
                <EstructuraIntegrador
                    codigoIntegrador={codigoIntegradorVista}
                    personas={personas}
                    pilares={pilares}
                    okrs={okrs}
                    onAgregarHijo={() => router.push(`${RUTA}?padre=${codigoIntegradorVista}`)}
                    onEditarIntegrador={() => router.push(`${RUTA}?codigo_proyecto=${codigoIntegradorVista}&origen=estructura`)}
                    onEditarHijo={(codigo) => router.push(`${RUTA}?codigo_proyecto=${codigo}&origen=estructura`)}
                    onVolver={() => router.push(RUTA)}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 p-4 md:p-6">
            {borradorPendiente && (
                <BorradorBanner
                    guardadoEn={borradorPendiente.guardadoEn}
                    continuaGuardado={borradorConProyectoCreado}
                    onRecuperar={recuperarBorrador}
                    onDescartar={descartarBorrador}
                />
            )}

            <Card>
                <CardHeader className="gap-2">
                    {integradorDeVuelta && (
                        // Enlace tipo "migas" arriba del título (no botón): pasa por la protección de salida si hay avance sin guardar.
                        <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground hover:text-foreground">
                            <Link href={`${RUTA}?integrador=${integradorDeVuelta}`}><ArrowLeft className="mr-2 h-4 w-4" /><Network className="mr-1.5 h-4 w-4" /> Volver a la estructura</Link>
                        </Button>
                    )}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                        <div className="min-w-0 flex-1 space-y-1.5">
                            <CardTitle>
                                {esIntegradorEdicion
                                    ? 'Editar Proyecto Integrador'
                                    : isEditMode
                                        ? 'Editar Proyecto'
                                        : codigoPadreParam
                                            ? 'Nuevo proyecto hijo'
                                            : tipoSolicitud === 'caja' ? 'Creación de Proyecto Integrador' : 'Creación de Proyecto'}
                            </CardTitle>
                            <CardDescription>
                                {esIntegradorEdicion
                                    ? 'Actualiza los datos, las fechas, la alineación y los objetivos del Proyecto Integrador.'
                                    : isEditMode
                                        ? 'Actualiza el proceso, las propiedades del proyecto y su plan de actividades.'
                                        : codigoPadreParam
                                            ? `Se crea como hijo del Proyecto Integrador "${nombreDelPadre}". Sus fechas deben quedar dentro de las del integrador. Al guardar vuelves a su estructura.`
                                            : tipoSolicitud === 'caja'
                                                ? 'Fase 1 de 2: define el Proyecto Integrador. Al crearlo se abre su estructura para agregarle los proyectos hijos.'
                                                : 'Define el proceso, las propiedades del proyecto y sus actividades en un solo flujo.'}
                            </CardDescription>
                        </div>
                        {horaGuardado && (
                            <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:pt-1.5" title="Tu avance se guarda solo en este navegador mientras trabajas">
                                <Save className="h-3.5 w-3.5" /> Borrador guardado automáticamente · {horaGuardado}
                            </span>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <StepperHeader steps={steps} currentStep={currentStep} />
                </CardContent>
            </Card>

            <Form {...formDelPaso}>
                <form onSubmit={handleFormSubmit}>
                    <Card>
                        {pasoKey === 'tipo' && (
                            <StepTipoSolicitud
                                value={tipoSolicitud}
                                onChange={setTipoSolicitud}
                                integradores={integradores}
                                onAbrirIntegrador={(codigo) => router.push(`${RUTA}?integrador=${codigo}`)}
                            />
                        )}
                        {pasoKey === 'caja' && (
                            <StepCaja
                                form={formCaja}
                                personas={personas}
                                isLoading={isLoadingCatalogs}
                                isEditMode={esIntegradorEdicion}
                                hijosExistentes={hijosExistentes}
                            />
                        )}
                        {pasoKey === 'proceso' && <StepArea form={formActivo} areas={areas} isLoading={isLoadingCatalogs} />}
                        {pasoKey === 'proyecto' && (
                            <StepProyecto
                                form={formActivo}
                                tiposProyecto={tiposProyecto}
                                proyectosPadre={proyectosPadre}
                                areaPorProyectoPadre={areaPorProyectoPadre}
                                personas={personas}
                                pilares={pilares}
                                okrs={okrs}
                                isLoading={isLoadingCatalogs}
                                isEditMode={isEditMode}
                                esHijo={esHijo}
                            />
                        )}
                        {pasoKey === 'recursos' && <StepRecursos form={formActivo} tiposRecurso={tiposRecurso} recursos={recursos} isLoading={isLoadingCatalogs} />}
                        {pasoKey === 'actividades' && (
                            <StepActividades
                                form={formActivo}
                                responsables={responsables}
                                personas={personas}
                                isLoading={isLoadingCatalogs}
                                editOriginalFechas={editContext ? { fecha_inicio: editContext.fechaInicioOriginal, fecha_fin: editContext.fechaFinOriginal } : null}
                                titulo={esHijo ? 'Objetivos y Plan de Actividades' : undefined}
                                bloqueSuperior={esHijo ? (
                                    // Proyecto hijo: primero qué/por qué/cómo (descripción y objetivos) y luego el plan que lo cumple.
                                    <div className="mb-2 flex flex-col gap-4">
                                        <ChecklistPasoActividades form={formActivo} />
                                        <ImportarExcel form={formActivo} responsables={responsables} personas={personas} />
                                        <SeccionFormulario icono={FileText} numero={1} titulo="Descripción y objetivos del proyecto" ayuda="Qué abarca, para qué se hace y cómo se logra. Se pide al menos un objetivo específico.">
                                            <DescripcionObjetivos form={formActivo} objetivosRequeridos guiado />
                                        </SeccionFormulario>
                                        <div className="flex items-center gap-3 pt-2">
                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><ListChecks className="h-4 w-4" /></span>
                                            <div>
                                                <p className="text-sm font-semibold"><span className="mr-1.5 text-muted-foreground tabular-nums">2.</span>Plan de actividades</p>
                                                <p className="text-xs text-muted-foreground">Las actividades con las que se cumplen los objetivos, dentro de las fechas del proyecto.</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mb-2"><ImportarExcel form={formActivo} responsables={responsables} personas={personas} /></div>
                                )}
                            />
                        )}

                        <CardFooter className="flex justify-between">
                            <Button type="button" variant="outline" onClick={handleBack} disabled={currentStep === 1 || isSaving}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Anterior
                            </Button>
                            {currentStep < pasoFinal ? (
                                <Button key="siguiente" type="button" onClick={handleNext} disabled={isLoadingCatalogs}>
                                    Siguiente
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            ) : (
                                <Button key="guardar" type="button" onClick={accionFinal} disabled={isSaving || isLoadingCatalogs}>
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            {isEditMode ? 'Actualizando...' : 'Guardando...'}
                                        </>
                                    ) : (
                                        <>
                                            <Check className="mr-2 h-4 w-4" />
                                            {etiquetaFinal}
                                        </>
                                    )}
                                </Button>
                            )}
                        </CardFooter>
                    </Card>
                </form>
            </Form>

            <SalidaSinGuardarDialog abierto={salidaPendiente} onPermanecer={permanecer} onSalir={salir} />
        </div>
    );
}
