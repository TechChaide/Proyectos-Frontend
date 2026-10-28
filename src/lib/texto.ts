
// Pone en mayúscula solo la primera letra del texto y respeta el resto tal como lo escribió el usuario
// (ej: "ingeniero de ambiente" → "Ingeniero de ambiente"; si escribe "SSO" se conserva). Soporta acentos.
export const capitalizar = (v: string): string =>
    (v || '').replace(/^(\s*)(\p{L})/u, (_m, sp: string, ch: string) => sp + ch.toUpperCase());
