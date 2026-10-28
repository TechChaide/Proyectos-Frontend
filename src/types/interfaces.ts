
// Este archivo es autogenerado. No lo modifiques manually.

export interface Aplicacion {
  codigo_aplicacion: string;
  nombre_aplicacion: string;
  estado: string;
}

export interface Clase {
  codigo_clase: number;
  nombre_clase: string;
  estado: string;
}

export interface Menu {
  codigo_menu: number;
  codigo_padre: number;
  nombre: string;
  icono: string;
  path: string;
  estado: string;
  codigo_aplicacion: string;
}

export interface MenuTipoUsuario {
  codigo_menu_tipo_usuario: number;
  estado: string;
  usuario_modificacion: string;
  fecha_modificacion: Date | string;
  codigo_menu: number;
  codigo_tipo_usuario: number;
}

export interface Permisos {
  codigo_permiso: number;
  estado: string;
  usuario_modificacion: string;
  fecha_modificacion: Date | string;
  codigo_tipo_permiso: number;
  codigo_menu_tipo_usuario: number;
}

export interface Propiedad {
  codigo_propiedad: number;
  nombre_propiedad: string;
  valor_propiedad: string;
  estado: string;
  codigo_aplicacion: string;
}

export interface TipoPermiso {
  codigo_tipo_permiso: number;
  nombre_tipo_permiso: string;
  mnemonico: string;
  estado: string;
}

export interface TipoUsuario {
  codigo_tipo_usuario: number;
  codigo_clase: number;
  nombre_tipo_usuario: string;
  estado: string;
  usuario_modificacion: string;
  fecha_modificacion: Date | string;
}

export interface TipoUsuarioAplicacion {
  codigo_tipo_usuario_aplicacion: number;
  estado: string;
  usuario_modificacion: string;
  fecha_modificacion: Date | string;
  codigo_aplicacion: string;
  codigo_tipo_usuario: number;
}

export interface Usuario {
  codigo_usuario: number;
  id_usuario: string;
  condicion: string;
  estado: string;
  usuario_modificacion: string;
  fecha_modificacion: Date | string;
  codigo_tipo_usuario: number;
}

export interface UsuarioTipoUsuario {
  codigo_usuario_tipo_usuario: number;
  estado: string;
  codigo_usuario: number;
  codigo_tipo_usuario: number;
}

export interface Auth {
  message: string;
  token: string;
  expiresIn: string;
  user:User;
  perfiles: any;
}

export interface User {
  codigo_usuario: number;
  usuario: string;
  correo_usuario: string;
  condicion: string;
  id_usuario: string;
  codigo_empleado: string;
}

export interface FichaSocialHistorica {
  CODIGO: string;
  NOMBRE: string;
  LOCALIDAD: string;
  CEDULA: string;
  MAIL: string;
  GRUPO_DEPARTAMENTO: string;
  DEPARTAMENTO: string;
  CARGO: string;
  CODIGO_JEFE: string;
}

export interface InformacionExterna {
  codigo_informacion_externa: number;
  codigo_usuario: number;
  identificador: string;
  nombres: string;
  passcode: string;
  estado: string;
  fecha_creacion: Date | string;
  usuario_creacion: string;
  fecha_modificacion: Date | string;
  usuario_modificacion: string;
} 

// Modelo v6: la tabla 'area' fue reemplazada por 'proceso' (con jerarquía propia codigo_proceso_padre).
// Se conserva el nombre de tipo Area como alias interno para minimizar cambios; sus campos son de proceso.
export interface Area {
  codigo_proceso: number;
  /** Proceso padre (jerarquía de procesos); null si es un proceso raíz. */
  codigo_proceso_padre: number | null;
  /** Modelo v6: código de centro (varchar(4)). */
  centro: string;
  nombre_proceso: string;
  correos_proceso: string;
  estado: string;
  fecha_modificacion: string | Date;
  usuario_modificacion: string;
}

export interface Estado {
  codigo_estado: number;
  nombre_estado: string;
  estado: string;
  fecha_modificacion: string | Date;
  usuario_modificacion: string;
}

