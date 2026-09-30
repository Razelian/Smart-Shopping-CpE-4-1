import React, { useState } from 'react';
import { StockDataPoint } from '../types';
import { BarChart3 } from 'lucide-react';

interface StockChartProps {
  data: StockDataPoint[];
  skuName: string;
}

export const StockChart: React.FC<StockChartProps> = ({ data, skuName }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  if (!data || data.length === 0) {
    return (
      <div className="bg-slate-50/50 rounded-lg p-8 border border-dashed border-slate-200 text-center">
        <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-xs font-medium text-slate-600">No Inventory History Recorded Yet</p>
        <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
          Stock trends are generated dynamically by replaying <span className="font-mono text-slate-600">box_placed</span> (+qty) and <span className="font-mono text-slate-600">restock_to_shelf</span> (-qty) events.
        </p>
      </div>
    );
  }

  // Calculate scales
  const maxStock = Math.max(...data.map((d) => Math.max(d.stock, d.shelfStock || 0)), 10) * 1.15;
  const height = 180;
  const width = 540;
  const paddingX = 40;
  const paddingY = 25;

  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;

  const getX = (idx: number) =>
    data.length === 1 ? width / 2 : paddingX + (idx / (data.length - 1)) * innerWidth;
  const getY = (val: number) => height - paddingY - (val / maxStock) * innerHeight;

  // Generate SVG path for line
  const warehousePoints = data.map((d, i) => `${getX(i)},${getY(d.stock)}`).join(' ');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-700">Inventory Level History</span>
          <span className="text-xs text-slate-400 ml-1.5 font-normal">
            ({data.length} telemetry {data.length === 1 ? 'event point' : 'event points'})
          </span>
        </div>

        {/* Legend & Chart Type toggle */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
            <span className="text-slate-600 font-medium">Rack Warehouse Stock</span>
          </div>

          <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200">
            <button
              onClick={() => setChartType('line')}
              className={`px-2 py-0.5 text-[11px] font-medium rounded ${
                chartType === 'line' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
              }`}
            >
              Line
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`px-2 py-0.5 text-[11px] font-medium rounded ${
                chartType === 'bar' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
              }`}
            >
              Bar
            </button>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative bg-slate-50/50 rounded-lg p-2 border border-slate-100 overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          {/* Horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = height - paddingY - pct * innerHeight;
            const value = Math.round(pct * maxStock);
            return (
              <g key={pct}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[10px] fill-slate-400 font-mono"
                >
                  {value}
                </text>
              </g>
            );
          })}

          {chartType === 'line' ? (
            <>
              <defs>
                <linearGradient id="warehouseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {data.length > 1 && (
                <>
                  <polygon
                    points={`${getX(0)},${height - paddingY} ${warehousePoints} ${getX(
                      data.length - 1
                    )},${height - paddingY}`}
                    fill="url(#warehouseGrad)"
                  />
                  <polyline
                    fill="none"
                    stroke="#4f46e5"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={warehousePoints}
                  />
                </>
              )}

              {/* Data points */}
              {data.map((d, i) => {
                const cx = getX(i);
                const cyW = getY(d.stock);
                const isHovered = hoveredIndex === i;

                return (
                  <g
                    key={i}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className="cursor-pointer"
                  >
                    {isHovered && (
                      <line
                        x1={cx}
                        y1={paddingY}
                        x2={cx}
                        y2={height - paddingY}
                        stroke="#94a3b8"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                    )}

                    <circle
                      cx={cx}
                      cy={cyW}
                      r={isHovered ? 5.5 : 3.5}
                      fill="#ffffff"
                      stroke="#4f46e5"
                      strokeWidth="2.5"
                    />
                  </g>
                );
              })}
            </>
          ) : (
            /* Bar Chart View */
            <g>
              {data.map((d, i) => {
                const totalBarWidth =
                  data.length === 1
                    ? 32
                    : Math.min((innerWidth / data.length) * 0.7, 36);
                const groupX = getX(i) - totalBarWidth / 2;

                const hW = Math.max((d.stock / maxStock) * innerHeight, 4);
                const yW = height - paddingY - hW;

                return (
                  <g
                    key={i}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={groupX}
                      y={yW}
                      width={totalBarWidth}
                      height={hW}
                      fill="#4f46e5"
                      rx="2"
                      className="transition-all hover:opacity-80"
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* X Axis Labels */}
          {data.map((d, i) => (
            <text
              key={i}
              x={getX(i)}
              y={height - paddingY + 16}
              textAnchor="middle"
              className={`text-[10px] font-mono ${
                hoveredIndex === i ? 'fill-slate-900 font-bold' : 'fill-slate-400'
              }`}
            >
              {d.date}
            </text>
          ))}
        </svg>

        {/* Hover info tooltip */}
        {hoveredIndex !== null && data[hoveredIndex] && (
          <div className="absolute top-2 right-2 bg-slate-900 text-white text-[11px] p-2 rounded shadow-md pointer-events-none border border-slate-700">
            <p className="font-semibold text-slate-200">{data[hoveredIndex].date}</p>
            <div className="flex items-center justify-between gap-3 mt-1">
              <span className="text-indigo-300">Replayed Stock:</span>
              <span className="font-mono font-bold">{data[hoveredIndex].stock} units</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
