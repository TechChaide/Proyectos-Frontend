
import type { Solicitud } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { fetchWithAuth } from "@/lib/http-client";

const API_URL = `${environment.apiAPP}/api/solicitud`;

// Filtros de POST /api/solicitud/por-usuario (solicitudes creadas por un usuario).
export interface SolicitudPorUsuarioFiltros {
  /** Requerido: usuario que creó la solicitud (acepta alias `usuario`). */
  usuario_creacion: string;
  /** Estado a filtrar; por defecto el backend usa "A". */
  estado?: string;
  order_by?: 'codigo_solicitud' | 'fecha_creacion' | 'fecha_modificacion' | 'usuario_creacion';
  order_dir?: 'asc' | 'desc';
}

export const solicitudService = {
  async getAll(): Promise<BodyListResponse<Solicitud>> {
    const response = await fetchWithAuth(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch solicitud');
    }
    return response.json();
  },

  // Recupera las solicitudes creadas por un usuario (POST /api/solicitud/por-usuario).
  async porUsuario(filtros: SolicitudPorUsuarioFiltros): Promise<BodyListResponse<Solicitud>> {
    const response = await fetchWithAuth(`${API_URL}/por-usuario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filtros),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch solicitudes por usuario');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<Solicitud>> {
    const response = await fetchWithAuth(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch solicitud with id ${id}`);
    }
    return response.json();
  },

  async save(data: Solicitud): Promise<BodyResponse<Solicitud>> {
    const response = await fetchWithAuth(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save solicitud');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<void> {
    const response = await fetchWithAuth(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete solicitud with id ${id}`);
    }
  },
};
