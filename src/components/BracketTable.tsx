import {useMemo, useState} from 'react';
import {
  formatCurrency,
  formatIntegerBound,
  TaxComputationResult,
} from '../lib/taxEngine';

interface BracketTableProps {
  result: TaxComputationResult;
  onSelectMilestone: (income: number) => void;
}

type ViewScope = 'active' | 'all';
type RateFilter = 'all' | 0.11 | 0.23 | 0.34;

export function BracketTable({result, onSelectMilestone}: BracketTableProps) {
  const [scope, setScope] = useState<ViewScope>('active');
  const [rateFilter, setRateFilter] = useState<RateFilter>('all');

  const visibleSteps = useMemo(() => {
    return result.steps.filter((step) => {
      if (scope === 'active' && !step.isActive) return false;
      if (rateFilter !== 'all' && step.rate !== rateFilter) return false;
      return true;
    });
  }, [result.steps, scope, rateFilter]);

  const activeCount = useMemo(
    () => result.steps.filter((s) => s.isActive).length,
    [result.steps],
  );

  const getRateStyle = (rate: number) => {
    if (rate === 0.11) return 'text-sky-700 bg-sky-50 border-sky-200';
    if (rate === 0.23) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  return (
    <section
      id="schedule"
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Построчный расчёт прогрессии
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Активных строк: {activeCount} из {result.steps.length} · Суммирование вычета по каждой ступени
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setScope('active')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                scope === 'active'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Активные ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                scope === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Все 36 строк
            </button>
          </div>

          <div className="flex items-center p-1 bg-slate-100 rounded-lg">
            {(
              [
                {key: 'all', label: 'Все'},
                {key: 0.11, label: '11%'},
                {key: 0.23, label: '23%'},
                {key: 0.34, label: '34%'},
              ] as const
            ).map((opt) => (
              <button
                key={String(opt.key)}
                type="button"
                onClick={() => setRateFilter(opt.key)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  rateFilter === opt.key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {visibleSteps.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-900">
            Нет активных ступеней для отображения
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Введите сумму дохода больше 0 или переключитесь на просмотр всей шкалы.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onSelectMilestone(100000)}
              className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Подставить 100 000 c
            </button>
            <button
              type="button"
              onClick={() => {
                setScope('all');
                setRateFilter('all');
              }}
              className="px-4 py-2 text-xs font-medium border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Показать все 36 строк
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-4 whitespace-nowrap">Цикл</th>
                <th className="py-2.5 px-4 whitespace-nowrap">Диапазон (c)</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Ставка</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Облагаемая сумма</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Вычет налога</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Сумма прогрессии</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Остаток (на руки)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {visibleSteps.map((step) => (
                <tr
                  key={step.id}
                  onClick={() => onSelectMilestone(step.upper)}
                  title={`Нажмите, чтобы рассчитать на границе ${formatIntegerBound(step.upper)} c`}
                  className={`transition-colors cursor-pointer ${
                    step.isCurrent
                      ? 'bg-slate-900/[0.04] hover:bg-slate-900/[0.07]'
                      : step.isActive
                        ? 'hover:bg-slate-50'
                        : 'text-slate-400 hover:bg-slate-50/60'
                  }`}
                >
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    <span className="font-mono text-xs tabular-nums text-slate-700">
                      #{step.index.toString().padStart(2, '0')}
                    </span>
                    <span className="mx-1.5 text-slate-300">/</span>
                    <span className="text-xs text-slate-500">
                      Цикл {step.cycleIndex}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs tabular-nums whitespace-nowrap text-slate-800">
                    {formatIntegerBound(step.displayLower)}c – {formatIntegerBound(step.upper)}c
                  </td>
                  <td className="py-2.5 px-4 text-right whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-mono font-medium rounded border tabular-nums ${getRateStyle(
                        step.rate,
                      )}`}
                    >
                      {Math.round(step.rate * 100)}%
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs tabular-nums whitespace-nowrap text-slate-700">
                    {step.isActive ? `${formatCurrency(step.taxable)} c` : '—'}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs font-medium tabular-nums whitespace-nowrap text-slate-900">
                    {step.isActive ? `${formatCurrency(step.tax)} c` : '—'}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs font-semibold tabular-nums whitespace-nowrap text-slate-900">
                    {step.isActive ? `${formatCurrency(step.cumulativeTax)} c` : '—'}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs tabular-nums whitespace-nowrap text-emerald-700">
                    {step.isActive ? `${formatCurrency(step.cumulativeNet)} c` : '—'}
                  </td>
                </tr>
              ))}

              {result.excessIncome > 0 && (
                <tr className="bg-rose-50/40 border-t border-rose-200">
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    <span className="font-mono text-xs text-rose-700">Сверх</span>
                    <span className="mx-1.5 text-slate-300">/</span>
                    <span className="text-xs text-rose-700">Свыше Ц12</span>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs tabular-nums whitespace-nowrap text-slate-800">
                    {'>'} {formatIntegerBound(result.steps[result.steps.length - 1].upper)}c
                  </td>
                  <td className="py-2.5 px-4 text-right whitespace-nowrap">
                    <span className="inline-block px-2 py-0.5 text-xs font-mono font-medium rounded border tabular-nums text-rose-700 bg-rose-50 border-rose-200">
                      34%
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs tabular-nums whitespace-nowrap text-slate-800">
                    {formatCurrency(result.excessIncome)} c
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs font-medium tabular-nums whitespace-nowrap text-slate-900">
                    {formatCurrency(result.excessTax)} c
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs font-semibold tabular-nums whitespace-nowrap text-slate-900">
                    {formatCurrency(result.totalTax)} c
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs tabular-nums whitespace-nowrap text-emerald-700">
                    {formatCurrency(result.netIncome)} c
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200 font-semibold text-slate-900">
                <td colSpan={3} className="py-3 px-4 text-xs">
                  Итого по прогрессии
                </td>
                <td className="py-3 px-4 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                  {formatCurrency(result.income)} c
                </td>
                <td className="py-3 px-4 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                  {formatCurrency(result.totalTax)} c
                </td>
                <td className="py-3 px-4 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                  {(result.effectiveRate * 100).toFixed(2)}% эфф.
                </td>
                <td className="py-3 px-4 text-right font-mono text-xs tabular-nums whitespace-nowrap text-emerald-700">
                  {formatCurrency(result.netIncome)} c
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
