"use client";

import { useMemo, useState } from 'react';
import { AlertTriangle, Building, CalendarRange, Check, CheckCircle2, ChevronDown, Clock, Layers, Loader2, Target, User, Users, X } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { FichaSocialHistorica, Responsable } from '@/types/interfaces';
import { actividadesEvaluables, actividadesPrincipales, duracionDias, hijosPorPadre } from '@/lib/actividades';
import { aFechaSegura, formatearFecha } from '@/lib/fechas';
import { cn } from '@/lib/utils';
import type { ProyectoView } from '../proyectos/types';
import { useProyectoDetalle } from '../proyectos/use-proyecto-detalle';
import ProyectoGantt from '../proyectos/components/proyecto-gantt';

const money = (n: number) => `$${n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface RevisionProyectoProps {
    view: ProyectoView;
    responsables: Responsable[];
    personas: FichaSocialHistorica[];
    /** Ya hay una resolución en curso para este proyecto. */
    procesando: boolean;
    /** Faltan los estados "Aprobado"/"Rechazado" en el catálogo. */
    sinEstados: boolean;
    onResolver: (aprobar: boolean) => void;
}

interface Senal {
    ok: boolean;
    texto: string;
}

// Panel de revisión de un proyecto pendiente: todo lo necesario para decidir con criterio (qué busca, cómo se
// alinea a la estrategia, cuándo y quién lo hace, y cuánto cuesta) y la decisión con confirmación.
export default function RevisionProyecto({ view, responsables, personas, procesando, sinEstados, onResolver }: RevisionProyectoProps) {
    const p = view.proyecto;
    const { recursos, totalCosto, resultadoEsperado, objetivos, alineacion, cargando } = useProyectoDetalle(p);
    const [confirmar, setConfirmar] = useState<null | 'aprobar' | 'rechazar'>(null);
    const [verCorrectos, setVerCorrectos] = useState(false);

    const responsableMap = useMemo(() => new Map(responsables.map((r) => [r.codigo_responsable, r])), [responsables]);
    const personaMap = useMemo(() => new Map(personas.map((x) => [x.CODIGO, x])), [personas]);
    const nombreDe = (codigoResponsable: number): string => {
        const r = responsableMap.get(codigoResponsable);
        if (!r) return 'Sin responsable';
        return personaMap.get(r.codigo_empleado)?.NOMBRE || r.codigo_empleado;
    };

    const principales = useMemo(() => actividadesPrincipales(view.actividades), [view.actividades]);
    const compartidas = useMemo(() => hijosPorPadre(view.actividades).size, [view.actividades]);
    const duracionProyecto = duracionDias(p.fecha_inicio, p.fecha_fin);

    // Carga por persona: actividades y días asignados (solo lo que se ejecuta: las partes de cada participante).
    const equipo = useMemo(() => {
        const evaluables = actividadesEvaluables(view.actividades);
        const mapa = new Map<number, { nombre: string; actividades: string[]; dias: number; inicio: number; fin: number }>();
        evaluables.forEach((a) => {
            const ini = aFechaSegura(a.fecha_inicio_actividad).getTime();
            const fin = aFechaSegura(a.fecha_fin_actividad).getTime();
            const prev = mapa.get(a.codigo_responsable) ?? { nombre: nombreDe(a.codigo_responsable), actividades: [], dias: 0, inicio: Infinity, fin: -Infinity };
            prev.actividades.push(a.nombre_actividad);
            prev.dias += duracionDias(a.fecha_inicio_actividad, a.fecha_fin_actividad);
            prev.inicio = Math.min(prev.inicio, ini);
            prev.fin = Math.max(prev.fin, fin);
            mapa.set(a.codigo_responsable, prev);
        });
        const filas = [...mapa.entries()].map(([codigo, v]) => ({ codigo, ...v }));
        const totalDias = filas.reduce((s, f) => s + f.dias, 0) || 1;
        return filas
            .map((f) => ({ ...f, porcentaje: Math.round((f.dias / totalDias) * 100) }))
            .sort((a, b) => b.dias - a.dias);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view.actividades, responsableMap, personaMap]);

    // Puntos a revisar: lo que falta o llama la atención, antes de decidir.
    const senales = useMemo<Senal[]>(() => {
        const lista: Senal[] = [];
        lista.push(alineacion
            ? { ok: true, texto: `Alineado a ${alineacion.pilar ? `${alineacion.pilar} → ` : ''}${alineacion.okr}.` }
            : { ok: false, texto: 'No está alineado a ningún pilar/OKR estratégico.' });
        lista.push(objetivos.length > 0
            ? { ok: true, texto: `Tiene ${objetivos.length} ${objetivos.length === 1 ? 'objetivo específico' : 'objetivos específicos'}.` }
            : { ok: false, texto: 'No define objetivos específicos (solo el objetivo principal).' });
        lista.push(principales.length > 0
            ? { ok: true, texto: `${principales.length} ${principales.length === 1 ? 'actividad' : 'actividades'} planificadas${compartidas ? `, ${compartidas} compartida(s)` : ''}.` }
            : { ok: false, texto: 'No tiene actividades registradas.' });
        const sinResponsable = actividadesEvaluables(view.actividades).filter((a) => !responsableMap.has(a.codigo_responsable)).length;
        if (sinResponsable > 0) lista.push({ ok: false, texto: `${sinResponsable} actividad(es) sin responsable asignado.` });
        const ini = aFechaSegura(p.fecha_inicio).getTime();
        const fin = aFechaSegura(p.fecha_fin).getTime();
        const fuera = view.actividades.filter((a) => aFechaSegura(a.fecha_inicio_actividad).getTime() < ini || aFechaSegura(a.fecha_fin_actividad).getTime() > fin).length;
        if (fuera > 0) lista.push({ ok: false, texto: `${fuera} actividad(es) quedan fuera de las fechas del proyecto.` });
        if (!cargando) {
            lista.push(recursos.length > 0
                ? { ok: true, texto: `${recursos.length} recurso(s), costo estimado ${money(totalCosto)}.` }
                : { ok: false, texto: 'No tiene recursos asignados.' });
        }
        return lista;
    }, [alineacion, objetivos, principales.length, compartidas, view.actividades, responsableMap, p.fecha_inicio, p.fecha_fin, cargando, recursos.length, totalCosto]);

    const pendientesRevisar = senales.filter((s) => !s.ok).length;

    return (
        <div className="flex flex-col gap-4">
            {/* Cabecera + decisión */}
            <Card>
                <CardHeader className="gap-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 space-y-1.5">
                            <Badge variant="secondary" className="w-fit text-amber-700">
                                <Clock className="mr-1 h-3 w-3" /> Pendiente de aprobación
                            </Badge>
                            <CardTitle className="text-xl leading-snug">{p.nombre_proyecto}</CardTitle>
                            {view.padreNombre && <p className="text-xs text-muted-foreground">Sub-proyecto de: {view.padreNombre}</p>}
                            <p className="text-sm text-muted-foreground">{p.descripcion_proyecto || 'Sin descripción.'}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5"><Building className="h-3.5 w-3.5" />{view.areaNombre || '—'}{view.tipoProyectoNombre ? ` · ${view.tipoProyectoNombre}` : ''}</span>
                        <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />Responsable: {p.responsable_proyecto || '—'}</span>
                        <span className="flex items-center gap-1.5"><CalendarRange className="h-3.5 w-3.5" />{formatearFecha(p.fecha_inicio)} – {formatearFecha(p.fecha_fin)} ({duracionProyecto} días)</span>
                        {view.usuarioCreacion && <span>Solicitado por: {view.usuarioCreacion}</span>}
                    </div>
                </CardHeader>
            </Card>

            {/* Cifras clave: lo que un aprobador mira primero */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { etiqueta: 'Duración', valor: `${duracionProyecto} días`, detalle: `${formatearFecha(p.fecha_inicio)} – ${formatearFecha(p.fecha_fin)}` },
                    { etiqueta: 'Actividades', valor: String(principales.length), detalle: compartidas ? `${compartidas} compartida(s)` : 'todas individuales' },
                    { etiqueta: 'Equipo', valor: String(equipo.length), detalle: equipo.length === 1 ? 'persona' : 'personas' },
                    { etiqueta: 'Costo estimado', valor: cargando ? '…' : recursos.length ? money(totalCosto) : '—', detalle: cargando ? 'cargando' : `${recursos.length} recurso(s)` },
                ].map((k) => (
                    <div key={k.etiqueta} className="rounded-lg border bg-card p-3">
                        <p className="text-xs text-muted-foreground">{k.etiqueta}</p>
                        <p className="text-xl font-semibold leading-tight tabular-nums">{k.valor}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{k.detalle}</p>
                    </div>
                ))}
            </div>

            {/* Verificaciones: primero lo que requiere atención; lo correcto queda plegado */}
            <Card className={cn(pendientesRevisar > 0 && 'border-amber-500/50')}>
                <CardContent className="flex flex-col gap-2 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                        {pendientesRevisar > 0
                            ? <><AlertTriangle className="h-4 w-4 text-amber-600" /> {pendientesRevisar} {pendientesRevisar === 1 ? 'punto requiere' : 'puntos requieren'} tu atención</>
                            : <><CheckCircle2 className="h-4 w-4 text-green-600" /> El proyecto está completo</>}
                    </p>
                    {pendientesRevisar > 0 && (
                        <ul className="flex flex-col gap-1">
                            {senales.filter((s) => !s.ok).map((s, i) => (
                                <li key={i} className="flex items-start gap-2 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-sm text-amber-800 dark:text-amber-300">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>{s.texto}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    {senales.some((s) => s.ok) && (
                        <>
                            <button
                                type="button"
                                onClick={() => setVerCorrectos((v) => !v)}
                                aria-expanded={verCorrectos}
                                className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            >
                                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !verCorrectos && '-rotate-90')} />
                                {senales.filter((s) => s.ok).length} verificaciones correctas
                            </button>
                            {verCorrectos && (
                                <ul className="grid gap-1 text-sm sm:grid-cols-2">
                                    {senales.filter((s) => s.ok).map((s, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                                            <span>{s.texto}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </>
                    )}
                    {cargando && <p className="text-xs text-muted-foreground">Cargando recursos y objetivos…</p>}
                </CardContent>
            </Card>

            <Tabs defaultValue="resumen">
                <TabsList aria-label="Secciones de la revisión del proyecto">
                    <TabsTrigger value="resumen">Resumen</TabsTrigger>
                    <TabsTrigger value="cronograma">Cronograma ({principales.length})</TabsTrigger>
                    <TabsTrigger value="equipo">Equipo ({equipo.length})</TabsTrigger>
                    <TabsTrigger value="recursos">Recursos ({recursos.length})</TabsTrigger>
                </TabsList>

                {/* Resumen: qué busca y cómo se alinea */}
                <TabsContent value="resumen" className="mt-4">
                    <Card>
                        <CardContent className="grid gap-5 pt-6 text-sm md:grid-cols-2">
                            <div className="md:col-span-2">
                                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Layers className="h-3.5 w-3.5" /> Alineación estratégica</p>
                                {alineacion ? (
                                    <div>
                                        <p className="font-medium">{alineacion.pilar ? `${alineacion.pilar} → ` : ''}{alineacion.okr}</p>
                                        {alineacion.descripcionOkr && <p className="text-muted-foreground">{alineacion.descripcionOkr}</p>}
                                    </div>
                                ) : <p className="text-muted-foreground">Sin OKR asignado.</p>}
                            </div>
                            <div className="md:col-span-2">
                                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Target className="h-3.5 w-3.5" /> Objetivo principal</p>
                                <p>{p.objetivo_principal || '—'}</p>
                            </div>
                            <div className="md:col-span-2">
                                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Objetivos específicos ({objetivos.length})</p>
                                {objetivos.length > 0 ? (
                                    <ol className="flex flex-col gap-1.5">
                                        {objetivos.map((o, i) => (
                                            <li key={o.codigo_objetivo} className="flex gap-2">
                                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold tabular-nums text-primary">{i + 1}</span>
                                                <span>{o.descripcion_objetivo}</span>
                                            </li>
                                        ))}
                                    </ol>
                                ) : <p className="text-muted-foreground">No se definieron objetivos específicos.</p>}
                            </div>
                            {resultadoEsperado && (
                                <div className="md:col-span-2">
                                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Resultados esperados</p>
                                    <p>{resultadoEsperado}</p>
                                </div>
                            )}
                            {(view.padreNombre || view.subProyectosCount > 0) && (
                                <div className="md:col-span-2">
                                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Jerarquía</p>
                                    <p>
                                        {view.padreNombre && `Sub-proyecto de: ${view.padreNombre}`}
                                        {view.padreNombre && view.subProyectosCount > 0 && ' · '}
                                        {view.subProyectosCount > 0 && `${view.subProyectosCount} sub-proyecto(s) asociado(s)`}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Cronograma: cuándo y en qué orden */}
                <TabsContent value="cronograma" className="mt-4">
                    <ProyectoGantt actividades={view.actividades} responsables={responsables} personas={personas} />
                </TabsContent>

                {/* Equipo: quién carga con qué */}
                <TabsContent value="equipo" className="mt-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> Cómo se distribuye el trabajo</CardTitle>
                            <p className="text-xs text-muted-foreground">La carga es el porcentaje de días asignados a cada persona sobre el total de días de trabajo del proyecto.</p>
                        </CardHeader>
                        <CardContent>
                            {equipo.length === 0 ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">Sin actividades asignadas.</p>
                            ) : (
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Persona</TableHead>
                                                <TableHead>Actividades</TableHead>
                                                <TableHead className="whitespace-nowrap">Desde – hasta</TableHead>
                                                <TableHead className="w-48">Carga</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {equipo.map((e) => (
                                                <TableRow key={e.codigo}>
                                                    <TableCell className="font-medium">{e.nombre}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">
                                                        <span className="font-medium text-foreground">{e.actividades.length}</span> · {e.actividades.join(', ')}
                                                    </TableCell>
                                                    <TableCell className="whitespace-nowrap text-xs tabular-nums">
                                                        {formatearFecha(new Date(e.inicio))} – {formatearFecha(new Date(e.fin))}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${e.porcentaje}% de la carga`}>
                                                                <div className="h-full rounded-full bg-primary" style={{ width: `${e.porcentaje}%` }} />
                                                            </div>
                                                            <span className="w-16 text-right text-xs tabular-nums">{e.porcentaje}% · {e.dias}d</span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Recursos y costo */}
                <TabsContent value="recursos" className="mt-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-base">Recursos del proyecto</CardTitle>
                            {recursos.length > 0 && <p className="text-sm">Costo total: <strong className="tabular-nums">{money(totalCosto)}</strong></p>}
                        </CardHeader>
                        <CardContent>
                            {cargando ? (
                                <Skeleton className="h-24 w-full" />
                            ) : recursos.length === 0 ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">Este proyecto no tiene recursos asignados.</p>
                            ) : (
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Recurso</TableHead>
                                                <TableHead>Tipo</TableHead>
                                                <TableHead className="text-right">Costo unit.</TableHead>
                                                <TableHead className="text-right">Cantidad</TableHead>
                                                <TableHead className="text-right">Subtotal</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {recursos.map((r, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="font-medium">{r.nombre}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{r.tipo || '—'}</TableCell>
                                                    <TableCell className="text-right tabular-nums">{money(r.costo)}</TableCell>
                                                    <TableCell className="text-right tabular-nums">{r.valor}</TableCell>
                                                    <TableCell className="text-right tabular-nums">{money(r.subtotal)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Decisión: barra fija al pie, visible sin importar la pestaña o el scroll */}
            <div className="sticky bottom-3 z-20 flex flex-col gap-2 rounded-lg border bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-sm">
                    <p className="truncate font-medium">{p.nombre_proyecto}</p>
                    <p className={cn('text-xs', pendientesRevisar > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
                        {pendientesRevisar > 0 ? `${pendientesRevisar} ${pendientesRevisar === 1 ? 'punto requiere' : 'puntos requieren'} atención` : 'Sin observaciones'}
                    </p>
                </div>
                <div className="flex shrink-0 gap-2">
                    <Button variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={procesando || sinEstados} onClick={() => setConfirmar('rechazar')}>
                        <X className="mr-2 h-4 w-4" /> Rechazar
                    </Button>
                    <Button className="bg-green-600 hover:bg-green-700" disabled={procesando || sinEstados} onClick={() => setConfirmar('aprobar')}>
                        {procesando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                        Aprobar
                    </Button>
                </div>
            </div>

            {/* Confirmación de la decisión: queda registrada y cambia el estado de la solicitud. */}
            <AlertDialog open={confirmar !== null} onOpenChange={(o) => { if (!o) setConfirmar(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{confirmar === 'aprobar' ? '¿Aprobar este proyecto?' : '¿Rechazar este proyecto?'}</AlertDialogTitle>
                        <AlertDialogDescription>
                            <strong className="text-foreground">{p.nombre_proyecto}</strong> quedará como {confirmar === 'aprobar' ? 'Aprobado' : 'Rechazado'} y saldrá de esta bandeja.
                            {pendientesRevisar > 0 && (
                                <span className="mt-2 block text-amber-700 dark:text-amber-400">
                                    Ten en cuenta que aún hay {pendientesRevisar} {pendientesRevisar === 1 ? 'punto a revisar' : 'puntos a revisar'} en este proyecto.
                                </span>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Volver a revisar</AlertDialogCancel>
                        <AlertDialogAction
                            className={confirmar === 'rechazar' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-green-600 text-white hover:bg-green-700'}
                            onClick={() => { const aprobar = confirmar === 'aprobar'; setConfirmar(null); onResolver(aprobar); }}
                        >
                            {confirmar === 'aprobar' ? 'Sí, aprobar' : 'Sí, rechazar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
