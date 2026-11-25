"use client";

import { useEffect, useMemo, useState } from 'react';
import { addDays } from 'date-fns';
import { CalendarClock, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import type { FichaSocialHistorica } from '@/types/interfaces';

// resultado.evaluador_asignado es varchar(50): se guardan los códigos de los evaluadores separados por '&'.
const MAX_EVALUADORES = 50;
import { aFecha, aFechaSegura, formatearFecha } from '@/lib/fechas';
import type { ProyectoView } from '../proyectos/types';
import DateRangePicker from '../pCreation/components/date-range-picker';
import EmployeeMultiCombobox from '../pCreation/components/employee-multi-combobox';

export interface DatosEvaluacion {
    /** Códigos de los evaluadores separados por '&' (se guarda en resultado.evaluador_asignado, varchar(50)). */
    evaluador: string;
    /** "YYYY-MM-DD" */
    inicio: string;
    fin: string;
}

interface AprobarDialogProps {
    view: ProyectoView | null;
    personas: FichaSocialHistorica[];
    procesando: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirmar: (datos: DatosEvaluacion) => void;
}

// Al aprobar un proyecto se define su evaluación: quién evalúa y en qué fechas. La evaluación debe empezar
// ESTRICTAMENTE después de terminar el calendario de actividades (la última fecha de fin de sus actividades).
export default function AprobarDialog({ view, personas, procesando, onOpenChange, onConfirmar }: AprobarDialogProps) {
    const [evaluadores, setEvaluadores] = useState('');
    const [inicio, setInicio] = useState('');
    const [fin, setFin] = useState('');
    const [intento, setIntento] = useState(false);

    useEffect(() => {
        if (view) { setEvaluadores(''); setInicio(''); setFin(''); setIntento(false); }
    }, [view]);

    // Fin del calendario de actividades: la última fecha de fin (si no hay actividades, el fin del proyecto).
    const finActividades = useMemo(() => {
        if (!view) return null;
        const fechas = view.actividades.map((a) => aFechaSegura(a.fecha_fin_actividad).getTime()).filter((t) => t > 0);
        return fechas.length ? new Date(Math.max(...fechas)) : aFecha(view.proyecto.fecha_fin);
    }, [view]);
    const minEvaluacion = finActividades ? addDays(finActividades, 1) : undefined;

    const inicioFecha = aFecha(inicio);
    const finFecha = aFecha(fin);
    const errores = {
        evaluador: !evaluadores ? 'Selecciona al menos un evaluador.' : evaluadores.length > MAX_EVALUADORES ? `Demasiados evaluadores: el límite es de ${MAX_EVALUADORES} caracteres en total (selecciona menos personas).` : '',
        fechas: !inicioFecha || !finFecha
            ? 'Define las fechas de inicio y fin de la evaluación.'
            : minEvaluacion && inicioFecha < minEvaluacion
                ? `La evaluación debe empezar después del ${formatearFecha(finActividades)} (fin del calendario de actividades).`
                : finFecha < inicioFecha ? 'La fecha de fin no puede ser anterior al inicio.' : '',
    };
    const valido = !errores.evaluador && !errores.fechas;

    const confirmar = () => {
        setIntento(true);
        if (!valido) return;
        onConfirmar({ evaluador: evaluadores, inicio, fin });
    };

    return (
        <Dialog open={!!view} onOpenChange={(o) => !procesando && onOpenChange(o)}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" /> Aprobar y definir la evaluación</DialogTitle>
                    <DialogDescription>
                        <strong className="text-foreground">{view?.proyecto.nombre_proyecto}</strong> quedará como Aprobado. Indica quiénes lo evaluarán y cuándo.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <div className="grid gap-1.5">
                        <Label>Evaluadores</Label>
                        <EmployeeMultiCombobox value={evaluadores} personas={personas} onChange={setEvaluadores} etiquetaSeleccion="evaluador(es)" disabled={procesando} />
                        <p className="text-xs text-muted-foreground">Puedes agregar varios. Escribe para buscar y presiona Enter para agregar.</p>
                        {(intento || evaluadores.length > MAX_EVALUADORES) && errores.evaluador && <p className="text-xs font-medium text-destructive">{errores.evaluador}</p>}
                    </div>

                    <div className="grid gap-1.5">
                        <Label>Fechas de evaluación (inicio – fin)</Label>
                        <DateRangePicker
                            startValue={inicio}
                            endValue={fin}
                            onChange={(s, e) => { setInicio(s); setFin(e); }}
                            minDate={minEvaluacion}
                            rangoLabel="Disponible desde"
                            disabled={procesando}
                        />
                        <p className="text-xs text-muted-foreground">
                            {view && view.actividades.length === 0 ? 'El proyecto termina el' : 'El calendario de actividades termina el'} <strong className="text-foreground">{formatearFecha(finActividades)}</strong>; la evaluación debe ser posterior.
                        </p>
                        {(intento || (inicio && fin)) && errores.fechas && <p className="text-xs font-medium text-destructive">{errores.fechas}</p>}
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={procesando}>Cancelar</Button>
                    <Button type="button" className="bg-green-600 hover:bg-green-700" onClick={confirmar} disabled={procesando}>
                        {procesando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                        Aprobar proyecto
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
