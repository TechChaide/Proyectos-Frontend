
import type { PilarEstrategico } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { fetchWithAuth } from "@/lib/http-client";

// Modelo v7: pilares estratégicos (catálogo raíz de la alineación pilar → OKR → proyecto).
const API_URL = `${environment.apiAPP}/api/pilar_estrategico`;

export const pilarEstrategicoService = {
  async getAll(): Promise<BodyListResponse<PilarEstrategico>> {
    const response = await fetchWithAuth(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch pilar-estrategico');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<PilarEstrategico>> {
    const response = await fetchWithAuth(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch pilar-estrategico with id ${id}`);
    }
    return response.json();
  },

  async save(data: PilarEstrategico): Promise<BodyResponse<PilarEstrategico>> {
    const response = await fetchWithAuth(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save pilar-estrategico');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<void> {
    const response = await fetchWithAuth(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete pilar-estrategico with id ${id}`);
    }
  },
};
