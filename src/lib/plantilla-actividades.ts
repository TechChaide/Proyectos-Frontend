// Plantilla de Excel para cargar los objetivos y el plan de actividades de un proyecto (paso "Actividades" de pCreation).
// El gestor genera la plantilla para UN proyecto (con sus fechas y la lista de responsables válidos) y luego la lee:
// normaliza fechas, reconoce responsables, aplica los límites del sistema y devuelve un resultado con avisos por fila para
// revisarlo antes de llenar el formulario. Todo ocurre en el navegador (exceljs se carga solo cuando se usa).
//
// Formato (versión 2): el plan se llena como un ESQUEMA. Cada fila dice su Tipo: "Actividad" o "↳ Subactividad"; una
// subactividad pertenece a la actividad que está más arriba. Se sigue leyendo la versión 1 (columna "Subactividad de (N°)").
import type { Workbook, Worksheet, CellValue } from 'exceljs';

export const VERSION_PLANTILLA = 'GP-ACT-2';
const MAX_TEXTO = 200;
const FILAS_ACTIVIDADES = 200;
const FILAS_OBJETIVOS = 30;
const TIPO_ACTIVIDAD = 'Actividad';
const TIPO_SUB = '↳ Subactividad';
const HOJA = { guia: 'Cómo llenar', objetivos: '1. Objetivos', plan: '2. Plan de actividades', ejemplo: 'Ejemplo', personas: 'Personas', meta: 'Meta' } as const;

export interface ResponsablePlantilla {
    /** codigo_responsable (lo que se guarda en la actividad). */
    codigo: number;
    /** Código de empleado. */
    empleado: string;
    nombre: string;
    cedula?: string;
}

export interface ContextoPlantilla {
    nombreProyecto: string;
    /** "YYYY-MM-DD" */
    inicio: string;
    fin: string;
    responsables: ResponsablePlantilla[];
    maxParticipantes: number;
}

export type EstadoFila = 'ok' | 'aviso' | 'error';

export interface ResponsableLeido {
    texto: string;
    /** codigo_responsable reconocido (null = falta elegirlo o no se encontró). */
    codigo: number | null;
    /** Posibles coincidencias cuando el texto es ambiguo. */
    candidatos: number[];
}

export interface ActividadLeida {
    /** Fila del Excel (para que el usuario la ubique). */
    fila: number;
    /** Número interno de la fila dentro del plan. */
    numero: number;
    /** Número de la actividad a la que pertenece (null = actividad de primer nivel). */
    padre: number | null;
    /** Tiene subactividades: no lleva responsables propios y sus subactividades quedan dentro de sus fechas. */
    contenedor: boolean;
    nombre: string;
    descripcion: string;
    inicio: string;
    fin: string;
    responsables: ResponsableLeido[];
    mensajes: string[];
    /** Error que impide importar la fila (sin contar responsables por elegir). */
    error: boolean;
    /** La fila se omite (duplicada). */
    omitida: boolean;
}

export interface ResultadoImportacion {
    descripcion: string;
    objetivoPrincipal: string;
    objetivos: string[];
    actividades: ActividadLeida[];
    /** Avisos generales (versión de plantilla, otro proyecto, textos recortados…). */
    avisos: string[];
}

