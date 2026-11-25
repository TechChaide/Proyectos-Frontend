"use client";

import type { UseFormReturn } from 'react-hook-form';
import { ClipboardCheck } from 'lucide-react';
import type { ProyectoWizardValues } from '../schema';
import ListaTextoEditor from './lista-texto-editor';

interface ResultadosEditorProps {
    form: UseFormReturn<ProyectoWizardValues>;
}

// Resultados esperados del proyecto (tabla `resultado`, categoría "Esperado"): obligatorio al menos uno, sin tope.
// Cada uno se guarda como una fila propia con el `codigo_proyecto` del proyecto.
export default function ResultadosEditor({ form }: ResultadosEditorProps) {
    return (
        <ListaTextoEditor
            form={form}
            nombreLista="resultados_esperados"
            campo="descripcion_resultado"
            nuevoItem={(texto) => ({ codigo_resultado: 0, descripcion_resultado: texto })}
            titulo="Resultados esperados"
            ayuda="Qué se espera lograr con el proyecto. Agrega al menos uno; puedes agregar todos los que necesites."
            placeholder="Ej: Reducción del 15% en reprocesos al cierre del proyecto"
            etiquetaItem="resultado esperado"
            icono={ClipboardCheck}
            requerido
        />
    );
}
