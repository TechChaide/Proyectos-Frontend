
"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import type { Area, TipoProyecto, Responsable, Estado, Solicitud, EstadoSolicitud, AreaSolicitud, Proyecto, Actividad, FichaSocialHistorica, Resultado, TipoRecurso, Recurso, ProyectoRecurso } from '@/types/interfaces';
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
import StepperHeader from './components/stepper-header';
import StepArea from './components/step-area';
import StepProyecto from './components/step-proyecto';
import StepActividades from './components/step-actividades';
import StepRecursos from './components/step-recursos';
import { proyectoWizardSchema, defaultWizardValues, defaultActividad, defaultParticipante, type ProyectoWizardValues } from './schema';
import { ahoraSQL, fechaISO, fechaSQL } from '@/lib/fechas';
import { actividadesPrincipales, hijosPorPadre } from '@/lib/actividades';
import { resolverAreaPorProyecto } from '../proyectos/area-utils';

const normalize = (value: string): string =>
    value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const steps = [
    { id: 1, title: 'Proceso', description: 'Proceso solicitante' },
    { id: 2, title: 'Proyecto', description: 'Datos del proyecto' },
    { id: 3, title: 'Recursos', description: 'Recursos del proyecto' },
    { id: 4, title: 'Actividades', description: 'Plan de actividades' },
];
const PASO_FINAL = 4;

const stepFields: Record<number, (keyof ProyectoWizardValues)[]> = {
    1: ['codigo_proceso'],
    2: ['codigo_tipo_proyecto', 'nombre_proyecto', 'descripcion_proyecto', 'responsable_proyecto', 'objetivo_principal', 'fecha_inicio', 'fecha_fin'],
    3: ['recursos'],
};

interface EditContext {
    codigoProyecto: number;
    codigoSolicitud: number;
    codigoAreaSolicitud: number;
    proyectoEstado: string;
    actividadCodigosOriginales: number[];
    actividadEstadoMap: Map<number, string>;
    actividadPadreMap: Map<number, number | null>;
    /** Resultado "Esperado" existente del proyecto (para editarlo/eliminarlo); null si no tiene. */
    codigoResultadoEsperado: number | null;
    /** Asignaciones de recurso (proyecto_recurso) originales, para eliminar las que se quiten. */
    proyectoRecursoCodigosOriginales: number[];
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

    const [currentStep, setCurrentStep] = useState(1);
    const [isSaving, setIsSaving] = useState(false);

    const [areas, setAreas] = useState<Area[]>([]);
    const [tiposProyecto, setTiposProyecto] = useState<TipoProyecto[]>([]);
    const [proyectosPadre, setProyectosPadre] = useState<Proyecto[]>([]);
    const [areaSolicitudes, setAreaSolicitudes] = useState<AreaSolicitud[]>([]);
    const [tiposRecurso, setTiposRecurso] = useState<TipoRecurso[]>([]);
    const [recursos, setRecursos] = useState<Recurso[]>([]);
    const [responsables, setResponsables] = useState<Responsable[]>([]);
    const [estados, setEstados] = useState<Estado[]>([]);
    const [personas, setPersonas] = useState<FichaSocialHistorica[]>([]);
    const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(true);
    const [editContext, setEditContext] = useState<EditContext | null>(null);

    const form = useForm<ProyectoWizardValues>({
        resolver: zodResolver(proyectoWizardSchema),
        defaultValues: defaultWizardValues,
    });

