import {useMemo, useState} from 'react';
import {Download} from 'lucide-react';
import {BracketTable} from './components/BracketTable';
import {TaxProgressionChart} from './components/TaxProgressionChart';
import {
  computeProgressiveTax,
  formatCurrency,
} from './lib/taxEngine';

export default function App() {
  const [incomeInput, setIncomeInput] = useState<string>('100000');

  const parsedIncome = useMemo(() => {
    const normalized = incomeInput.replace(/\s+/g, '').replace(',', '.');
    const val = Number(normalized);
    return Number.isFinite(val) && val >= 0 ? val : 0;
  }, [incomeInput]);

  const result = useMemo(
    () => computeProgressiveTax(parsedIncome),
    [parsedIncome],
  );

  const handleSelectIncome = (value: number) => {
    setIncomeInput(String(value));
  };

  const handleExportCsv = () => {
    const header = [
      'Строка',
      'Цикл',
      'Диапазон от (c)',
      'Диапазон до (c)',
      'Ставка (%)',
      'Облагаемая сумма (c)',
      'Вычет налога (c)',
      'Накопленный налог (c)',
      'Остаток после вычета (c)',
    ];

    const rows = result.steps
      .filter((s) => s.isActive)
      .map((s) => [
        s.index,
        s.cycleIndex,
        s.displayLower,
        s.upper,
        Math.round(s.rate * 100),
        s.taxable.toFixed(2),
        s.tax.toFixed(2),
        s.cumulativeTax.toFixed(2),
        s.cumulativeNet.toFixed(2),
      ]);

    if (result.excessIncome > 0) {
      rows.push([
        result.steps.length + 1,
        12,
        result.steps[result.steps.length - 1].upper + 1,
        '∞',
        34,
        result.excessIncome.toFixed(2),
        result.excessTax.toFixed(2),
        result.totalTax.toFixed(2),
        result.netIncome.toFixed(2),
      ]);
    }

    rows.push([
      'ИТОГО',
      result.activeCycle,
      1,
      result.income,
      (result.effectiveRate * 100).toFixed(2),
      result.income.toFixed(2),
      result.totalTax.toFixed(2),
      result.totalTax.toFixed(2),
      result.netIncome.toFixed(2),
    ]);

    const csvContent =
      '\uFEFF' +
      [header, ...rows].map((r) => r.map((cell) => `"${cell}"`).join(';')).join('\n');

    const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tax-bot-pro-v1.1-${Math.round(result.income)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const netPct = result.income > 0 ? (result.netIncome / result.income) * 100 : 0;
  const r11Pct =
    result.income > 0
      ? ((result.rateBreakdown[0]?.tax ?? 0) / result.income) * 100
      : 0;
  const r23Pct =
    result.income > 0
      ? ((result.rateBreakdown[1]?.tax ?? 0) / result.income) * 100
      : 0;
  const r34Pct =
    result.income > 0
      ? ((result.rateBreakdown[2]?.tax ?? 0) / result.income) * 100
      : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-6 py-3.5 flex items-center justify-between gap-8">
          <a
            href="#calculator"
            className="font-display text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            TAX-BOT
          </a>

          <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#calculator"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Калькулятор
            </a>
            <a
              href="#analytics"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              График ставок
            </a>
            <a
              href="#schedule"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Шкала циклов
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Экспорт CSV</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-8 space-y-10">
        {/* Section 1: Calculator */}
        <section id="calculator" className="scroll-mt-20 space-y-6">
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
              Налоговый калькулятор PRO 1.1 (11%–34%) × 12
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>Ставки 11% / 23% / 34%</span>
              <span aria-hidden="true">·</span>
              <span>12 циклов (36 ступеней)</span>
              <span aria-hidden="true">·</span>
              <span>Шкала: 1–1 100 / 1 101–2 300 / 2 301–3 400 (×10 за цикл)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Only Income Input */}
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6">
              <label
                htmlFor="income-input"
                className="block text-xs font-medium text-slate-700 mb-2"
              >
                Сумма дохода (c)
              </label>
              <input
                id="income-input"
                type="text"
                inputMode="decimal"
                value={incomeInput}
                onChange={(e) => setIncomeInput(e.target.value)}
                placeholder="Введите сумму дохода"
                className="w-full px-4 py-3 font-mono text-xl font-semibold tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-colors"
              />
            </div>

            {/* Right Column: KPI Strip + Rate Breakdown */}
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl flex flex-col justify-between overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border-b border-slate-200">
                <div className="p-6">
                  <p className="text-xs font-medium text-slate-500">Валовый доход</p>
                  <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900 truncate">
                    {formatCurrency(result.income)} c
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {result.activeCycle > 0
                      ? `Цикл ${result.activeCycle} из 12`
                      : 'База расчёта'}
                  </p>
                </div>

                <div className="p-6">
                  <p className="text-xs font-medium text-slate-500">
                    Итоговый налог (сумма вычетов)
                  </p>
                  <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900 truncate">
                    {formatCurrency(result.totalTax)} c
                  </p>
                  <p className="mt-1 text-xs text-slate-600 font-mono tabular-nums">
                    Эффективная ставка: {(result.effectiveRate * 100).toFixed(2)}%
                  </p>
                </div>

                <div className="p-6">
                  <p className="text-xs font-medium text-slate-500">
                    После вычета налога (на руки)
                  </p>
                  <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-emerald-700 truncate">
                    {formatCurrency(result.netIncome)} c
                  </p>
                  <p className="mt-1 text-xs text-emerald-700 font-mono tabular-nums">
                    Сохраняется: {netPct.toFixed(2)}%
                  </p>
                </div>
              </div>

              <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-medium text-slate-700">
                      Структура распределения дохода по ставкам
                    </span>
                    <span className="font-mono tabular-nums text-slate-500">
                      100% = {formatCurrency(result.income)} c
                    </span>
                  </div>

                  <div className="h-3.5 w-full bg-slate-100 rounded-md overflow-hidden flex">
                    {result.income > 0 && (
                      <>
                        <div
                          style={{width: `${netPct}%`}}
                          className="bg-emerald-600 transition-all duration-200"
                          title={`На руки: ${formatCurrency(result.netIncome)} c`}
                        />
                        <div
                          style={{width: `${r11Pct}%`}}
                          className="bg-sky-500 transition-all duration-200"
                          title={`Налог 11%: ${formatCurrency(result.rateBreakdown[0].tax)} c`}
                        />
                        <div
                          style={{width: `${r23Pct}%`}}
                          className="bg-amber-500 transition-all duration-200"
                          title={`Налог 23%: ${formatCurrency(result.rateBreakdown[1].tax)} c`}
                        />
                        <div
                          style={{width: `${r34Pct}%`}}
                          className="bg-rose-600 transition-all duration-200"
                          title={`Налог 34%: ${formatCurrency(result.rateBreakdown[2].tax)} c`}
                        />
                      </>
                    )}
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600" />
                      <span>На руки ({netPct.toFixed(1)}%)</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-sky-500" />
                      <span>Вычет 11% ({r11Pct.toFixed(1)}%)</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
                      <span>Вычет 23% ({r23Pct.toFixed(1)}%)</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-rose-600" />
                      <span>Вычет 34% ({r34Pct.toFixed(1)}%)</span>
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-xs font-medium text-slate-500">
                        <th className="pb-2">Уровень ставки</th>
                        <th className="pb-2 text-right">Облагаемая база (c)</th>
                        <th className="pb-2 text-right">Вычет налога (c)</th>
                        <th className="pb-2 text-right">Доля в налоге</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {result.rateBreakdown.map((tier) => (
                        <tr key={tier.rate}>
                          <td className="py-2 font-mono font-semibold text-slate-800">
                            Ставка {Math.round(tier.rate * 100)}%
                          </td>
                          <td className="py-2 text-right font-mono tabular-nums text-slate-700">
                            {formatCurrency(tier.taxable)} c
                          </td>
                          <td className="py-2 text-right font-mono font-semibold tabular-nums text-slate-900">
                            {formatCurrency(tier.tax)} c
                          </td>
                          <td className="py-2 text-right font-mono tabular-nums text-slate-500">
                            {(tier.shareOfTax * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Rate Chart */}
        <div className="scroll-mt-20">
          <TaxProgressionChart
            currentResult={result}
            onSelectIncome={handleSelectIncome}
          />
        </div>

        {/* Section 3: Cycle Scale & Row-by-Row Breakdown */}
        <section id="schedule" className="scroll-mt-20">
          <BracketTable
            result={result}
            onSelectMilestone={handleSelectIncome}
          />
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white mt-10">
        <div className="max-w-[1280px] mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>TAX-BOT PRO 1.1 · Прогрессивная шкала 11% / 23% / 34% × 12 циклов</span>
          <span className="font-mono tabular-nums">
            Цикл 1: 1–1 100 (11%), 1 101–2 300 (23%), 2 301–3 400 (34%) · далее ×10 за цикл
          </span>
        </div>
      </footer>
    </div>
  );
}
