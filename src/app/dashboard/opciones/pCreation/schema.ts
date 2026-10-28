
import * as z from 'zod';
import { aFecha } from '@/lib/fechas';
import { MAX_PARTICIPANTES } from '@/lib/actividades';

// Límites de la base (modelo v5). Proyecto sigue en varchar(50); actividad subió a varchar(200).
export const MAX_LEN_50 = 50;
export const MAX_LEN_200 = 200;

// Un participante de la actividad. Si la actividad tiene un solo participante se guarda como una
// sola fila; si tiene 2 o 3, cada participante es una subactividad (codigo_actividad_padre).
export const participanteSchema = z.object({
    /** codigo de la subactividad (solo cuando la actividad tiene 2+ participantes). */
    codigo_actividad: z.number().optional(),
    codigo_responsable: z.number({ required_error: "El responsable es requerido." }).min(1, "El responsable es requerido."),
    fecha_inicio_actividad: z.string().min(1, "La fecha de inicio es requerida."),
    fecha_fin_actividad: z.string().min(1, "La fecha de fin es requerida."),
    /** Peso del participante dentro del proyecto (calculado automáticamente). */
    peso_actividad: z.coerce.number(),
});

export const actividadSchema = z.object({
    codigo_actividad: z.number().optional(),
    nombre_actividad: z.string().min(1, "El nombre de la actividad es requerido.").max(MAX_LEN_200, `Máximo ${MAX_LEN_200} caracteres.`),
    descripcion_actividad: z.string().min(1, "La descripción es requerida.").max(MAX_LEN_200, `Máximo ${MAX_LEN_200} caracteres.`),
    fecha_inicio_actividad: z.string().min(1, "La fecha de inicio es requerida."),
    fecha_fin_actividad: z.string().min(1, "La fecha de fin es requerida."),
    participantes: z
        .array(participanteSchema)
        .min(1, "Agrega al menos un participante.")
        .max(MAX_PARTICIPANTES, `Máximo ${MAX_PARTICIPANTES} participantes por actividad.`),
});

// Un recurso asignado al proyecto. El tipo y el recurso pueden ser existentes (código > 0) o nuevos
// (código 0 → se crean al vuelo con los datos de abajo). valor_recurso es la cantidad para este proyecto.
export const recursoProyectoSchema = z.object({
    codigo_proyecto_recurso: z.number().optional(),
    codigo_tipo_recurso: z.coerce.number(),   // tipo existente (obligatorio)
    nombre_tipo: z.string().optional(),       // requerido si el tipo es nuevo
    proveniencia: z.string().optional(),       // tipo nuevo
    codigo_recurso: z.coerce.number(),        // 0 = recurso nuevo
    nombre_recurso: z.string().optional(),    // requerido si el recurso es nuevo
    costo: z.string().optional(),             // costo unitario (recurso nuevo)
    valor_recurso: z.string().min(1, 'Indica el valor/cantidad.'),
}).superRefine((r, ctx) => {
    // Los tipos de recurso los administra el administrador en Parámetros: aquí solo se elige uno existente.
    if (!r.codigo_tipo_recurso) {
        ctx.addIssue({ code: 'custom', path: ['codigo_tipo_recurso'], message: 'Seleccione un tipo de recurso.' });
    }
    // Los recursos también se administran en Parámetros: aquí solo se elige uno existente.
    if (!r.codigo_recurso) {
        ctx.addIssue({ code: 'custom', path: ['codigo_recurso'], message: 'Seleccione un recurso.' });
    }
});

// Fecha calendario (hora de Ecuador) de "YYYY-MM-DD", "YYYY-MM-DDTHH:mm" o un valor de la API.
export const parseLocalDate = (value: string): Date | null => aFecha(value);

