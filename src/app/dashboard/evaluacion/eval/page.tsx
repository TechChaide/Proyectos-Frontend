
"use client";

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ClipboardCheck, FolderKanban } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Proyecto, TipoProyecto, Resultado } from '@/types/interfaces';
import { proyectoService } from '@/services/proyectos/proyecto.service';
import { tipoProyectoService } from '@/services/proyectos/tipoProyecto.service';
import { resultadoService } from '@/services/proyectos/resultado.service';
import { RUBRICAS, sistemaDeTipo, type SistemaCalificacion } from '@/lib/rubricas';

// La calificación se guarda en la tabla `resultado` (una fila por criterio), con la categoría
// marcada como "<TIPO>:<criterio>" (ej. "MR:calidad") para distinguirla de otros resultados.
const marcadorCriterio = (sistema: string, criterio: string) => `${sistema}:${criterio}`;
import RubricaEvaluador from './components/rubrica-evaluador';
import { ahoraSQL, formatearFecha } from '@/lib/fechas';

const MODULOS: { sistema: SistemaCalificacion; nombre: string; descripcion: string }[] = [
    { sistema: 'MR', nombre: 'Mejoras Rápidas (MR)', descripcion: 'Rúbrica MR (5 criterios × 20%).' },
    { sistema: 'MSP', nombre: 'Método Solución de Problemas (MSP)', descripcion: 'Rúbrica MSP (5 criterios × 20%).' },
    { sistema: 'PI', nombre: 'Proyecto de Innovación (PI)', descripcion: 'Rúbrica PI (5 criterios × 20%).' },
];

