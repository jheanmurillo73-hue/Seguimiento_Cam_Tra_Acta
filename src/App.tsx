import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AutoShape, ShapeType, AutoShapeCategory, CustomPreset, LayerType } from './types';
import { INITIAL_SHAPES, INITIAL_PRESETS } from './data/initialShapes';
import { AutoShapesCanvas } from './components/AutoShapesCanvas';
import { ShapePropertyInspector } from './components/ShapePropertyInspector';
import { AutoShapesTableDrawer } from './components/AutoShapesTableDrawer';
import { exportAutoShapesToCsv, exportAutoShapesToPdf } from './services/reportExporter';
import { straightenLine, CanvasDimensions } from './utils/geometry';
import {
  MousePointer,
  Hand,
  Minus,
  MoveRight,
  Square,
  Circle,
  Type,
  Eraser,
  FileSpreadsheet,
  FileText,
  TableProperties,
  Undo2,
  Trash2,
  CheckCircle2,
  Palette,
  Sparkles,
  Layers,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Info,
  X,
  ExternalLink,
  Compass,
} from 'lucide-react';

const STORAGE_KEY = 'trazaplano_autoshapes_v2';

const COLOR_PALETTE = [
  { name: 'MT (Rojo)', hex: '#dc2626' },
  { name: 'BT (Amarillo)', hex: '#eab308' },
  { name: 'Campanas PVC (Verde)', hex: '#10b981' },
  { name: 'Datos (Cian)', hex: '#06b6d4' },
  { name: 'Subestación (Púrpura)', hex: '#9333ea' },
];

const ACTAS = ['Acta 01', 'Acta 02', 'Acta 03', 'Acta 04', 'Acta 05', 'Acta Final'];

const CALIBRES_RAPIDOS = [
  '3x4" PVC',
  '2x6" PVC',
  '1Ø4" PVC',
  '2Ø4" PVC',
  '4" PVC (Campana)',
  '3" PVC (Campana)',
  'Al 3#1/0 XLPE',
  'Cu #2/0 MCM',
  '3#250 + 1#250',
  'Norma SB850',
  'Norma SB851',
  'Norma SB858',
  'Trafo 300 kVA',
];