    useEffect(() => {
        const loadCatalogs = async () => {
            setIsLoadingCatalogs(true);
            try {
                // Resiliente: si un catálogo falla (p. ej. /api/proyecto da 500), los demás igual cargan.
                const nombresCatalogo = ['procesos', 'tipos de proyecto', 'responsables', 'estados', 'personas', 'proyectos', 'proceso_solicitud', 'tipos de recurso', 'recursos'];
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
                ]);
                const asData = (r: PromiseSettledResult<{ data?: any[] }>) => (r.status === 'fulfilled' ? r.value : { data: [] });
                const [areasResp, tiposResp, responsablesResp, estadosResp, personasResp, proyectosResp, areaSolResp, tiposRecResp, recursosResp] = results.map(asData);

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

                setAreas((areasResp.data || []).filter((a) => a.estado === 'A'));
                setTiposProyecto((tiposResp.data || []).filter((t) => t.estado === 'A'));
                setResponsables(responsablesResp.data || []);
                setEstados(estadosResp.data || []);
                setTiposRecurso(tiposRecResp.data || []);
                setRecursos((recursosResp.data || []).filter((r) => r.estado === 'A'));
                setPersonas(personasResp.data || []);
                setAreaSolicitudes(areaSolResp.data || []);

                const todosProyectos = proyectosResp.data || [];
                const codigoProyectoNum = editCodigoProyecto ? Number(editCodigoProyecto) : null;
                setProyectosPadre(
                    todosProyectos.filter((p) => !p.codigo_padre && p.estado === 'A' && p.codigo_proyecto !== codigoProyectoNum)
                );

                // Creación desde "Proyectos por Tipo": deja el tipo ya seleccionado.
                if (!codigoProyectoNum && tipoInicial && Number(tipoInicial) > 0) {
                    form.setValue('codigo_tipo_proyecto', Number(tipoInicial));
                }

                if (codigoProyectoNum) {
                    const proyectoExistente = todosProyectos.find((p) => p.codigo_proyecto === codigoProyectoNum);
                    if (!proyectoExistente) {
                        toast({ title: "Proyecto no encontrado", description: "No se pudo cargar el proyecto a editar.", variant: "destructive" });
                        router.push('/dashboard/opciones/proyectos');
                        return;
                    }

                    const [areaSolicitudesResp, actividadesResp, resultadosResp, proyRecResp] = await Promise.all([
                        areaSolicitudService.getAll(),
                        actividadService.getAll(),
                        resultadoService.getAll(),
                        proyectoRecursoService.getAll(),
                    ]);

                    const resultadoEsperado = (resultadosResp.data || []).find(
                        (r) => r.codigo_proyecto === codigoProyectoNum && normalize(r.categoria_resultado || '').includes('esper')
                    ) || null;

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
                        codigoResultadoEsperado: resultadoEsperado?.codigo_resultado ?? null,
                        proyectoRecursoCodigosOriginales: asignacionesProyecto.map((pr) => pr.codigo_proyecto_recurso),
                        fechaInicioOriginal,
                        fechaFinOriginal,
                    });

                    form.reset({
                        codigo_proceso: areaSolicitudExistente?.codigo_proceso ?? 0,
                        codigo_padre: proyectoExistente.codigo_padre || 0,
                        codigo_tipo_proyecto: proyectoExistente.codigo_tipo_proyecto,
                        nombre_proyecto: proyectoExistente.nombre_proyecto,
                        descripcion_proyecto: proyectoExistente.descripcion_proyecto,
                        responsable_proyecto: proyectoExistente.responsable_proyecto,
                        objetivo_principal: proyectoExistente.objetivo_principal,
                        resultados_esperados: resultadoEsperado?.descripcion_resultado ?? '',
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
                                // Actividad individual: la fila es del propio participante (codigo_actividad
                                // de la actividad queda en 0). Compartida: la fila es el contenedor padre.
                                return {
                                    codigo_actividad: hijos.length > 0 ? a.codigo_actividad : 0,
                                    nombre_actividad: a.nombre_actividad,
                                    descripcion_actividad: a.descripcion_actividad,
                                    fecha_inicio_actividad: fechaISO(a.fecha_inicio_actividad),
                                    fecha_fin_actividad: fechaISO(a.fecha_fin_actividad),
                                    participantes: hijos.length > 0 ? hijos.map(aParticipante) : [aParticipante(a)],
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
    }, [toast, editCodigoProyecto, tipoInicial, router]);

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

    const handleNext = async () => {
        const valid = await form.trigger(stepFields[currentStep]);
        if (valid) setCurrentStep((s) => Math.min(s + 1, PASO_FINAL));
    };

    const handleBack = () => setCurrentStep((s) => Math.max(s - 1, 1));

    // El formulario nunca se envía solo: ignoramos cualquier envío implícito (Enter en un campo,
    // reutilización del botón al cambiar de paso, etc.). Guardar se dispara únicamente desde el
    // clic explícito en el botón "Guardar/Actualizar Proyecto" (ver footer).
    const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
    };

    const handleGuardarClick = () => {
        form.handleSubmit(onSubmit, onInvalid)();
    };

    // Al intentar guardar con campos obligatorios vacíos: avisa y salta al primer paso con error.
    const onInvalid = (errors: FieldErrors<ProyectoWizardValues>) => {
        let paso = 4;
        if (stepFields[1].some((campo) => errors[campo])) paso = 1;
        else if (stepFields[2].some((campo) => errors[campo])) paso = 2;
        else if (errors.recursos) paso = 3;
        const mensajes: Record<number, string> = {
            3: 'Revisa los recursos: hay datos obligatorios marcados en rojo (nombre, costo o valor).',
            4: 'Revisa las actividades: hay campos obligatorios marcados en rojo (nombre, descripción, fechas o responsable).',
        };
        setCurrentStep(paso);
        toast({
            title: 'Faltan campos por completar',
            description: mensajes[paso] || `Completa los campos obligatorios marcados en rojo en el paso ${paso} antes de guardar.`,
            variant: 'destructive',
        });
    };

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

            for (const actividad of values.actividades) {
                const participantes = actividad.participantes;
                if (participantes.length === 1) {
                    const p = participantes[0];
                    await guardarFila({
                        codigo: p.codigo_actividad || 0,
                        padre: null,
                        responsable: p.codigo_responsable,
                        inicio: actividad.fecha_inicio_actividad,
                        fin: actividad.fecha_fin_actividad,
                        peso: p.peso_actividad,
                        nombre: actividad.nombre_actividad,
                        descripcion: actividad.descripcion_actividad,
                    });
                    continue;
                }
                const codigoPadre = await guardarFila({
                    codigo: actividad.codigo_actividad || 0,
                    padre: null,
                    responsable: participantes[0].codigo_responsable,
                    inicio: actividad.fecha_inicio_actividad,
                    fin: actividad.fecha_fin_actividad,
                    peso: 0,
                    nombre: actividad.nombre_actividad,
                    descripcion: actividad.descripcion_actividad,
                });
                for (const p of participantes) {
                    await guardarFila({
                        codigo: p.codigo_actividad || 0,
                        padre: codigoPadre,
                        responsable: p.codigo_responsable,
                        inicio: p.fecha_inicio_actividad || actividad.fecha_inicio_actividad,
                        fin: p.fecha_fin_actividad || actividad.fecha_fin_actividad,
                        peso: p.peso_actividad,
                        nombre: actividad.nombre_actividad,
                        descripcion: actividad.descripcion_actividad,
                    });
                }
            }
            return vigentes;
        };

