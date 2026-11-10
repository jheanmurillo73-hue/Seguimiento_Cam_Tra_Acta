import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { AutoShape, ShapeType, AutoShapeCategory, CustomPreset, LayerType } from '../types';
import { loadPdfDocument, renderPdfPageToCanvas } from '../services/pdfRenderer';
import { snapPointToOrtho, straightenLine, OrthoSnapResult, CanvasDimensions } from '../utils/geometry';
import {
  MousePointer,
  Hand,
  Eraser,
  Minus,
  MoveRight,
  Square,
  Circle,
  Type,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FolderOpen,
  Upload,
  Layers,
  Palette,
  Sparkles,
  Ruler,
  Image as ImageIcon,
  Compass,
} from 'lucide-react';

interface AutoShapesCanvasProps {
  shapes: AutoShape[];
  selectedShapeId: string | null;
  activeTool: 'select' | 'pan' | 'eraser' | ShapeType;
  currentCategory: AutoShapeCategory;
  currentActa: string;
  currentColor: string;
  currentStrokeWidth: number;
  currentCalibre: string;
  currentIconSize?: number;
  visibleLayers?: Record<LayerType, boolean>;
  activeLayer?: LayerType;
  isOrthoMode?: boolean;
  onToggleOrthoMode?: () => void;
  onDimensionsChange?: (dims: CanvasDimensions) => void;
  onOpenPhotoModal?: () => void;
  onSelectShape: (id: string | null) => void;
  onAddShape: (newShape: AutoShape) => void;
  onUpdateShape: (id: string, updates: Partial<AutoShape>) => void;
  onDeleteShape: (id: string) => void;
  onRegisterCanvasRef: (canvas: HTMLCanvasElement | null) => void;
}