const norm = (v: string) => (v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const etiquetaPersona = (r: ResponsablePlantilla) => `${r.nombre || r.empleado} (${r.empleado})`;
const pad = (n: number) => String(n).padStart(2, '0');
const isoDeUTC = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const fechaUTC = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fmt = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const letra = (col: number) => String.fromCharCode(64 + col);

async function cargarExcelJS() {
    const mod = await import('exceljs');
    return (mod as unknown as { default?: typeof import('exceljs') }).default ?? mod;
}

// Paleta de la plantilla.
const C = {
    azul: 'FF0B4F9C',
    azulClaro: 'FFDCE8F7',
    gris: 'FFF3F4F6',
    grisTexto: 'FF6B7280',
    entrada: 'FFFFFBEB',      // celdas para escribir (amarillo muy suave)
    borde: 'FFD1D5DB',
    blanco: 'FFFFFFFF',
};

// ------------------------------------------------------------------------------------------------------------------
// Generación de la plantilla
// ------------------------------------------------------------------------------------------------------------------
export async function generarPlantilla(ctx: ContextoPlantilla): Promise<Blob> {
    const ExcelJS = await cargarExcelJS();
    const wb: Workbook = new ExcelJS.Workbook();
    wb.creator = 'Gestor de Proyectos';
    wb.created = new Date();
    const periodo = `${fmt(ctx.inicio)} al ${fmt(ctx.fin)}`;
    const nCols = 5 + ctx.maxParticipantes;
    const borde = { style: 'thin' as const, color: { argb: C.borde } };
    const bordes = { top: borde, left: borde, bottom: borde, right: borde };
    const titulo = (ws: Worksheet, texto: string, sub: string, hasta: number) => {
        ws.mergeCells(1, 1, 1, hasta);
        ws.mergeCells(2, 1, 2, hasta);
        const t = ws.getCell(1, 1);
        t.value = texto;
        t.font = { bold: true, size: 15, color: { argb: C.blanco } };
        t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.azul } };
        t.alignment = { vertical: 'middle', indent: 1 };
        ws.getRow(1).height = 30;
        const s = ws.getCell(2, 1);
        s.value = sub;
        s.font = { italic: true, color: { argb: C.grisTexto } };
        s.alignment = { vertical: 'middle', indent: 1, wrapText: true };
        ws.getRow(2).height = 32;
    };
    const encabezado = (ws: Worksheet, fila: number, desde: number, hasta: number) => {
        for (let c = desde; c <= hasta; c++) {
            const cell = ws.getCell(fila, c);
            cell.font = { bold: true, color: { argb: C.blanco } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
            cell.alignment = { vertical: 'middle', wrapText: true };
            cell.border = bordes;
        }
        ws.getRow(fila).height = 30;
    };
    const entrada = (cell: ReturnType<Worksheet['getCell']>) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.entrada } };
        cell.border = bordes;
        cell.alignment = { vertical: 'top', wrapText: true };
    };
    const largo = (titulo_: string, ayuda: string) => ({
        type: 'textLength' as const, operator: 'lessThanOrEqual' as const, allowBlank: true, formulae: [MAX_TEXTO],
        showErrorMessage: true, errorTitle: 'Texto muy largo', error: `Máximo ${MAX_TEXTO} caracteres.`,
        showInputMessage: true, promptTitle: titulo_, prompt: ayuda,
    });

    // ---------------- Cómo llenar ----------------
    const wsG = wb.addWorksheet(HOJA.guia, { properties: { tabColor: { argb: C.azul } }, views: [{ showGridLines: false }] });
    wsG.getColumn(1).width = 6;
    wsG.getColumn(2).width = 100;
    titulo(wsG, 'Cómo llenar esta plantilla', `${ctx.nombreProyecto || 'Proyecto'} · Periodo del proyecto: ${periodo}`, 2);
    const pasos: [string, string, string[]][] = [
        ['1', 'Hoja "1. Objetivos"', [
            'Escribe la descripción del proyecto y su objetivo principal en las celdas amarillas.',
            'Debajo, un objetivo específico por fila (al menos uno).',
        ]],
        ['2', 'Hoja "2. Plan de actividades"', [
            'Una fila por actividad. En la columna "Tipo" elige "Actividad".',
            `Si una actividad se divide en tareas, escribe cada tarea en las filas de ABAJO y elige "${TIPO_SUB}": pertenecen a la actividad de arriba.`,
            'Una actividad con subactividades: escribe sus fechas y deja los responsables vacíos (van en sus subactividades).',
            'Las subactividades deben quedar dentro de las fechas de su actividad. Ninguna puede llamarse igual que su actividad.',
            `Responsables: elígelos de la lista (máximo ${ctx.maxParticipantes} por fila). Si hay varios, comparten las fechas de la fila.`,
            `Fechas en formato dd/mm/aaaa, dentro del periodo del proyecto (${periodo}).`,
        ]],
        ['3', 'Cárgala en el Gestor', [
            'En el paso "Actividades" presiona "Cargar Excel". Verás una vista previa con lo que se va a cargar antes de aplicarlo.',
            'Mira la hoja "Ejemplo" si tienes dudas. No cambies los nombres de las hojas ni de las columnas.',
        ]],
    ];
    let filaG = 4;
    pasos.forEach(([n, t, lineas]) => {
        const num = wsG.getCell(filaG, 1);
        num.value = n;
        num.font = { bold: true, size: 14, color: { argb: C.blanco } };
        num.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.azul } };
        num.alignment = { horizontal: 'center', vertical: 'middle' };
        const tt = wsG.getCell(filaG, 2);
        tt.value = t;
        tt.font = { bold: true, size: 13, color: { argb: C.azul } };
        wsG.getRow(filaG).height = 24;
        filaG++;
        lineas.forEach((l) => {
            const c = wsG.getCell(filaG, 2);
            c.value = `•  ${l}`;
            c.alignment = { wrapText: true, vertical: 'top' };
            filaG++;
        });
        filaG++;
    });
    const nota = wsG.getCell(filaG, 2);
    nota.value = 'Las celdas amarillas son para escribir. Al seleccionar una celda verás una ayuda de lo que va en ella.';
    nota.font = { italic: true, color: { argb: C.grisTexto } };

    // ---------------- 1. Objetivos ----------------
    const wsO = wb.addWorksheet(HOJA.objetivos, { views: [{ showGridLines: false }] });
    wsO.getColumn(1).width = 30;
    wsO.getColumn(2).width = 95;
    titulo(wsO, '1. Objetivos del proyecto', 'Escribe en las celdas amarillas. Máximo 200 caracteres por celda.', 2);
    const etiquetas: [number, string, string, string][] = [
        [4, 'Descripción del proyecto', 'Descripción', 'Qué abarca el proyecto: qué se va a hacer y dónde.'],
        [5, 'Objetivo principal', 'Objetivo principal', 'El propósito general del proyecto.'],
    ];
    etiquetas.forEach(([f, et, pt, ay]) => {
        const a = wsO.getCell(f, 1);
        a.value = et;
        a.font = { bold: true };
        a.alignment = { vertical: 'top' };
        const b = wsO.getCell(f, 2);
        entrada(b);
        b.dataValidation = largo(pt, ay);
        wsO.getRow(f).height = 48;
    });
    wsO.getCell(7, 1).value = 'N°';
    wsO.getCell(7, 2).value = 'Objetivo específico (uno por fila, al menos uno)';
    encabezado(wsO, 7, 1, 2);
    for (let i = 0; i < FILAS_OBJETIVOS; i++) {
        const f = 8 + i;
        const n = wsO.getCell(f, 1);
        n.value = i + 1;
        n.font = { color: { argb: C.grisTexto } };
        n.alignment = { horizontal: 'center', vertical: 'top' };
        const b = wsO.getCell(f, 2);
        entrada(b);
        b.dataValidation = largo('Objetivo específico', 'Un objetivo concreto con el que se logra el objetivo principal.');
    }

    // ---------------- Personas (oculta) ----------------
    const wsP = wb.addWorksheet(HOJA.personas, { state: 'hidden' });
    wsP.getCell('A1').value = 'Responsable';
    const personas = [...ctx.responsables].sort((a, b) => etiquetaPersona(a).localeCompare(etiquetaPersona(b)));
    personas.forEach((r, i) => { wsP.getCell(i + 2, 1).value = etiquetaPersona(r); });
    const rangoPersonas = `'${HOJA.personas}'!$A$2:$A$${Math.max(2, personas.length + 1)}`;

    // ---------------- 2. Plan de actividades ----------------
    const FILA_ENC = 4;
    const FILA_INI = FILA_ENC + 1;
    const columnas: [string, number][] = [
        ['Tipo', 18], ['Nombre', 42], ['Descripción', 48], ['Fecha inicio', 14], ['Fecha fin', 14],
        ...Array.from({ length: ctx.maxParticipantes }, (_, i) => [`Responsable ${i + 1}`, 34] as [string, number]),
    ];
    const armarPlan = (ws: Worksheet, filas: (string | Date)[][] | null) => {
        titulo(ws, filas ? 'Ejemplo de plan (solo referencia, no se carga)' : `2. Plan de actividades · ${ctx.nombreProyecto || 'Proyecto'}`,
            `Periodo del proyecto: ${periodo}. Las actividades van en filas azules; sus subactividades, justo debajo con Tipo "${TIPO_SUB}".`, nCols);
        // Leyenda
        const ley1 = ws.getCell(3, 1);
        ley1.value = TIPO_ACTIVIDAD;
        ley1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.azulClaro } };
        ley1.font = { bold: true };
        const ley2 = ws.getCell(3, 2);
        ley2.value = `${TIPO_SUB} (pertenece a la actividad de arriba)`;
        ley2.font = { italic: true, color: { argb: C.grisTexto } };
        columnas.forEach(([t, w], i) => { ws.getCell(FILA_ENC, i + 1).value = t; ws.getColumn(i + 1).width = w; });
        encabezado(ws, FILA_ENC, 1, nCols);
        ws.views = [{ state: 'frozen', ySplit: FILA_ENC, showGridLines: false }];
        const total = filas ? filas.length : FILAS_ACTIVIDADES;
        for (let i = 0; i < total; i++) {
            const f = FILA_INI + i;
            for (let c = 1; c <= nCols; c++) {
                const cell = ws.getCell(f, c);
                cell.border = bordes;
                cell.alignment = { vertical: 'top', wrapText: c <= 3 };
                if (filas) cell.value = filas[i][c - 1] ?? null;
            }
            ws.getCell(f, 4).numFmt = 'dd/mm/yyyy';
            ws.getCell(f, 5).numFmt = 'dd/mm/yyyy';
            if (filas) continue;
            ws.getCell(f, 1).dataValidation = {
                type: 'list', allowBlank: true, formulae: [`"${TIPO_ACTIVIDAD},${TIPO_SUB}"`],
                showErrorMessage: true, errorTitle: 'Tipo no válido', error: `Elige "${TIPO_ACTIVIDAD}" o "${TIPO_SUB}".`,
                showInputMessage: true, promptTitle: 'Tipo', prompt: `"${TIPO_ACTIVIDAD}" para una actividad. "${TIPO_SUB}" para una tarea de la actividad de arriba.`,
            };
            ws.getCell(f, 2).dataValidation = largo('Nombre', 'Nombre corto. Una subactividad no puede llamarse igual que su actividad.');
            ws.getCell(f, 3).dataValidation = largo('Descripción', 'Detalle de lo que se hace (opcional: si falta se usa el nombre).');
            [4, 5].forEach((c) => {
                ws.getCell(f, c).dataValidation = {
                    type: 'date', operator: 'between', allowBlank: true, formulae: [fechaUTC(ctx.inicio), fechaUTC(ctx.fin)],
                    showErrorMessage: true, errorTitle: 'Fecha fuera del proyecto', error: `La fecha debe estar entre ${periodo} (dd/mm/aaaa).`,
                    showInputMessage: true, promptTitle: c === 4 ? 'Fecha inicio' : 'Fecha fin',
                    prompt: `dd/mm/aaaa, dentro de ${periodo}. Una subactividad debe quedar dentro de las fechas de su actividad.`,
                };
            });
            for (let r = 0; r < ctx.maxParticipantes; r++) {
                ws.getCell(f, 6 + r).dataValidation = {
                    type: 'list', allowBlank: true, formulae: [rangoPersonas],
                    showErrorMessage: true, errorTitle: 'Responsable no válido', error: 'Elige un responsable de la lista.',
                    showInputMessage: true, promptTitle: `Responsable ${r + 1}`, prompt: 'Elige de la lista. Déjalo vacío en una actividad que tiene subactividades.',
                };
            }
        }
        // Formato según el tipo: actividad = fila azul en negrita; subactividad = nombre en cursiva.
        const ref = `A${FILA_INI}:${letra(nCols)}${FILA_INI + total - 1}`;
        ws.addConditionalFormatting({
            ref,
            rules: [
                { type: 'expression', priority: 1, formulae: [`$A${FILA_INI}="${TIPO_ACTIVIDAD}"`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.azulClaro } }, font: { bold: true } } },
                { type: 'expression', priority: 2, formulae: [`$A${FILA_INI}="${TIPO_SUB}"`], style: { font: { italic: true, color: { argb: 'FF374151' } } } },
            ],
        });
    };
    const wsA = wb.addWorksheet(HOJA.plan);
    armarPlan(wsA, null);

    // ---------------- Ejemplo ----------------
    const wsE = wb.addWorksheet(HOJA.ejemplo, { properties: { tabColor: { argb: 'FF9CA3AF' } } });
    const d = (iso: string) => fechaUTC(iso);
    const base = fechaUTC(ctx.inicio);
    const dia = (n: number) => { const x = new Date(base.getTime() + n * 86400000); return x.getTime() > fechaUTC(ctx.fin).getTime() ? d(ctx.fin) : x; };
    const p1 = personas[0] ? etiquetaPersona(personas[0]) : 'Pérez Juan (12345)';
    const p2 = personas[1] ? etiquetaPersona(personas[1]) : 'Mora Ana (23456)';
    armarPlan(wsE, [
        [TIPO_ACTIVIDAD, 'Levantamiento de procesos', 'Conocer cómo se trabaja hoy', dia(0), dia(27), '', '', ''],
        [TIPO_SUB, 'Entrevistas a jefes de área', 'Reuniones con cada área', dia(0), dia(10), p1, '', ''],
        [TIPO_SUB, 'Documentar procesos actuales', 'Diagramas y fichas', dia(13), dia(27), p1, p2, ''],
        [TIPO_ACTIVIDAD, 'Capacitación al personal', 'Una sola tarea, sin subactividades', dia(30), dia(40), p2, '', ''],
    ].map((f) => f.slice(0, nCols)));

    // Meta (versión y proyecto, oculta)
    const wsM = wb.addWorksheet(HOJA.meta, { state: 'veryHidden' });
    wsM.getCell('A1').value = VERSION_PLANTILLA;
    wsM.getCell('A2').value = ctx.inicio;
    wsM.getCell('A3').value = ctx.fin;
    wsM.getCell('A4').value = ctx.nombreProyecto;

    // Se abre en la guía.
    wb.views = [{ x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, activeTab: 0, visibility: 'visible' }];

    const buffer = await wb.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ------------------------------------------------------------------------------------------------------------------
