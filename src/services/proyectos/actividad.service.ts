
import type { Actividad } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { fetchWithAuth } from "@/lib/http-client";

const API_URL = `${environment.apiAPP}/api/actividad`;

// Filtros del endpoint optimizado POST /api/actividad/buscar (filtra y pagina en el servidor).
export interface ActividadBuscarFiltros {
  codigo_proyecto?: number;
  codigo_responsable?: number;
  codigo_actividad_padre?: number | null;
  solo_principales?: boolean;
  estado?: string;
  desde?: string;
  hasta?: string;
  anio?: number;
  page?: number;
  page_size?: number;
  order_by?: string;
  order_dir?: 'asc' | 'desc';
}

export const actividadService = {
  async getAll(): Promise<BodyListResponse<Actividad>> {
    const response = await fetchWithAuth(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch actividad');
    }
    return response.json();
  },

  // Búsqueda filtrada + paginada en el servidor (reemplaza el getAll + filtrado en el navegador).
  async buscar(filtros: ActividadBuscarFiltros = {}): Promise<BodyListResponse<Actividad>> {
    const response = await fetchWithAuth(`${API_URL}/buscar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filtros),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to search actividad');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<Actividad>> {
    const response = await fetchWithAuth(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch actividad with id ${id}`);
    }
    return response.json();
  },

  async save(data: Actividad): Promise<BodyResponse<Actividad>> {
    // El GET devuelve relaciones anidadas (proyecto, responsable); se envían solo las
    // columnas propias de la tabla para que el backend aplique el cambio correctamente.
    const payload: Actividad = {
      codigo_actividad: data.codigo_actividad,
      // FK autorreferencial: debe ir null (no 0) cuando no tiene padre.
      codigo_actividad_padre: data.codigo_actividad_padre || null,
      codigo_proyecto: data.codigo_proyecto,
      codigo_responsable: data.codigo_responsable,
      nombre_actividad: data.nombre_actividad,
      descripcion_actividad: data.descripcion_actividad,
      fecha_inicio_actividad: data.fecha_inicio_actividad,
      fecha_fin_actividad: data.fecha_fin_actividad,
      estado_actividad: data.estado_actividad,
      peso_actividad: data.peso_actividad,
      estado: data.estado,
      fecha_modificacion: data.fecha_modificacion,
      usuario_modificacion: data.usuario_modificacion,
    };
    const response = await fetchWithAuth(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save actividad');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<void> {
    const response = await fetchWithAuth(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete actividad with id ${id}`);
    }
  },
};
