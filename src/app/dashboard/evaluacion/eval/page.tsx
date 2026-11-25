
"use client";

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ClipboardCheck } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Estado, EstadoSolicitud, FichaSocialHistorica, Okr, PilarEstrategico, Proyecto, Resultado, Solicitud, TipoProyecto } from '@/types/interfaces';
import { okrService } from '@/services/proyectos/okr.service';
import { pilarEstrategicoService } from '@/services/proyectos/pilarEstrategico.service';
import { proyectoService } from '@/services/proyectos/proyecto.service';
import { tipoProyectoService } from '@/services/proyectos/tipoProyecto.service';
import { resultadoService } from '@/services/proyectos/resultado.service';
import { solicitudService } from '@/services/proyectos/solicitud.service';
import { estadoService } from '@/services/proyectos/estado.service';
import { estadoSolicitudService } from '@/services/proyectos/estadoSolicitud.service';
import { serviciosService } from '@/services/proyectos/servicios.service';
import { RUBRICAS, type SistemaCalificacion } from '@/lib/rubricas';
import { construirArbolEvaluacion, puntajesDeProyecto, type NodoEvaluacion } from '@/lib/evaluacion-proyectos';
import RubricaEvaluador, { type ResultadoParaVerificar } from './components/rubrica-evaluador';
import TablaEvaluacion from './components/tabla-evaluacion';
import { ahoraSQL } from '@/lib/fechas';

// La calificación se guarda en la tabla `resultado` (una fila por criterio), con la categoría
// marcada como "<TIPO>:<criterio>" (ej. "MR:calidad") para distinguirla de otros resultados.
const marcadorCriterio = (sistema: string, criterio: string) => `${sistema}:${criterio}`;