export const AutoShapesCanvas: React.FC<AutoShapesCanvasProps> = ({
  shapes,
  selectedShapeId,
  activeTool,
  currentCategory,
  currentActa,
  currentColor,
  currentStrokeWidth,
  currentCalibre,
  currentIconSize = 1.0,
  visibleLayers = { camaras_campanas: true, canalizaciones: true },
  activeLayer = 'camaras_campanas',
  isOrthoMode,
  onToggleOrthoMode,
  onDimensionsChange,
  onOpenPhotoModal,
  onSelectShape,
  onAddShape,
  onUpdateShape,
  onDeleteShape,
  onRegisterCanvasRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);

  // PDF Loading
  const [pdfSource, setPdfSource] = useState<string | ArrayBuffer>(
    '/assets/aistudio/1.ALCANTARILLADO_VS_ELECTRICO_Jul.30-2026_2__1_-Model_a5753fa7.pdf'
  );
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(true);
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number }>({
    width: 2000,
    height: 1414,
  });

  // Pan & Zoom
  const [transform, setTransform] = useState<{ x: number; y: number; scale: number }>({
    x: 0,
    y: 0,
    scale: 0.65,
  });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Drawing state
  const [drawingStart, setDrawingStart] = useState<{ x: number; y: number } | null>(null);
  const [drawingCurrent, setDrawingCurrent] = useState<{ x: number; y: number } | null>(null);

  // Modo Orto / Línea Recta (Shift o botón dedicado)
  const [isShiftPressed, setIsShiftPressed] = useState<boolean>(false);
  const [internalOrthoMode, setInternalOrthoMode] = useState<boolean>(false);
  const [orthoFeedback, setOrthoFeedback] = useState<OrthoSnapResult | null>(null);

  const isOrthoActive = isOrthoMode !== undefined ? (isOrthoMode || isShiftPressed) : (internalOrthoMode || isShiftPressed);

  // Dragging existing shape or endpoint handle
  const [draggingShape, setDraggingShape] = useState<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origEndX?: number;
    origEndY?: number;
    handle?: 'all' | 'start' | 'end';
  } | null>(null);

  // Calibration: 1% of blueprint = ~2.5 meters in 1:500 scale
  const metersPerPercent = 2.5;

  // Keyboard shortcut for Shift (Ortho mode) and 'O'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(true);
      if (
        (e.key === 'o' || e.key === 'O') &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        if (onToggleOrthoMode) {
          onToggleOrthoMode();
        } else {
          setInternalOrthoMode((prev) => !prev);
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onToggleOrthoMode]);

  useEffect(() => {
    if (onRegisterCanvasRef && pdfCanvasRef.current) {
      onRegisterCanvasRef(pdfCanvasRef.current);
    }
  }, [onRegisterCanvasRef, isLoadingPdf]);

  // Load PDF
  useEffect(() => {
    let isMounted = true;
    setIsLoadingPdf(true);

    loadPdfDocument(pdfSource)
      .then((info) => {
        if (!isMounted) return;
        setPdfDoc(info.doc);
        setIsLoadingPdf(false);
      })
      .catch((err) => {
        console.error('Error al cargar PDF:', err);
        setIsLoadingPdf(false);
      });

    return () => {
      isMounted = false;
    };
  }, [pdfSource]);

  // Render PDF
  useEffect(() => {
    if (!pdfDoc || !pdfCanvasRef.current) return;
    renderPdfPageToCanvas(pdfDoc, 1, pdfCanvasRef.current, 1.5).then((rendered) => {
      setCanvasDimensions({ width: rendered.width, height: rendered.height });
      if (onDimensionsChange) onDimensionsChange({ width: rendered.width, height: rendered.height });
      if (containerRef.current) {
        const containerW = containerRef.current.clientWidth;
        const containerH = containerRef.current.clientHeight;
        const fitScale = Math.min((containerW - 40) / rendered.width, (containerH - 40) / rendered.height, 1);
        const initialX = Math.max(0, (containerW - rendered.width * fitScale) / 2);
        const initialY = Math.max(0, (containerH - rendered.height * fitScale) / 2);
        setTransform({ x: initialX, y: initialY, scale: fitScale });
      }
    });
  }, [pdfDoc]);

  // Screen to percentage coordinates (0 - 100%)
  const screenToCanvasPercent = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;

      const canvasX = (screenX - transform.x) / transform.scale;
      const canvasY = (screenY - transform.y) / transform.scale;

      const px = (canvasX / canvasDimensions.width) * 100;
      const py = (canvasY / canvasDimensions.height) * 100;

      return {
        x: Math.max(0, Math.min(100, Number(px.toFixed(2)))),
        y: Math.max(0, Math.min(100, Number(py.toFixed(2)))),
      };
    },
    [transform, canvasDimensions]
  );

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newScale = Math.max(0.15, Math.min(5.0, transform.scale * zoomFactor));

    const newX = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
    const newY = mouseY - (mouseY - transform.y) * (newScale / transform.scale);

    setTransform({ x: newX, y: newY, scale: newScale });
  };

  // Zoom buttons
  const handleZoomIn = () => setTransform((prev) => ({ ...prev, scale: Math.min(5.0, prev.scale * 1.25) }));
  const handleZoomOut = () => setTransform((prev) => ({ ...prev, scale: Math.max(0.15, prev.scale * 0.8) }));
  const handleResetZoom = () => {
    if (!containerRef.current) return;
    const fitScale = Math.min(
      (containerRef.current.clientWidth - 40) / canvasDimensions.width,
      (containerRef.current.clientHeight - 40) / canvasDimensions.height,
      1
    );
    const initialX = Math.max(0, (containerRef.current.clientWidth - canvasDimensions.width * fitScale) / 2);
    const initialY = Math.max(0, (containerRef.current.clientHeight - canvasDimensions.height * fitScale) / 2);
    setTransform({ x: initialX, y: initialY, scale: fitScale });
  };

  // File upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) setPdfSource(event.target.result);
      };
      reader.readAsArrayBuffer(file);
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (typeof event.target?.result === 'string') {
          const img = new Image();
          img.onload = () => {
            if (pdfCanvasRef.current) {
              pdfCanvasRef.current.width = img.width;
              pdfCanvasRef.current.height = img.height;
              const ctx = pdfCanvasRef.current.getContext('2d');
              ctx?.drawImage(img, 0, 0);
              setCanvasDimensions({ width: img.width, height: img.height });
              setIsLoadingPdf(false);
            }
          };
          img.src = event.target.result;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Mouse Down
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || activeTool === 'pan') {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
      return;
    }

    if (e.button !== 0) return;

    const pt = screenToCanvasPercent(e.clientX, e.clientY);

    // If activeTool is a shape tool (line, arrow, rect, circle, text)
    if (activeTool !== 'select' && activeTool !== 'eraser') {
      setDrawingStart(pt);
      setDrawingCurrent(pt);
      return;
    }

    // If select or eraser tool clicked empty space
    onSelectShape(null);
  };

  // Mouse Move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      }));
      return;
    }

    const pt = screenToCanvasPercent(e.clientX, e.clientY);

    // If currently drawing a new shape
    if (drawingStart) {
      if (isOrthoActive && (activeTool === 'line' || activeTool === 'arrow')) {
        const snap = snapPointToOrtho(drawingStart, pt, canvasDimensions);
        setDrawingCurrent(snap.pt);
        setOrthoFeedback(snap);
      } else {
        setDrawingCurrent(pt);
        setOrthoFeedback(null);
      }
      return;
    }

    // If dragging an existing shape or endpoint handle
    if (draggingShape) {
      const dx = pt.x - draggingShape.startX;
      const dy = pt.y - draggingShape.startY;

      if (draggingShape.handle === 'start') {
        let newX = Math.max(0, Math.min(100, draggingShape.origX + dx));
        let newY = Math.max(0, Math.min(100, draggingShape.origY + dy));
        if (isOrthoActive && draggingShape.origEndX !== undefined && draggingShape.origEndY !== undefined) {
          const anchor = { x: draggingShape.origEndX, y: draggingShape.origEndY };
          const snap = snapPointToOrtho(anchor, { x: newX, y: newY }, canvasDimensions);
          newX = snap.pt.x;
          newY = snap.pt.y;
          setOrthoFeedback(snap);
        }
        const distPercent = Math.hypot(
          (draggingShape.origEndX ?? newX) - newX,
          (draggingShape.origEndY ?? newY) - newY
        );
        onUpdateShape(draggingShape.id, {
          x: newX,
          y: newY,
          metros: Number((distPercent * metersPerPercent).toFixed(1)),
        });
        return;
      }

      if (draggingShape.handle === 'end') {
        let newEndX = Math.max(0, Math.min(100, (draggingShape.origEndX ?? draggingShape.origX) + dx));
        let newEndY = Math.max(0, Math.min(100, (draggingShape.origEndY ?? draggingShape.origY) + dy));
        if (isOrthoActive) {
          const anchor = { x: draggingShape.origX, y: draggingShape.origY };
          const snap = snapPointToOrtho(anchor, { x: newEndX, y: newEndY }, canvasDimensions);
          newEndX = snap.pt.x;
          newEndY = snap.pt.y;
          setOrthoFeedback(snap);
        }
        const distPercent = Math.hypot(newEndX - draggingShape.origX, newEndY - draggingShape.origY);
        onUpdateShape(draggingShape.id, {
          endX: newEndX,
          endY: newEndY,
          metros: Number((distPercent * metersPerPercent).toFixed(1)),
        });
        return;
      }

      const updates: Partial<AutoShape> = {
        x: Math.max(0, Math.min(100, draggingShape.origX + dx)),
        y: Math.max(0, Math.min(100, draggingShape.origY + dy)),
      };

      if (draggingShape.origEndX !== undefined && draggingShape.origEndY !== undefined) {
        updates.endX = Math.max(0, Math.min(100, draggingShape.origEndX + dx));
        updates.endY = Math.max(0, Math.min(100, draggingShape.origEndY + dy));
      }

      onUpdateShape(draggingShape.id, updates);
    }
  };

  // Mouse Up
  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingShape(null);
    setOrthoFeedback(null);

    // Finished drawing a shape
    if (drawingStart && drawingCurrent) {
      let finalEndPt = drawingCurrent;
      if (isOrthoActive && (activeTool === 'line' || activeTool === 'arrow')) {
        const snap = snapPointToOrtho(drawingStart, drawingCurrent, canvasDimensions);
        finalEndPt = snap.pt;
      }

      const dx = finalEndPt.x - drawingStart.x;
      const dy = finalEndPt.y - drawingStart.y;
      const distPercent = Math.hypot(dx, dy);

      // Create new AutoShape
      const id = `shape-${Date.now()}`;
      const shapeType = activeTool as ShapeType;
      const autoCalibre = currentCalibre || (shapeType === 'line' ? '3x4" PVC' : 'Estándar');

      let newShape: AutoShape | null = null;

      if (shapeType === 'line' || shapeType === 'arrow') {
        const calculatedMeters = Number((distPercent * metersPerPercent).toFixed(1));
        newShape = {
          id,
          type: shapeType,
          category: currentCategory,
          layer: 'canalizaciones', // Capa Canalizaciones
          name: `${shapeType === 'arrow' ? 'Acometida' : 'Canalización'} ${calculatedMeters}m`,
          acta: currentActa,
          fecha: new Date().toISOString().slice(0, 10),
          calibre: autoCalibre,
          estado: 'Terminado',
          notas: '',
          x: drawingStart.x,
          y: drawingStart.y,
          endX: finalEndPt.x,
          endY: finalEndPt.y,
          strokeColor: currentColor,
          fillColor: currentColor,
          strokeWidth: currentStrokeWidth,
          strokeDash: 'solid',
          metros: calculatedMeters,
          iconSize: currentIconSize,
        };
      } else if (shapeType === 'rect') {
        const width = Math.max(2, Math.abs(dx));
        const height = Math.max(2, Math.abs(dy));
        newShape = {
          id,
          type: 'rect',
          category: currentCategory,
          layer: activeLayer === 'canalizaciones' ? 'canalizaciones' : 'camaras_campanas',
          name: currentCategory === 'trafo' ? 'Transformador Padmount' : 'Caja de Paso',
          acta: currentActa,
          fecha: new Date().toISOString().slice(0, 10),
          calibre: autoCalibre,
          estado: 'Terminado',
          notas: '',
          campanasEntrada: 2,
          campanasSalida: 2,
          campanasCalibre: '4" PVC',
          campanasActa: currentActa,
          x: Math.min(drawingStart.x, drawingCurrent.x),
          y: Math.min(drawingStart.y, drawingCurrent.y),
          width,
          height,
          strokeColor: currentColor,
          fillColor: `${currentColor}33`,
          strokeWidth: currentStrokeWidth,
          strokeDash: 'solid',
          iconSize: currentIconSize,
        };
      } else if (shapeType === 'circle') {
        const radius = Math.max(1.5, distPercent / 2 || 2);
        newShape = {
          id,
          type: 'circle',
          category: currentCategory,
          layer: 'camaras_campanas', // Capa Cámaras y Campanas
          name: currentCategory.includes('mt') ? 'Cámara MT' : 'Cámara BT',
          acta: currentActa,
          fecha: new Date().toISOString().slice(0, 10),
          calibre: autoCalibre,
          estado: 'Terminado',
          notas: 'Cámara con terminación de campanas en ambas caras.',
          campanasEntrada: 4,
          campanasSalida: 4,
          campanasCalibre: '4" PVC',
          campanasActa: currentActa,
          x: drawingStart.x,
          y: drawingStart.y,
          width: radius,
          strokeColor: currentColor,
          fillColor: `${currentColor}33`,
          strokeWidth: currentStrokeWidth,
          strokeDash: 'solid',
          iconSize: currentIconSize,
        };
      } else if (shapeType === 'text') {
        const customText = prompt('Ingrese el texto o rótulo para el plano:', 'Nota de Obra');
        if (customText) {
          newShape = {
            id,
            type: 'text',
            category: 'custom',
            layer: activeLayer,
            name: customText,
            acta: currentActa,
            fecha: new Date().toISOString().slice(0, 10),
            calibre: 'Rótulo',
            estado: 'Terminado',
            notas: '',
            x: drawingStart.x,
            y: drawingStart.y,
            text: customText,
            strokeColor: currentColor,
            fillColor: 'transparent',
            strokeWidth: 1,
            strokeDash: 'solid',
            fontSize: 14,
            iconSize: currentIconSize,
          };
        }
      }

      if (newShape) {
        onAddShape(newShape);
        onSelectShape(newShape.id);
      }

      setDrawingStart(null);
      setDrawingCurrent(null);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-slate-950 overflow-hidden select-none ${
        activeTool === 'pan'
          ? 'cursor-grab active:cursor-grabbing'
          : activeTool === 'select'
          ? 'cursor-default'
          : activeTool === 'eraser'
          ? 'cursor-pointer'
          : 'cursor-crosshair'
      }`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* LOADING OVERLAY */}
      {isLoadingPdf && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="w-9 h-9 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-xs font-semibold text-slate-200">Cargando plano técnico...</p>
        </div>
      )}

      {/* TRANSFORM VIEWPORT */}
      <div
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
          width: canvasDimensions.width,
          height: canvasDimensions.height,
        }}
        className="absolute top-0 left-0 transition-transform duration-75 ease-out"
      >
        {/* PDF CANVAS */}
        <canvas
          ref={pdfCanvasRef}
          className="absolute inset-0 block shadow-2xl bg-white"
          style={{ width: canvasDimensions.width, height: canvasDimensions.height }}
        />

        {/* SVG DRAWING LAYER FOR AUTOSHAPES */}
        <svg
          viewBox={`0 0 ${canvasDimensions.width} ${canvasDimensions.height}`}
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
        >
          {/* DEFINITIONS FOR ARROWHEADS */}
          <defs>
            <marker
              id="arrow-head"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill={currentColor} />
            </marker>
          </defs>

          {/* RENDER ALL AUTOSHAPES */}
          {shapes.map((shape) => {
            const shapeLayer = shape.layer || (shape.category === 'tuberia' ? 'canalizaciones' : 'camaras_campanas');
            if (visibleLayers && !visibleLayers[shapeLayer]) {
              return null;
            }

            const isSelected = shape.id === selectedShapeId;
            const x = (shape.x / 100) * canvasDimensions.width;
            const y = (shape.y / 100) * canvasDimensions.height;
            const strokeColor = shape.strokeColor || '#dc2626';
            const strokeWidth = shape.strokeWidth || 3;

            return (
              <g
                key={shape.id}
                className="pointer-events-auto cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeTool === 'eraser') {
                    onDeleteShape(shape.id);
                    return;
                  }
                  onSelectShape(shape.id);
                }}
                onMouseDown={(e) => {
                  if (activeTool === 'select') {
                    e.stopPropagation();
                    const pt = screenToCanvasPercent(e.clientX, e.clientY);
                    setDraggingShape({
                      id: shape.id,
                      startX: pt.x,
                      startY: pt.y,
                      origX: shape.x,
                      origY: shape.y,
                      origEndX: shape.endX,
                      origEndY: shape.endY,
                    });
                  }
                }}
              >
                {/* 1. LINE (Canalizaciones / Tuberías) */}
                {shape.type === 'line' && shape.endX !== undefined && shape.endY !== undefined && (
                  <>
                    {/* Wide hit-area */}
                    <line
                      x1={x}
                      y1={y}
                      x2={(shape.endX / 100) * canvasDimensions.width}
                      y2={(shape.endY / 100) * canvasDimensions.height}
                      stroke="transparent"
                      strokeWidth="20"
                    />
                    {/* Selection halo */}
                    {isSelected && (
                      <line
                        x1={x}
                        y1={y}
                        x2={(shape.endX / 100) * canvasDimensions.width}
                        y2={(shape.endY / 100) * canvasDimensions.height}
                        stroke="#38bdf8"
                        strokeWidth={strokeWidth + 8}
                        strokeOpacity="0.4"
                        strokeLinecap="round"
                      />
                    )}
                    <line
                      x1={x}
                      y1={y}
                      x2={(shape.endX / 100) * canvasDimensions.width}
                      y2={(shape.endY / 100) * canvasDimensions.height}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                    />
                    <circle cx={x} cy={y} r="4" fill={strokeColor} />
                    <circle
                      cx={(shape.endX / 100) * canvasDimensions.width}
                      cy={(shape.endY / 100) * canvasDimensions.height}
                      r="4"
                      fill={strokeColor}
                    />
                    {/* Label */}
                    <g
                      transform={`translate(${
                        (x + (shape.endX / 100) * canvasDimensions.width) / 2
                      }, ${(y + (shape.endY / 100) * canvasDimensions.height) / 2 - 12})`}
                    >
                      <rect
                        x="-40"
                        y="-10"
                        width="80"
                        height="20"
                        rx="10"
                        fill="#0f172a"
                        fillOpacity="0.92"
                        stroke={strokeColor}
                        strokeWidth="1.5"
                      />
                      <text
                        x="0"
                        y="4"
                        fill="#ffffff"
                        fontSize="9.5"
                        fontWeight="600"
                        textAnchor="middle"
                        fontFamily="monospace"
                      >
                        {shape.calibre.slice(0, 10)} {shape.metros ? `· ${shape.metros}m` : ''}
                      </text>
                    </g>

                    {/* BOTÓN RÁPIDO: ENDEREZAR LÍNEA (CUANDO ESTÁ SELECCIONADA) */}
                    {isSelected && (
                      <g
                        transform={`translate(${
                          (x + (shape.endX / 100) * canvasDimensions.width) / 2
                        }, ${(y + (shape.endY / 100) * canvasDimensions.height) / 2 - 36})`}
                        className="cursor-pointer select-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          const updates = straightenLine(shape, 'auto', canvasDimensions);
                          onUpdateShape(shape.id, updates);
                        }}
                      >
                        <rect
                          x="-50"
                          y="-10"
                          width="100"
                          height="20"
                          rx="10"
                          fill="#2563eb"
                          stroke="#93c5fd"
                          strokeWidth="1.2"
                        />
                        <text
                          x="0"
                          y="4"
                          fill="#ffffff"
                          fontSize="9.5"
                          fontWeight="bold"
                          textAnchor="middle"
                          fontFamily="sans-serif"
                        >
                          📐 Enderezar
                        </text>
                      </g>
                    )}

                    {/* MANIPULADORES DE EXTREMOS (HANDLES) PARA AJUSTAR LA LÍNEA */}
                    {isSelected && (
                      <>
                        {/* Handle de Inicio */}
                        <g
                          className="cursor-crosshair"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            const pt = screenToCanvasPercent(e.clientX, e.clientY);
                            setDraggingShape({
                              id: shape.id,
                              startX: pt.x,
                              startY: pt.y,
                              origX: shape.x,
                              origY: shape.y,
                              origEndX: shape.endX,
                              origEndY: shape.endY,
                              handle: 'start',
                            });
                          }}
                        >
                          <circle cx={x} cy={y} r="9" fill="#0284c7" fillOpacity="0.45" stroke="#38bdf8" strokeWidth="2" />
                          <circle cx={x} cy={y} r="3.5" fill="#ffffff" />
                        </g>

                        {/* Handle de Fin */}
                        <g
                          className="cursor-crosshair"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            const pt = screenToCanvasPercent(e.clientX, e.clientY);
                            setDraggingShape({
                              id: shape.id,
                              startX: pt.x,
                              startY: pt.y,
                              origX: shape.x,
                              origY: shape.y,
                              origEndX: shape.endX,
                              origEndY: shape.endY,
                              handle: 'end',
                            });
                          }}
                        >
                          <circle
                            cx={(shape.endX / 100) * canvasDimensions.width}
                            cy={(shape.endY / 100) * canvasDimensions.height}
                            r="9"
                            fill="#0284c7"
                            fillOpacity="0.45"
                            stroke="#38bdf8"
                            strokeWidth="2"
                          />
                          <circle
                            cx={(shape.endX / 100) * canvasDimensions.width}
                            cy={(shape.endY / 100) * canvasDimensions.height}
                            r="3.5"
                            fill="#ffffff"
                          />
                        </g>
                      </>
                    )}
                  </>
                )}

                {/* 2. ARROW (Acometida / Dirección de flujo) */}
                {shape.type === 'arrow' && shape.endX !== undefined && shape.endY !== undefined && (
                  <>
                    <line
                      x1={x}
                      y1={y}
                      x2={(shape.endX / 100) * canvasDimensions.width}
                      y2={(shape.endY / 100) * canvasDimensions.height}
                      stroke="transparent"
                      strokeWidth="20"
                    />
                    {isSelected && (
                      <line
                        x1={x}
                        y1={y}
                        x2={(shape.endX / 100) * canvasDimensions.width}
                        y2={(shape.endY / 100) * canvasDimensions.height}
                        stroke="#38bdf8"
                        strokeWidth={strokeWidth + 8}
                        strokeOpacity="0.4"
                      />
                    )}
                    <line
                      x1={x}
                      y1={y}
                      x2={(shape.endX / 100) * canvasDimensions.width}
                      y2={(shape.endY / 100) * canvasDimensions.height}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      markerEnd="url(#arrow-head)"
                    />

                    {/* BOTÓN RÁPIDO: ENDEREZAR FLECHA */}
                    {isSelected && (
                      <g
                        transform={`translate(${
                          (x + (shape.endX / 100) * canvasDimensions.width) / 2
                        }, ${(y + (shape.endY / 100) * canvasDimensions.height) / 2 - 24})`}
                        className="cursor-pointer select-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          const updates = straightenLine(shape, 'auto', canvasDimensions);
                          onUpdateShape(shape.id, updates);
                        }}
                      >
                        <rect
                          x="-50"
                          y="-10"
                          width="100"
                          height="20"
                          rx="10"
                          fill="#2563eb"
                          stroke="#93c5fa"
                          strokeWidth="1.2"
                        />
                        <text
                          x="0"
                          y="4"
                          fill="#ffffff"
                          fontSize="9.5"
                          fontWeight="bold"
                          textAnchor="middle"
                          fontFamily="sans-serif"
                        >
                          📐 Enderezar
                        </text>
                      </g>
                    )}

                    {/* HANDLES PARA FLECHA */}
                    {isSelected && (
                      <>
                        <g
                          className="cursor-crosshair"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            const pt = screenToCanvasPercent(e.clientX, e.clientY);
                            setDraggingShape({
                              id: shape.id,
                              startX: pt.x,
                              startY: pt.y,
                              origX: shape.x,
                              origY: shape.y,
                              origEndX: shape.endX,
                              origEndY: shape.endY,
                              handle: 'start',
                            });
                          }}
                        >
                          <circle cx={x} cy={y} r="9" fill="#0284c7" fillOpacity="0.45" stroke="#38bdf8" strokeWidth="2" />
                          <circle cx={x} cy={y} r="3.5" fill="#ffffff" />
                        </g>
                        <g
                          className="cursor-crosshair"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            const pt = screenToCanvasPercent(e.clientX, e.clientY);
                            setDraggingShape({
                              id: shape.id,
                              startX: pt.x,
                              startY: pt.y,
                              origX: shape.x,
                              origY: shape.y,
                              origEndX: shape.endX,
                              origEndY: shape.endY,
                              handle: 'end',
                            });
                          }}
                        >
                          <circle
                            cx={(shape.endX / 100) * canvasDimensions.width}
                            cy={(shape.endY / 100) * canvasDimensions.height}
                            r="9"
                            fill="#0284c7"
                            fillOpacity="0.45"
                            stroke="#38bdf8"
                            strokeWidth="2"
                          />
                          <circle
                            cx={(shape.endX / 100) * canvasDimensions.width}
                            cy={(shape.endY / 100) * canvasDimensions.height}
                            r="3.5"
                            fill="#ffffff"
                          />
                        </g>
                      </>
                    )}
                  </>
                )}

                {/* 3. RECTANGLE (Caja, Transformador, Losa con campanas) */}
                {shape.type === 'rect' && shape.width && shape.height && (() => {
                  const scale = shape.iconSize || 1.0;
                  const rectW = Math.max(8, ((shape.width * scale) / 100) * canvasDimensions.width);
                  const rectH = Math.max(8, ((shape.height * scale) / 100) * canvasDimensions.height);
                  const campanaScale = Math.max(0.35, Math.min(1.2, scale));
                  const hasCampanasEntrada = (shape.campanasEntrada || 0) > 0;
                  const hasCampanasSalida = (shape.campanasSalida || 0) > 0;

                  return (
                    <g>
                      {isSelected && (
                        <rect
                          x={x - 4}
                          y={y - 4}
                          width={rectW + 8}
                          height={rectH + 8}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="2"
                          strokeDasharray="4 4"
                        />
                      )}
                      <rect
                        x={x}
                        y={y}
                        width={rectW}
                        height={rectH}
                        fill={shape.fillColor || `${strokeColor}22`}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        rx="3"
                      />

                      {/* CAMPANAS EN CARA ENTRADA RECT (LADO IZQUIERDO) */}
                      {hasCampanasEntrada && (
                        <g transform={`translate(${x}, ${y + rectH / 2}) scale(${campanaScale})`}>
                          <path
                            d="M 0 -8 C -3 -8, -6 -12, -9 -13 L -12 -13 C -14 -13, -14 13, -12 13 L -9 13 C -6 12, -3 8, 0 8 Z"
                            fill="#10b981"
                            stroke="#047857"
                            strokeWidth="1.2"
                          />
                          <circle cx="-10" cy="-4" r="2.2" fill="#064e3b" stroke="#34d399" strokeWidth="0.8" />
                          <circle cx="-10" cy="4" r="2.2" fill="#064e3b" stroke="#34d399" strokeWidth="0.8" />
                          <rect x="-44" y="-7" width="32" height="14" rx="7" fill="#064e3b" stroke="#10b981" strokeWidth="1" opacity="0.95" />
                          <text x="-28" y="3" fill="#a7f3d0" fontSize="7.5" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                            {shape.campanasEntrada} 🔔
                          </text>
                        </g>
                      )}

                      {/* CAMPANAS EN CARA SALIDA RECT (LADO DERECHO) */}
                      {hasCampanasSalida && (
                        <g transform={`translate(${x + rectW}, ${y + rectH / 2}) scale(${campanaScale})`}>
                          <path
                            d="M 0 -8 C 3 -8, 6 -12, 9 -13 L 12 -13 C 14 -13, 14 13, 12 13 L 9 13 C 6 12, 3 8, 0 8 Z"
                            fill="#10b981"
                            stroke="#047857"
                            strokeWidth="1.2"
                          />
                          <circle cx="10" cy="-4" r="2.2" fill="#064e3b" stroke="#34d399" strokeWidth="0.8" />
                          <circle cx="10" cy="4" r="2.2" fill="#064e3b" stroke="#34d399" strokeWidth="0.8" />
                          <rect x="12" y="-7" width="32" height="14" rx="7" fill="#064e3b" stroke="#10b981" strokeWidth="1" opacity="0.95" />
                          <text x="28" y="3" fill="#a7f3d0" fontSize="7.5" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                            {shape.campanasSalida} 🔔
                          </text>
                        </g>
                      )}

                      <text
                        x={x + rectW / 2}
                        y={y + rectH / 2 + 4}
                        fill="#ffffff"
                        fontSize={Math.max(7, Math.round(10 * Math.max(0.65, scale)))}
                        fontWeight="bold"
                        textAnchor="middle"
                        fontFamily="monospace"
                      >
                        {shape.name.slice(0, 16)}
                      </text>
                    </g>
                  );
                })()}

                {/* 4. CIRCLE (Cámara MT/BT con Campanas en entrada, salida 1 y segunda salida) */}
                {shape.type === 'circle' && shape.width && (() => {
                  const scale = shape.iconSize || 1.0;
                  const radius = Math.max(6, ((shape.width * scale) / 100) * canvasDimensions.width);
                  const campanaScale = Math.max(0.35, Math.min(1.2, scale));
                  const hasCampanasEntrada = (shape.campanasEntrada || 0) > 0;
                  const hasCampanasSalida = (shape.campanasSalida || 0) > 0;
                  const hasCampanasSalida2 = (shape.campanasSalida2 || 0) > 0;

                  return (
                    <g>
                      {isSelected && (
                        <circle
                          cx={x}
                          cy={y}
                          r={radius + 8}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="2"
                          strokeDasharray="4 4"
                        />
                      )}
                      <circle
                        cx={x}
                        cy={y}
                        r={radius}
                        fill={shape.fillColor || `${strokeColor}33`}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                      />
                      {/* Cuadrado interno que simula el pozo de concreto de la cámara */}
                      <rect
                        x={x - radius * 0.4}
                        y={y - radius * 0.4}
                        width={radius * 0.8}
                        height={radius * 0.8}
                        fill={strokeColor}
                        opacity={0.85}
                        rx="2"
                      />

                      {/* CAMPANAS LADO ENTRADA (LADO IZQUIERDO DE LA CÁMARA - VERDE PVC COMO EN FOTO) */}
                      {hasCampanasEntrada && (
                        <g transform={`translate(${x - radius}, ${y}) scale(${campanaScale})`}>
                          {/* Boquilla campana abocinada verde PVC */}
                          <path
                            d="M 0 -11 C -4 -11, -8 -15, -13 -17 L -17 -17 C -20 -17, -20 17, -17 17 L -13 17 C -8 15, -4 11, 0 11 Z"
                            fill="#10b981"
                            stroke="#047857"
                            strokeWidth="1.5"
                          />
                          {/* Bocas cilíndricas del banco de ductos */}
                          <circle cx="-14" cy="-7" r="3.2" fill="#064e3b" stroke="#6ee7b7" strokeWidth="1" />
                          <circle cx="-14" cy="7" r="3.2" fill="#064e3b" stroke="#6ee7b7" strokeWidth="1" />
                          {/* Rótulo de campanas entrada */}
                          <g transform="translate(-20, 0)">
                            <rect x="-62" y="-9" width="60" height="18" rx="9" fill="#064e3b" stroke="#10b981" strokeWidth="1.2" opacity="0.95" />
                            <text x="-32" y="3.5" fill="#a7f3d0" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                              {shape.campanasEntrada} Campanas
                            </text>
                          </g>
                        </g>
                      )}

                      {/* CAMPANAS LADO SALIDA 1 (LADO DERECHO DE LA CÁMARA - VERDE PVC COMO EN FOTO) */}
                      {hasCampanasSalida && (
                        <g transform={`translate(${x + radius}, ${y}) scale(${campanaScale})`}>
                          {/* Boquilla campana abocinada verde PVC */}
                          <path
                            d="M 0 -11 C 4 -11, 8 -15, 13 -17 L 17 -17 C 20 -17, 20 17, 17 17 L 13 17 C 8 15, 4 11, 0 11 Z"
                            fill="#10b981"
                            stroke="#047857"
                            strokeWidth="1.5"
                          />
                          {/* Bocas cilíndricas del banco de ductos */}
                          <circle cx="14" cy="-7" r="3.2" fill="#064e3b" stroke="#6ee7b7" strokeWidth="1" />
                          <circle cx="14" cy="7" r="3.2" fill="#064e3b" stroke="#6ee7b7" strokeWidth="1" />
                          {/* Rótulo de campanas salida 1 */}
                          <g transform="translate(20, 0)">
                            <rect x="2" y="-9" width="60" height="18" rx="9" fill="#064e3b" stroke="#10b981" strokeWidth="1.2" opacity="0.95" />
                            <text x="32" y="3.5" fill="#a7f3d0" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                              {shape.campanasSalida} Campanas
                            </text>
                          </g>
                        </g>
                      )}

                      {/* CAMPANAS SEGUNDA SALIDA (DERIVACIÓN / ACOMETIDA EN ÁNGULO / NOROESTE COMO EN LA FOTO) */}
                      {hasCampanasSalida2 && (() => {
                        const deg = shape.campanasSalida2Angulo ?? 115;
                        const rad = (deg * Math.PI) / 180;
                        const outX = x + Math.cos(rad) * radius;
                        const outY = y - Math.sin(rad) * radius;
                        const rotDeg = -deg;

                        return (
                          <g transform={`translate(${outX}, ${outY}) rotate(${rotDeg}) scale(${campanaScale})`}>
                            {/* Boquilla campana abocinada verde PVC hacia afuera */}
                            <path
                              d="M 0 -11 C 4 -11, 8 -15, 13 -17 L 17 -17 C 20 -17, 20 17, 17 17 L 13 17 C 8 15, 4 11, 0 11 Z"
                              fill="#10b981"
                              stroke="#047857"
                              strokeWidth="1.5"
                            />
                            <circle cx="14" cy="-7" r="3.2" fill="#064e3b" stroke="#6ee7b7" strokeWidth="1" />
                            <circle cx="14" cy="7" r="3.2" fill="#064e3b" stroke="#6ee7b7" strokeWidth="1" />
                            {/* Rótulo de campanas 2da salida */}
                            <g transform="translate(20, 0)">
                              <rect x="2" y="-9" width="68" height="18" rx="9" fill="#064e3b" stroke="#10b981" strokeWidth="1.2" opacity="0.95" />
                              <text x="36" y="3.5" fill="#a7f3d0" fontSize="7.8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                                {shape.campanasSalida2} Salida 2
                              </text>
                            </g>
                          </g>
                        );
                      })()}

                      <text
                        x={x}
                        y={y + radius + Math.max(10, 15 * campanaScale)}
                        fill="#ffffff"
                        fontSize={Math.max(7, Math.round(10 * Math.max(0.65, scale)))}
                        fontWeight="bold"
                        textAnchor="middle"
                        fontFamily="monospace"
                      >
                        {shape.name}
                      </text>
                    </g>
                  );
                })()}

                {/* 5. SYMBOL (Batería de Campanas / Terminaciones PVC como en la foto) */}
                {(shape.type === 'symbol' || shape.category === 'campana') && (() => {
                  const scale = shape.iconSize || 1.0;
                  const boxW = Math.max(14, 38 * scale);
                  const boxH = Math.max(12, 34 * scale);
                  return (
                    <g transform={`translate(${x}, ${y})`}>
                      {isSelected && (
                        <rect
                          x={-boxW / 2 - 4}
                          y={-boxH / 2 - 4}
                          width={boxW + 8}
                          height={boxH + 8}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="2"
                          strokeDasharray="4 4"
                          rx="4"
                        />
                      )}
                      {/* Bloque de concreto donde se embeben las campanas */}
                      <rect
                        x={-boxW / 2}
                        y={-boxH / 2}
                        width={boxW}
                        height={boxH}
                        fill="#1e293b"
                        stroke="#10b981"
                        strokeWidth="2"
                        rx="4"
                      />
                      {/* Matriz 2x2 de bocas de campana verde PVC tipo foto */}
                      <circle cx={-boxW / 4} cy={-boxH / 4} r={Math.max(2, 5 * scale)} fill="#10b981" stroke="#047857" strokeWidth="1" />
                      <circle cx={-boxW / 4} cy={-boxH / 4} r={Math.max(1, 2.5 * scale)} fill="#064e3b" />

                      <circle cx={boxW / 4} cy={-boxH / 4} r={Math.max(2, 5 * scale)} fill="#10b981" stroke="#047857" strokeWidth="1" />
                      <circle cx={boxW / 4} cy={-boxH / 4} r={Math.max(1, 2.5 * scale)} fill="#064e3b" />

                      <circle cx={-boxW / 4} cy={boxH / 4} r={Math.max(2, 5 * scale)} fill="#10b981" stroke="#047857" strokeWidth="1" />
                      <circle cx={-boxW / 4} cy={boxH / 4} r={Math.max(1, 2.5 * scale)} fill="#064e3b" />

                      <circle cx={boxW / 4} cy={boxH / 4} r={Math.max(2, 5 * scale)} fill="#10b981" stroke="#047857" strokeWidth="1" />
                      <circle cx={boxW / 4} cy={boxH / 4} r={Math.max(1, 2.5 * scale)} fill="#064e3b" />

                      {/* Rótulo */}
                      <text
                        x="0"
                        y={boxH / 2 + Math.max(9, 13 * scale)}
                        fill="#34d399"
                        fontSize={Math.max(6.5, Math.round(9 * Math.max(0.65, scale)))}
                        fontWeight="bold"
                        textAnchor="middle"
                        fontFamily="monospace"
                      >
                        {shape.name}
                      </text>
                    </g>
                  );
                })()}

                {/* 6. TEXT LABEL */}
                {shape.type === 'text' && shape.text && (() => {
                  const scale = shape.iconSize || 1.0;
                  const textFontSize = Math.max(8, Math.round((shape.fontSize || 14) * scale));
                  return (
                    <g transform={`translate(${x}, ${y})`}>
                      {isSelected && (
                        <rect
                          x="-4"
                          y={-textFontSize - 2}
                          width="180"
                          height={textFontSize + 8}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                          strokeDasharray="3 3"
                        />
                      )}
                      <text
                        x="0"
                        y="0"
                        fill={strokeColor}
                        fontSize={textFontSize}
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        {shape.text}
                      </text>
                    </g>
                  );
                })()}

                {/* FLOATING DELETE BADGE WHEN SELECTED */}
                {isSelected && (
                  <g
                    transform={`translate(${x}, ${y - 18})`}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteShape(shape.id);
                    }}
                  >
                    <rect
                      x="-14"
                      y="-11"
                      width="28"
                      height="22"
                      rx="6"
                      fill="#ef4444"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M-4 -4 L4 4 M4 -4 L-4 4"
                      stroke="#ffffff"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </g>
                )}
              </g>
            );
          })}

          {/* PREVIEW OF SHAPE CURRENTLY BEING DRAWN */}
          {drawingStart && drawingCurrent && (
            <g>
              {/* GUÍAS ORTOGONALES CUANDO EL MODO RECTO ESTÁ ACTIVO */}
              {isOrthoActive && (activeTool === 'line' || activeTool === 'arrow') && (
                <>
                  <line
                    x1={0}
                    y1={(drawingStart.y / 100) * canvasDimensions.height}
                    x2={canvasDimensions.width}
                    y2={(drawingStart.y / 100) * canvasDimensions.height}
                    stroke="#38bdf8"
                    strokeWidth="1"
                    strokeDasharray="3 4"
                    opacity="0.45"
                  />
                  <line
                    x1={(drawingStart.x / 100) * canvasDimensions.width}
                    y1={0}
                    x2={(drawingStart.x / 100) * canvasDimensions.width}
                    y2={canvasDimensions.height}
                    stroke="#38bdf8"
                    strokeWidth="1"
                    strokeDasharray="3 4"
                    opacity="0.45"
                  />
                </>
              )}

              {activeTool === 'line' && (
                <line
                  x1={(drawingStart.x / 100) * canvasDimensions.width}
                  y1={(drawingStart.y / 100) * canvasDimensions.height}
                  x2={(drawingCurrent.x / 100) * canvasDimensions.width}
                  y2={(drawingCurrent.y / 100) * canvasDimensions.height}
                  stroke={currentColor}
                  strokeWidth={currentStrokeWidth}
                  strokeDasharray="6 4"
                />
              )}
              {activeTool === 'arrow' && (
                <line
                  x1={(drawingStart.x / 100) * canvasDimensions.width}
                  y1={(drawingStart.y / 100) * canvasDimensions.height}
                  x2={(drawingCurrent.x / 100) * canvasDimensions.width}
                  y2={(drawingCurrent.y / 100) * canvasDimensions.height}
                  stroke={currentColor}
                  strokeWidth={currentStrokeWidth}
                  markerEnd="url(#arrow-head)"
                />
              )}
              {activeTool === 'rect' && (
                <rect
                  x={Math.min(drawingStart.x, drawingCurrent.x) * (canvasDimensions.width / 100)}
                  y={Math.min(drawingStart.y, drawingCurrent.y) * (canvasDimensions.height / 100)}
                  width={Math.abs(drawingCurrent.x - drawingStart.x) * (canvasDimensions.width / 100)}
                  height={Math.abs(drawingCurrent.y - drawingStart.y) * (canvasDimensions.height / 100)}
                  fill={`${currentColor}22`}
                  stroke={currentColor}
                  strokeWidth={currentStrokeWidth}
                  strokeDasharray="4 4"
                />
              )}
              {activeTool === 'circle' && (
                <circle
                  cx={(drawingStart.x / 100) * canvasDimensions.width}
                  cy={(drawingStart.y / 100) * canvasDimensions.height}
                  r={Math.hypot(
                    ((drawingCurrent.x - drawingStart.x) / 100) * canvasDimensions.width,
                    ((drawingCurrent.y - drawingStart.y) / 100) * canvasDimensions.height
                  )}
                  fill={`${currentColor}22`}
                  stroke={currentColor}
                  strokeWidth={currentStrokeWidth}
                  strokeDasharray="4 4"
                />
              )}

              {/* RÓTULO FLOTANTE DE ÁNGULO EN MODO RECTO */}
              {orthoFeedback && (activeTool === 'line' || activeTool === 'arrow') && (
                <g
                  transform={`translate(${
                    (drawingCurrent.x / 100) * canvasDimensions.width + 14
                  }, ${(drawingCurrent.y / 100) * canvasDimensions.height - 14})`}
                >
                  <rect
                    x="-6"
                    y="-13"
                    width="128"
                    height="24"
                    rx="6"
                    fill="#0284c7"
                    stroke="#e0f2fe"
                    strokeWidth="1.2"
                  />
                  <text
                    x="58"
                    y="3"
                    fill="#ffffff"
                    fontSize="10"
                    fontWeight="bold"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    📐 {orthoFeedback.label}
                  </text>
                </g>
              )}
            </g>
          )}
        </svg>
      </div>

      {/* BOTTOM LEFT: INDICADOR Y BOTÓN MODO RECTO (ORTO) */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (onToggleOrthoMode) onToggleOrthoMode();
            else setInternalOrthoMode((prev) => !prev);
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xl backdrop-blur-md transition-all ${
            isOrthoActive
              ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300 shadow-amber-500/30'
              : 'bg-slate-900/90 text-slate-300 hover:text-white border border-slate-700/80 hover:bg-slate-800'
          }`}
          title="Modo Recto (Orto): Fuerza líneas 100% horizontales o verticales (Mantén Shift o presiona tecla 'O')"
        >
          <Compass className={`w-4 h-4 ${isOrthoActive ? 'text-slate-950' : 'text-blue-400'}`} />
          <span>Modo Recto (Orto): {isOrthoActive ? 'ACTIVO' : 'OFF'}</span>
          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
            isOrthoActive ? 'bg-black/25 text-black' : 'bg-slate-800 text-slate-400'
          }`}>
            Shift
          </span>
        </button>

        {orthoFeedback && (
          <div className="px-3 py-1.5 bg-blue-950/95 border border-blue-500/80 rounded-xl text-xs font-bold text-blue-200 flex items-center gap-2 shadow-xl backdrop-blur-md animate-in fade-in duration-100">
            <span>📐 {orthoFeedback.label}</span>
            {drawingStart && drawingCurrent && (
              <span className="font-mono text-cyan-300">
                ({(Math.hypot(drawingCurrent.x - drawingStart.x, drawingCurrent.y - drawingStart.y) * metersPerPercent).toFixed(1)}m)
              </span>
            )}
          </div>
        )}
      </div>

      {/* TOP RIGHT: PDF SWITCHER & FOTO OBRA BUTTONS */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {onOpenPhotoModal && (
          <button
            onClick={onOpenPhotoModal}
            className="px-3 py-1.5 bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-600/80 rounded-lg text-xs font-semibold text-emerald-200 flex items-center gap-1.5 shadow-lg backdrop-blur-md transition-colors"
            title="Ver fotografía real en obra: campanas de tubería en cámara"
          >
            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Foto Obra:</span>
            <span>Campanas</span>
          </button>
        )}

        <button
          onClick={() => {
            setPdfSource('/assets/aistudio/1.ALCANTARILLADO_VS_ELECTRICO_Jul.30-2026_2__1_-Model_a5753fa7.pdf');
          }}
          className="px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 flex items-center gap-1.5 shadow-lg backdrop-blur-md transition-colors"
        >
          <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">Plano La Nubia P2</span>
        </button>

        <label className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 shadow-lg cursor-pointer transition-colors">
          <Upload className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Subir Otro PDF</span>
          <span className="sm:hidden">Subir</span>
          <input type="file" accept=".pdf,image/png,image/jpeg" onChange={handleFileUpload} className="hidden" />
        </label>
      </div>

      {/* BOTTOM RIGHT: ZOOM CONTROLS */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-2xl">
        <button
          onClick={handleZoomIn}
          title="Zoom In"
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <span className="text-xs font-mono font-semibold text-slate-300 px-1 min-w-[45px] text-center">
          {Math.round(transform.scale * 100)}%
        </span>
        <button
          onClick={handleZoomOut}
          title="Zoom Out"
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-slate-700 mx-1" />
        <button
          onClick={handleResetZoom}
          title="Ajustar a Pantalla"
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
