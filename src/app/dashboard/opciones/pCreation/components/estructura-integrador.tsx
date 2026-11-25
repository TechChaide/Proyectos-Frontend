"use client";

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Boxes, CalendarRange, Check, ClipboardCheck, Compass, FolderPlus, ListChecks, Loader2, Pencil, RefreshCw, Star, User, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { FichaSocialHistorica, Okr, PilarEstrategico, Resultado } from '@/types/interfaces';
import { resultadoService } from '@/services/proyectos/resultado.service';
import { aFechaSegura, fechaISO, formatearFecha } from '@/lib/fechas';
import { actividadesPrincipales } from '@/lib/actividades';
import { cn } from '@/lib/utils';
import { useProyectoViews } from '../../proyectos/use-proyecto-views';
import { estiloEstadoSolicitud } from '../../proyectos/components/proyecto-card';
import type { ProyectoView } from '../../proyectos/types';

interface EstructuraIntegradorProps {
    codigoIntegrador: number;
    personas: FichaSocialHistorica[];
    pilares: PilarEstrategico[];
    okrs: Okr[];
    onAgregarHijo: () => void;
    onEditarIntegrador: () => void;
    onEditarHijo: (codigo: number) => void;
    onVolver: () => void;
}

const normalizar = (v: string) => (v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
type Grupo = 'aprobado' | 'pendiente' | 'rechazado' | 'otro';
const grupoDe = (estado: string): Grupo => {
    const n = normalizar(estado);
    if (n.includes('pendiente')) return 'pendiente';
    if (n.includes('rechaz')) return 'rechazado';
    if (n.includes('aprob')) return 'aprobado';
    return 'otro';
};

function EstadoBadge({ nombre }: { nombre: string }) {
    const e = estiloEstadoSolicitud(nombre);
    return (
        <Badge className="gap-1 border-0" style={{ backgroundColor: e.color, color: e.texto }}>
            <e.Icono className="h-3 w-3" /> {e.etiqueta}
        </Badge>
    );
}

// Fase 2 del Proyecto Integrador: su estructura en cascada. Arriba el integrador (raíz) con sus datos estratégicos; debajo,
// colgando de una línea, cada proyecto hijo con su estado de aprobación y una barra que muestra dónde cae su periodo dentro
// del rango del integrador. Desde aquí se agregan y se editan los hijos sin salir del menú de creación.
export default function EstructuraIntegrador({ codigoIntegrador, personas, pilares, okrs, onAgregarHijo, onEditarIntegrador, onEditarHijo, onVolver }: EstructuraIntegradorProps) {
    const { proyectoViews, isLoading, recargar } = useProyectoViews();
    // Resultados esperados de los hijos: el integrador no tiene propios, reúne los de sus hijos.
    const [resultados, setResultados] = useState<Resultado[]>([]);
    const [versionResultados, setVersionResultados] = useState(0);
    useEffect(() => {
        let cancelado = false;
        resultadoService.getAll()
            .then((r) => { if (!cancelado) setResultados(r.data || []); })
            .catch(() => { if (!cancelado) setResultados([]); });
        return () => { cancelado = true; };
    }, [versionResultados]);
    const actualizar = () => { recargar(); setVersionResultados((v) => v + 1); };

    const integrador = proyectoViews.find((v) => v.proyecto.codigo_proyecto === codigoIntegrador) ?? null;
    const hijos = useMemo(
        () => proyectoViews
            .filter((v) => v.proyecto.codigo_padre === codigoIntegrador && v.proyecto.estado === 'A')
            .sort((a, b) => fechaISO(a.proyecto.fecha_inicio).localeCompare(fechaISO(b.proyecto.fecha_inicio))),
        [proyectoViews, codigoIntegrador]
    );

    const personaMap = useMemo(() => new Map(personas.map((p) => [p.CODIGO, p.NOMBRE])), [personas]);
    const nombres = (crudo: string) => (crudo || '').split('&').map((c) => c.trim()).filter(Boolean).map((c) => personaMap.get(c) || c).join(', ');

    if (isLoading && !integrador) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Cargando la estructura del Proyecto Integrador…
                </CardContent>
            </Card>
        );
    }
    if (!integrador) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                    <p className="text-sm text-muted-foreground">No se encontró el Proyecto Integrador. Puede que se haya inactivado.</p>
                    <Button type="button" variant="outline" onClick={onVolver}><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Button>
                </CardContent>
            </Card>
        );
    }

    const p = integrador.proyecto;
    const inicio = fechaISO(p.fecha_inicio);
    const fin = fechaISO(p.fecha_fin);
    const okrDe = (codigo: number | null) => okrs.find((o) => o.codigo_okr === codigo);
    const nombrePilar = (codigo?: number) => pilares.find((x) => x.codigo_pilar === codigo)?.nombre_pilar;
    const esperadosDe = (codigo: number) =>
        resultados.filter((r) => r.codigo_proyecto === codigo && normalizar(r.categoria_resultado).includes('esper')).map((r) => r.descripcion_resultado);
    const resultadosIntegrador = hijos.map((h) => ({ hijo: h.proyecto.nombre_proyecto, resultados: esperadosDe(h.proyecto.codigo_proyecto) })).filter((x) => x.resultados.length > 0);
    const totalResultados = resultadosIntegrador.reduce((n, x) => n + x.resultados.length, 0);
    const rechazado = grupoDe(integrador.estadoSolicitudNombre) === 'rechazado';

    const conteo = hijos.reduce<Record<Grupo, number>>((acc, h) => { acc[grupoDe(h.estadoSolicitudNombre)]++; return acc; }, { aprobado: 0, pendiente: 0, rechazado: 0, otro: 0 });

    // Posición de un hijo dentro del rango del integrador (en % del ancho de la barra).
    const tIni = aFechaSegura(inicio).getTime();
    const tFin = aFechaSegura(fin).getTime();
    const total = Math.max(tFin - tIni, 1);
    const barra = (h: ProyectoView) => {
        const a = aFechaSegura(h.proyecto.fecha_inicio).getTime();
        const b = aFechaSegura(h.proyecto.fecha_fin).getTime();
        const izq = Math.min(Math.max(((a - tIni) / total) * 100, 0), 100);
        const der = Math.min(Math.max(((b - tIni) / total) * 100, 0), 100);
        return { izq, ancho: Math.max(der - izq, 1.5), fuera: a < tIni || b > tFin };
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Guía del proceso: dónde está el usuario. */}
            <Card>
                <CardContent className="flex flex-col gap-4 pt-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={onVolver}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Nueva solicitud
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={actualizar} disabled={isLoading}>
                            <RefreshCw className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} /> Actualizar
                        </Button>
                    </div>
                    <ol className="grid gap-2 text-sm sm:grid-cols-3" aria-label="Fases del Proyecto Integrador">
                        {[
                            { n: 1, t: 'Integrador creado', d: 'Nombre, director y periodo', hecho: true },
                            { n: 2, t: 'Proyectos hijos', d: 'Agrégalos cuando los tengas definidos', actual: true },
                            { n: 3, t: 'Aprobación', d: 'Cada solicitud se aprueba por separado' },
                        ].map((f) => (
                            <li key={f.n} className={cn('flex items-start gap-3 rounded-md border p-3', f.actual && 'border-primary bg-primary/5')}>
                                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold', f.hecho ? 'bg-green-600 text-white' : f.actual ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                                    {f.hecho ? <Check className="h-4 w-4" /> : f.n}
                                </span>
                                <span>
                                    <span className="block font-medium">{f.t}</span>
                                    <span className="block text-xs text-muted-foreground">{f.d}</span>
                                </span>
                            </li>
                        ))}
                    </ol>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Estructura del Proyecto Integrador</CardTitle>
                    <CardDescription>
                        Cada proyecto hijo es una solicitud completa (proceso, datos, recursos y actividades) y debe quedar dentro de las fechas del integrador.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col">
                    {/* Raíz: el integrador */}
                    <div className="relative z-10 flex flex-col gap-3 rounded-lg border-2 border-primary/60 bg-primary/5 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Boxes className="h-5 w-5" /></span>
                                <div className="min-w-0">
                                    <p className="text-xs font-medium uppercase tracking-wide text-primary">Proyecto Integrador</p>
                                    <p className="text-lg font-semibold leading-tight">{p.nombre_proyecto}</p>
                                </div>
                            </div>
                            <EstadoBadge nombre={integrador.estadoSolicitudNombre} />
                        </div>
                        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                            <div className="flex items-start gap-2"><User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div><dt className="text-xs text-muted-foreground">Director(es)</dt><dd>{nombres(p.responsable_proyecto) || '—'}</dd></div></div>
                            <div className="flex items-start gap-2"><CalendarRange className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div><dt className="text-xs text-muted-foreground">Periodo</dt><dd>{formatearFecha(inicio)} – {formatearFecha(fin)}</dd></div></div>
                            <div className="flex items-start gap-2 sm:col-span-2"><Star className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div><dt className="text-xs text-muted-foreground">Evaluación</dt><dd>Promedio de las notas de sus hijos aprobados (sobre 5).</dd></div></div>
                        </dl>
                        <div className="rounded-md border bg-card p-3">
                            <p className="flex items-center gap-2 text-sm font-medium"><ClipboardCheck className="h-4 w-4 text-primary" /> Resultados esperados ({totalResultados})</p>
                            {resultadosIntegrador.length === 0 ? (
                                <p className="mt-1 text-xs text-muted-foreground">Se van sumando aquí a medida que agregas proyectos hijos con sus resultados esperados.</p>
                            ) : (
                                <div className="mt-2 flex flex-col gap-2 text-sm">
                                    {resultadosIntegrador.map((x) => (
                                        <div key={x.hijo}>
                                            <p className="text-xs font-medium text-muted-foreground">{x.hijo}</p>
                                            <ul className="list-disc space-y-0.5 pl-5">{x.resultados.map((r, i) => <li key={i}>{r}</li>)}</ul>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                            <div className="flex flex-wrap gap-2 text-xs">
                                <Badge variant="outline">{hijos.length} {hijos.length === 1 ? 'hijo' : 'hijos'}</Badge>
                                {conteo.aprobado > 0 && <Badge variant="outline" className="border-green-600/40 text-green-700 dark:text-green-400">{conteo.aprobado} aprobado(s)</Badge>}
                                {conteo.pendiente > 0 && <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">{conteo.pendiente} pendiente(s)</Badge>}
                                {conteo.rechazado > 0 && <Badge variant="outline" className="border-destructive/50 text-destructive">{conteo.rechazado} rechazado(s)</Badge>}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={onEditarIntegrador}><Pencil className="mr-2 h-4 w-4" /> Editar integrador</Button>
                                <Button type="button" size="sm" onClick={onAgregarHijo} disabled={rechazado} title={rechazado ? 'El integrador fue rechazado: no se le pueden agregar hijos.' : undefined}>
                                    <FolderPlus className="mr-2 h-4 w-4" /> Agregar proyecto hijo
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Cascada de hijos: cuelgan de una línea vertical que sale del integrador. */}
                    <ul className="ml-5 flex flex-col gap-3 border-l-2 border-dashed border-primary/30 pt-3 sm:ml-8">
                        {hijos.map((h, i) => {
                            const b = barra(h);
                            const grupo = grupoDe(h.estadoSolicitudNombre);
                            const nAct = actividadesPrincipales(h.actividades).length;
                            return (
                                <li key={h.proyecto.codigo_proyecto} className="relative pl-5 sm:pl-8">
                                    <span aria-hidden className="absolute left-0 top-7 h-0.5 w-5 bg-primary/30 sm:w-8" />
                                    <div className={cn('flex flex-col gap-3 rounded-lg border bg-card p-4', b.fuera && 'border-destructive')}>
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-xs text-muted-foreground">Hijo {i + 1} · {h.areaNombre}{h.tipoProyectoNombre ? ` · ${h.tipoProyectoNombre}` : ''}</p>
                                                <p className="font-semibold leading-tight">{h.proyecto.nombre_proyecto}</p>
                                            </div>
                                            <EstadoBadge nombre={h.estadoSolicitudNombre} />
                                        </div>
                                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{nombres(h.proyecto.responsable_proyecto) || '—'}</span>
                                            <span className="flex items-center gap-1"><CalendarRange className="h-3.5 w-3.5" />{formatearFecha(h.proyecto.fecha_inicio)} – {formatearFecha(h.proyecto.fecha_fin)}</span>
                                            <span className="flex items-center gap-1"><ListChecks className="h-3.5 w-3.5" />{nAct} {nAct === 1 ? 'actividad' : 'actividades'}</span>
                                            <span className="flex items-center gap-1"><Compass className="h-3.5 w-3.5" />{(() => { const o = okrDe(h.proyecto.codigo_okr); return o ? `${nombrePilar(o.codigo_pilar) ?? '—'} › ${o.nombre_okr}` : 'Sin OKR'; })()}</span>
                                            <span className="flex items-center gap-1"><ClipboardCheck className="h-3.5 w-3.5" />{esperadosDe(h.proyecto.codigo_proyecto).length} resultado(s) esperado(s)</span>
                                        </div>
                                        {/* Dónde cae el hijo dentro del periodo del integrador. */}
                                        <div>
                                            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`Periodo del hijo dentro del integrador: ${formatearFecha(h.proyecto.fecha_inicio)} a ${formatearFecha(h.proyecto.fecha_fin)}`}>
                                                <span
                                                    className={cn('absolute inset-y-0 rounded-full', b.fuera ? 'bg-destructive' : grupo === 'aprobado' ? 'bg-green-600' : grupo === 'rechazado' ? 'bg-destructive/60' : 'bg-amber-500')}
                                                    style={{ left: `${b.izq}%`, width: `${b.ancho}%` }}
                                                />
                                            </div>
                                            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                                                <span>{formatearFecha(inicio)}</span>
                                                {b.fuera && <span className="flex items-center gap-1 font-medium text-destructive"><AlertTriangle className="h-3 w-3" /> Fuera del periodo del integrador</span>}
                                                <span>{formatearFecha(fin)}</span>
                                            </div>
                                        </div>
                                        {grupo !== 'aprobado' && (
                                            <div className="flex justify-end">
                                                <Button type="button" variant="ghost" size="sm" onClick={() => onEditarHijo(h.proyecto.codigo_proyecto)}>
                                                    <Pencil className="mr-2 h-4 w-4" /> Editar hijo
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </li>
                            );
                        })}

                        {/* Nodo "fantasma": la acción de agregar vive al final de la cascada. */}
                        {!rechazado && (
                            <li className="relative pl-5 sm:pl-8">
                                <span aria-hidden className="absolute left-0 top-1/2 h-0.5 w-5 bg-primary/30 sm:w-8" />
                                <button
                                    type="button"
                                    onClick={onAgregarHijo}
                                    className="flex w-full items-center gap-3 rounded-lg border-2 border-dashed p-4 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <FolderPlus className="h-5 w-5 shrink-0 text-primary" />
                                    <span>
                                        <span className="block font-medium text-foreground">{hijos.length === 0 ? 'Agrega el primer proyecto hijo' : 'Agregar otro proyecto hijo'}</span>
                                        <span className="block text-xs">Se define con el flujo completo y queda pendiente de aprobación. Debe caer entre el {formatearFecha(inicio)} y el {formatearFecha(fin)}.</span>
                                    </span>
                                </button>
                            </li>
                        )}
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}
