
"use client";

import { useMemo, useState } from 'react';
import { FilterX, Inbox } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { EstadoSolicitud, Resultado } from '@/types/interfaces';
import { estadoSolicitudService } from '@/services/proyectos/estadoSolicitud.service';
import { resultadoService } from '@/services/proyectos/resultado.service';
import { useProyectoViews } from '../proyectos/use-proyecto-views';
import { sortProyectoViewsByHierarchy, type ProyectoView } from '../proyectos/types';
import { ahoraSQL, fechaSQL } from '@/lib/fechas';
import { nombreNivel } from '@/lib/procesoNiveles';
import FilaProyecto, { COLUMNAS_FILA } from './fila-proyecto';
import RevisionProyecto from './revision-proyecto';
import AprobarDialog, { type DatosEvaluacion } from './aprobar-dialog';
import { useDatosAprobacion } from './use-datos-aprobacion';
import { cn } from '@/lib/utils';

const normalize = (v: string): string => (v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const esPendiente = (nombre: string) => normalize(nombre).includes('pendiente') && normalize(nombre).includes('aprob');

const TODOS = 'todos';
const SIN_ALINEACION = 'sin';
const FILTROS_INICIALES = { proceso: TODOS, pilar: TODOS, okr: TODOS, responsable: TODOS };

// El proyecto guarda los códigos de sus responsables separados por '&'.
const codigosResponsable = (v: ProyectoView): string[] => (v.proyecto.responsable_proyecto || '').split('&').map((c) => c.trim()).filter(Boolean);

// Bandeja de aprobación: por defecto, la tabla de todos los proyectos pendientes de aprobación o rechazo. Cada fila
// es una tarjeta (nombre, objetivos, responsable, estado y recursos) que se expande para revisar el proyecto completo
// (actividades con responsables y pesos, Gantt, equipo, recursos) y decidir. La decisión registra un nuevo
// estado_solicitud (sin motivo, según lo acordado).
// NOTA: el control por perfil (quién puede aprobar) queda pendiente de definir con el analista.
export default function AprobacionesPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const { proyectoViews, areas, estados, responsables, personas, isLoading, recargar } = useProyectoViews();
    const datos = useDatosAprobacion();
    const [procesando, setProcesando] = useState<number | null>(null);
    const [abierto, setAbierto] = useState<number | null>(null);
    const [filtros, setFiltros] = useState(FILTROS_INICIALES);
    // Proyecto que se está aprobando (pide evaluador y fechas de evaluación).
    const [aprobando, setAprobando] = useState<ProyectoView | null>(null);

    const estadoAprobado = useMemo(
        () => estados.find((e) => e.estado === 'A' && normalize(e.nombre_estado).includes('aprob') && !normalize(e.nombre_estado).includes('pendiente')) || null,
        [estados]
    );
    const estadoRechazado = useMemo(
        () => estados.find((e) => e.estado === 'A' && normalize(e.nombre_estado).includes('rechaz')) || null,
        [estados]
    );

    const pendientes = useMemo(
        () => sortProyectoViewsByHierarchy(proyectoViews.filter((v) => esPendiente(v.estadoSolicitudNombre))),
        [proyectoViews]
    );

    // Pilar y OKR de un proyecto (por su codigo_okr).
    const alineacionDe = (v: ProyectoView) => (v.proyecto.codigo_okr ? datos.okrs.get(v.proyecto.codigo_okr) : undefined);

    const personaMap = useMemo(() => new Map(personas.map((p) => [p.CODIGO, p])), [personas]);
    // El proyecto guarda solo los códigos: aquí se resuelven a los nombres de las personas (si no hay ficha, se muestra el código).
    const nombresResponsables = (v: ProyectoView): string[] => codigosResponsable(v).map((c) => personaMap.get(c)?.NOMBRE || c);

    // Procesos como árbol por niveles (Macroproceso → Proceso → Subproceso…): solo las ramas donde hay proyectos pendientes.
    // Elegir un nivel incluye a todos los proyectos de sus niveles inferiores.
    const arbolProcesos = useMemo(() => {
        const porCodigo = new Map(areas.map((a) => [a.codigo_proceso, a]));
        const tienePadre = (a: { codigo_proceso_padre: number | null }) => !!a.codigo_proceso_padre && porCodigo.has(a.codigo_proceso_padre);
        const hijos = new Map<number, number[]>();
        areas.forEach((a) => {
            if (tienePadre(a)) hijos.set(a.codigo_proceso_padre!, [...(hijos.get(a.codigo_proceso_padre!) || []), a.codigo_proceso]);
        });
        const relevantes = new Set<number>();
        pendientes.forEach((v) => {
            let a = v.areaCodigo ? porCodigo.get(v.areaCodigo) : undefined;
            for (let g = 0; a && g < 20; g++) {
                relevantes.add(a.codigo_proceso);
                a = a.codigo_proceso_padre ? porCodigo.get(a.codigo_proceso_padre) : undefined;
            }
        });
        const nombre = (c: number) => porCodigo.get(c)?.nombre_proceso || '';
        const opciones: { codigo: number; nombre: string; nivel: number }[] = [];
        const recorrer = (codigo: number, nivel: number) => {
            opciones.push({ codigo, nombre: nombre(codigo), nivel });
            (hijos.get(codigo) || []).filter((h) => relevantes.has(h)).sort((x, y) => nombre(x).localeCompare(nombre(y))).forEach((h) => recorrer(h, nivel + 1));
        };
        areas
            .filter((a) => relevantes.has(a.codigo_proceso) && !tienePadre(a))
            .sort((x, y) => x.nombre_proceso.localeCompare(y.nombre_proceso))
            .forEach((a) => recorrer(a.codigo_proceso, 0));
        const descendientes = (codigo: number) => {
            const res = new Set<number>([codigo]);
            const pila = [codigo];
            while (pila.length) (hijos.get(pila.pop()!) || []).forEach((h) => { if (!res.has(h)) { res.add(h); pila.push(h); } });
            return res;
        };
        return { opciones, descendientes };
    }, [areas, pendientes]);

    // Opciones de pilar y OKR: solo lo que existe entre los proyectos pendientes.
    const opciones = useMemo(() => {
        const pilares = new Map<number, string>();
        const okrs = new Map<number, { nombre: string; pilar: number }>();
        let haySinAlineacion = false;
        pendientes.forEach((v) => {
            const a = v.proyecto.codigo_okr ? datos.okrs.get(v.proyecto.codigo_okr) : undefined;
            if (!a) { haySinAlineacion = true; return; }
            pilares.set(a.codigoPilar, a.pilar || `Pilar ${a.codigoPilar}`);
            okrs.set(a.codigoOkr, { nombre: a.okr, pilar: a.codigoPilar });
        });
        return {
            pilares: [...pilares.entries()].sort((a, b) => a[1].localeCompare(b[1])),
            okrs: [...okrs.entries()].sort((a, b) => a[1].nombre.localeCompare(b[1].nombre)),
            haySinAlineacion,
        };
    }, [pendientes, datos.okrs]);

    // Responsables de los proyectos ya definidos: cada persona una sola vez, con su cantidad de proyectos pendientes.
    const opcionesResponsable = useMemo(() => {
        const cuenta = new Map<string, number>();
        pendientes.forEach((v) => new Set(codigosResponsable(v)).forEach((c) => cuenta.set(c, (cuenta.get(c) || 0) + 1)));
        return [...cuenta.entries()]
            .map(([codigo, n]) => ({ codigo, n, nombre: personaMap.get(codigo)?.NOMBRE || codigo }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [pendientes, personaMap]);

    // El OKR solo se ofrece cuando ya se eligió un pilar.
    const pilarElegido = filtros.pilar !== TODOS && filtros.pilar !== SIN_ALINEACION;
    const okrsDisponibles = opciones.okrs.filter(([, o]) => String(o.pilar) === filtros.pilar);

    const cambiar = (parcial: Partial<typeof FILTROS_INICIALES>) => setFiltros((f) => ({ ...f, ...parcial }));
    const hayFiltros = JSON.stringify(filtros) !== JSON.stringify(FILTROS_INICIALES);

    const visibles = useMemo(() => {
        const enProceso = filtros.proceso !== TODOS ? arbolProcesos.descendientes(Number(filtros.proceso)) : null;
        return pendientes.filter((v) => {
            if (enProceso && (!v.areaCodigo || !enProceso.has(v.areaCodigo))) return false;
            const a = v.proyecto.codigo_okr ? datos.okrs.get(v.proyecto.codigo_okr) : undefined;
            if (filtros.pilar === SIN_ALINEACION) { if (a) return false; }
            else if (filtros.pilar !== TODOS && String(a?.codigoPilar) !== filtros.pilar) return false;
            if (filtros.okr !== TODOS && String(a?.codigoOkr) !== filtros.okr) return false;
            if (filtros.responsable !== TODOS && !codigosResponsable(v).includes(filtros.responsable)) return false;
            return true;
        });
    }, [pendientes, filtros, datos.okrs, arbolProcesos]);

    const faltanEstados = !estadoAprobado || !estadoRechazado;

    const resolver = async (view: ProyectoView, aprobar: boolean, evaluacion?: DatosEvaluacion) => {
        const estado = aprobar ? estadoAprobado : estadoRechazado;
        if (!estado) return;
        setProcesando(view.proyecto.codigo_proyecto);
        try {
            // Al aprobar se registran el evaluador y las fechas de evaluación (tabla resultado). Se guarda antes del
            // estado para que un proyecto aprobado nunca quede sin evaluación definida.
            if (aprobar && evaluacion) {
                await resultadoService.save({
                    codigo_resultado: 0,
                    codigo_proyecto: view.proyecto.codigo_proyecto,
                    categoria_resultado: 'Evaluación',
                    descripcion_resultado: 'Pendiente de evaluación',
                    evaluador_asignado: evaluacion.evaluador,
                    cumple_propuesta: false,
                    fecha_inicio_evaluacion: fechaSQL(evaluacion.inicio),
                    fecha_fin_evaluacion: fechaSQL(evaluacion.fin),
                    usuario_modificacion: user?.usuario || 'admin',
                    fecha_modificacion: ahoraSQL(),
                } as Resultado);
            }
            await estadoSolicitudService.save({
                codigo_estado_solicitud: 0,
                codigo_estado: estado.codigo_estado,
                codigo_solicitud: view.proyecto.codigo_solicitud,
                estado: 'A',
                usuario_modificacion: user?.usuario || 'admin',
                fecha_modificacion: ahoraSQL(),
            } as EstadoSolicitud);
            toast({
                title: aprobar ? 'Proyecto aprobado' : 'Proyecto rechazado',
                description: `"${view.proyecto.nombre_proyecto}" quedó como ${estado.nombre_estado}.`,
            });
            setAbierto(null);
            setAprobando(null);
            recargar();
        } catch (error) {
            const mensaje = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
            toast({ title: 'Error al guardar', description: mensaje, variant: 'destructive' });
        } finally {
            setProcesando(null);
        }
    };

    return (
        <div className="flex flex-col gap-4 p-4 md:p-6">
            <Card>
                <CardHeader>
                    <div className="space-y-1.5">
                        <CardTitle>Aprobaciones</CardTitle>
                        <CardDescription>
                            Proyectos pendientes de aprobación o rechazo. Haz clic en uno para ver el proyecto completo: actividades, responsables, pesos y cronograma.
                        </CardDescription>
                    </div>
                </CardHeader>
            </Card>

            {faltanEstados && !isLoading && (
                <Card className="border-destructive">
                    <CardContent className="py-4 text-sm text-destructive">
                        Faltan estados en el catálogo: se necesitan <strong>"Aprobado"</strong> y <strong>"Rechazado"</strong> para poder resolver las solicitudes. Créalos en el catálogo de estados.
                    </CardContent>
                </Card>
            )}

            {isLoading ? (
                <div className="flex flex-col gap-3">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
                </div>
            ) : pendientes.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Inbox className="h-6 w-6" />
                        </div>
                        <p className="font-medium">No hay solicitudes pendientes de aprobación</p>
                        <p className="text-sm text-muted-foreground">Cuando se cree un proyecto aparecerá aquí para su revisión.</p>
                    </CardContent>
                </Card>
            ) : (
                <section aria-label="Proyectos pendientes de aprobación" className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">
                        <strong className="text-foreground">{visibles.length}</strong> {visibles.length === 1 ? 'proyecto pendiente' : 'proyectos pendientes'}
                        {visibles.length !== pendientes.length && ` de ${pendientes.length}`}
                    </p>

                    {/* Filtros */}
                    <Card>
                        <CardContent className="flex flex-col gap-3 p-4">
                            <div className={cn('grid gap-3 sm:grid-cols-2', pilarElegido ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
                                <div className="grid gap-1.5">
                                    <Label className="text-xs">Proceso</Label>
                                    <Select value={filtros.proceso} onValueChange={(v) => cambiar({ proceso: v })}>
                                        <SelectTrigger aria-label="Filtrar por proceso"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={TODOS}>Todos los procesos</SelectItem>
                                            {arbolProcesos.opciones.map((o) => (
                                                // La sangría y la etiqueta muestran el nivel: Macroproceso → Proceso → Subproceso…
                                                <SelectItem key={o.codigo} value={String(o.codigo)} style={{ paddingLeft: 32 + o.nivel * 16 }}>
                                                    {o.nombre} <span className="text-xs text-muted-foreground">· {nombreNivel(o.nivel)}</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-1.5">
                                    <Label className="text-xs">Pilar estratégico</Label>
                                    <Select value={filtros.pilar} onValueChange={(v) => cambiar({ pilar: v, okr: TODOS })}>
                                        <SelectTrigger aria-label="Filtrar por pilar"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={TODOS}>Todos los pilares</SelectItem>
                                            {opciones.pilares.map(([codigo, nombre]) => <SelectItem key={codigo} value={String(codigo)}>{nombre}</SelectItem>)}
                                            {opciones.haySinAlineacion && <SelectItem value={SIN_ALINEACION}>Sin pilar ni OKR</SelectItem>}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {pilarElegido && (
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs">OKR <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                                        <Select value={filtros.okr} onValueChange={(v) => cambiar({ okr: v })}>
                                            <SelectTrigger aria-label="Filtrar por OKR"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={TODOS}>Todos los OKR del pilar</SelectItem>
                                                {okrsDisponibles.map(([codigo, o]) => <SelectItem key={codigo} value={String(codigo)}>{o.nombre}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                <div className="grid gap-1.5">
                                    <Label className="text-xs">Responsable</Label>
                                    <Select value={filtros.responsable} onValueChange={(v) => cambiar({ responsable: v })}>
                                        <SelectTrigger aria-label="Filtrar por responsable"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={TODOS}>Todos los responsables</SelectItem>
                                            {opcionesResponsable.map((r) => (
                                                <SelectItem key={r.codigo} value={r.codigo}>
                                                    {r.nombre} <span className="text-xs text-muted-foreground">· {r.n} {r.n === 1 ? 'proyecto' : 'proyectos'}</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            {hayFiltros && (
                                <div className="flex justify-end">
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setFiltros(FILTROS_INICIALES)}>
                                        <FilterX className="mr-2 h-4 w-4" /> Limpiar filtros
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Encabezado de columnas (pantallas anchas) */}
                    <div className={cn('hidden gap-x-4 px-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:grid', COLUMNAS_FILA)}>
                        <span className="pl-6">Proyecto, pilar y OKR</span>
                        <span>Objetivo principal y secundarios</span>
                        <span>Responsable</span>
                        <span>Estado</span>
                        <span>Recursos</span>
                    </div>

                    {visibles.length === 0 ? (
                        <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">Ningún proyecto coincide con los filtros.</p>
                    ) : (
                        visibles.map((v) => {
                            const codigo = v.proyecto.codigo_proyecto;
                            const expandido = abierto === codigo;
                            return (
                                <FilaProyecto
                                    key={codigo}
                                    view={v}
                                    objetivos={datos.objetivos.get(codigo) || []}
                                    recursos={datos.recursos.get(codigo) || []}
                                    alineacion={alineacionDe(v)}
                                    responsable={nombresResponsables(v)}
                                    abierto={expandido}
                                    onToggle={() => setAbierto(expandido ? null : codigo)}
                                >
                                    {/* Solo se monta (y carga sus datos) cuando la fila está expandida */}
                                    <RevisionProyecto
                                        view={v}
                                        responsables={responsables}
                                        personas={personas}
                                        procesando={procesando === codigo}
                                        sinEstados={faltanEstados}
                                        // Todo proyecto (independiente, hijo o integrador) se aprueba definiendo sus evaluadores y fechas de evaluación.
                                        onResolver={(aprobar) => (aprobar ? setAprobando(v) : resolver(v, aprobar))}
                                        pedirEvaluacion
                                        sinCabecera
                                    />
                                </FilaProyecto>
                            );
                        })
                    )}
                </section>
            )}

            <AprobarDialog
                view={aprobando}
                personas={personas}
                procesando={!!aprobando && procesando === aprobando.proyecto.codigo_proyecto}
                onOpenChange={(o) => { if (!o) setAprobando(null); }}
                onConfirmar={(datos) => aprobando && resolver(aprobando, true, datos)}
            />
        </div>
    );
}
