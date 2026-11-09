
import type { Objetivo } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { fetchWithAuth } from "@/lib/http-client";

// Modelo v7: objetivos de un proyecto (objetivo.codigo_proyecto), uno o varios por proyecto.
const API_URL = `${environment.apiAPP}/api/objetivo`;

// Filtros de POST /api/objetivo/buscar. Para los objetivos de un proyecto basta codigo_proyecto.
export interface ObjetivoBuscarFiltros {
  codigo_proyecto: number;
  estado?: string;
  [key: string]: unknown;
}

export const objetivoService = {
  async getAll(): Promise<BodyListResponse<Objetivo>> {
    const response = await fetchWithAuth(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch objetivo');
    }
    return response.json();
  },

  // Búsqueda filtrada en el servidor (POST /api/objetivo/buscar).
  async buscar(filtros: ObjetivoBuscarFiltros): Promise<BodyListResponse<Objetivo>> {
    const response = await fetchWithAuth(`${API_URL}/buscar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filtros),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to search objetivo');
    }
    return response.json();
  },

  // Objetivos de un proyecto (usa POST /api/objetivo/buscar con el código del proyecto).
  async getByProyecto(codigoProyecto: number): Promise<BodyListResponse<Objetivo>> {
    return objetivoService.buscar({ codigo_proyecto: codigoProyecto });
  },

  async getById(id: number | string): Promise<BodyResponse<Objetivo>> {
    const response = await fetchWithAuth(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch objetivo with id ${id}`);
    }
    return response.json();
  },

  async save(data: Objetivo): Promise<BodyResponse<Objetivo>> {
    const response = await fetchWithAuth(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save objetivo');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<void> {
    const response = await fetchWithAuth(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete objetivo with id ${id}`);
    }
  },
};