// Lectura e interpretación
// ------------------------------------------------------------------------------------------------------------------
function texto(v: CellValue): string {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return isoDeUTC(v);
    if (typeof v === 'object') {
        const o = v as unknown as Record<string, unknown>;
        if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join('').trim();
        if ('result' in o) return texto(o.result as CellValue);
        if ('text' in o) return String(o.text ?? '').trim();
        return '';
    }
    return String(v).trim();
}

// Fecha de una celda: fecha de Excel, número de serie o texto dd/mm/aaaa, dd-mm-aaaa o aaaa-mm-dd. '' si no se reconoce.
function fechaDe(v: CellValue): string {
    if (v === null || v === undefined || v === '') return '';
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : isoDeUTC(v);
    if (typeof v === 'number') return isoDeUTC(new Date(Math.round((v - 25569) * 86400000)));
    if (typeof v === 'object' && 'result' in (v as object)) return fechaDe((v as { result: CellValue }).result);
    const s = texto(v);
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return valida(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
    if (m) return valida(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
    return '';
}
function valida(y: number, mes: number, d: number): string {
    const f = new Date(Date.UTC(y, mes - 1, d));
    return f.getUTCFullYear() === y && f.getUTCMonth() === mes - 1 && f.getUTCDate() === d ? isoDeUTC(f) : '';
}

// Reconoce un responsable por "Nombre (código)", código de empleado, cédula o nombre (sin tildes ni mayúsculas).
function reconocer(textoCelda: string, ctx: ContextoPlantilla): ResponsableLeido {
    const t = textoCelda.trim();
    const porCodigo = (c: string) => ctx.responsables.find((r) => norm(r.empleado) === norm(c));
    const entreParentesis = t.match(/\(([^()]+)\)\s*$/);
    const directo = (entreParentesis && porCodigo(entreParentesis[1])) || porCodigo(t) || ctx.responsables.find((r) => !!r.cedula && norm(r.cedula) === norm(t));
    if (directo) return { texto: t, codigo: directo.codigo, candidatos: [] };
    const nombre = norm(t.replace(/\([^()]*\)\s*$/, ''));
    const exactos = ctx.responsables.filter((r) => norm(r.nombre) === nombre);
    if (exactos.length === 1) return { texto: t, codigo: exactos[0].codigo, candidatos: [] };
    // Coincidencia parcial: todas las palabras escritas aparecen en el nombre.
    const palabras = nombre.split(' ').filter((p) => p.length > 1);
    const parciales = exactos.length > 1 ? exactos : palabras.length ? ctx.responsables.filter((r) => palabras.every((p) => norm(r.nombre).includes(p))) : [];
    if (parciales.length === 1) return { texto: t, codigo: parciales[0].codigo, candidatos: [] };
    return { texto: t, codigo: null, candidatos: parciales.slice(0, 15).map((r) => r.codigo) };
}

// Hoja por nombre aproximado (tolera "Objetivos", "1. Objetivos", "Actividades", "2. Plan de actividades").
function hoja(wb: Workbook, ...claves: string[]): Worksheet | undefined {
    return wb.worksheets.find((w) => claves.some((c) => norm(w.name).includes(c)) && !norm(w.name).includes('ejemplo'));
}

export async function leerPlantilla(archivo: File, ctx: ContextoPlantilla): Promise<ResultadoImportacion> {
    const ExcelJS = await cargarExcelJS();
    const wb: Workbook = new ExcelJS.Workbook();
    try {
        await wb.xlsx.load(await archivo.arrayBuffer());
    } catch {
        throw new Error('No se pudo leer el archivo. Verifica que sea un Excel (.xlsx) y que no esté protegido con contraseña.');
    }
    const wsO = hoja(wb, 'objetivos');
    const wsA = hoja(wb, 'plan de actividades', 'actividades');
    if (!wsO || !wsA) throw new Error('El archivo no tiene las hojas de Objetivos y Plan de actividades. Descarga la plantilla desde el Gestor y úsala como base.');

    const avisos: string[] = [];
    const wsM = wb.worksheets.find((w) => norm(w.name) === 'meta');
    if (wsM) {
        const ini = texto(wsM.getCell('A2').value);
        const fin = texto(wsM.getCell('A3').value);
        if ((ini && ini !== ctx.inicio) || (fin && fin !== ctx.fin)) avisos.push(`La plantilla se generó con otras fechas de proyecto (${ini ? fmt(ini) : '?'} – ${fin ? fmt(fin) : '?'}). Se valida contra las fechas actuales.`);
    } else {
        avisos.push('No se reconoció la plantilla del Gestor; se intentará leer igual.');
    }

    const recortar = (s: string, que: string) => {
        if (s.length <= MAX_TEXTO) return s;
        avisos.push(`${que} superaba ${MAX_TEXTO} caracteres y se recortó.`);
        return s.slice(0, MAX_TEXTO);
    };

    // ---- Objetivos: se ubican por la etiqueta de la columna A (sirve para ambas versiones) ----
    let descripcion = '';
    let objetivoPrincipal = '';
    let filaListaObj = 0;
    for (let f = 1; f <= Math.min(wsO.rowCount, 20); f++) {
        const a = norm(texto(wsO.getCell(f, 1).value));
        const b = norm(texto(wsO.getCell(f, 2).value));
        if (a.startsWith('descripcion')) descripcion = texto(wsO.getCell(f, 2).value);
        else if (a.startsWith('objetivo principal')) objetivoPrincipal = texto(wsO.getCell(f, 2).value);
        else if (b.startsWith('objetivo especifico')) filaListaObj = f;
    }
    descripcion = recortar(descripcion, 'La descripción del proyecto');
    objetivoPrincipal = recortar(objetivoPrincipal, 'El objetivo principal');
    const objetivos: string[] = [];
    const vistosObj = new Set<string>();
    for (let fila = (filaListaObj || 5) + 1; fila <= wsO.rowCount; fila++) {
        const t = texto(wsO.getCell(fila, 2).value);
        if (!t) continue;
        const k = norm(t);
        if (vistosObj.has(k)) { avisos.push(`Objetivo específico repetido en la fila ${fila}: se cargó una sola vez.`); continue; }
        vistosObj.add(k);
        objetivos.push(recortar(t, `El objetivo específico de la fila ${fila}`));
    }

    // ---- Plan: fila de encabezados (la que tiene "Nombre") y columnas por su título ----
    let filaEnc = 0;
    for (let f = 1; f <= Math.min(wsA.rowCount, 10) && !filaEnc; f++) {
        wsA.getRow(f).eachCell((c) => { if (norm(texto(c.value)).startsWith('nombre')) filaEnc = f; });
    }
    if (!filaEnc) throw new Error('La hoja del plan no tiene la fila de encabezados (Tipo, Nombre, Fechas, Responsables). Usa la plantilla del Gestor.');
    const encabezados = new Map<string, number>();
    wsA.getRow(filaEnc).eachCell((c, col) => encabezados.set(norm(texto(c.value)), col));
    const col = (...claves: string[]) => {
        for (const [k, v] of encabezados) if (claves.some((c) => k.startsWith(c))) return v;
        return 0;
    };
    const cTipo = col('tipo');
    const cNombre = col('nombre');
    const cDesc = col('descripcion');
    const cIni = col('fecha inicio', 'inicio');
    const cFin = col('fecha fin', 'fin');
    const cResp = [...encabezados.entries()].filter(([k]) => k.startsWith('responsable')).sort((a, b) => a[1] - b[1]).map(([, v]) => v);
    const cNum = [...encabezados.entries()].find(([k]) => ['n°', 'nº', 'no', 'n', 'numero'].includes(k))?.[1] ?? 0;
    const cPadre = col('subactividad de', 'actividad padre');
    if (!cNombre || !cIni || !cFin || cResp.length === 0) throw new Error('La hoja del plan no tiene las columnas esperadas (Nombre, Fecha inicio, Fecha fin, Responsable). Usa la plantilla del Gestor.');

    // 1) Filas crudas. Versión 2: la jerarquía sale del Tipo (una subactividad pertenece a la actividad de arriba).
    //    Versión 1: columna "Subactividad de (N°)".
    type Cruda = { fila: number; numero: number; padre: number | null; errorPadre: string; nombre: string; desc: string; iniCrudo: CellValue; finCrudo: CellValue; respTextos: string[] };
    const crudas: Cruda[] = [];
    let ultimaActividad: number | null = null;
    for (let fila = filaEnc + 1; fila <= wsA.rowCount; fila++) {
        const r = wsA.getRow(fila);
        const nombre = texto(r.getCell(cNombre).value);
        const desc = cDesc ? texto(r.getCell(cDesc).value) : '';
        const iniCrudo = r.getCell(cIni).value;
        const finCrudo = r.getCell(cFin).value;
        const respTextos = cResp.map((c) => texto(r.getCell(c).value)).filter(Boolean);
        if (!nombre && !desc && !texto(iniCrudo) && !texto(finCrudo) && respTextos.length === 0) continue; // fila vacía
        const numero = crudas.length + 1;
        let padre: number | null = null;
        let errorPadre = '';
        if (cTipo) {
            const tipo = norm(texto(r.getCell(cTipo).value));
            if (tipo.includes('sub')) {
                if (ultimaActividad === null) errorPadre = 'Es una subactividad pero no hay ninguna actividad arriba.';
                else padre = ultimaActividad;
            } else {
                ultimaActividad = numero;
            }
        } else if (cPadre) {
            const numeroV1 = (cNum && Number(texto(r.getCell(cNum).value))) || fila - filaEnc;
            const padreTexto = texto(r.getCell(cPadre).value);
            // En la versión 1 el N° lo escribía el usuario: se traduce al número interno más abajo.
            crudas.push({ fila, numero: numeroV1, padre: padreTexto ? (Number(padreTexto.replace(/[^\d]/g, '')) || -1) : null, errorPadre: '', nombre, desc, iniCrudo, finCrudo, respTextos });
            continue;
        }
        crudas.push({ fila, numero, padre, errorPadre, nombre, desc, iniCrudo, finCrudo, respTextos });
    }
    const porNumero = new Map(crudas.map((c) => [c.numero, c]));
    crudas.forEach((c) => {
        if (c.padre === -1) { c.errorPadre = '"Subactividad de" debe ser el N° de una actividad.'; c.padre = null; }
        else if (c.padre !== null) {
            const p = porNumero.get(c.padre);
            if (!p) { c.errorPadre = `No existe la actividad N° ${c.padre}.`; c.padre = null; }
            else if (p.padre !== null) { c.errorPadre = 'Solo se permiten dos niveles: la actividad indicada ya es una subactividad.'; c.padre = null; }
        }
    });
    const conHijos = new Set(crudas.filter((c) => c.padre !== null).map((c) => c.padre as number));

    // 2) Interpretación de cada fila.
    const actividades: ActividadLeida[] = [];
    const firmas = new Set<string>();
    for (const c of crudas) {
        const mensajes: string[] = [];
        let error = false;
        let nombre = c.nombre;
        let desc = c.desc;
        const contenedor = c.padre === null && conHijos.has(c.numero);
        if (c.errorPadre) { mensajes.push(c.errorPadre); error = true; }

        if (!nombre) { mensajes.push('Falta el nombre.'); error = true; }
        if (nombre.length > MAX_TEXTO) { nombre = nombre.slice(0, MAX_TEXTO); mensajes.push(`El nombre se recortó a ${MAX_TEXTO} caracteres.`); }
        if (!desc && nombre) { desc = nombre; mensajes.push('Sin descripción: se usó el nombre.'); }
        if (desc.length > MAX_TEXTO) { desc = desc.slice(0, MAX_TEXTO); mensajes.push(`La descripción se recortó a ${MAX_TEXTO} caracteres.`); }
        if (c.padre !== null) {
            const padre = porNumero.get(c.padre);
            if (padre && norm(padre.nombre) === norm(nombre)) { mensajes.push('Una subactividad no puede llamarse igual que su actividad.'); error = true; }
        }

        let ini = fechaDe(c.iniCrudo);
        let fin = fechaDe(c.finCrudo);
        const sinFechas = !texto(c.iniCrudo) && !texto(c.finCrudo);
        if (contenedor && sinFechas) {
            // Se completan con las de sus subactividades (paso 3).
        } else {
            if (!ini) { mensajes.push(texto(c.iniCrudo) ? `Fecha de inicio no reconocida ("${texto(c.iniCrudo)}").` : 'Falta la fecha de inicio.'); error = true; }
            if (!fin) { mensajes.push(texto(c.finCrudo) ? `Fecha de fin no reconocida ("${texto(c.finCrudo)}").` : 'Falta la fecha de fin.'); error = true; }
            if (ini && fin && fin < ini) { [ini, fin] = [fin, ini]; mensajes.push('Las fechas estaban invertidas: se intercambiaron.'); }
            if (ini && fin) {
                if (fin < ctx.inicio || ini > ctx.fin) {
                    mensajes.push(`Queda completamente fuera del periodo del proyecto (${fmt(ctx.inicio)} – ${fmt(ctx.fin)}).`);
                    error = true;
                } else {
                    if (ini < ctx.inicio) { ini = ctx.inicio; mensajes.push(`El inicio era anterior al proyecto: se ajustó al ${fmt(ctx.inicio)}.`); }
                    if (fin > ctx.fin) { fin = ctx.fin; mensajes.push(`El fin era posterior al proyecto: se ajustó al ${fmt(ctx.fin)}.`); }
                }
            }
        }

        const responsables: ResponsableLeido[] = [];
        if (contenedor) {
            if (c.respTextos.length) mensajes.push('Tiene subactividades: sus responsables van en ellas (se ignoran los de esta fila).');
        } else {
            for (const t of c.respTextos) {
                const r = reconocer(t, ctx);
                if (r.codigo && responsables.some((x) => x.codigo === r.codigo)) { mensajes.push(`"${t}" estaba repetido.`); continue; }
                if (r.codigo === null) {
                    mensajes.push(r.candidatos.length
                        ? `"${t}" coincide con varias personas: elige cuál.`
                        : `No se encontró a "${t}" en la lista de responsables: se ignora.`);
                    if (r.candidatos.length === 0) continue;
                }
                responsables.push(r);
            }
            if (responsables.length > ctx.maxParticipantes) {
                mensajes.push(`Tenía más de ${ctx.maxParticipantes} responsables: se tomaron los primeros ${ctx.maxParticipantes}.`);
                responsables.splice(ctx.maxParticipantes);
            }
            if (c.respTextos.length === 0) { mensajes.push('Falta al menos un responsable.'); error = true; }
            else if (responsables.length === 0) { mensajes.push('Ningún responsable reconocido: no se carga.'); error = true; }
        }

        const firma = `${c.padre ?? ''}|${norm(nombre)}|${ini}|${fin}`;
        const omitida = !error && !contenedor && firmas.has(firma);
        if (omitida) mensajes.push('Duplicada (mismo nombre y fechas): se omite.');
        firmas.add(firma);

        actividades.push({ fila: c.fila, numero: c.numero, padre: c.padre, contenedor, nombre, descripcion: desc, inicio: ini, fin, responsables, mensajes, error, omitida });
    }

    // 3) Actividades con subactividades: sin fechas propias se toman las de sus subactividades; las subactividades deben
    //    quedar dentro de las fechas de su actividad (las que se salen en parte se ajustan, las que quedan fuera no se
    //    cargan). Una actividad sin subactividades válidas no se carga, y si la actividad no se carga sus subactividades tampoco.
    const porNum = new Map(actividades.map((x) => [x.numero, x]));
    const subsDe = (n: number) => actividades.filter((x) => x.padre === n);
    actividades.filter((x) => x.contenedor && !x.error).forEach((x) => {
        const subs = subsDe(x.numero);
        if (!x.inicio || !x.fin) {
            const validas = subs.filter((s) => !s.error && s.inicio && s.fin);
            if (validas.length) {
                x.inicio = validas.map((s) => s.inicio).sort()[0];
                x.fin = validas.map((s) => s.fin).sort().slice(-1)[0];
                x.mensajes.push('Sin fechas: se tomaron del inicio de su primera subactividad al fin de la última.');
            }
        }
        subs.filter((s) => !s.error && s.inicio && s.fin).forEach((s) => {
            if (s.fin < x.inicio || s.inicio > x.fin) {
                s.mensajes.push(`Queda fuera de las fechas de su actividad (${fmt(x.inicio)} – ${fmt(x.fin)}).`);
                s.error = true;
                return;
            }
            if (s.inicio < x.inicio) { s.inicio = x.inicio; s.mensajes.push(`Empezaba antes que su actividad: se ajustó al ${fmt(x.inicio)}.`); }
            if (s.fin > x.fin) { s.fin = x.fin; s.mensajes.push(`Terminaba después que su actividad: se ajustó al ${fmt(x.fin)}.`); }
        });
    });
    actividades.filter((x) => x.contenedor && !x.error).forEach((x) => {
        const validas = subsDe(x.numero).filter((s) => !s.error && !s.omitida);
        if (validas.length === 0) { x.mensajes.push('Ninguna de sus subactividades se puede cargar.'); x.error = true; }
        else x.mensajes.unshift(`Con ${validas.length} subactividad(es).`);
    });
    actividades.filter((x) => x.padre !== null).forEach((sub) => {
        const padre = porNum.get(sub.padre as number);
        if (padre?.error && !sub.error) { sub.mensajes.push('Su actividad no se carga.'); sub.error = true; }
    });

    // Orden: actividades por fecha de inicio y, debajo de cada una, sus subactividades por fecha.
    const porFecha = (x: ActividadLeida, y: ActividadLeida) => (x.inicio || '9999').localeCompare(y.inicio || '9999') || x.fila - y.fila;
    const ordenadas = actividades.filter((x) => x.padre === null).sort(porFecha).flatMap((x) => [x, ...subsDe(x.numero).sort(porFecha)]);
    actividades.forEach((x) => { if (!ordenadas.includes(x)) ordenadas.push(x); });

    return { descripcion, objetivoPrincipal, objetivos, actividades: ordenadas, avisos };
}

/** Estado de una fila: error = no se carga (falta un dato o ningún responsable reconocido); aviso = se carga con ajustes o
 *  con responsables por elegir (los no elegidos se ignoran). */
export function estadoDeFila(a: ActividadLeida): EstadoFila {
    if (a.error || a.omitida || (!a.contenedor && !a.responsables.some((r) => r.codigo !== null))) return 'error';
    return a.mensajes.length || a.responsables.some((r) => r.codigo === null) ? 'aviso' : 'ok';
}
