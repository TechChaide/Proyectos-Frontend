
// Rúbricas de calificación por tipo de proyecto (reglas de negocio de Chaide).
// Cada rúbrica tiene 5 criterios, cada uno con peso 20% (suman 100%) y escala 0/1/3/5.
// La nota final = Σ(valor elegido × peso) → escala 0-5; el % = nota/5*100.

export type TipoRubrica = 'MR' | 'MSP' | 'PI';

export interface NivelRubrica {
    valor: number;        // 0 | 1 | 3 | 5
    descripcion: string;  // descriptor del nivel (guía para el evaluador)
}

export interface CriterioRubrica {
    clave: string;        // id estable del criterio
    grupo: string;        // nombre visible del criterio
    detalle?: string;     // qué mide (sub-indicadores)
    peso: number;         // fracción (0.20)
    niveles: NivelRubrica[];
}

export interface Rubrica {
    codigo: TipoRubrica;
    nombre: string;
    criterios: CriterioRubrica[];
}

const PESO = 0.2;

// Criterios compartidos (Innovación y Nivel de Servicio son iguales en MR y MSP/PI).
const INNOVACION: CriterioRubrica = {
    clave: 'innovacion',
    grupo: 'Innovación (Cambio)',
    detalle: 'Originalidad / estandarización',
    peso: PESO,
    niveles: [
        { valor: 0, descripcion: 'No genera cambio significativo' },
        { valor: 1, descripcion: 'Réplica; proceso existente; estandariza lo que hacemos actualmente' },
        { valor: 3, descripcion: 'Adaptación; proceso existente permite generar un nuevo estándar' },
        { valor: 5, descripcion: 'Original; crea una nueva forma de hacer las cosas' },
    ],
};

const NIVEL_SERVICIO: CriterioRubrica = {
    clave: 'nivel_servicio',
    grupo: 'Nivel de Servicio',
    detalle: 'Fortalecimiento de pilares (facilidad, comunicación, conocimiento, cumplimiento, contactabilidad, calidez)',
    peso: PESO,
    niveles: [
        { valor: 0, descripcion: 'No genera beneficio' },
        { valor: 1, descripcion: 'Fortalece 1 a 2 pilares' },
        { valor: 3, descripcion: 'Fortalece 3 a 4 pilares' },
        { valor: 5, descripcion: 'Fortalece 5 a 6 pilares' },
    ],
};

// ───────────────────────── MR (Mejoras Rápidas) ─────────────────────────
const CRITERIOS_MR: CriterioRubrica[] = [
    {
        clave: 'calidad',
        grupo: 'Calidad (Reducción de desperdicios)',
        detalle: 'Ahorros generados ($/año) y aseguramiento de la calidad',
        peso: PESO,
        niveles: [
            { valor: 0, descripcion: 'No genera beneficio' },
            { valor: 1, descripcion: 'Ahorros < USD 500. Facilita identificación' },
            { valor: 3, descripcion: 'Ahorros USD 500 – 1000. Disminución de desperdicio' },
            { valor: 5, descripcion: 'Ahorros > USD 1000. Eliminación de desperdicio + estandarización (ITE, 3/5, 10 min, mantenimiento autónomo)' },
        ],
    },
    INNOVACION,
    {
        clave: 'sostenibilidad',
        grupo: 'Sostenibilidad',
        detalle: 'Reducción de impactos ambientales e impacto en seguridad del personal',
        peso: PESO,
        niveles: [
            { valor: 0, descripcion: 'No genera beneficio' },
            { valor: 1, descripcion: 'Reducción ambiental < 1%. Seguridad: reducción sin cambiar nivel de riesgo' },
            { valor: 3, descripcion: 'Reducción ambiental 1% – 5%. Seguridad: mejora 1 nivel' },
            { valor: 5, descripcion: 'Reducción ambiental > 5%. Seguridad: mejora > 1 nivel' },
        ],
    },
    NIVEL_SERVICIO,
    {
        clave: 'calidad_analisis',
        grupo: 'Calidad de Análisis',
        detalle: 'Solución del problema, causa raíz, identificación de riesgos',
        peso: PESO,
        niveles: [
            { valor: 0, descripcion: 'No se realiza ningún análisis del problema' },
            { valor: 1, descripcion: 'El análisis se basa en la experiencia' },
            { valor: 3, descripcion: 'Se usaron algunos datos pero no están verificados o analizados' },
            { valor: 5, descripcion: 'Análisis fundamentado en datos completos, confiables y con herramientas adecuadas' },
        ],
    },
];

