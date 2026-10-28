/**
 * HTTP Client with automatic token handling via httpOnly cookies
 * Intercepts all requests to add credentials and handle 401 responses
 * 
 * Note: Token is managed by the backend as httpOnly cookie
 * This client only needs to include cookies in requests
 */

import { toast } from "@/hooks/use-toast";

export type FetchOptions = RequestInit & {
  skipAuth?: boolean;
};

/**
 * Fetch wrapper that automatically:
 * 1. Includes httpOnly cookies with credentials: 'include'
 * 2. Handles 401 errors by clearing local auth state and redirecting to login
 * 
 * @param url - The URL to fetch
 * @param options - Fetch options (can include skipAuth: true to skip credentials)
 * @returns Promise with the fetch response
 */
export async function fetchWithAuth(
  url: string,
  options: FetchOptions = {}
) {
  const { skipAuth = false, ...restOptions } = options;

  // Realizar la petición con credenciales (incluye httpOnly cookies)
  // cache: 'no-store' evita que el navegador reutilice/valide contra una respuesta
  // en caché (revalidaciones 304 que el backend puede responder sin reflejar cambios
  // recientes) — siempre trae el dato más actual del servidor.
  const response = await fetch(url, {
    ...restOptions,
    credentials: skipAuth ? 'omit' : 'include', // 'include' para enviar cookies
    cache: restOptions.cache ?? 'no-store',
  });

  // Si error 401 (Unauthorized), limpiar auth local y redirigir a login
  if (response.status === 401) {
    clearAuthData();
    // Comentado para debuggear:
    // redirectToLogin();
    // Intentar extraer mensaje del body sin consumir el stream original
    let errMsg = 'Tu sesión ha expirado. Por favor, inicia sesión de nuevo.';
    try {
      const cloned = response.clone();
      const body = await cloned.json().catch(() => null);
      if (body) {
        if (typeof body === 'string') errMsg = body;
        else if (body.message) errMsg = body.message;
        else if (body.error) errMsg = body.error;
      }
    } catch (_) {
      // Ignorar errores al parsear
    }
    toast({
      title: 'Error de autenticación',
      description: errMsg,
      variant: 'destructive',
    });
    console.error('❌ Error 401 - Sesión no válida', errMsg);
    throw new Error(errMsg);
  }

  return response;
}

/**
 * Limpia todos los datos de autenticación local del localStorage
 * Nota: La cookie httpOnly se maneja en el backend
 */
function clearAuthData() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('user');
    localStorage.removeItem('appsByProfile');
  }
}

/**
 * Redirige al usuario a la página de login
 */
function redirectToLogin() {
  if (typeof window !== 'undefined') {
    const basePath = ((window as any).__NEXT_DATA__?.basePath || process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '');
    window.location.href = basePath ? `${basePath}/` : '/';
  }
}

/**
 * Limpia todos los datos de autenticación local
 * Nota: El backend se encarga de limpiar la cookie httpOnly en logout
 */
export function clearAuth() {
  clearAuthData();
}