export interface Solicitud {
  codigo_solicitud: number;
  /** Modelo v6: usuario solicitante de la solución. */
  usuario_solicitante_solucion: string;
  usuario_creacion: string;
  fecha_creacion: string | Date;
  estado: string;
  fecha_modificacion: string | Date;
  usuario_modificacion: string;
}

export interface TipoProyecto {
  codigo_tipo_proyecto: number;
  nombre_tipo_proyecto: string;
  estado: string;
  fecha_modificacion: string | Date;
  usuario_modificacion: string;
}

export interface TipoRecurso {
  codigo_tipo_recurso: number;
  nombre_recurso: string;
  proveniencia: string;
  estado: string;
  fecha_modificacion: string | Date;
  usuario_modificacion: string;
}

export interface Responsable {
  codigo_responsable: number;
  codigo_empleado: string;
  correo_responsable: string;
  fecha_modificacion: string | Date;
  usuario_modificacion: string;
}

export interface EstadoSolicitud {
  codigo_estado_solicitud: number;
  codigo_estado: number;
  codigo_solicitud: number;
  estado: string;
  fecha_modificacion: string | Date;
  usuario_modificacion: string;
}

// Modelo v6: tabla 'proceso_solicitud' (antes 'area_solicitud'). Vincula solicitud ↔ proceso.
export interface AreaSolicitud {
  codigo_proceso_solicitud: number;
  codigo_proceso: number;
  codigo_solicitud: number;
  estado: string;
  fecha_modificacion: string | Date;
  usuario_modificacion: string;
}

export interface Proyecto {
  codigo_proyecto: number;
  codigo_padre: number | null;
  codigo_solicitud: number;
  codigo_tipo_proyecto: number;
  nombre_proyecto: string;
  descripcion_proyecto: string;
  responsable_proyecto: string;
  fecha_inicio: string | Date;
  fecha_fin: string | Date;
  objetivo_principal: string;
  estado: string;
  fecha_modificacion: string | Date;
  usuario_modificacion: string;
}

// Modelo v6: resultados/evaluación de un proyecto (uno o varios por proyecto).
// También almacena la CALIFICACIÓN por rúbrica: una fila por criterio, con
// categoria_resultado = "<TIPO>:<criterio>" (ej. "MR:calidad") y descripcion_resultado = "<puntaje> | <nivel>".
export interface Resultado {
  codigo_resultado: number;
  codigo_proyecto: number;
  categoria_resultado: string;
  descripcion_resultado: string;
  evaluador_asignado: string;
  /** bit: si el resultado cumple lo propuesto. */
  cumple_propuesta: boolean;
  fecha_modificacion: string | Date;
  usuario_modificacion: string;
}

export interface Recurso {
  codigo_recurso: number;
  codigo_tipo_recurso: number;
  nombre_recurso: string;
  costo: string;
  estado: string;
  fecha_modificacion: string | Date;
  usuario_modificacion: string;
}

export interface ProyectoRecurso {
  codigo_proyecto_recurso: number;
  codigo_recurso: number;
  codigo_proyecto: number;
  valor_recurso: string;
  estado: string;
  fecha_modificacion: string | Date;
  usuario_modificacion: string;
}

export interface EstadoActividad {
  codigo_estado_actividad: number;
  codigo_estado: number;
  codigo_actividad: number;
  url_evidencia: string;
  estado: string;
  fecha_modificacion: string | Date;
  usuario_modificacion: string;
}

export interface Actividad {
  codigo_actividad: number;
  /** Actividad padre (modelo v5): null si es una actividad principal; si tiene valor es una subactividad de un participante. */
  codigo_actividad_padre: number | null;
  codigo_proyecto: number;
  codigo_responsable: number;
  nombre_actividad: string;
  descripcion_actividad: string;
  fecha_inicio_actividad: string | Date;
  fecha_fin_actividad: string | Date;
  estado_actividad: string;
  peso_actividad: string;
  estado: string;
  fecha_modificacion: string | Date;
  usuario_modificacion: string;
}