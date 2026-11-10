import React, { useState } from 'react';
import { AutoShape, LayerType } from '../types';
import { X, FileSpreadsheet, FileText, Download, Trash2, Edit, Layers, Filter } from 'lucide-react';

interface AutoShapesTableDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  shapes: AutoShape[];
  onSelectShape: (id: string) => void;
  onDeleteShape: (id: string) => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
}

export const AutoShapesTableDrawer: React.FC<AutoShapesTableDrawerProps> = ({
  isOpen,
  onClose,
  shapes,
  onSelectShape,
  onDeleteShape,
  onExportCsv,
  onExportPdf,
}) => {
  const [filterLayer, setFilterLayer] = useState<'all' | LayerType>('all');

  if (!isOpen) return null;

  // Filtrado por capa
  const filteredShapes = shapes.filter((s) => {
    const sLayer = s.layer || (s.category === 'tuberia' ? 'canalizaciones' : 'camaras_campanas');
    if (filterLayer === 'all') return true;
    return sLayer === filterLayer;
  });

  // Métricas de obra
  const totalMetros = shapes
    .filter((s) => (s.layer || (s.category === 'tuberia' ? 'canalizaciones' : 'camaras_campanas')) === 'canalizaciones')
    .reduce((acc, s) => acc + (s.metros || 0), 0);

  const totalCamaras = shapes.filter(
    (s) => s.category === 'camara_mt' || s.category === 'camara_bt' || s.category === 'caja'
  ).length;

  const totalCampanas = shapes.reduce((acc, s) => {
    const ent = s.campanasEntrada || 0;
    const sal = s.campanasSalida || 0;
    const sal2 = s.campanasSalida2 || 0;
    return acc + ent + sal + sal2;
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 backdrop-blur-xs">
      <div className="w-full max-w-6xl max-h-[80vh] bg-slate-900 border-t border-slate-800 rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-200">
        {/* HEADER */}
        <div className="px-6 py-3.5 border-b border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Trazabilidad de Obra por Capas y Actas</span>
            </h2>

            {/* RESUMEN RÁPIDO DE OBRA */}
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-800/80">
                ⚡ Canalizaciones: <strong className="text-white">{totalMetros.toFixed(1)} m</strong>
              </span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/80">
                🏛️ Cámaras: <strong className="text-white">{totalCamaras}</strong>
              </span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
                🔔 Campanas PVC: <strong className="text-white">{totalCampanas}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onExportCsv}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Exportar CSV</span>
            </button>

            <button
              onClick={onExportPdf}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Exportar PDF</span>
            </button>

            <div className="w-px h-4 bg-slate-700 mx-1" />

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TABS DE FILTRO POR CAPA */}
        <div className="px-6 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px] font-semibold mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-400" />
              <span>Filtrar Capa:</span>
            </span>

            <button
              type="button"
              onClick={() => setFilterLayer('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                filterLayer === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              Todas ({shapes.length})
            </button>

            <button
              type="button"
              onClick={() => setFilterLayer('camaras_campanas')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                filterLayer === 'camaras_campanas'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <span>🏛️ Cámaras y Campanas</span>
              <span className="font-mono text-[10px] opacity-75">
                ({shapes.filter((s) => (s.layer || (s.category === 'tuberia' ? 'canalizaciones' : 'camaras_campanas')) === 'camaras_campanas').length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterLayer('canalizaciones')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                filterLayer === 'canalizaciones'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <span>⚡ Canalizaciones</span>
              <span className="font-mono text-[10px] opacity-75">
                ({shapes.filter((s) => (s.layer || (s.category === 'tuberia' ? 'canalizaciones' : 'camaras_campanas')) === 'canalizaciones').length})
              </span>
            </button>
          </div>

          <div className="text-slate-400 text-[11px] font-mono hidden md:block">
            {filteredShapes.length} elementos mostrados
          </div>
        </div>

        {/* TABLE */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/90 sticky top-0 border-b border-slate-800 font-semibold text-slate-400">
              <tr>
                <th className="p-3">CAPA</th>
                <th className="p-3">AUTOFORMA</th>
                <th className="p-3">NOMBRE / REF</th>
                <th className="p-3">ACTA</th>
                <th className="p-3">CALIBRE / DETALLE</th>
                <th className="p-3">CAMPANAS EN CARAS</th>
                <th className="p-3 text-right">METROS</th>
                <th className="p-3">ESTADO</th>
                <th className="p-3">FECHA</th>
                <th className="p-3">OBSERVACIONES</th>
                <th className="p-3 text-right">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredShapes.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-500 italic">
                    No se encontraron autoformas en la capa seleccionada.
                  </td>
                </tr>
              ) : (
                filteredShapes.map((s) => {
                  const sLayer = s.layer || (s.category === 'tuberia' ? 'canalizaciones' : 'camaras_campanas');
                  const totalCampanasForma =
                    (s.campanasEntrada || 0) +
                    (s.campanasSalida || 0) +
                    (s.campanasSalida2 || 0);

                  return (
                    <tr
                      key={s.id}
                      onClick={() => {
                        onSelectShape(s.id);
                        onClose();
                      }}
                      className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
                      {/* CAPA */}
                      <td className="p-3">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                            sLayer === 'camaras_campanas'
                              ? 'bg-blue-950 text-blue-300 border border-blue-800/80'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
                          }`}
                        >
                          {sLayer === 'camaras_campanas' ? '🏛️ Cámaras' : '⚡ Canaliz.'}
                        </span>
                      </td>

                      {/* TIPO */}
                      <td className="p-3 font-mono font-semibold uppercase text-slate-400 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.strokeColor }} />
                        <span>{s.type}</span>
                      </td>

                      {/* NOMBRE */}
                      <td className="p-3 font-medium text-white">{s.name}</td>

                      {/* ACTA */}
                      <td className="p-3 font-semibold text-blue-400">{s.acta}</td>

                      {/* CALIBRE */}
                      <td className="p-3 font-mono text-slate-300">{s.calibre}</td>

                      {/* CAMPANAS (ENTRADA, SALIDA 1 Y SEGUNDA SALIDA) */}
                      <td className="p-3">
                        {totalCampanasForma > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 font-mono text-[10.5px]">
                              🔔 {totalCampanasForma} ({s.campanasEntrada || 0}E / {s.campanasSalida || 0}S1{s.campanasSalida2 ? ` / ${s.campanasSalida2}S2` : ''})
                            </span>
                            {Boolean(s.campanasSalida2) && (
                              <span className="text-[9.5px] text-emerald-400 font-mono">
                                Salida 2: {s.campanasSalida2Calibre || '2x6" PVC'} ({s.campanasSalida2Angulo ?? 115}°)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600 font-mono">-</span>
                        )}
                      </td>

                      {/* METROS */}
                      <td className="p-3 text-right font-mono text-slate-200 font-bold">
                        {s.metros !== undefined ? `${s.metros} m` : '-'}
                      </td>

                      {/* ESTADO */}
                      <td className="p-3">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                            s.estado === 'Terminado'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : s.estado === 'En proceso'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {s.estado}
                        </span>
                      </td>

                      {/* FECHA */}
                      <td className="p-3 font-mono text-slate-400">{s.fecha}</td>

                      {/* OBSERVACIONES */}
                      <td className="p-3 text-slate-400 max-w-[200px] truncate">{s.notas || '-'}</td>

                      {/* ACCIONES */}
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onDeleteShape(s.id)}
                          className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-slate-800 transition-colors"
                          title="Eliminar autoforma"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
