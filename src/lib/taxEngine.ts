export interface TaxBracketDef {
  id: string;
  index: number; // 1..36
  cycleIndex: number; // 1..12
  tierIndex: 1 | 2 | 3;
  rate: 0.11 | 0.23 | 0.34;
  lower: number; // continuous lower bound (0, 1100, 2300, ...)
  displayLower: number; // discrete start label (1, 1101, 2301, ...)
  upper: number;
}

export interface TaxStepResult extends TaxBracketDef {
  taxable: number;
  tax: number;
  cumulativeTax: number;
  cumulativeNet: number;
  isActive: boolean;
  isCurrent: boolean;
}

export interface RateSummary {
  rate: 0.11 | 0.23 | 0.34;
  taxable: number;
  tax: number;
  shareOfTax: number;
}

export interface TaxComputationResult {
  income: number;
  totalTax: number;
  netIncome: number;
  effectiveRate: number;
  marginalRate: number;
  activeCycle: number;
  nextThreshold: number | null;
  remainingToThreshold: number | null;
  excessIncome: number;
  excessTax: number;
  steps: TaxStepResult[];
  rateBreakdown: RateSummary[];
}

const RATES: readonly [0.11, 0.23, 0.34] = [0.11, 0.23, 0.34];
const BASE_CYCLE_UPPERS: readonly [number, number, number] = [1100, 2300, 3400];

/**
 * Version 1.1 schedule: 12 cycles (36 brackets) with rates 11%, 23%, 34%.
 * Cycle c (0..11) scales [1100, 2300, 3400] by 10^c:
 *   Cycle 1:  1–1100 (11%), 1101–2300 (23%), 2301–3400 (34%)
 *   Cycle 2:  3401–11000, 11001–23000, 23001–34000
 *   ...
 *   Cycle 12: 34000000000001–110000000000000, 110000000000001–230000000000000, 230000000000001–340000000000000
 */
export function buildTaxSchedule(): TaxBracketDef[] {
  const brackets: TaxBracketDef[] = [];
  let prevUpper = 0;
  let globalIndex = 0;

  for (let c = 0; c < 12; c++) {
    const scale = Math.pow(10, c);
    for (let t = 0; t < 3; t++) {
      globalIndex += 1;
      const upper = BASE_CYCLE_UPPERS[t] * scale;
      brackets.push({
        id: `v11-${globalIndex}`,
        index: globalIndex,
        cycleIndex: c + 1,
        tierIndex: (t + 1) as 1 | 2 | 3,
        rate: RATES[t],
        lower: prevUpper,
        displayLower: prevUpper + 1,
        upper,
      });
      prevUpper = upper;
    }
  }

  return brackets;
}

export function computeProgressiveTax(incomeRaw: number): TaxComputationResult {
  const income = Number.isFinite(incomeRaw) ? Math.max(0, incomeRaw) : 0;
  const schedule = buildTaxSchedule();

  let cumulativeTax = 0;
  let activeCycle = income > 0 ? 1 : 0;
  let marginalRate = income > 0 ? 0.11 : 0;
  let nextThreshold: number | null = schedule[0]?.upper ?? null;

  const rateTaxableMap: Record<number, number> = {0.11: 0, 0.23: 0, 0.34: 0};
  const rateTaxMap: Record<number, number> = {0.11: 0, 0.23: 0, 0.34: 0};

  const steps: TaxStepResult[] = schedule.map((bracket) => {
    const taxable =
      income > bracket.lower
        ? Math.min(income, bracket.upper) - bracket.lower
        : 0;
    const tax = taxable * bracket.rate;
    cumulativeTax += tax;

    const isActive = taxable > 0;
    const isCurrent = income > bracket.lower && income <= bracket.upper;

    if (isActive) {
      rateTaxableMap[bracket.rate] += taxable;
      rateTaxMap[bracket.rate] += tax;
      activeCycle = bracket.cycleIndex;
      marginalRate = bracket.rate;
    }

    if (isCurrent) {
      nextThreshold = bracket.upper;
    }

    const cumulativeCovered = Math.min(income, bracket.upper);
    return {
      ...bracket,
      taxable,
      tax,
      cumulativeTax,
      cumulativeNet: Math.max(0, cumulativeCovered - cumulativeTax),
      isActive,
      isCurrent,
    };
  });

  const lastUpper = schedule[schedule.length - 1]?.upper ?? 0;
  let excessIncome = 0;
  let excessTax = 0;

  if (income > lastUpper) {
    excessIncome = income - lastUpper;
    excessTax = excessIncome * 0.34;
    cumulativeTax += excessTax;
    rateTaxableMap[0.34] += excessIncome;
    rateTaxMap[0.34] += excessTax;
    marginalRate = 0.34;
    activeCycle = 12;
    nextThreshold = null;
  } else if (income === 0) {
    nextThreshold = schedule[0]?.upper ?? null;
  }

  const totalTax = cumulativeTax;
  const netIncome = Math.max(0, income - totalTax);
  const effectiveRate = income > 0 ? totalTax / income : 0;
  const remainingToThreshold =
    nextThreshold !== null ? Math.max(0, nextThreshold - income) : null;

  const rateBreakdown: RateSummary[] = RATES.map((rate) => ({
    rate,
    taxable: rateTaxableMap[rate],
    tax: rateTaxMap[rate],
    shareOfTax: totalTax > 0 ? rateTaxMap[rate] / totalTax : 0,
  }));

  return {
    income,
    totalTax,
    netIncome,
    effectiveRate,
    marginalRate,
    activeCycle,
    nextThreshold,
    remainingToThreshold,
    excessIncome,
    excessTax,
    steps,
    rateBreakdown,
  };
}

export function formatCurrency(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '0';
  // For exact large integers (>= 1e15) avoid floating display noise
  if (Math.abs(value) >= 1e15 && Number.isInteger(value)) {
    const str = BigInt(value).toString();
    return str.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  const hasFraction = Math.abs(value - Math.round(value)) > 1e-9;
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: hasFraction ? decimals : 0,
    maximumFractionDigits: decimals,
  });
}

export function formatIntegerBound(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1e15) {
    const str = BigInt(Math.round(value)).toString();
    return str.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  return Math.round(value).toLocaleString('ru-RU');
}

export function formatPercent(rateDecimal: number, decimals = 2): string {
  return `${(rateDecimal * 100).toLocaleString('ru-RU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}
