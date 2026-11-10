import React from 'react';
import { AutoShape, AutoShapeCategory, ExecutionStatus } from '../types';
import { Trash2, X, Check, Calendar, Hash, Tag, Layers, Palette, Compass, ArrowRightLeft } from 'lucide-react';
import { getLineAlignmentInfo, straightenLine, invertLineDirection, CanvasDimensions } from '../utils/geometry';

interface ShapePropertyInspectorProps {
  shape: AutoShape | null;
  onUpdate: (id: string, updates: Partial<AutoShape>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  canvasDimensions?: CanvasDimensions;
}

const COLOR_PRESETS = [
  '#dc2626', // Rojo MT
  '#ea580c', // Naranja
  '#eab308', // Amarillo BT
  '#16a34a', // Verde Tierra
  '#06b6d4', // Cian Datos
  '#2563eb', // Azul
  '#9333ea', // Púrpura Trafo
  '#ec4899', // Rosado
];

const ACTA_OPTIONS = [
  'Acta 01',
  'Acta 02',
  'Acta 03',
  'Acta 04',
  'Acta 05',
  'Acta Final',
];

const CALIBRE_PRESETS = [
  '3x4" PVC',
  '2x6" PVC',
  '1Ø4" PVC',
  '2Ø4" PVC',
  '4x4" PVC',
  '1Ø2" PVC (Datos)',
  'Al 3#1/0 AWG 15KV',
  'Cu #2/0 MCM',
  '3#250 + 1#250',
  '12#350 + 4#350',
  'Norma SB850',
  'Norma SB851',
  'Norma SB858 Tipo D',
  'Trafo 300 kVA',
  'Trafo 400 kVA',
  'Trafo 225 kVA',
];

export const ShapePropertyInspector: React.FC<ShapePropertyInspectorProps> = ({
  shape,
  onUpdate,
  onDelete,
  onClose,
  canvasDimensions,
}) => {
  if (!shape) return null;

  const isLineOrArrow = (shape.type === 'line' || shape.type === 'arrow') && shape.endX !== undefined && shape.endY !== undefined;
  const lineAlignInfo = isLineOrArrow ? getLineAlignmentInfo(shape, canvasDimensions) : null;

  return (
    <div className="absolute top-16 right-4 z-30 w-80 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-150">
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/60">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: shape.strokeColor }}
          />
          <span className="font-bold text-xs text-white uppercase tracking-wider">
            {shape.type} · {shape.category}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onDelete(shape.id)}
            className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-red-950/60 transition-colors"
            title="Borrar esta autoforma"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
            title="Cerrar ficha"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* FORM FIELDS */}
      <div className="p-4 space-y-3.5 text-xs max-h-[calc(85vh-60px)] overflow-y-auto">
        {/* CAPA INDEPENDIENTE */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1">Capa Asignada</label>
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => onUpdate(shape.id, { layer: 'camaras_campanas' })}
              className={`py-1.5 px-2 rounded-md font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors ${
                shape.layer === 'camaras_campanas'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🏛️ Cámaras y Campanas</span>
            </button>
            <button
              type="button"
              onClick={() => onUpdate(shape.id, { layer: 'canalizaciones' })}
              className={`py-1.5 px-2 rounded-md font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors ${
                shape.layer === 'canalizaciones'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>⚡ Canalizaciones</span>
            </button>
          </div>
        </div>

        {/* NOMBRE / REF */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1">Nombre / Identificador</label>
          <input
            type="text"
            value={shape.name}
            onChange={(e) => onUpdate(shape.id, { name: e.target.value })}
            className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* CAMPANAS EN LAS CARAS DE LA CÁMARA (TERMINACIONES DE TUBERÍAS) */}
        {(shape.layer === 'camaras_campanas' ||
          shape.category === 'camara_mt' ||
          shape.category === 'camara_bt' ||
          shape.category === 'caja' ||
          shape.category === 'trafo' ||
          shape.category === 'campana') && (() => {
          const totalCampanas =
            (shape.campanasEntrada || 0) +
            (shape.campanasSalida || 0) +
            (shape.campanasSalida2 || 0);

          return (
            <div className="p-3 bg-emerald-950/30 border border-emerald-800/60 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-400 text-[11px] flex items-center gap-1.5">
                  <span>🔔 Campanas en Caras de la Cámara</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-900/80 text-emerald-300 font-bold">
                  {totalCampanas} Total
                </span>
              </div>
              <p className="text-[10.5px] text-slate-400 leading-snug">
                Campanas de terminación PVC en entrada, salida principal y salidas secundarias / derivaciones.
              </p>

              {/* ENTRADA Y SALIDA PRINCIPAL */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-slate-300 text-[10px] font-semibold mb-1">
                    Entrada (Lado A)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="48"
                    value={shape.campanasEntrada ?? 0}
                    onChange={(e) =>
                      onUpdate(shape.id, {
                        campanasEntrada: Math.max(0, parseInt(e.target.value) || 0),
                      })
                    }
                    className="w-full px-2 py-1 bg-slate-900 border border-emerald-700/60 rounded text-white font-mono font-bold focus:outline-none focus:border-emerald-400 text-center"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-[10px] font-semibold mb-1">
                    Salida 1 (Lado B)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="48"
                    value={shape.campanasSalida ?? 0}
                    onChange={(e) =>
                      onUpdate(shape.id, {
                        campanasSalida: Math.max(0, parseInt(e.target.value) || 0),
                      })
                    }
                    className="w-full px-2 py-1 bg-slate-900 border border-emerald-700/60 rounded text-white font-mono font-bold focus:outline-none focus:border-emerald-400 text-center"
                  />
                </div>
              </div>

              {/* SEGUNDA SALIDA (DERIVACIÓN / ACOMETIDA SUPERIOR) */}
              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-emerald-800/80 space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="font-bold text-white text-[11px]">Segunda Salida (Derivación)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 font-semibold">Campanas:</span>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      value={shape.campanasSalida2 ?? 0}
                      onChange={(e) =>
                        onUpdate(shape.id, {
                          campanasSalida2: Math.max(0, parseInt(e.target.value) || 0),
                          // Si es primera vez que se activa y no tiene ángulo, fijar 115° (como en la foto de obra)
                          campanasSalida2Angulo: shape.campanasSalida2Angulo ?? 115,
                        })
                      }
                      className="w-12 px-1.5 py-0.5 bg-slate-950 border border-emerald-600 rounded text-white font-mono font-bold text-center text-[11px] focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                {(shape.campanasSalida2 || 0) > 0 && (
                  <div className="space-y-2 pt-1 border-t border-slate-800 animate-in fade-in duration-100">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-slate-300 text-[10px] font-semibold">
                          Dirección / Orientación 2da Salida
                        </label>
                        <span className="font-mono text-emerald-400 text-[10px] font-bold">
                          {shape.campanasSalida2Angulo ?? 115}°
                        </span>
                      </div>

                      {/* PRESETS DE DIRECCIÓN */}
                      <div className="grid grid-cols-4 gap-1 mb-1.5">
                        {[
                          { label: '↖️ Noroeste', deg: 115, note: 'Foto' },
                          { label: '⬆️ Norte', deg: 90 },
                          { label: '↗️ Noreste', deg: 45 },
                          { label: '⬇️ Sur', deg: 270 },
                        ].map((d) => (
                          <button
                            key={d.deg}
                            type="button"
                            onClick={() =>
                              onUpdate(shape.id, {
                                campanasSalida2Angulo: d.deg,
                              })
                            }
                            className={`py-1 px-1 rounded text-[9.5px] font-semibold text-center transition-colors ${
                              (shape.campanasSalida2Angulo ?? 115) === d.deg
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                            }`}
                            title={`Orientar a ${d.deg}°`}
                          >
                            <span>{d.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* SLIDER DE ÁNGULO LIBRE (0° a 360°) */}
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-slate-500 font-mono">0°</span>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          step="5"
                          value={shape.campanasSalida2Angulo ?? 115}
                          onChange={(e) =>
                            onUpdate(shape.id, {
                              campanasSalida2Angulo: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
                        />
                        <span className="text-[9px] text-slate-500 font-mono">360°</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="block text-slate-300 text-[10px] font-semibold mb-1">
                          Calibre 2da Salida
                        </label>
                        <input
                          type="text"
                          value={shape.campanasSalida2Calibre || '2x6" PVC'}
                          onChange={(e) =>
                            onUpdate(shape.id, { campanasSalida2Calibre: e.target.value })
                          }
                          placeholder='2x6" PVC'
                          className="w-full px-2 py-1 bg-slate-950 border border-emerald-700/60 rounded text-white font-mono text-[10.5px] focus:outline-none focus:border-emerald-400"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 text-[10px] font-semibold mb-1">
                          Acta 2da Salida
                        </label>
                        <select
                          value={shape.campanasSalida2Acta || shape.acta}
                          onChange={(e) =>
                            onUpdate(shape.id, { campanasSalida2Acta: e.target.value })
                          }
                          className="w-full px-2 py-1 bg-slate-950 border border-emerald-700/60 rounded text-white text-[10.5px] focus:outline-none focus:border-emerald-400"
                        >
                          {ACTA_OPTIONS.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* CALIBRE Y ACTA DE ENTRADA / SALIDA 1 */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-slate-300 text-[10px] font-semibold mb-1">
                    Calibre Ent / Sal 1
                  </label>
                  <input
                    type="text"
                    value={shape.campanasCalibre || '4" PVC'}
                    onChange={(e) => onUpdate(shape.id, { campanasCalibre: e.target.value })}
                    placeholder='4" PVC'
                    className="w-full px-2 py-1 bg-slate-900 border border-emerald-700/60 rounded text-white font-mono text-[11px] focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-[10px] font-semibold mb-1">
                    Acta Campanas
                  </label>
                  <select
                    value={shape.campanasActa || shape.acta}
                    onChange={(e) => onUpdate(shape.id, { campanasActa: e.target.value })}
                    className="w-full px-2 py-1 bg-slate-900 border border-emerald-700/60 rounded text-white text-[11px] focus:outline-none focus:border-emerald-400"
                  >
                    {ACTA_OPTIONS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ACTA */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1">Acta Asignada</label>
          <div className="flex gap-1.5">
            <select
              value={shape.acta}
              onChange={(e) => onUpdate(shape.id, { acta: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500 font-medium"
            >
              {ACTA_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* CALIBRE (TUBERÍA O CONDUCTOR) */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1">
            Calibre (Tubería / Cable / Dimensión)
          </label>
          <input
            type="text"
            list="inspector-calibres"
            value={shape.calibre}
            onChange={(e) => onUpdate(shape.id, { calibre: e.target.value })}
            placeholder="Ej. 3x4&quot;, 2x6&quot;, Al 3#1/0"
            className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-blue-500"
          />
          <datalist id="inspector-calibres">
            {CALIBRE_PRESETS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>

        {/* METROS (SI APLICA) */}
        {(shape.type === 'line' || shape.type === 'arrow' || shape.metros !== undefined) && (
          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              Metros Lineales (m)
            </label>
            <input
              type="number"
              step="0.1"
              value={shape.metros || 0}
              onChange={(e) => onUpdate(shape.id, { metros: parseFloat(e.target.value) || 0 })}
              className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
        )}

        {/* ALINEAR Y ENDEREZAR LÍNEA (SI ES LÍNEA O FLECHA) */}
        {isLineOrArrow && lineAlignInfo && (
          <div className="space-y-2 p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 shadow-inner">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold text-xs">
                <Compass className="w-3.5 h-3.5 text-blue-400" />
                <span>Alinear / Enderezar Línea</span>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                  lineAlignInfo.isStrictlyHorizontal
                    ? 'bg-blue-900/60 text-blue-300 border border-blue-700/60'
                    : lineAlignInfo.isStrictlyVertical
                    ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/60'
                    : 'bg-amber-950/70 text-amber-300 border border-amber-700/60'
                }`}
              >
                {lineAlignInfo.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {/* BOTÓN AUTO-ENDEREZAR (MÁS CERCANA) */}
              <button
                type="button"
                onClick={() => {
                  const updates = straightenLine(shape, 'auto', canvasDimensions);
                  onUpdate(shape.id, updates);
                }}
                className="col-span-2 py-1.5 px-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-blue-600/30 transition-all active:scale-[0.98]"
                title="Enderezar automáticamente a horizontal o vertical según cuál esté más cerca"
              >
                <span>📐 Auto-Enderezar (Más Cercana)</span>
              </button>

              {/* HORIZONTAL */}
              <button
                type="button"
                onClick={() => {
                  const updates = straightenLine(shape, 'horizontal', canvasDimensions);
                  onUpdate(shape.id, updates);
                }}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
                  lineAlignInfo.isStrictlyHorizontal
                    ? 'bg-blue-950 border border-blue-500 text-blue-200'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
                title="Alinear 100% Horizontal (Nivelada, 0° / 180°)"
              >
                <span>↔️ Horizontal</span>
              </button>

              {/* VERTICAL */}
              <button
                type="button"
                onClick={() => {
                  const updates = straightenLine(shape, 'vertical', canvasDimensions);
                  onUpdate(shape.id, updates);
                }}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
                  lineAlignInfo.isStrictlyVertical
                    ? 'bg-emerald-950 border border-emerald-500 text-emerald-200'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
                title="Alinear 100% Vertical (Aplomada, 90° / 270°)"
              >
                <span>↕️ Vertical</span>
              </button>

              {/* DIAGONAL 45° */}
              <button
                type="button"
                onClick={() => {
                  const updates = straightenLine(shape, 'diagonal45', canvasDimensions);
                  onUpdate(shape.id, updates);
                }}
                className="py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
                title="Alinear a diagonal simétrica limpia de 45°"
              >
                <span>↗️ Diagonal 45°</span>
              </button>

              {/* INVERTIR SENTIDO */}
              <button
                type="button"
                onClick={() => {
                  const updates = invertLineDirection(shape);
                  onUpdate(shape.id, updates);
                }}
                className="py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
                title="Invertir punto de inicio y punto final de la línea"
              >
                <ArrowRightLeft className="w-3 h-3 text-slate-400" />
                <span>Invertir</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              💡 Tip: También puedes mantener <span className="text-blue-300 font-mono font-bold">Shift</span> al dibujar para trazar líneas rectas automáticamente.
            </p>
          </div>
        )}

        {/* ESTADO */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1">Estado de Ejecución</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['Terminado', 'En proceso', 'No iniciado'] as ExecutionStatus[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => onUpdate(shape.id, { estado: st })}
                className={`py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  shape.estado === st
                    ? st === 'Terminado'
                      ? 'bg-emerald-600 text-white'
                      : st === 'En proceso'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-700 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* FECHA */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1">Fecha de Registro</label>
          <input
            type="date"
            value={shape.fecha}
            onChange={(e) => onUpdate(shape.id, { fecha: e.target.value })}
            className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* COLOR DEL TRAZO */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1">Color de Autoforma</label>
          <div className="flex items-center gap-1.5">
            {COLOR_PRESETS.map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => onUpdate(shape.id, { strokeColor: col, fillColor: `${col}33` })}
                style={{ backgroundColor: col }}
                className={`w-6 h-6 rounded-md transition-transform ${
                  shape.strokeColor === col ? 'scale-125 ring-2 ring-white' : 'hover:scale-110'
                }`}
              />
            ))}
          </div>
        </div>

        {/* GROSOR DEL TRAZO */}
        <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="text-slate-400 font-semibold">Grosor de Trazo / Línea</label>
            <span className="font-mono font-bold text-blue-400 text-[11px]">
              {shape.strokeWidth || 3} px
            </span>
          </div>

          {/* PRESETS DE GROSOR */}
          <div className="grid grid-cols-5 gap-1">
            {[
              { label: 'Fino', val: 1.5 },
              { label: 'Medio', val: 3 },
              { label: 'Grueso', val: 5 },
              { label: 'Extra', val: 8 },
              { label: 'XL', val: 12 },
            ].map((preset) => (
              <button
                key={preset.val}
                type="button"
                onClick={() => onUpdate(shape.id, { strokeWidth: preset.val })}
                className={`py-1 rounded text-[10px] font-semibold flex flex-col items-center gap-1 transition-colors ${
                  (shape.strokeWidth || 3) === preset.val
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>{preset.label}</span>
                <span
                  className="w-4 rounded-full"
                  style={{
                    height: `${Math.min(6, Math.max(1, preset.val / 2))}px`,
                    backgroundColor: (shape.strokeWidth || 3) === preset.val ? '#ffffff' : '#94a3b8',
                  }}
                />
              </button>
            ))}
          </div>

          {/* SLIDER CONTINUO */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[10px] text-slate-500 font-mono">1px</span>
            <input
              type="range"
              min="1"
              max="20"
              step="0.5"
              value={shape.strokeWidth || 3}
              onChange={(e) => onUpdate(shape.id, { strokeWidth: parseFloat(e.target.value) })}
              className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <span className="text-[10px] text-slate-500 font-mono">20px</span>
          </div>

          {/* VISTA PREVIA DEL GROSOR */}
          <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-center">
            <div
              className="w-full rounded-full transition-all"
              style={{
                height: `${shape.strokeWidth || 3}px`,
                backgroundColor: shape.strokeColor || '#dc2626',
              }}
            />
          </div>
        </div>

        {/* TAMAÑO DE ÍCONO / SÍMBOLO */}
        <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="text-slate-400 font-semibold">
              {shape.type === 'text' ? 'Tamaño de Texto' : 'Tamaño de Ícono / Símbolo'}
            </label>
            <span className="font-mono font-bold text-blue-400 text-[11px]">
              {Math.round((shape.iconSize || 1.0) * 100)}%
            </span>
          </div>

          {/* PRESETS DE TAMAÑO */}
          <div className="grid grid-cols-7 gap-1">
            {[
              { label: '3XS', val: 0.25, tip: '3XS (25%)' },
              { label: 'XXS', val: 0.4, tip: 'XXS (40%)' },
              { label: 'XS', val: 0.6, tip: 'XS (60%)' },
              { label: 'S', val: 0.8, tip: 'S (80%)' },
              { label: 'M', val: 1.0, tip: 'M (100%)' },
              { label: 'L', val: 1.4, tip: 'L (140%)' },
              { label: 'XL', val: 2.0, tip: 'XL (200%)' },
            ].map((preset) => (
              <button
                key={preset.val}
                type="button"
                onClick={() => onUpdate(shape.id, { iconSize: preset.val })}
                className={`py-1 rounded text-[10px] font-semibold transition-colors ${
                  Math.abs((shape.iconSize || 1.0) - preset.val) < 0.05
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
                title={preset.tip}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* SLIDER CONTINUO DE TAMAÑO */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[10px] text-slate-500 font-mono">15%</span>
            <input
              type="range"
              min="0.15"
              max="3.0"
              step="0.05"
              value={shape.iconSize || 1.0}
              onChange={(e) => onUpdate(shape.id, { iconSize: parseFloat(e.target.value) })}
              className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <span className="text-[10px] text-slate-500 font-mono">300%</span>
          </div>
        </div>

        {/* NOTAS */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1">Observaciones</label>
          <textarea
            rows={2}
            value={shape.notas}
            onChange={(e) => onUpdate(shape.id, { notas: e.target.value })}
            placeholder="Notas técnicas de obra..."
            className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* DELETE BUTTON */}
        <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
          <button
            type="button"
            onClick={() => onDelete(shape.id)}
            className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800/80 rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Eliminar</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold flex items-center gap-1 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Listo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
