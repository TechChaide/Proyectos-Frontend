
import type { FichaSocialHistorica, InformacionExterna, TipoUsuarioAplicacion } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { fetchWithAuth } from "@/lib/http-client";

const API_URL = `${environment.apiAPP}/api/servicios`;

export const serviciosService = {

  async getInformacionPersonas(): Promise<BodyListResponse<FichaSocialHistorica>> {
    const response = await fetchWithAuth(`${API_URL}/getPersonalFS`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch ficha social historica`);
    }
    return response.json();
  },

   
};
