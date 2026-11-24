import {useMemo, useState} from 'react';
import {
  computeProgressiveTax,
  formatCurrency,
  formatIntegerBound,
  TaxComputationResult,
} from '../lib/taxEngine';

interface TaxProgressionChartProps {
  currentResult: TaxComputationResult;
  onSelectIncome: (income: number) => void;
}

interface ChartPoint {
  income: number;
  logX: number;
  effectivePct: number;
  marginalPct: number;
  totalTax: number;
  netIncome: number;
}

export function TaxProgressionChart({
  currentResult,
  onSelectIncome,
}: TaxProgressionChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const chartData = useMemo(() => {
    const sampleIncomes: number[] = [100, 500];
    for (let c = 0; c < 12; c++) {
      const scale = Math.pow(10, c);
      sampleIncomes.push(1100 * scale, 2300 * scale, 3400 * scale);
    }

    const points: ChartPoint[] = sampleIncomes.map((inc) => {
      const res = computeProgressiveTax(inc);
      return {
        income: inc,
        logX: Math.log10(inc),
        effectivePct: res.effectiveRate * 100,
        marginalPct: res.marginalRate * 100,
        totalTax: res.totalTax,
        netIncome: res.netIncome,
      };
    });

    return points;
  }, []);

  const width = 840;
  const height = 270;
  const padLeft = 48;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 38;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const minLog = chartData[0]?.logX ?? 2;
  const maxLog = chartData[chartData.length - 1]?.logX ?? 14.5;

  const toX = (logVal: number) =>
    padLeft + ((logVal - minLog) / Math.max(0.001, maxLog - minLog)) * innerW;

  const toY = (pct: number) => padTop + innerH - (pct / 40) * innerH;

  const effectivePath = chartData
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${toX(p.logX).toFixed(1)} ${toY(p.effectivePct).toFixed(1)}`)
    .join(' ');

  const marginalStepPath = chartData
    .map((p, idx) => {
      const x = toX(p.logX).toFixed(1);
      const y = toY(p.marginalPct).toFixed(1);
      if (idx === 0) return `M ${x} ${y}`;
      const prevY = toY(chartData[idx - 1].marginalPct).toFixed(1);
      return `L ${x} ${prevY} L ${x} ${y}`;
    })
    .join(' ');

  const currentLog =
    currentResult.income >= 100
      ? Math.min(maxLog, Math.max(minLog, Math.log10(currentResult.income)))
      : null;

  const activePoint = hoveredIdx !== null ? chartData[hoveredIdx] : null;

  const xTicks = [1e3, 1e5, 1e7, 1e9, 1e11, 1e13].filter(
    (v) => Math.log10(v) >= minLog && Math.log10(v) <= maxLog,
  );

  const formatTickLabel = (val: number) => {
    if (val >= 1e12) return `${val / 1e12} трлн`;
    if (val >= 1e9) return `${val / 1e9} млрд`;
    if (val >= 1e6) return `${val / 1e6} млн`;
    if (val >= 1e3) return `${val / 1e3}k`;
    return String(val);
  };

  return (
    <section
      id="analytics"
      className="bg-white border border-slate-200 rounded-xl p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Кривая эффективной и предельной ставки
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Логарифмическая шкала дохода · Нажмите на точку, чтобы подставить значение в калькулятор
          </p>
        </div>

        <div className="flex items-center gap-5 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-0.5 bg-slate-900" />
            <span>Эффективная ставка (%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-0.5 border-t-2 border-dashed border-amber-600" />
            <span>Предельная ставка (%)</span>
          </div>
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[600px] h-auto select-none"
          role="img"
          aria-label="График эффективной и предельной налоговой ставки"
        >
          {/* Horizontal grid lines */}
          {[0, 11, 23, 34].map((pct) => {
            const y = toY(pct);
            return (
              <g key={pct}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke={pct === 0 ? '#cbd5e1' : '#e2e8f0'}
                  strokeDasharray={pct === 0 ? undefined : '3 3'}
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 text-[11px] font-mono"
                >
                  {pct}%
                </text>
              </g>
            );
          })}

          {/* X-axis ticks */}
          {xTicks.map((val) => {
            const x = toX(Math.log10(val));
            return (
              <g key={val}>
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={height - padBottom}
                  stroke="#f1f5f9"
                />
                <text
                  x={x}
                  y={height - 14}
                  textAnchor="middle"
                  className="fill-slate-500 text-[11px] font-mono"
                >
                  {formatTickLabel(val)}
                </text>
              </g>
            );
          })}

          {/* Marginal rate stepped path */}
          <path
            d={marginalStepPath}
            fill="none"
            stroke="#d97706"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            opacity={0.85}
          />

          {/* Effective rate smooth line */}
          <path
            d={effectivePath}
            fill="none"
            stroke="#0f172a"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Current income marker */}
          {currentLog !== null && (
            <g>
              <line
                x1={toX(currentLog)}
                y1={padTop}
                x2={toX(currentLog)}
                y2={height - padBottom}
                stroke="#059669"
                strokeWidth={1.5}
                strokeDasharray="2 2"
              />
              <circle
                cx={toX(currentLog)}
                cy={toY(currentResult.effectiveRate * 100)}
                r={5}
                fill="#059669"
                stroke="#ffffff"
                strokeWidth={2}
              />
            </g>
          )}

          {/* Interactive hit targets */}
          {chartData.map((point, idx) => {
            const cx = toX(point.logX);
            const cy = toY(point.effectivePct);
            const isHovered = hoveredIdx === idx;
            return (
              <g
                key={point.income}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => onSelectIncome(point.income)}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 5.5 : 3}
                  fill={isHovered ? '#0f172a' : '#ffffff'}
                  stroke="#0f172a"
                  strokeWidth={1.75}
                />
                <circle cx={cx} cy={cy} r={14} fill="transparent" />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Live inspection strip below chart */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs">
        {activePoint ? (
          <div className="flex flex-wrap items-center gap-4 text-slate-700">
            <span>
              Точка шкалы:{' '}
              <strong className="font-mono tabular-nums text-slate-900">
                {formatIntegerBound(activePoint.income)} c
              </strong>
            </span>
            <span className="text-slate-300">·</span>
            <span>
              Эффективная:{' '}
              <strong className="font-mono tabular-nums text-slate-900">
                {activePoint.effectivePct.toFixed(2)}%
              </strong>
            </span>
            <span className="text-slate-300">·</span>
            <span>
              Предельная:{' '}
              <strong className="font-mono tabular-nums text-amber-700">
                {activePoint.marginalPct.toFixed(0)}%
              </strong>
            </span>
            <span className="text-slate-300">·</span>
            <span>
              Налог:{' '}
              <strong className="font-mono tabular-nums text-slate-900">
                {formatCurrency(activePoint.totalTax)} c
              </strong>
            </span>
          </div>
        ) : (
          <span className="text-slate-500">
            Наведите курсор на точку графика для деталей или кликните для расчёта
          </span>
        )}
        <span className="font-mono tabular-nums text-emerald-700">
          Текущий доход: {formatCurrency(currentResult.income)} c (
          {(currentResult.effectiveRate * 100).toFixed(2)}%)
        </span>
      </div>
    </section>
  );
}