// ──────────────────── MSP / PI (comparten la misma rúbrica) ────────────────────
const CRITERIOS_MSP_PI: CriterioRubrica[] = [
    {
        clave: 'calidad',
        grupo: 'Calidad (Reducción de desperdicios)',
        detalle: 'Ahorros ($), reducción de inventario, OEE y aseguramiento de la calidad',
        peso: PESO,
        niveles: [
            { valor: 0, descripcion: 'No genera beneficio' },
            { valor: 1, descripcion: 'Ahorros ≤ USD 1000; inventario ≤ 5%; OEE ≤ 1%. Disminución de desperdicios' },
            { valor: 3, descripcion: 'Ahorros USD 1K – 10K; inventario > 5% – < 10%; OEE > 1% – < 3%. Eliminación de desperdicio identificando causa raíz' },
            { valor: 5, descripcion: 'Ahorros ≥ USD 10K; inventario > 20%; OEE > 5%. Eliminación de desperdicio con causa raíz, establece controles y estandariza' },
        ],
    },
    INNOVACION,
    {
        clave: 'sostenibilidad',
        grupo: 'Sostenibilidad',
        detalle: 'Reducción de impactos ambientales, plástico/papel/MP e impacto en seguridad',
        peso: PESO,
        niveles: [
            { valor: 0, descripcion: 'No genera beneficio' },
            { valor: 1, descripcion: 'Impacto ambiental en puesto de trabajo; reducción 1%. Seguridad: mejora 1 nivel' },
            { valor: 3, descripcion: 'Impacto a nivel institucional; reducción 5%. Seguridad: mejora 2 niveles' },
            { valor: 5, descripcion: 'Impacto en productos (incluye MP y gestión proveedores); reducción ≥ 10%. Seguridad: mejora > 2 niveles' },
        ],
    },
    NIVEL_SERVICIO,
    {
        clave: 'calidad_analisis',
        grupo: 'Calidad de Análisis',
        detalle: 'Solución del problema, causa raíz, identificación de riesgos',
        peso: PESO,
        niveles: [
            { valor: 0, descripcion: 'No realizar análisis' },
            { valor: 1, descripcion: 'N1 = Desviación identificada, aplicación 5W' },
            { valor: 3, descripcion: 'N2 = N1 + la solución ataca la causa del problema' },
            { valor: 5, descripcion: 'N3 = N2 + objetivos claramente definidos (3P), análisis de riesgo' },
        ],
    },
];

export const RUBRICAS: Record<TipoRubrica, Rubrica> = {
    MR: { codigo: 'MR', nombre: 'Mejoras Rápidas (MR)', criterios: CRITERIOS_MR },
    MSP: { codigo: 'MSP', nombre: 'Método Solución de Problemas (MSP)', criterios: CRITERIOS_MSP_PI },
    PI: { codigo: 'PI', nombre: 'Proyecto de Innovación (PI)', criterios: CRITERIOS_MSP_PI },
};

// Mapea el NOMBRE del tipo de proyecto a su rúbrica (o al sistema de objetivos individuales).
export type SistemaCalificacion = TipoRubrica | 'INDIVIDUAL';

const norm = (v: string) => (v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function sistemaDeTipo(nombreTipo: string): SistemaCalificacion | null {
    const n = norm(nombreTipo);
    if ((n.includes('mejora') && n.includes('rapid')) || n === 'mr') return 'MR';
    if ((n.includes('solucion') && n.includes('problema')) || n === 'msp') return 'MSP';
    if (n.includes('innovacion') || n === 'pi') return 'PI';
    if (n.includes('objetivo') && n.includes('individual')) return 'INDIVIDUAL';
    return null;
}

// Calcula la nota (0-5) y el % a partir de los puntajes elegidos por criterio (clave → valor).
export function calcularNotaRubrica(rubrica: Rubrica, puntajes: Record<string, number>): { nota: number; pct: number; completa: boolean } {
    let nota = 0;
    let completa = true;
    rubrica.criterios.forEach((c) => {
        const v = puntajes[c.clave];
        if (v === undefined || v === null) completa = false;
        nota += (v ?? 0) * c.peso;
    });
    return { nota, pct: (nota / 5) * 100, completa };
}

// Nota de rúbrica de un proyecto a partir de las filas de `resultado` ("<TIPO>:<criterio>" → "puntaje | nivel").
// Devuelve null si el tipo no usa rúbrica o si aún no tiene ninguna calificación guardada.
export function notaRubricaDeProyecto(
    resultados: { codigo_proyecto: number; categoria_resultado: string; descripcion_resultado: string }[],
    codigoProyecto: number,
    sistema: SistemaCalificacion | null
): { nota: number; pct: number; completa: boolean } | null {
    if (!sistema || sistema === 'INDIVIDUAL') return null;
    const rubrica = RUBRICAS[sistema];
    const puntajes: Record<string, number> = {};
    rubrica.criterios.forEach((c) => {
        const fila = resultados.find((r) => r.codigo_proyecto === codigoProyecto && r.categoria_resultado === `${sistema}:${c.clave}`);
        if (!fila) return;
        const v = parseInt(String(fila.descripcion_resultado), 10);
        if (!Number.isNaN(v)) puntajes[c.clave] = v;
    });
    if (Object.keys(puntajes).length === 0) return null;
    return calcularNotaRubrica(rubrica, puntajes);
}