export default function EvaluacionPage() {
    const { user } = useAuth();
    const { toast } = useToast();

    const [proyectos, setProyectos] = useState<Proyecto[]>([]);
    const [tiposProyecto, setTiposProyecto] = useState<TipoProyecto[]>([]);
    const [resultados, setResultados] = useState<Resultado[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [sistema, setSistema] = useState<SistemaCalificacion | null>(null);
    const [proyecto, setProyecto] = useState<Proyecto | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        const nombres = ['proyectos', 'tipos de proyecto', 'resultados'];
        const results = await Promise.allSettled([
            proyectoService.getAll(),
            tipoProyectoService.getAll(),
            resultadoService.getAll(),
        ]);
        const asData = (r: PromiseSettledResult<{ data?: any[] }>) => (r.status === 'fulfilled' ? r.value : { data: [] });
        const [proyRes, tiposRes, resultRes] = results.map(asData);
        setProyectos(proyRes.data || []);
        setTiposProyecto(tiposRes.data || []);
        setResultados(resultRes.data || []);
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

    const tipoMap = useMemo(() => new Map(tiposProyecto.map((t) => [t.codigo_tipo_proyecto, t.nombre_tipo_proyecto])), [tiposProyecto]);
    const sistemaDe = (p: Proyecto): SistemaCalificacion | null => sistemaDeTipo(tipoMap.get(p.codigo_tipo_proyecto) || '');

    const proyectosDelSistema = useMemo(
        () => (sistema ? proyectos.filter((p) => p.estado === 'A' && sistemaDe(p) === sistema) : []),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [proyectos, sistema, tipoMap]
    );

    const conteoPorSistema = useMemo(() => {
        const map = new Map<SistemaCalificacion, number>();
        proyectos.filter((p) => p.estado === 'A').forEach((p) => {
            const s = sistemaDe(p);
            if (s) map.set(s, (map.get(s) || 0) + 1);
        });
        return map;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [proyectos, tipoMap]);

    const evaluadorDe = (p: Proyecto): string =>
        resultados.find((r) => r.codigo_proyecto === p.codigo_proyecto && r.evaluador_asignado)?.evaluador_asignado || '';

    // Puntajes guardados del proyecto para la rúbrica del sistema actual (desde la tabla resultado).
    const puntajesDe = (p: Proyecto): Record<string, number> => {
        const res: Record<string, number> = {};
        if (!sistema || sistema === 'INDIVIDUAL') return res;
        const rub = RUBRICAS[sistema];
        rub.criterios.forEach((c) => {
            const cat = marcadorCriterio(rub.codigo, c.clave);
            const row = resultados.find((r) => r.codigo_proyecto === p.codigo_proyecto && r.categoria_resultado === cat);
            if (row) {
                const v = parseInt(String(row.descripcion_resultado), 10);
                if (!Number.isNaN(v)) res[c.clave] = v;
            }
        });
        return res;
    };

    const guardar = async (puntajes: Record<string, number>) => {
        if (!proyecto || !sistema || sistema === 'INDIVIDUAL') return;
        const rubrica = RUBRICAS[sistema];
        setIsSaving(true);
        try {
            const usuario = user?.usuario || 'admin';
            const now = ahoraSQL();
            const evaluador = evaluadorDe(proyecto) || usuario;
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
                    usuario_modificacion: usuario,
                    fecha_modificacion: now,
                } as Resultado);
            }
            toast({ title: 'Evaluación guardada', description: `Se guardó la calificación de "${proyecto.nombre_proyecto}".` });
            setProyecto(null);
            fetchData();
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
            toast({ title: 'Error al guardar', description: msg, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    // ── Vista: evaluando un proyecto ──
    if (proyecto && sistema && sistema !== 'INDIVIDUAL') {
        return (
            <div className="flex flex-col gap-4 p-4 md:p-6">
                <div className="flex flex-wrap items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => setProyecto(null)}>
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
                            evaluadorAsignado={evaluadorDe(proyecto)}
                            puntajesIniciales={puntajesDe(proyecto)}
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
                        <CardTitle>Evaluación</CardTitle>
                        <CardDescription>
                            {sistema ? `Proyectos para calificar — ${MODULOS.find((m) => m.sistema === sistema)?.nombre}` : 'Elige el sistema de calificación según el tipo de proyecto.'}
                        </CardDescription>
                    </div>
                </CardHeader>
            </Card>

            {isLoading ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
                </div>
            ) : sistema === null ? (
                // ── Landing: módulos por tipo ──
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {MODULOS.map((m) => {
                        const count = conteoPorSistema.get(m.sistema) || 0;
                        return (
                            <Card
                                key={m.sistema}
                                role="button"
                                tabIndex={0}
                                onClick={() => setSistema(m.sistema)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSistema(m.sistema); }}
                                className="cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <CardHeader className="space-y-2">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                        <ClipboardCheck className="h-5 w-5" />
                                    </div>
                                    <CardTitle className="text-base">{m.nombre}</CardTitle>
                                    <CardDescription className="text-xs">{m.descripcion}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <span className="text-sm text-muted-foreground">{count} proyecto{count === 1 ? '' : 's'}</span>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <>
                    <Button variant="outline" size="sm" className="w-fit" onClick={() => setSistema(null)}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Volver a sistemas
                    </Button>

                    {proyectosDelSistema.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center text-sm text-muted-foreground">
                                No hay proyectos activos de este tipo para calificar.
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {proyectosDelSistema.map((p) => {
                                const yaCalificado = resultados.some((r) => r.codigo_proyecto === p.codigo_proyecto && (r.categoria_resultado || '').startsWith(`${sistema}:`));
                                return (
                                    <Card
                                        key={p.codigo_proyecto}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setProyecto(p)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setProyecto(p); }}
                                        className="cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <CardHeader className="space-y-2">
                                            {yaCalificado && <Badge className="w-fit bg-green-600">Calificado</Badge>}
                                            <CardTitle className="text-base leading-snug">{p.nombre_proyecto}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1.5"><FolderKanban className="h-3.5 w-3.5" /> {p.responsable_proyecto || 'Sin responsable'}</span>
                                            <span>{formatearFecha(p.fecha_inicio)} - {formatearFecha(p.fecha_fin)}</span>
                                            <span>Evaluador: {evaluadorDe(p) || 'No asignado'}</span>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
