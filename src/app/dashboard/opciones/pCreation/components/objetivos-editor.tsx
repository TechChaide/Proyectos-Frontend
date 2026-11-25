"use client";

import type { UseFormReturn } from 'react-hook-form';
import { Target } from 'lucide-react';
import type { ProyectoWizardValues } from '../schema';
import ListaTextoEditor from './lista-texto-editor';

interface ObjetivosEditorProps {
    form: UseFormReturn<ProyectoWizardValues>;
    /** Exige al menos un objetivo (Proyecto Integrador). */
    requerido?: boolean;
}

// Objetivos específicos del proyecto (tabla `objetivo`, uno o varios por proyecto). Se editan como lista en el
// formulario y se guardan con el `codigo_proyecto` que devuelve el backend al crear/actualizar el proyecto.
export default function ObjetivosEditor({ form, requerido = false }: ObjetivosEditorProps) {
    return (
        <ListaTextoEditor
            form={form}
            nombreLista="objetivos"
            campo="descripcion_objetivo"
            nuevoItem={(texto) => ({ codigo_objetivo: 0, descripcion_objetivo: texto })}
            titulo="Objetivos específicos"
            ayuda="El objetivo principal es el propósito general; aquí van los objetivos concretos con los que se logra. Agrega uno por uno."
            placeholder="Ej: Reducir el desperdicio de espuma al 3% en el segundo semestre"
            etiquetaItem="objetivo"
            icono={Target}
            requerido={requerido}
        />
    );
}
