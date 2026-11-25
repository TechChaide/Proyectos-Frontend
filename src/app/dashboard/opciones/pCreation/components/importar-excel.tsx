"use client";

import { useMemo, useRef, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { AlertTriangle, CheckCircle2, CornerDownRight, Download, FileSpreadsheet, ListTree, Loader2, Upload, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { FichaSocialHistorica, Responsable } from '@/types/interfaces';
import { MAX_PARTICIPANTES } from '@/lib/actividades';
import { cn } from '@/lib/utils';
import {
    estadoDeFila, generarPlantilla, leerPlantilla,
    type ActividadLeida, type ContextoPlantilla, type ResultadoImportacion,
} from '@/lib/plantilla-actividades';
import type { ActividadWizardValues, ProyectoWizardValues } from '../schema';

interface ImportarExcelProps {
    form: UseFormReturn<ProyectoWizardValues>;
    responsables: Responsable[];
    personas: FichaSocialHistorica[];
}

const norm = (v: string) => (v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const fmt = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '—');

// Carga de objetivos y plan de actividades desde Excel: descarga de la plantilla del proyecto, lectura con vista previa
// (semáforo por fila, responsables por elegir) y llenado del formulario, reemplazando o agregando a lo que ya hay.
export default function ImportarExcel({ form, responsables, personas }: ImportarExcelProps) {
    const { toast } = useToast();
    const inputRef = useRef<HTMLInputElement>(null);
    const [generando, setGenerando] = useState(false);
    const [leyendo, setLeyendo] = useState(false);
    const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
    const [nombreArchivo, setNombreArchivo] = useState('');
    // Responsables elegidos en la vista previa cuando el texto era ambiguo: "fila-índice" → codigo_responsable.
    const [elegidos, setElegidos] = useState<Record<string, number>>({});

    const personaMap = useMemo(() => new Map(personas.map((p) => [p.CODIGO, p])), [personas]);
    const nombreResp = (codigo: number | null) => {
        const r = responsables.find((x) => x.codigo_responsable === codigo);
        return r ? `${personaMap.get(r.codigo_empleado)?.NOMBRE || r.codigo_empleado} (${r.codigo_empleado})` : '';
    };

    const contexto = (): ContextoPlantilla | null => {
        const v = form.getValues();
        if (!v.fecha_inicio || !v.fecha_fin) return null;
        return {
            nombreProyecto: v.nombre_proyecto,
            inicio: v.fecha_inicio.slice(0, 10),
            fin: v.fecha_fin.slice(0, 10),
            maxParticipantes: MAX_PARTICIPANTES,
            responsables: responsables.map((r) => {
                const p = personaMap.get(r.codigo_empleado);
                return { codigo: r.codigo_responsable, empleado: r.codigo_empleado, nombre: p?.NOMBRE || '', cedula: p?.CEDULA };
            }),
        };
    };
    const sinFechas = () => toast({ title: 'Faltan las fechas del proyecto', description: 'Define primero las fechas de inicio y fin en el paso "Proyecto": la plantilla y la carga se validan contra ellas.', variant: 'destructive' });

    const descargar = async () => {
        const ctx = contexto();
        if (!ctx) return sinFechas();
        setGenerando(true);
        try {
            const blob = await generarPlantilla(ctx);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const base = (ctx.nombreProyecto || 'Proyecto').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').slice(0, 60);
            a.href = url;
            a.download = `Plantilla_Actividades_${base}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (e) {
            toast({ title: 'No se pudo generar la plantilla', description: e instanceof Error ? e.message : 'Error inesperado.', variant: 'destructive' });
        } finally {
            setGenerando(false);
        }
    };

    const alElegirArchivo = async (archivo?: File) => {
        if (!archivo) return;
        const ctx = contexto();
        if (!ctx) return sinFechas();
        setLeyendo(true);
        try {
            const r = await leerPlantilla(archivo, ctx);
            setElegidos({});
            setNombreArchivo(archivo.name);
            setResultado(r);
        } catch (e) {
            toast({ title: 'No se pudo leer el Excel', description: e instanceof Error ? e.message : 'Error inesperado.', variant: 'destructive' });
        } finally {
            setLeyendo(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    // Filas con las elecciones de la vista previa aplicadas.
    const filas = useMemo<(ActividadLeida & { estado: ReturnType<typeof estadoDeFila> })[]>(() => {
        if (!resultado) return [];
        return resultado.actividades.map((a) => {
            const responsablesFila = a.responsables.map((r, i) => (r.codigo === null && elegidos[`${a.fila}-${i}`] ? { ...r, codigo: elegidos[`${a.fila}-${i}`] } : r));
            const conEleccion = { ...a, responsables: responsablesFila };
            return { ...conEleccion, estado: estadoDeFila(conEleccion) };
        });
    }, [resultado, elegidos]);
    const cargables = filas.filter((f) => f.estado !== 'error');
    const conteo = { ok: filas.filter((f) => f.estado === 'ok').length, aviso: filas.filter((f) => f.estado === 'aviso').length, error: filas.filter((f) => f.estado === 'error').length };

    const actual = form.getValues();
    const hayDatos = !!(actual.descripcion_proyecto?.trim() || actual.objetivo_principal?.trim() || actual.objetivos?.length || actual.actividades?.some((a) => a.nombre_actividad?.trim()));

    const aplicar = (modo: 'reemplazar' | 'agregar') => {
        if (!resultado) return;
        const v = form.getValues();
        const opciones = { shouldDirty: true };
        // Varios responsables comparten las fechas de su actividad/subactividad.
        const tarea = (f: (typeof cargables)[number]) => ({
            codigo_actividad: 0,
            nombre_actividad: f.nombre,
            descripcion_actividad: f.descripcion,
            fecha_inicio_actividad: f.inicio,
            fecha_fin_actividad: f.fin,
            participantes: f.responsables.filter((r) => r.codigo !== null).map((r) => ({
                codigo_actividad: 0,
                codigo_responsable: r.codigo as number,
                fecha_inicio_actividad: f.inicio,
                fecha_fin_actividad: f.fin,
                peso_actividad: 0,
            })),
        });
        const nuevas: ActividadWizardValues[] = cargables
            .filter((f) => f.padre === null)
            .map((f) => (f.contenedor
                ? { ...tarea(f), participantes: [], subactividades: cargables.filter((sub) => sub.padre === f.numero).map(tarea) }
                : { ...tarea(f), subactividades: [] }));
        const totalSubs = nuevas.reduce((n, a) => n + (a.subactividades?.length ?? 0), 0);

        const ponerTexto = (campo: 'descripcion_proyecto' | 'objetivo_principal', valor: string) => {
            if (!valor) return;
            if (modo === 'reemplazar' || !v[campo]?.trim()) form.setValue(campo, valor, opciones);
        };
        ponerTexto('descripcion_proyecto', resultado.descripcion);
        ponerTexto('objetivo_principal', resultado.objetivoPrincipal);

        if (resultado.objetivos.length) {
            const nuevosObj = resultado.objetivos.map((t) => ({ codigo_objetivo: 0, descripcion_objetivo: t }));
            if (modo === 'reemplazar') form.setValue('objetivos', nuevosObj, opciones);
            else {
                const ya = new Set((v.objetivos || []).map((o) => norm(o.descripcion_objetivo)));
                form.setValue('objetivos', [...(v.objetivos || []), ...nuevosObj.filter((o) => !ya.has(norm(o.descripcion_objetivo)))], opciones);
            }
        }

        if (nuevas.length) {
            const existentes = (v.actividades || []).filter((a) => a.nombre_actividad?.trim());
            const lista = (modo === 'reemplazar' ? nuevas : [...existentes, ...nuevas])
                .sort((a, b) => a.fecha_inicio_actividad.localeCompare(b.fecha_inicio_actividad));
            form.setValue('actividades', lista, opciones);
        }
        form.clearErrors(['descripcion_proyecto', 'objetivo_principal', 'objetivos', 'actividades']);

        toast({
            title: 'Excel cargado',
            description: `${nuevas.length} actividad(es)${totalSubs ? `, ${totalSubs} subactividad(es)` : ''} y ${resultado.objetivos.length} objetivo(s) específico(s) ${modo === 'reemplazar' ? 'reemplazaron lo anterior' : 'se agregaron'}.${conteo.error ? ` ${conteo.error} fila(s) no se cargaron.` : ''} Revisa el plan y el Gantt antes de guardar.`,
        });
        setResultado(null);
    };

    return (
        <>
            <div className="flex flex-col gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-green-700 text-white"><FileSpreadsheet className="h-5 w-5" /></span>
                    <div>
                        <p className="text-sm font-semibold">¿Tienes el plan en Excel?</p>
                        <p className="text-xs text-muted-foreground">Descarga la plantilla de este proyecto, pide que la llenen y cárgala: se llenan los objetivos y las actividades, y se arma el Gantt.</p>
                    </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={descargar} disabled={generando}>
                        {generando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Descargar plantilla
                    </Button>
                    <Button type="button" size="sm" onClick={() => (contexto() ? inputRef.current?.click() : sinFechas())} disabled={leyendo}>
                        {leyendo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Cargar Excel
                    </Button>
                    <input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => alElegirArchivo(e.target.files?.[0])} />
                </div>
            </div>

            <Dialog open={!!resultado} onOpenChange={(o) => !o && setResultado(null)}>
                <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-green-700" /> Vista previa de la carga</DialogTitle>
                        <DialogDescription>
                            <span className="font-medium text-foreground">{nombreArchivo}</span>. Revisa lo que se va a cargar; nada cambia en el formulario hasta que lo apliques.
                        </DialogDescription>
                    </DialogHeader>

                    {resultado && (
                        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
                            <div className="flex flex-wrap gap-2 text-xs">
                                <Badge variant="outline" className="gap-1 border-green-600/40 text-green-700 dark:text-green-400"><CheckCircle2 className="h-3 w-3" /> {conteo.ok} listas</Badge>
                                <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3 w-3" /> {conteo.aviso} con ajustes</Badge>
                                <Badge variant="outline" className="gap-1 border-destructive/50 text-destructive"><XCircle className="h-3 w-3" /> {conteo.error} no se cargarán</Badge>
                                <Badge variant="outline">{resultado.objetivos.length} objetivo(s) específico(s)</Badge>
                            </div>

                            {resultado.avisos.length > 0 && (
                                <ul className="list-disc rounded-md border border-amber-500/40 bg-amber-500/10 py-2 pl-8 pr-3 text-xs text-amber-900 dark:text-amber-200">
                                    {resultado.avisos.map((a, i) => <li key={i}>{a}</li>)}
                                </ul>
                            )}

                            <section className="rounded-md border">
                                <p className="border-b px-3 py-2 text-sm font-medium">Descripción y objetivos</p>
                                <dl className="grid gap-2 px-3 py-2 text-sm">
                                    <div><dt className="text-xs text-muted-foreground">Descripción del proyecto</dt><dd>{resultado.descripcion || <span className="text-muted-foreground">Vacía en el Excel (no se cambia)</span>}</dd></div>
                                    <div><dt className="text-xs text-muted-foreground">Objetivo principal</dt><dd>{resultado.objetivoPrincipal || <span className="text-muted-foreground">Vacío en el Excel (no se cambia)</span>}</dd></div>
                                    <div>
                                        <dt className="text-xs text-muted-foreground">Objetivos específicos</dt>
                                        <dd>{resultado.objetivos.length ? <ol className="list-decimal pl-5">{resultado.objetivos.map((o, i) => <li key={i}>{o}</li>)}</ol> : <span className="text-muted-foreground">Ninguno en el Excel</span>}</dd>
                                    </div>
                                </dl>
                            </section>

                            <section className="rounded-md border">
                                <p className="border-b px-3 py-2 text-sm font-medium">Actividades y subactividades ({filas.length}) · ordenadas por fecha</p>
                                {filas.length === 0 ? (
                                    <p className="px-3 py-2 text-sm text-muted-foreground">El Excel no tiene actividades.</p>
                                ) : (
                                    <ul className="divide-y">
                                        {filas.map((f) => (
                                            <li key={f.fila} className={cn('flex gap-3 px-3 py-2 text-sm', f.estado === 'error' && 'bg-destructive/5', f.padre !== null && 'pl-10')}>
                                                <span className="pt-0.5">
                                                    {f.estado === 'ok' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : f.estado === 'aviso' ? <AlertTriangle className="h-4 w-4 text-amber-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                                                </span>
                                                <div className="flex min-w-0 flex-1 flex-col gap-1">
                                                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                                                        <p className={cn('flex items-center gap-1.5 font-medium', f.estado === 'error' && 'text-muted-foreground line-through', f.padre !== null && 'font-normal')}>
                                                            {f.padre !== null && <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                                                            {f.padre !== null && <span className="text-xs text-muted-foreground no-underline">Subactividad ·</span>}
                                                            {f.nombre || '(sin nombre)'}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground tabular-nums">Fila {f.fila} · {fmt(f.inicio)} – {fmt(f.fin)}</p>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        {f.contenedor && <Badge variant="outline" className="gap-1 border-primary/40 font-normal text-primary"><ListTree className="h-3 w-3" /> {filas.filter((x) => x.padre === f.numero).length} subactividad(es)</Badge>}
                                                        {f.responsables.map((r, i) => r.codigo !== null ? (
                                                            <Badge key={i} variant="secondary" className="font-normal">{nombreResp(r.codigo)}</Badge>
                                                        ) : (
                                                            <Select key={i} value={elegidos[`${f.fila}-${i}`] ? String(elegidos[`${f.fila}-${i}`]) : undefined} onValueChange={(val) => setElegidos((e) => ({ ...e, [`${f.fila}-${i}`]: Number(val) }))}>
                                                                <SelectTrigger className="h-7 w-auto min-w-56 border-amber-500 text-xs"><SelectValue placeholder={`¿Quién es "${r.texto}"?`} /></SelectTrigger>
                                                                <SelectContent>
                                                                    {r.candidatos.map((c) => <SelectItem key={c} value={String(c)}>{nombreResp(c)}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                        ))}
                                                    </div>
                                                    {f.mensajes.length > 0 && (
                                                        <ul className={cn('text-xs', f.estado === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400')}>
                                                            {f.mensajes.map((m, i) => <li key={i}>• {m}</li>)}
                                                        </ul>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        </div>
                    )}

                    <DialogFooter className="flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                        <p className="text-xs text-muted-foreground">
                            {hayDatos
                                ? 'Este paso ya tiene datos. "Reemplazar" borra las actividades y objetivos actuales; "Agregar" los conserva y suma lo del Excel.'
                                : 'Se llenarán la descripción, los objetivos y las actividades.'}
                        </p>
                        <div className="flex flex-wrap justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setResultado(null)}>Cancelar</Button>
                            {hayDatos ? (
                                <>
                                    <Button type="button" variant="secondary" onClick={() => aplicar('agregar')} disabled={cargables.length === 0 && !resultado?.objetivos.length}>Agregar a lo que ya tengo</Button>
                                    <Button type="button" onClick={() => aplicar('reemplazar')} disabled={cargables.length === 0 && !resultado?.objetivos.length}>Reemplazar todo</Button>
                                </>
                            ) : (
                                <Button type="button" onClick={() => aplicar('reemplazar')} disabled={cargables.length === 0 && !resultado?.objetivos.length}>Cargar al formulario</Button>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
