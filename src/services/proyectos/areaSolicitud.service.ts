
import type { AreaSolicitud } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { fetchWithAuth } from "@/lib/http-client";

// Modelo v6: 'area_solicitud' → 'proceso_solicitud'. Alias interno areaSolicitudService.
const API_URL = `${environment.apiAPP}/api/proceso_solicitud`;

export const areaSolicitudService = {
  async getAll(): Promise<BodyListResponse<AreaSolicitud>> {
    const response = await fetchWithAuth(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch area-solicitud');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<AreaSolicitud>> {
    const response = await fetchWithAuth(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch area-solicitud with id ${id}`);
    }
    return response.json();
  },

  async save(data: AreaSolicitud): Promise<BodyResponse<AreaSolicitud>> {
    const response = await fetchWithAuth(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save area-solicitud');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<void> {
    const response = await fetchWithAuth(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete area-solicitud with id ${id}`);
    }
  },
};
