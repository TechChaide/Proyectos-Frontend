
import type { Proyecto } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { fetchWithAuth } from "@/lib/http-client";

const API_URL = `${environment.apiAPP}/api/proyecto`;

// Filtros de POST /api/proyecto/buscar.
export interface ProyectoBuscarFiltros {
  codigo_proyecto?: number;
  codigo_okr?: number;
  codigo_padre?: number | null;
  codigo_solicitud?: number;
  codigo_tipo_proyecto?: number;
  estado?: string;
  page?: number;
  page_size?: number;
  order_by?: string;
  order_dir?: 'asc' | 'desc';
  [key: string]: unknown;
}

// Body de POST /api/proyecto/detalle.
export interface ProyectoDetalleFiltros {
  codigo_proyecto: number;
  [key: string]: unknown;
}

export const proyectoService = {
  async getAll(): Promise<BodyListResponse<Proyecto>> {
    const response = await fetchWithAuth(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch proyecto');
    }
    return response.json();
  },

  // Búsqueda filtrada en el servidor (POST /api/proyecto/buscar).
  async buscar(filtros: ProyectoBuscarFiltros): Promise<BodyListResponse<Proyecto>> {
    const response = await fetchWithAuth(`${API_URL}/buscar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filtros),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to search proyecto');
    }
    return response.json();
  },

  // Detalle de un proyecto (POST /api/proyecto/detalle).
  async detalle(filtros: ProyectoDetalleFiltros): Promise<BodyResponse<Proyecto>> {
    const response = await fetchWithAuth(`${API_URL}/detalle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filtros),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch proyecto detalle');
    }
    return response.json();
  },

  // Cadena de proyectos padre (GET /api/proyecto/:id/ancestors).
  async ancestors(id: number | string): Promise<BodyListResponse<Proyecto>> {
    const response = await fetchWithAuth(`${API_URL}/${id}/ancestors`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch proyecto ancestors');
    }
    return response.json();
  },

  // Subproyectos en todos los niveles (GET /api/proyecto/:id/descendants).
  async descendants(id: number | string): Promise<BodyListResponse<Proyecto>> {
    const response = await fetchWithAuth(`${API_URL}/${id}/descendants`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch proyecto descendants');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<Proyecto>> {
    const response = await fetchWithAuth(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch proyecto with id ${id}`);
    }
    return response.json();
  },

  async save(data: Proyecto): Promise<BodyResponse<Proyecto>> {
    const response = await fetchWithAuth(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save proyecto');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<void> {
    const response = await fetchWithAuth(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete proyecto with id ${id}`);
    }
  },
};
