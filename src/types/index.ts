/**
 * Tipos simplificados de Autoformas para Trazabilidad sobre Planos
 */

export type ShapeType = 'line' | 'arrow' | 'rect' | 'circle' | 'polygon' | 'text' | 'symbol';

export type LayerType = 'camaras_campanas' | 'canalizaciones';

export type AutoShapeCategory =
  | 'tuberia'
  | 'camara_mt'
  | 'camara_bt'
  | 'caja'
  | 'trafo'
  | 'datos'
  | 'alumbrado'
  | 'campana'
  | 'terminal'
  | 'custom';

export type ExecutionStatus = 'Terminado' | 'En proceso' | 'No iniciado';

export interface AutoShape {
  id: string;
  type: ShapeType;
  category: AutoShapeCategory;
  layer: LayerType; // Capa independiente: 'camaras_campanas' o 'canalizaciones'
  name: string;
  acta: string;
  fecha: string;
  calibre: string; // Calibre de tubería o cable (ej. 3x4", 2x6", Al 3#1/0 XLPE 15KV)
  estado: ExecutionStatus;
  notas: string;
  metros?: number; // Metros lineales calculados para canalizaciones

  // Datos específicos de campanas (terminaciones de tubería en caras de las cámaras)
  campanasEntrada?: number; // Número de campanas en cara de entrada (lado A)
  campanasSalida?: number;  // Número de campanas en cara de salida principal (lado B)
  campanasSalida2?: number; // Número de campanas en segunda salida (derivación / acometida)
  campanasSalida2Pos?: 'arriba' | 'abajo' | 'diagonal_arr_izq' | 'diagonal_arr_der' | 'personalizado';
  campanasSalida2Angulo?: number; // Ángulo de la 2da salida en grados (90 = Norte/Arriba, 115 = Noroeste, 270 = Sur/Abajo)
  campanasSalida2Calibre?: string; // Calibre de la 2da salida (ej. 2x6" PVC)
  campanasSalida2Acta?: string;    // Acta de la 2da salida
  campanasCalibre?: string; // Calibre de las campanas (ej. 4" PVC, 3" PVC, 6" PVC)
  campanasActa?: string;    // Acta de instalación de campanas

  // Geometría en porcentajes del plano (0 a 100%)
  x: number;
  y: number;
  endX?: number; // Para líneas y flechas
  endY?: number;
  width?: number; // Para rectángulos y círculos
  height?: number;
  points?: Array<{ x: number; y: number }>; // Para polígonos

  // Estilo de dibujo
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  strokeDash: 'solid' | 'dashed' | 'dotted';
  fontSize?: number;
  iconSize?: number; // Multiplicador de escala / tamaño de icono (ej. 0.25 [3XS], 0.4 [XXS], 0.6 [XS], 1.0 [M], 1.4, 2.0)
  text?: string;
}

export interface CustomPreset {
  id: string;
  name: string;
  category: AutoShapeCategory;
  shapeType: ShapeType;
  color: string;
  defaultCalibre: string;
  defaultActa: string;
}