export const proyectoWizardSchema = z.object({
    codigo_proceso: z.number({ required_error: "El proceso es requerido." }).min(1, "El proceso es requerido."),
    codigo_padre: z.number().optional(),
    codigo_tipo_proyecto: z.number({ required_error: "El tipo de proyecto es requerido." }).min(1, "El tipo de proyecto es requerido."),
    nombre_proyecto: z.string().min(1, "El nombre del proyecto es requerido.").max(MAX_LEN_50, `Máximo ${MAX_LEN_50} caracteres.`),
    descripcion_proyecto: z.string().min(1, "La descripción es requerida.").max(MAX_LEN_50, `Máximo ${MAX_LEN_50} caracteres.`),
    responsable_proyecto: z.string().min(1, "El responsable del proyecto es requerido.").max(MAX_LEN_50, `Máximo ${MAX_LEN_50} caracteres (selecciona menos personas o usa nombres más cortos).`),
    objetivo_principal: z.string().min(1, "El objetivo principal es requerido.").max(MAX_LEN_50, `Máximo ${MAX_LEN_50} caracteres.`),
    // Modelo v6: resultados esperados del proyecto (se guarda como un registro en 'resultado').
    resultados_esperados: z.string().max(MAX_LEN_200, `Máximo ${MAX_LEN_200} caracteres.`).optional(),
    // Recursos asignados al proyecto (opcional).
    recursos: z.array(recursoProyectoSchema),
    fecha_inicio: z.string().min(1, "La fecha de inicio es requerida."),
    fecha_fin: z.string().min(1, "La fecha de fin es requerida."),
    actividades: z.array(actividadSchema).min(1, "Debe agregar al menos una actividad."),
}).superRefine((data, ctx) => {
    const proyectoInicio = parseLocalDate(data.fecha_inicio);
    const proyectoFin = parseLocalDate(data.fecha_fin);
    if (!proyectoInicio || !proyectoFin) return;

    // Un proyecto se planifica dentro de un solo año calendario.
    if (proyectoFin.getFullYear() !== proyectoInicio.getFullYear()) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `El proyecto debe planificarse dentro del año ${proyectoInicio.getFullYear()} (no puede pasar del 31/12/${proyectoInicio.getFullYear()}).`,
            path: ['fecha_fin'],
        });
    }

    const fueraDe = (valor: string, min: Date, max: Date) => {
        const d = parseLocalDate(valor);
        return !!d && (d < min || d > max);
    };

    data.actividades.forEach((actividad, index) => {
        if (fueraDe(actividad.fecha_inicio_actividad, proyectoInicio, proyectoFin)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "La fecha de inicio de la actividad debe estar dentro del rango del proyecto.",
                path: ['actividades', index, 'fecha_inicio_actividad'],
            });
        }
        if (fueraDe(actividad.fecha_fin_actividad, proyectoInicio, proyectoFin)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "La fecha de fin de la actividad debe estar dentro del rango del proyecto.",
                path: ['actividades', index, 'fecha_fin_actividad'],
            });
        }

        const actInicio = parseLocalDate(actividad.fecha_inicio_actividad);
        const actFin = parseLocalDate(actividad.fecha_fin_actividad);
        const vistos = new Set<number>();
        actividad.participantes.forEach((p, pIndex) => {
            if (p.codigo_responsable && vistos.has(p.codigo_responsable)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Esta persona ya participa en la actividad.",
                    path: ['actividades', index, 'participantes', pIndex, 'codigo_responsable'],
                });
            }
            vistos.add(p.codigo_responsable);

            if (actividad.participantes.length > 1 && actInicio && actFin &&
                (fueraDe(p.fecha_inicio_actividad, actInicio, actFin) || fueraDe(p.fecha_fin_actividad, actInicio, actFin))) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Las fechas del participante deben estar dentro del rango de la actividad.",
                    path: ['actividades', index, 'participantes', pIndex, 'fecha_fin_actividad'],
                });
            }
        });
    });
});

export type ProyectoWizardValues = z.infer<typeof proyectoWizardSchema>;
export type ActividadWizardValues = z.infer<typeof actividadSchema>;
export type ParticipanteWizardValues = z.infer<typeof participanteSchema>;
export type RecursoProyectoValues = z.infer<typeof recursoProyectoSchema>;

export const defaultRecursoProyecto: RecursoProyectoValues = {
    codigo_proyecto_recurso: 0,
    codigo_tipo_recurso: 0,
    nombre_tipo: '',
    proveniencia: '',
    codigo_recurso: 0,
    nombre_recurso: '',
    costo: '',
    valor_recurso: '',
};

export const defaultParticipante: ParticipanteWizardValues = {
    codigo_actividad: 0,
    codigo_responsable: 0,
    fecha_inicio_actividad: '',
    fecha_fin_actividad: '',
    peso_actividad: 0,
};

export const defaultActividad: ActividadWizardValues = {
    codigo_actividad: 0,
    nombre_actividad: '',
    descripcion_actividad: '',
    fecha_inicio_actividad: '',
    fecha_fin_actividad: '',
    participantes: [{ ...defaultParticipante }],
};

export const defaultWizardValues: ProyectoWizardValues = {
    codigo_proceso: 0,
    codigo_padre: 0,
    codigo_tipo_proyecto: 0,
    nombre_proyecto: '',
    descripcion_proyecto: '',
    responsable_proyecto: '',
    objetivo_principal: '',
    resultados_esperados: '',
    fecha_inicio: '',
    fecha_fin: '',
    recursos: [],
    actividades: [{ ...defaultActividad, participantes: [{ ...defaultParticipante }] }],
};