        // Guarda los "resultados esperados" como un registro de la tabla resultado (categoría "Esperado").
        // Si se vació el texto y existía, se elimina; si no existía y hay texto, se crea.
        const guardarResultadoEsperado = async (codigoProyecto: number) => {
            const texto = (values.resultados_esperados || '').trim();
            const idExistente = editContext?.codigoResultadoEsperado ?? null;
            if (!texto && !idExistente) return;
            if (!texto && idExistente) {
                await resultadoService.delete(idExistente);
                return;
            }
            await resultadoService.save({
                codigo_resultado: idExistente || 0,
                codigo_proyecto: codigoProyecto,
                categoria_resultado: 'Esperado',
                descripcion_resultado: texto,
                evaluador_asignado: '',
                cumple_propuesta: false,
                usuario_modificacion: usuario,
                fecha_modificacion: now,
            } as Resultado);
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
                vigentes.add(resp.data.codigo_proyecto_recurso);
            }

            if (editContext) {
                for (const codigo of editContext.proyectoRecursoCodigosOriginales) {
                    if (!vigentes.has(codigo)) await proyectoRecursoService.delete(codigo);
                }
            }
        };

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

                // Actualiza/crea actividades y elimina las que el usuario quitó del plan
                stage = 'las actividades';
                const codigosVigentes = await guardarActividades(editContext.codigoProyecto);
                // Elimina lo que se quitó del plan: primero subactividades, luego padres (FK autorreferencial).
                const eliminar = editContext.actividadCodigosOriginales
                    .filter((codigo) => !codigosVigentes.has(codigo))
                    .sort((a, b) => Number(editContext.actividadPadreMap.get(a) == null) - Number(editContext.actividadPadreMap.get(b) == null));
                for (const codigoOriginal of eliminar) {
                    await actividadService.delete(codigoOriginal);
                }

                stage = 'los resultados esperados';
                await guardarResultadoEsperado(editContext.codigoProyecto);

                stage = 'los recursos';
                await guardarRecursos(editContext.codigoProyecto);

                toast({
                    title: "Proyecto actualizado",
                    description: `El proyecto "${values.nombre_proyecto}" se actualizó correctamente.`,
                });
                router.push('/dashboard/opciones/proyectos');
                return;
            }

            // 1. Solicitud
            const solicitudResp = await solicitudService.save({
                codigo_solicitud: 0,
                // Modelo v6: por defecto el solicitante de la solución es el mismo usuario que crea.
                usuario_solicitante_solucion: usuario,
                usuario_creacion: usuario,
                fecha_creacion: now,
                estado: 'A',
                usuario_modificacion: usuario,
                fecha_modificacion: now,
            } as Solicitud);
            const codigoSolicitud = solicitudResp.data.codigo_solicitud;

            // 2. Estado de la solicitud: el proyecto nace "Pendiente de aprobación".
            stage = 'el estado de la solicitud';
            await estadoSolicitudService.save({
                codigo_estado_solicitud: 0,
                codigo_estado: estadoPendiente!.codigo_estado,
                codigo_solicitud: codigoSolicitud,
                estado: 'A',
                usuario_modificacion: usuario,
                fecha_modificacion: now,
            } as EstadoSolicitud);

            // 3. Proceso de la solicitud
            stage = 'el proceso de la solicitud';
            await areaSolicitudService.save({
                codigo_proceso_solicitud: 0,
                codigo_proceso: values.codigo_proceso,
                codigo_solicitud: codigoSolicitud,
                estado: 'A',
                usuario_modificacion: usuario,
                fecha_modificacion: now,
            } as AreaSolicitud);

            // 4. Proyecto
            stage = 'el proyecto';
            const proyectoResp = await proyectoService.save({
                codigo_proyecto: 0,
                codigo_padre: values.codigo_padre || null,
                codigo_solicitud: codigoSolicitud,
                codigo_tipo_proyecto: values.codigo_tipo_proyecto,
                nombre_proyecto: values.nombre_proyecto,
                descripcion_proyecto: values.descripcion_proyecto,
                responsable_proyecto: values.responsable_proyecto,
                fecha_inicio: fechaSQL(values.fecha_inicio),
                fecha_fin: fechaSQL(values.fecha_fin),
                objetivo_principal: values.objetivo_principal,
                estado: 'A',
                usuario_modificacion: usuario,
                fecha_modificacion: now,
            } as Proyecto);
            const codigoProyecto = proyectoResp.data.codigo_proyecto;

            // 5. Actividades del proyecto
            stage = 'las actividades';
            await guardarActividades(codigoProyecto);

            // 6. Resultados esperados (tabla resultado)
            stage = 'los resultados esperados';
            await guardarResultadoEsperado(codigoProyecto);

            // 7. Recursos del proyecto
            stage = 'los recursos';
            await guardarRecursos(codigoProyecto);

            toast({
                title: "Proyecto creado",
                description: `El proyecto "${values.nombre_proyecto}" se creó correctamente con ${values.actividades.length} actividad(es).`,
            });

            form.reset(defaultWizardValues);
            setCurrentStep(1);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Ocurrió un error inesperado.";
            // El backend (Sequelize) devuelve "Proyecto is not associated to Actividad!" cuando la
            // asociación Actividad→Proyecto no está definida tras migrar el modelo a v5. El registro
            // suele insertarse igual; el error ocurre al re-leerlo para devolverlo. Es un arreglo
            // del backend proyectosBA, no del frontend.
            const esAsociacionBackend = /is not associated/i.test(errorMessage);
            toast({
                title: `Error al guardar ${stage}`,
                description: esAsociacionBackend
                    ? 'El servidor no pudo devolver la actividad con su proyecto asociado (falta definir la asociación Actividad→Proyecto en el backend proyectosBA). Es posible que el registro se haya guardado parcialmente; revisa la base. Este arreglo es del backend.'
                    : errorMessage,
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 p-4 md:p-6">
            <Card>
                <CardHeader>
                    <CardTitle>{isEditMode ? 'Editar Proyecto' : 'Creación de Proyecto'}</CardTitle>
                    <CardDescription>
                        {isEditMode
                            ? 'Actualiza el proceso, las propiedades del proyecto y su plan de actividades.'
                            : 'Define el proceso, las propiedades del proyecto y sus actividades en un solo flujo.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <StepperHeader steps={steps} currentStep={currentStep} />
                </CardContent>
            </Card>

            <Form {...form}>
                <form onSubmit={handleFormSubmit}>
                    <Card>
                        {currentStep === 1 && <StepArea form={form} areas={areas} isLoading={isLoadingCatalogs} />}
                        {currentStep === 2 && <StepProyecto form={form} tiposProyecto={tiposProyecto} proyectosPadre={proyectosPadre} areaPorProyectoPadre={areaPorProyectoPadre} personas={personas} isLoading={isLoadingCatalogs} isEditMode={isEditMode} />}
                        {currentStep === 3 && <StepRecursos form={form} tiposRecurso={tiposRecurso} recursos={recursos} isLoading={isLoadingCatalogs} />}
                        {currentStep === 4 && (
                            <StepActividades
                                form={form}
                                responsables={responsables}
                                personas={personas}
                                isLoading={isLoadingCatalogs}
                                editOriginalFechas={editContext ? { fecha_inicio: editContext.fechaInicioOriginal, fecha_fin: editContext.fechaFinOriginal } : null}
                            />
                        )}

                        <CardFooter className="flex justify-between">
                            <Button type="button" variant="outline" onClick={handleBack} disabled={currentStep === 1 || isSaving}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Anterior
                            </Button>
                            {currentStep < PASO_FINAL ? (
                                <Button key="siguiente" type="button" onClick={handleNext} disabled={isLoadingCatalogs}>
                                    Siguiente
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            ) : (
                                <Button key="guardar" type="button" onClick={handleGuardarClick} disabled={isSaving || isLoadingCatalogs}>
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            {isEditMode ? 'Actualizando...' : 'Guardando...'}
                                        </>
                                    ) : (
                                        <>
                                            <Check className="mr-2 h-4 w-4" />
                                            {isEditMode ? 'Actualizar Proyecto' : 'Guardar Proyecto'}
                                        </>
                                    )}
                                </Button>
                            )}
                        </CardFooter>
                    </Card>
                </form>
            </Form>
        </div>
    );
}