const normalize = (v: string): string => (v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// "Aprobado" (no "Pendiente de aprobación" ni "Rechazado").
const esAprobado = (nombreEstado: string) => normalize(nombreEstado).includes('aprob') && !normalize(nombreEstado).includes('pendiente');

// Modo de evaluación según el tipo de solicitud con que se creó el proyecto:
//  - Independiente: su nota es la de su rúbrica (MR / MSP / PI), escala 0-5.
//  - Integrador (proyecto de caja): promedio simple de la calificación de sus proyectos hijos, también sobre 5.
export default function EvaluacionPage() {
    const { user } = useAuth();
    const { toast } = useToast();

    const [proyectos, setProyectos] = useState<Proyecto[]>([]);
    const [tiposProyecto, setTiposProyecto] = useState<TipoProyecto[]>([]);
    const [resultados, setResultados] = useState<Resultado[]>([]);
    const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
    const [estados, setEstados] = useState<Estado[]>([]);
    const [estadosSolicitud, setEstadosSolicitud] = useState<EstadoSolicitud[]>([]);
    const [personas, setPersonas] = useState<FichaSocialHistorica[]>([]);
    const [okrs, setOkrs] = useState<Okr[]>([]);
    const [pilares, setPilares] = useState<PilarEstrategico[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Proyecto que se está calificando con su rúbrica (solo independientes).
    const [sistema, setSistema] = useState<SistemaCalificacion | null>(null);
    const [proyecto, setProyecto] = useState<Proyecto | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        const nombres = ['proyectos', 'tipos de proyecto', 'resultados', 'solicitudes', 'estados', 'estados de solicitud', 'personas', 'OKR', 'pilares'];
        const results = await Promise.allSettled([
            proyectoService.getAll(),
            tipoProyectoService.getAll(),
            resultadoService.getAll(),
            solicitudService.getAll(),
            estadoService.getAll(),
            estadoSolicitudService.getAll(),
            serviciosService.getInformacionPersonas(),
            okrService.getAll(),
            pilarEstrategicoService.getAll(),
        ]);
        const asData = (r: PromiseSettledResult<{ data?: any[] }>) => (r.status === 'fulfilled' ? r.value : { data: [] });
        const [proyRes, tiposRes, resultRes, solRes, estRes, estSolRes, persRes, okrRes, pilarRes] = results.map(asData);
        setProyectos(proyRes.data || []);
        setTiposProyecto(tiposRes.data || []);
        setResultados(resultRes.data || []);
        setSolicitudes(solRes.data || []);
        setEstados(estRes.data || []);
        setEstadosSolicitud(estSolRes.data || []);
        setPersonas(persRes.data || []);
        setOkrs(okrRes.data || []);
        setPilares(pilarRes.data || []);
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

    // Árbol de proyectos activos con su calificación: integradores = promedio de hijos; independientes = su rúbrica.
    const arbol = useMemo(() => {
        const tipoNombre = new Map(tiposProyecto.map((t) => [t.codigo_tipo_proyecto, t.nombre_tipo_proyecto]));
        const integrador = new Map(solicitudes.map((s) => [s.codigo_solicitud, !!s.proyecto_caja]));
        // Solo se evalúan proyectos APROBADOS: el estado vigente de la solicitud es el último registrado.
        const nombreEstado = new Map(estados.map((e) => [e.codigo_estado, e.nombre_estado]));
        const ultimo = new Map<number, EstadoSolicitud>();
        estadosSolicitud.filter((es) => es.estado === 'A').forEach((es) => {
            const actual = ultimo.get(es.codigo_solicitud);
            if (!actual || new Date(es.fecha_modificacion) > new Date(actual.fecha_modificacion)) ultimo.set(es.codigo_solicitud, es);
        });
        const aprobado = (p: Proyecto) => {
            const es = ultimo.get(p.codigo_solicitud);
            return !!es && esAprobado(nombreEstado.get(es.codigo_estado) || '');
        };
        return construirArbolEvaluacion(proyectos.filter((p) => p.estado === 'A' && aprobado(p)), tipoNombre, integrador, resultados);
    }, [proyectos, tiposProyecto, solicitudes, resultados, estados, estadosSolicitud]);

    const evaluadorDe = (p: Proyecto): string =>
        resultados.find((r) => r.codigo_proyecto === p.codigo_proyecto && r.evaluador_asignado)?.evaluador_asignado || '';

    // Los evaluadores se guardan como códigos separados por '&' (o, en datos antiguos, como texto): se muestran con nombre.
    const personaMap = useMemo(() => new Map(personas.map((p) => [p.CODIGO, p.NOMBRE])), [personas]);
    const nombresEvaluadores = (crudo: string): string =>
        crudo.split('&').map((c) => c.trim()).filter(Boolean).map((c) => personaMap.get(c) || c).join(', ');

    // "Pilar › OKR" de un proyecto (el integrador muestra la de cada hijo).
    const alineacionDe = (codigoOkr: number | null): string => {
        const okr = okrs.find((o) => o.codigo_okr === codigoOkr);
        if (!okr) return 'Sin OKR';
        const pilar = pilares.find((p) => p.codigo_pilar === okr.codigo_pilar)?.nombre_pilar;
        return pilar ? `${pilar} › ${okr.nombre_okr}` : okr.nombre_okr;
    };

    const iniciarEvaluacion = (nodo: NodoEvaluacion) => {
        if (!nodo.sistema || nodo.sistema === 'INDIVIDUAL') return;
        setSistema(nodo.sistema);
        setProyecto(nodo.proyecto);
    };

    const cerrarEvaluacion = () => {
        setProyecto(null);
        setSistema(null);
    };

    // Resultados esperados de un proyecto (filas de resultado con categoría "Esperado"), en el orden en que se registraron.
    const esperadosDe = (p: Proyecto): Resultado[] =>
        resultados
            .filter((r) => r.codigo_proyecto === p.codigo_proyecto && normalize(r.categoria_resultado || '').includes('esper'))
            .sort((a, b) => a.codigo_resultado - b.codigo_resultado);

    const guardar = async (puntajes: Record<string, number>, cumplimientos: Record<number, boolean>) => {
        if (!proyecto || !sistema || sistema === 'INDIVIDUAL') return;
        const rubrica = RUBRICAS[sistema];
        setIsSaving(true);
        try {
            const usuario = user?.usuario || 'admin';
            const now = ahoraSQL();
            const evaluador = evaluadorDe(proyecto) || usuario;
            // Ventana de evaluación definida al aprobar el proyecto: se conserva en cada fila de calificación.
            const ventana = resultados.find((r) => r.codigo_proyecto === proyecto.codigo_proyecto && r.fecha_inicio_evaluacion);
            const existentes = resultados.filter((r) => r.codigo_proyecto === proyecto.codigo_proyecto);
            for (const criterio of rubrica.criterios) {
                const cat = marcadorCriterio(rubrica.codigo, criterio.clave);
                const prev = existentes.find((r) => r.categoria_resultado === cat);
                const puntaje = puntajes[criterio.clave] ?? 0;
                const nivel = criterio.niveles.find((n) => n.valor === puntaje);
                // Se guarda el puntaje como prefijo parseable + el descriptor (para que sea legible en BD).
                const descripcion = `${puntaje} | ${nivel?.descripcion ?? ''}`.slice(0, 200);
                await resultadoService.save({
                    codigo_resultado: prev?.codigo_resultado || 0,
                    codigo_proyecto: proyecto.codigo_proyecto,
                    categoria_resultado: cat,
                    descripcion_resultado: descripcion,
                    evaluador_asignado: evaluador,
                    cumple_propuesta: puntaje >= 3,
                    fecha_inicio_evaluacion: ventana?.fecha_inicio_evaluacion ?? null,
                    fecha_fin_evaluacion: ventana?.fecha_fin_evaluacion ?? null,
                    usuario_modificacion: usuario,
                    fecha_modificacion: now,
                } as Resultado);
            }
            // Verificación de los resultados esperados: cumple_propuesta (bit) de cada fila "Esperado".
            for (const esperado of esperadosDe(proyecto)) {
                await resultadoService.save({
                    ...esperado,
                    cumple_propuesta: cumplimientos[esperado.codigo_resultado] ?? false,
                    usuario_modificacion: usuario,
                    fecha_modificacion: now,
                } as Resultado);
            }
            toast({ title: 'Evaluación guardada', description: `Se guardó la calificación de "${proyecto.nombre_proyecto}".` });
            cerrarEvaluacion();
            fetchData();
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
            toast({ title: 'Error al guardar', description: msg, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    // ── Vista: calificando un proyecto independiente con su rúbrica ──
    if (proyecto && sistema && sistema !== 'INDIVIDUAL') {
        return (
            <div className="flex flex-col gap-4 p-4 md:p-6">
                <div className="flex flex-wrap items-center gap-3">
                    <Button variant="outline" size="sm" onClick={cerrarEvaluacion}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Volver
                    </Button>
                    <div>
                        <h2 className="text-lg font-semibold">{proyecto.nombre_proyecto}</h2>
                        <p className="text-xs text-muted-foreground">{RUBRICAS[sistema].nombre}</p>
                    </div>
                </div>
                <Card>
                    <CardContent className="pt-6">
                        <RubricaEvaluador
                            rubrica={RUBRICAS[sistema]}
                            evaluadorAsignado={nombresEvaluadores(evaluadorDe(proyecto))}
                            puntajesIniciales={puntajesDeProyecto(resultados, proyecto.codigo_proyecto, sistema)}
                            // Si el proyecto ya se calificó, la verificación guardada se muestra; si no, parte "sin verificar".
                            resultadosEsperados={esperadosDe(proyecto).map((r): ResultadoParaVerificar => ({
                                codigo: r.codigo_resultado,
                                descripcion: r.descripcion_resultado,
                                cumple: Object.keys(puntajesDeProyecto(resultados, proyecto.codigo_proyecto, sistema)).length > 0 ? !!r.cumple_propuesta : null,
                            }))}
                            isSaving={isSaving}
                            onGuardar={guardar}
                        />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 p-4 md:p-6">
            <Card>
                <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <ClipboardCheck className="h-5 w-5" />
                    </div>
                    <div>
                        <CardTitle>Evaluación de Proyectos</CardTitle>
                        <CardDescription>
                            Un proyecto <strong>independiente</strong> se califica con su rúbrica (MR, MSP o PI). Un proyecto <strong>integrador</strong> se califica solo:
                            es el promedio simple de la calificación de sus proyectos hijos, sobre 5. Expande una fila para ver el detalle.
                        </CardDescription>
                    </div>
                </CardHeader>
            </Card>

            {isLoading ? (
                <div className="flex flex-col gap-3">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
                </div>
            ) : arbol.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                        No hay proyectos aprobados para evaluar. Los proyectos aparecen aquí cuando su solicitud es aprobada.
                    </CardContent>
                </Card>
            ) : (
                <TablaEvaluacion arbol={arbol} resultados={resultados} onEvaluar={iniciarEvaluacion} nombresEvaluadores={nombresEvaluadores} alineacionDe={alineacionDe} />
            )}
        </div>
    );
}
