
import * as z from 'zod';
import { aFecha } from '@/lib/fechas';
import { MAX_PARTICIPANTES } from '@/lib/actividades';

// Límites de la base (modelo v5). Proyecto sigue en varchar(50); actividad subió a varchar(200).
export const MAX_LEN_50 = 50;
export const MAX_LEN_100 = 100;
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

const normNombre = (v: string) => (v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const camposActividad = {
    codigo_actividad: z.number().optional(),
    nombre_actividad: z.string().trim().min(1, "El nombre de la actividad es requerido.").max(MAX_LEN_200, `Máximo ${MAX_LEN_200} caracteres.`),
    descripcion_actividad: z.string().min(1, "La descripción es requerida.").max(MAX_LEN_200, `Máximo ${MAX_LEN_200} caracteres.`),
    fecha_inicio_actividad: z.string().min(1, "La fecha de inicio es requerida."),
    fecha_fin_actividad: z.string().min(1, "La fecha de fin es requerida."),
};

// Subactividad (segundo y último nivel): una tarea con sus propios participantes y fechas.
export const subactividadSchema = z.object({
    ...camposActividad,
    participantes: z
        .array(participanteSchema)
        .min(1, "Agrega al menos un participante.")
        .max(MAX_PARTICIPANTES, `Máximo ${MAX_PARTICIPANTES} participantes por subactividad.`),
});

// Actividad. Si tiene subactividades es un CONTENEDOR: no lleva participantes propios, sus fechas van del inicio de la
// primera subactividad al fin de la última y no se califica. Sin subactividades necesita al menos un participante.
export const actividadSchema = z.object({
    ...camposActividad,
    participantes: z.array(participanteSchema).max(MAX_PARTICIPANTES, `Máximo ${MAX_PARTICIPANTES} participantes por actividad.`),
    subactividades: z.array(subactividadSchema).optional(),
}).superRefine((a, ctx) => {
    const subs = a.subactividades ?? [];
    if (subs.length === 0 && a.participantes.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Agrega al menos un participante o divide la actividad en subactividades.', path: ['participantes'] });
    }
    // Regla del gestor: un hijo con el mismo nombre que su padre es una participación, así que una subactividad no puede
    // llamarse igual que su actividad.
    const nombre = normNombre(a.nombre_actividad);
    const vistos = new Set<string>();
    subs.forEach((s, k) => {
        const n = normNombre(s.nombre_actividad);
        if (!n) return;
        if (n === nombre) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Una subactividad no puede llamarse igual que su actividad.', path: ['subactividades', k, 'nombre_actividad'] });
        else if (vistos.has(n)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Ya hay otra subactividad con este nombre.', path: ['subactividades', k, 'nombre_actividad'] });
        vistos.add(n);
    });
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

// Objetivo específico del proyecto (tabla objetivo, varchar(200)). codigo_objetivo 0 = nuevo.
export const objetivoProyectoSchema = z.object({
    codigo_objetivo: z.number(),
    descripcion_objetivo: z.string().trim().min(1, 'Describe el objetivo o quítalo.').max(MAX_LEN_200, `Máximo ${MAX_LEN_200} caracteres.`),
});

// Resultado esperado del proyecto (tabla resultado, categoría "Esperado", varchar(200)). codigo_resultado 0 = nuevo.
export const resultadoEsperadoSchema = z.object({
    codigo_resultado: z.number(),
    descripcion_resultado: z.string().trim().min(1, 'Describe el resultado o quítalo.').max(MAX_LEN_200, `Máximo ${MAX_LEN_200} caracteres.`),
});

export const proyectoWizardSchema = z.object({
    codigo_proceso: z.number({ required_error: "El proceso es requerido." }).min(1, "El proceso es requerido."),
    codigo_padre: z.number().optional(),
    codigo_tipo_proyecto: z.number({ required_error: "El tipo de proyecto es requerido." }).min(1, "El tipo de proyecto es requerido."),
    // Modelo v7: alineación estratégica. El pilar solo filtra los OKR; en la tabla proyecto se guarda codigo_okr.
    codigo_pilar: z.number().optional(),
    codigo_okr: z.number().optional(),
    nombre_proyecto: z.string().min(1, "El nombre del proyecto es requerido.").max(MAX_LEN_100, `Máximo ${MAX_LEN_100} caracteres.`),
    descripcion_proyecto: z.string().min(1, "La descripción es requerida.").max(MAX_LEN_200, `Máximo ${MAX_LEN_200} caracteres.`),
    responsable_proyecto: z.string().min(1, "El responsable del proyecto es requerido.").max(MAX_LEN_50, `Máximo ${MAX_LEN_50} caracteres (selecciona menos personas o usa nombres más cortos).`),
    objetivo_principal: z.string().min(1, "El objetivo principal es requerido.").max(MAX_LEN_200, `Máximo ${MAX_LEN_200} caracteres.`),
    // Modelo v6: resultados esperados del proyecto (se guarda como un registro en 'resultado').
    // Obligatorio: al menos un resultado esperado (sin tope). Cada uno es una fila de `resultado` con el codigo_proyecto.
    resultados_esperados: z.array(resultadoEsperadoSchema).min(1, 'Agrega al menos un resultado esperado.'),
    // Recursos asignados al proyecto (opcional).
    objetivos: z.array(objetivoProyectoSchema),
    recursos: z.array(recursoProyectoSchema),
    fecha_inicio: z.string().min(1, "La fecha de inicio es requerida."),
    fecha_fin: z.string().min(1, "La fecha de fin es requerida."),
    actividades: z.array(actividadSchema).min(1, "Debe agregar al menos una actividad."),
}).superRefine((data, ctx) => {
    // Proyecto hijo de un integrador: al menos un objetivo específico (se llena en el paso de actividades).
    if (data.codigo_padre && data.objetivos.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Agrega al menos un objetivo específico.', path: ['objetivos'] });
    }
    // Alineación estratégica obligatoria en un proyecto general (el Proyecto Integrador usa otro esquema y no la exige).
    if (!data.codigo_pilar) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecciona el pilar estratégico.', path: ['codigo_pilar'] });
    if (data.codigo_pilar && !data.codigo_okr) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecciona el OKR al que se alinea el proyecto.', path: ['codigo_okr'] });

    const proyectoInicio = parseLocalDate(data.fecha_inicio);
    const proyectoFin = parseLocalDate(data.fecha_fin);
    if (!proyectoInicio || !proyectoFin) return;

    const fueraDe = (valor: string, min: Date, max: Date) => {
        const d = parseLocalDate(valor);
        return !!d && (d < min || d > max);
    };

    // Revisa fechas y participantes de un nodo del plan (actividad sin subactividades, o cada subactividad).
    type Nodo = { fecha_inicio_actividad: string; fecha_fin_actividad: string; participantes: { codigo_responsable: number; fecha_inicio_actividad: string; fecha_fin_actividad: string }[] };
    const revisar = (nodo: Nodo, ruta: (string | number)[]) => {
        if (fueraDe(nodo.fecha_inicio_actividad, proyectoInicio, proyectoFin)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La fecha de inicio debe estar dentro del rango del proyecto.", path: [...ruta, 'fecha_inicio_actividad'] });
        }
        if (fueraDe(nodo.fecha_fin_actividad, proyectoInicio, proyectoFin)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La fecha de fin debe estar dentro del rango del proyecto.", path: [...ruta, 'fecha_fin_actividad'] });
        }
        const actInicio = parseLocalDate(nodo.fecha_inicio_actividad);
        const actFin = parseLocalDate(nodo.fecha_fin_actividad);
        const vistos = new Set<number>();
        nodo.participantes.forEach((p, pIndex) => {
            if (p.codigo_responsable && vistos.has(p.codigo_responsable)) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Esta persona ya participa en la actividad.", path: [...ruta, 'participantes', pIndex, 'codigo_responsable'] });
            }
            vistos.add(p.codigo_responsable);
            if (nodo.participantes.length > 1 && actInicio && actFin &&
                (fueraDe(p.fecha_inicio_actividad, actInicio, actFin) || fueraDe(p.fecha_fin_actividad, actInicio, actFin))) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Las fechas del participante deben estar dentro del rango de la actividad.", path: [...ruta, 'participantes', pIndex, 'fecha_fin_actividad'] });
            }
        });
    };

    data.actividades.forEach((actividad, index) => {
        const subs = actividad.subactividades ?? [];
        revisar(actividad, ['actividades', index]);
        // Las subactividades deben quedar dentro de las fechas de su actividad.
        const actIni = parseLocalDate(actividad.fecha_inicio_actividad);
        const actFin = parseLocalDate(actividad.fecha_fin_actividad);
        subs.forEach((sub, k) => {
            const ruta = ['actividades', index, 'subactividades', k];
            revisar(sub, ruta);
            if (actIni && actFin) {
                if (fueraDe(sub.fecha_inicio_actividad, actIni, actFin)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Debe quedar dentro de las fechas de su actividad.', path: [...ruta, 'fecha_inicio_actividad'] });
                if (fueraDe(sub.fecha_fin_actividad, actIni, actFin)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Debe quedar dentro de las fechas de su actividad.', path: [...ruta, 'fecha_fin_actividad'] });
            }
        });
    });
});

export type ProyectoWizardValues = z.infer<typeof proyectoWizardSchema>;

// Proyecto Integrador (proyecto de caja / padre). Se crea PRIMERO y después se le agregan los proyectos hijos desde su vista
// de estructura. Solo lleva nombre, descripción, director(es) y fechas (todo obligatorio). No lleva proceso, tipo, pilar, OKR,
// objetivos ni resultados propios: sus resultados esperados son los de sus hijos y su nota, el promedio de sus hijos
// aprobados. Los hijos deben quedar dentro de su rango de fechas. (El director va en proyecto.responsable_proyecto.)
export const cajaWizardSchema = z.object({
    nombre_proyecto: z.string().min(1, "El nombre del proyecto es requerido.").max(MAX_LEN_100, `Máximo ${MAX_LEN_100} caracteres.`),
    descripcion_proyecto: z.string().min(1, "La descripción es requerida.").max(MAX_LEN_200, `Máximo ${MAX_LEN_200} caracteres.`),
    responsable_proyecto: z.string().min(1, "El director del proyecto es requerido.").max(MAX_LEN_50, `Máximo ${MAX_LEN_50} caracteres (selecciona menos personas).`),
    fecha_inicio: z.string().min(1, "La fecha de inicio es requerida."),
    fecha_fin: z.string().min(1, "La fecha de fin es requerida."),
}).superRefine((data, ctx) => {
    const inicio = parseLocalDate(data.fecha_inicio);
    const fin = parseLocalDate(data.fecha_fin);
    if (inicio && fin && fin < inicio) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La fecha de fin no puede ser anterior al inicio.', path: ['fecha_fin'] });
    }
});
export type CajaWizardValues = z.infer<typeof cajaWizardSchema>;
export const defaultCajaValues: CajaWizardValues = { nombre_proyecto: '', descripcion_proyecto: '', responsable_proyecto: '', fecha_inicio: '', fecha_fin: '' };
export type ActividadWizardValues = z.infer<typeof actividadSchema>;
export type SubactividadWizardValues = z.infer<typeof subactividadSchema>;
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
    subactividades: [],
};

export const defaultWizardValues: ProyectoWizardValues = {
    codigo_proceso: 0,
    codigo_padre: 0,
    codigo_tipo_proyecto: 0,
    codigo_pilar: 0,
    codigo_okr: 0,
    nombre_proyecto: '',
    descripcion_proyecto: '',
    responsable_proyecto: '',
    objetivo_principal: '',
    resultados_esperados: [],
    fecha_inicio: '',
    fecha_fin: '',
    objetivos: [],
    recursos: [],
    actividades: [{ ...defaultActividad, participantes: [{ ...defaultParticipante }] }],
};