export default function App() {
  // AutoShapes state
  const [shapes, setShapes] = useState<AutoShape[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: AutoShape[] = JSON.parse(saved);
        return parsed.map((s) => {
          if (s.id === 'shape-circle-2' && s.campanasSalida2 === undefined) {
            return {
              ...s,
              campanasSalida2: 2,
              campanasSalida2Pos: 'diagonal_arr_izq',
              campanasSalida2Angulo: 115,
              campanasSalida2Calibre: '2x6" PVC',
              campanasSalida2Acta: 'Acta 02',
            };
          }
          return s;
        });
      }
    } catch (e) {
      console.warn('Error reading from localStorage', e);
    }
    return INITIAL_SHAPES;
  });

  // Save to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shapes));
    } catch (e) {
      console.warn('Error saving to localStorage', e);
    }
  }, [shapes]);

  // Two Independent Layers state
  const [activeLayer, setActiveLayer] = useState<LayerType>('camaras_campanas');
  const [visibleLayers, setVisibleLayers] = useState<Record<LayerType, boolean>>({
    camaras_campanas: true,
    canalizaciones: true,
  });

  // Photo modal state
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState<boolean>(false);

  // Selected tool and attributes
  const [activeTool, setActiveTool] = useState<'select' | 'pan' | 'eraser' | ShapeType>('select');
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);

  // Drawing attributes for next shapes
  const [currentCategory, setCurrentCategory] = useState<AutoShapeCategory>('camara_mt');
  const [currentActa, setCurrentActa] = useState<string>('Acta 01');
  const [currentColor, setCurrentColor] = useState<string>('#dc2626');
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState<number>(3);
  const [currentCalibre, setCurrentCalibre] = useState<string>('Norma SB851');
  const [currentIconSize, setCurrentIconSize] = useState<number>(1.0);
  const [isOrthoMode, setIsOrthoMode] = useState<boolean>(false);
  const [canvasDimensions, setCanvasDimensions] = useState<CanvasDimensions>({
    width: 2000,
    height: 1414,
  });

  // Table Drawer state
  const [isTableDrawerOpen, setIsTableDrawerOpen] = useState<boolean>(false);

  // Canvas Reference for PDF capture
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleRegisterCanvas = (canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
  };

  const getCanvasDataUrl = useCallback((): string | null => {
    if (!canvasRef.current) return null;
    try {
      return canvasRef.current.toDataURL('image/png');
    } catch (e) {
      return null;
    }
  }, []);

  // Keyboard shortcut to delete selected shape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShapeId) {
        // Only if not focused on an input/textarea
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
          return;
        }
        setShapes((prev) => prev.filter((s) => s.id !== selectedShapeId));
        setSelectedShapeId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShapeId]);

  // CRUD operations
  const handleAddShape = (newShape: AutoShape) => {
    setShapes((prev) => [...prev, newShape]);
  };

  const handleUpdateShape = (id: string, updates: Partial<AutoShape>) => {
    setShapes((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handleDeleteShape = (id: string) => {
    setShapes((prev) => prev.filter((s) => s.id !== id));
    if (selectedShapeId === id) setSelectedShapeId(null);
  };

  // Export handlers
  const handleExportCsv = () => {
    exportAutoShapesToCsv(shapes, 'Plano_LaNubia');
  };

  const handleExportPdf = async () => {
    const captureUrl = getCanvasDataUrl();
    await exportAutoShapesToPdf(shapes, captureUrl);
  };

  // Currently selected shape object
  const selectedShape = shapes.find((s) => s.id === selectedShapeId) || null;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* SIMPLE CAD HEADER: 1-ROW TOP BAR WITH AUTOSHAPES PALETTE */}
      <header className="h-14 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0 z-40">
        {/* BRAND */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md">
            <Square className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight">TrazaPlano · Autoformas</h1>
            <p className="text-[10px] text-slate-400 font-mono">Trazabilidad de Actas y Redes</p>
          </div>
        </div>

        {/* AUTOSHAPES TOOLBAR (DIBUJO DE AUTOFORMAS) */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          {/* PUNTERO */}
          <button
            onClick={() => setActiveTool('select')}
            title="Seleccionar y Mover Autoformas"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTool === 'select'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Puntero</span>
          </button>

          {/* MANO */}
          <button
            onClick={() => setActiveTool('pan')}
            title="Mover Plano"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTool === 'pan'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <Hand className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mover</span>
          </button>

          <div className="w-px h-4 bg-slate-800 mx-1" />

          {/* LÍNEA (TUBERÍA) */}
          <button
            onClick={() => {
              setActiveTool('line');
              setCurrentCategory('tuberia');
            }}
            title="Dibujar Línea de Tubería o Cable"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTool === 'line'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-850'
            }`}
          >
            <Minus className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Línea (Tubo)</span>
          </button>

          {/* FLECHA (ACOMETIDA) */}
          <button
            onClick={() => {
              setActiveTool('arrow');
              setCurrentCategory('tuberia');
            }}
            title="Dibujar Flecha de Acometida o Dirección"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTool === 'arrow'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-850'
            }`}
          >
            <MoveRight className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Flecha</span>
          </button>

          {/* RECTÁNGULO (CAJA / PADMOUNT) */}
          <button
            onClick={() => {
              setActiveTool('rect');
              setCurrentCategory('caja');
            }}
            title="Dibujar Rectángulo de Caja o Transformador"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTool === 'rect'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-850'
            }`}
          >
            <Square className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Rectángulo</span>
          </button>

          {/* CÍRCULO (CÁMARA MT/BT) */}
          <button
            onClick={() => {
              setActiveTool('circle');
              setCurrentCategory('camara_mt');
              setActiveLayer('camaras_campanas');
            }}
            title="Dibujar Círculo de Cámara MT/BT"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTool === 'circle' && currentCategory !== 'campana'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-850'
            }`}
          >
            <Circle className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Cámara</span>
          </button>

          {/* CAMPANA PVC (TERMINACIONES DE DUCTO EN CÁMARA) */}
          <button
            onClick={() => {
              setActiveTool('circle');
              setCurrentCategory('campana');
              setActiveLayer('camaras_campanas');
              setCurrentColor('#10b981');
              setCurrentCalibre('4" PVC (Campana)');
            }}
            title="Dibujar Campanas / Terminaciones de tubería en caras de cámaras (como en la foto de obra)"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              currentCategory === 'campana'
                ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                : 'text-emerald-400 hover:text-white hover:bg-emerald-950/50'
            }`}
          >
            <span className="text-xs">🔔</span>
            <span className="hidden md:inline">Campanas</span>
          </button>

          {/* TEXTO */}
          <button
            onClick={() => {
              setActiveTool('text');
              setCurrentCategory('custom');
            }}
            title="Agregar Rótulo o Nota de Texto"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTool === 'text'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-850'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Texto</span>
          </button>

          <div className="w-px h-4 bg-slate-800 mx-0.5" />

          {/* BORRADOR */}
          <button
            onClick={() => setActiveTool('eraser')}
            title="Herramienta Borrador: Haga clic en cualquier autoforma en el plano para borrarla"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTool === 'eraser'
                ? 'bg-red-600 text-white shadow-sm ring-1 ring-red-400'
                : 'text-red-400 hover:text-white hover:bg-red-950/40'
            }`}
          >
            <Eraser className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Borrador</span>
          </button>
        </div>

        {/* QUICK PALETTE & ACTIONS */}
        <div className="flex items-center gap-2">
          {/* BOTÓN BORRAR SELECCIÓN (CUANDO HAY UNA AUTOFORMA SELECCIONADA) */}
          {selectedShapeId && (
            <button
              onClick={() => handleDeleteShape(selectedShapeId)}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-red-600/30 transition-all animate-in fade-in duration-150"
              title="Borrar autoforma seleccionada (Tecla Supr / Delete)"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Borrar</span>
            </button>
          )}

          {/* COLOR SELECTOR */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {COLOR_PALETTE.map((col) => (
              <button
                key={col.hex}
                onClick={() => setCurrentColor(col.hex)}
                style={{ backgroundColor: col.hex }}
                title={col.name}
                className={`w-5 h-5 rounded-md transition-transform ${
                  currentColor === col.hex ? 'scale-125 ring-2 ring-white shadow-md' : 'hover:scale-110'
                }`}
              />
            ))}
          </div>

          {/* VIEW TABLE DRAWER */}
          <button
            onClick={() => setIsTableDrawerOpen(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <TableProperties className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Tabla</span>
            <span className="font-mono text-[11px] bg-slate-900 px-1.5 py-0.2 rounded text-slate-400">
              {shapes.length}
            </span>
          </button>

          {/* BORRAR TODAS LAS AUTOFORMAS (LIMPIAR PLANO) */}
          <button
            onClick={() => {
              if (shapes.length === 0) return;
              if (confirm('¿Está seguro de borrar TODAS las autoformas y dibujos del plano?')) {
                setShapes([]);
                setSelectedShapeId(null);
              }
            }}
            disabled={shapes.length === 0}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-red-950/60 hover:text-red-300 hover:border-red-800/80 text-slate-400 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Borrar todas las autoformas del plano"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Limpiar Todo</span>
          </button>

          {/* EXPORT CSV */}
          <button
            onClick={handleExportCsv}
            title="Descargar Hoja Excel CSV"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          {/* EXPORT PDF */}
          <button
            onClick={handleExportPdf}
            title="Descargar Informe Técnico con Plano y Tabla"
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
        </div>
      </header>

      {/* BARRA DE CAPAS INDEPENDIENTES: CÁMARAS Y CAMPANAS VS CANALIZACIONES */}
      <div className="h-10 px-4 bg-slate-950/95 border-b border-slate-800 flex items-center justify-between text-xs shrink-0 gap-2 overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mr-1">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Capas de Obra:</span>
          </span>

          {/* CAPA 1: CÁMARAS Y CAMPANAS */}
          <div
            className={`flex items-center rounded-lg border transition-all ${
              activeLayer === 'camaras_campanas'
                ? 'bg-blue-950/70 border-blue-500 text-white shadow-sm ring-1 ring-blue-500/30'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setActiveLayer('camaras_campanas');
                if (activeTool === 'line' || activeTool === 'arrow') {
                  setActiveTool('circle');
                  setCurrentCategory('camara_mt');
                }
              }}
              className="px-2.5 py-1 text-xs font-semibold flex items-center gap-1.5"
              title="Activar capa para dibujar cámaras y terminaciones de campana"
            >
              <span>🏛️ Cámaras y Campanas</span>
              <span className="font-mono text-[10.5px] px-1.5 py-0.2 rounded bg-blue-900/60 text-blue-200">
                {shapes.filter((s) => (s.layer || (s.category === 'tuberia' ? 'canalizaciones' : 'camaras_campanas')) === 'camaras_campanas').length}
              </span>
            </button>

            {/* VISIBILIDAD OJO */}
            <button
              type="button"
              onClick={() =>
                setVisibleLayers((prev) => ({
                  ...prev,
                  camaras_campanas: !prev.camaras_campanas,
                }))
              }
              className={`p-1.5 border-l border-slate-800 hover:text-white transition-colors ${
                visibleLayers.camaras_campanas ? 'text-blue-400' : 'text-slate-600'
              }`}
              title={
                visibleLayers.camaras_campanas
                  ? 'Ocultar capa Cámaras y Campanas en el plano'
                  : 'Mostrar capa Cámaras y Campanas en el plano'
              }
            >
              {visibleLayers.camaras_campanas ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* CAPA 2: CANALIZACIONES */}
          <div
            className={`flex items-center rounded-lg border transition-all ${
              activeLayer === 'canalizaciones'
                ? 'bg-emerald-950/70 border-emerald-500 text-white shadow-sm ring-1 ring-emerald-500/30'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setActiveLayer('canalizaciones');
                if (activeTool === 'circle' || activeTool === 'rect') {
                  setActiveTool('line');
                  setCurrentCategory('tuberia');
                  setCurrentCalibre('3x4" PVC');
                }
              }}
              className="px-2.5 py-1 text-xs font-semibold flex items-center gap-1.5"
              title="Activar capa para trazar canalizaciones y tuberías"
            >
              <span>⚡ Canalizaciones (Tuberías)</span>
              <span className="font-mono text-[10.5px] px-1.5 py-0.2 rounded bg-emerald-900/60 text-emerald-200">
                {shapes.filter((s) => (s.layer || (s.category === 'tuberia' ? 'canalizaciones' : 'camaras_campanas')) === 'canalizaciones').length}
              </span>
            </button>

            {/* VISIBILIDAD OJO */}
            <button
              type="button"
              onClick={() =>
                setVisibleLayers((prev) => ({
                  ...prev,
                  canalizaciones: !prev.canalizaciones,
                }))
              }
              className={`p-1.5 border-l border-slate-800 hover:text-white transition-colors ${
                visibleLayers.canalizaciones ? 'text-emerald-400' : 'text-slate-600'
              }`}
              title={
                visibleLayers.canalizaciones
                  ? 'Ocultar capa Canalizaciones en el plano'
                  : 'Mostrar capa Canalizaciones en el plano'
              }
            >
              {visibleLayers.canalizaciones ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* QUICK TOGGLE BUTTONS */}
          <div className="hidden lg:flex items-center gap-1 ml-1">
            <button
              type="button"
              onClick={() => setVisibleLayers({ camaras_campanas: true, canalizaciones: true })}
              className="px-2 py-0.5 rounded text-[10.5px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
            >
              Ver Ambas
            </button>
            <button
              type="button"
              onClick={() => setVisibleLayers({ camaras_campanas: true, canalizaciones: false })}
              className="px-2 py-0.5 rounded text-[10.5px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
            >
              Solo Cámaras
            </button>
            <button
              type="button"
              onClick={() => setVisibleLayers({ camaras_campanas: false, canalizaciones: true })}
              className="px-2 py-0.5 rounded text-[10.5px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
            >
              Solo Canalizaciones
            </button>
          </div>
        </div>

        {/* FOTO REFERENCIAL DE OBRA: CAMPANAS EN CÁMARAS */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsPhotoModalOpen(true)}
            className="px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/80 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            title="Ver fotografía de obra: campanas embebidas en las paredes de la cámara"
          >
            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Foto Obra:</span>
            <span>Campanas en Cámara</span>
          </button>
        </div>
      </div>

      {/* SUB-BAR: QUICK ATTRIBUTES (Acta & Calibre para el siguiente dibujo) */}
      <div className="h-9 px-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300 shrink-0">
        <div className="flex items-center gap-3">
          {/* ACTA */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">Asignar a:</span>
            <select
              value={currentActa}
              onChange={(e) => setCurrentActa(e.target.value)}
              className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-white font-semibold focus:outline-none focus:border-blue-500"
            >
              {ACTAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* CALIBRE */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">Calibre:</span>
            <input
              type="text"
              list="subbar-calibres"
              value={currentCalibre}
              onChange={(e) => setCurrentCalibre(e.target.value)}
              className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-white font-mono w-28 focus:outline-none focus:border-blue-500"
            />
            <datalist id="subbar-calibres">
              {CALIBRES_RAPIDOS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="w-px h-4 bg-slate-800 mx-1 hidden md:block" />

          {/* GROSOR DE TRAZO */}
          <div className="hidden md:flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">Grosor:</span>
            <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700">
              {[
                { label: '1.5', val: 1.5 },
                { label: '3', val: 3 },
                { label: '5', val: 5 },
                { label: '8', val: 8 },
                { label: '12', val: 12 },
              ].map((th) => (
                <button
                  key={th.val}
                  type="button"
                  onClick={() => {
                    setCurrentStrokeWidth(th.val);
                    if (selectedShapeId) {
                      handleUpdateShape(selectedShapeId, { strokeWidth: th.val });
                    }
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold flex items-center gap-1 transition-colors ${
                    currentStrokeWidth === th.val
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                  title={`Grosor ${th.val}px`}
                >
                  <span
                    className="w-2.5 rounded-full"
                    style={{
                      height: `${Math.min(5, Math.max(1, th.val / 2))}px`,
                      backgroundColor: currentStrokeWidth === th.val ? '#ffffff' : '#94a3b8',
                    }}
                  />
                  <span>{th.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-4 bg-slate-800 mx-1 hidden lg:block" />

          {/* TAMAÑO DE ÍCONOS / SÍMBOLOS */}
          <div className="hidden lg:flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">Escala / Ícono:</span>
            <div className="flex items-center gap-0.5 bg-slate-800 p-0.5 rounded-lg border border-slate-700">
              {[
                { label: '3XS', val: 0.25, tip: '3XS (25%) - Ultra compacto' },
                { label: 'XXS', val: 0.4, tip: 'XXS (40%) - Muy pequeño' },
                { label: 'XS', val: 0.6, tip: 'XS (60%) - Pequeño' },
                { label: 'S', val: 0.8, tip: 'S (80%)' },
                { label: 'M', val: 1.0, tip: 'M (100% normal)' },
                { label: 'L', val: 1.4, tip: 'L (140%)' },
                { label: 'XL', val: 2.0, tip: 'XL (200%)' },
              ].map((sz) => (
                <button
                  key={sz.val}
                  type="button"
                  onClick={() => {
                    setCurrentIconSize(sz.val);
                    if (selectedShapeId) {
                      handleUpdateShape(selectedShapeId, { iconSize: sz.val });
                    }
                  }}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                    Math.abs(currentIconSize - sz.val) < 0.05
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                  title={sz.tip}
                >
                  {sz.label}
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-4 bg-slate-800 mx-1 hidden lg:block" />

          {/* MODO ORTO / LÍNEA RECTA */}
          <button
            type="button"
            onClick={() => setIsOrthoMode((prev) => !prev)}
            className={`px-2 py-0.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isOrthoMode
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm ring-1 ring-amber-300'
                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700'
            }`}
            title="Modo Recto (Shift): Dibuja y alinea tuberías y líneas 100% derechas a 90° o 45°"
          >
            <Compass className={`w-3.5 h-3.5 ${isOrthoMode ? 'text-slate-950' : 'text-blue-400'}`} />
            <span className="hidden sm:inline">Modo Recto</span>
            <span className={`text-[9.5px] px-1 py-0.2 rounded font-bold uppercase ${
              isOrthoMode ? 'bg-black/25 text-black' : 'bg-slate-900 text-slate-400'
            }`}>
              {isOrthoMode ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* BOTÓN DIRECTO: ENDEREZAR LÍNEA SELECCIONADA */}
          {selectedShape && (selectedShape.type === 'line' || selectedShape.type === 'arrow') && (
            <button
              type="button"
              onClick={() => {
                const updates = straightenLine(selectedShape, 'auto', canvasDimensions);
                handleUpdateShape(selectedShape.id, updates);
              }}
              className="px-2.5 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-600/30 transition-all animate-in fade-in"
              title="Enderezar la línea seleccionada a 100% horizontal o vertical"
            >
              <span>📐 Enderezar Línea</span>
            </button>
          )}
        </div>

        {/* SHORT INSTRUCTION */}
        <div className="text-[11px] text-slate-400 hidden sm:flex items-center gap-2">
          <span>Mantenga presionado <kbd className="px-1 py-0.2 bg-slate-800 text-slate-200 rounded text-[10px] font-mono border border-slate-700">Shift</kbd> para dibujar líneas rectas</span>
          <span>·</span>
          <span>Haga clic en cualquier forma para editar o enderezar</span>
        </div>
      </div>

      {/* FULL-SCREEN BLUEPRINT CANVAS */}
      <main className="flex-1 relative overflow-hidden">
        <AutoShapesCanvas
          shapes={shapes}
          selectedShapeId={selectedShapeId}
          activeTool={activeTool}
          currentCategory={currentCategory}
          currentActa={currentActa}
          currentColor={currentColor}
          currentStrokeWidth={currentStrokeWidth}
          currentCalibre={currentCalibre}
          currentIconSize={currentIconSize}
          visibleLayers={visibleLayers}
          activeLayer={activeLayer}
          isOrthoMode={isOrthoMode}
          onToggleOrthoMode={() => setIsOrthoMode((prev) => !prev)}
          onDimensionsChange={setCanvasDimensions}
          onOpenPhotoModal={() => setIsPhotoModalOpen(true)}
          onSelectShape={setSelectedShapeId}
          onAddShape={handleAddShape}
          onUpdateShape={handleUpdateShape}
          onDeleteShape={handleDeleteShape}
          onRegisterCanvasRef={handleRegisterCanvas}
        />

        {/* FLOATING PROPERTY INSPECTOR WHEN SHAPE IS SELECTED */}
        <ShapePropertyInspector
          shape={selectedShape}
          onUpdate={handleUpdateShape}
          onDelete={handleDeleteShape}
          onClose={() => setSelectedShapeId(null)}
          canvasDimensions={canvasDimensions}
        />
      </main>

      {/* QUICK TABLE DRAWER */}
      <AutoShapesTableDrawer
        isOpen={isTableDrawerOpen}
        onClose={() => setIsTableDrawerOpen(false)}
        shapes={shapes}
        onSelectShape={setSelectedShapeId}
        onDeleteShape={handleDeleteShape}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
      />

      {/* MODAL FOTOGRAFÍA DE OBRA: CAMPANAS EN CÁMARA */}
      {isPhotoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col">
            {/* HEADER */}
            <div className="px-5 py-3.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Registro Fotográfico en Obra</h3>
                  <p className="text-[11px] text-emerald-400 font-mono">Campanas PVC embebidas en caras de la cámara</p>
                </div>
              </div>
              <button
                onClick={() => setIsPhotoModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* PHOTO CONTENT */}
            <div className="p-4 bg-slate-950 flex flex-col items-center">
              <div className="relative rounded-xl overflow-hidden border border-slate-800 shadow-xl max-h-[50vh]">
                <img
                  src="/assets/aistudio/IMG20261106100553_e1aafaf1.jpg"
                  alt="Campanas PVC en cámara de inspección eléctrica"
                  className="w-full h-full object-contain max-h-[50vh]"
                />
                <div className="absolute bottom-2 left-2 px-2.5 py-1 bg-slate-950/85 backdrop-blur-md rounded-md text-[10.5px] font-mono text-emerald-300 border border-emerald-800/80">
                  🔔 Batería de campanas PVC en pared de la cámara (Obra La Nubia)
                </div>
              </div>

              {/* DESCRIPTIVE NOTICE */}
              <div className="mt-3.5 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-1.5 w-full">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-[11.5px]">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>Estructura de las Dos Capas Independientes</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  • <strong className="text-white">Capa Cámaras y Campanas:</strong> Controla las cámaras de concreto (MT/BT/Pozos) y las campanas abocinadas verdes instaladas en ambos lados de cada cámara donde se rematan los ductos.
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  • <strong className="text-white">Capa Canalizaciones:</strong> Controla las tuberías, zanjas y bancos de ductos tendidos entre cámaras con sus metros lineales y calibres.
                </p>
              </div>
            </div>

            {/* FOOTER */}
            <div className="px-5 py-3 bg-slate-900/90 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setIsPhotoModalOpen(false)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-md"
              >
                Cerrar Fotografía
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
