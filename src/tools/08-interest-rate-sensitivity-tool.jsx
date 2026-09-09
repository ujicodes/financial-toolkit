/**
 * 08 — Interest Rate Sensitivity Tool
 * Show how changes in interest rates affect a company's debt expense,
 * valuation, and free cash flow.
 *
 * Spec tech: Python, FastAPI, Plotly
 * This build: React + Recharts. `sensitivity()` is the FastAPI
 * POST /sensitivity handler in JS — same tranche schema in, same curve out.
 */
import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, BarChart, Bar, Legend, Cell,
} from "recharts";

const C = {
  paper: "#EDEFF0", card: "#F7F8F8", ink: "#16232B", dim: "#5C7078",
  rule: "#C7CFD2", pos: "#1F5F4E", neg: "#A3341F", mark: "#B08814",
};

const money = (n) =>
  (n < 0 ? "−" : "") + "$" + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 }) + "M";

// Balances in $M. Floating tranches reprice with the base rate; fixed do not
// until they mature and roll at the prevailing rate.
const TRANCHES = [
  { id: "rcf",   name: "Revolving credit facility", balance: 340,  type: "floating", spread: 2.25, maturity: 2028 },
  { id: "tlb",   name: "Term loan B",               balance: 1250, type: "floating", spread: 3.50, maturity: 2030 },
  { id: "sn27",  name: "Senior notes 2027",         balance: 800,  type: "fixed",    coupon: 4.75, maturity: 2027 },
  { id: "sn31",  name: "Senior notes 2031",         balance: 950,  type: "fixed",    coupon: 5.90, maturity: 2031 },
  { id: "conv",  name: "Convertible notes",         balance: 400,  type: "fixed",    coupon: 1.25, maturity: 2029 },
];

const BASE = {
  baseRate: 4.25,     // policy / reference rate today
  ebitda: 1180,
  daPct: 6.5,         // D&A as % of revenue proxy — folded into EBIT below
  ebit: 890,
  taxRate: 24,
  capex: 260,
  nwcChange: 40,
  terminalGrowth: 2.2,
  beta: 1.15,
  equityPremium: 4.8,
  netDebtForEV: 3740,
  shares: 210,        // millions
};

/**
 * Rate shock in basis points → interest expense, free cash flow, and an
 * enterprise value from a Gordon-growth DCF whose WACC moves with the risk-free
 * rate. Fixed tranches only reprice once they mature and roll.
 */
function sensitivity(shockBps, a, tranches, horizonYear) {
  const shock = shockBps / 100;
  const newBase = a.baseRate + shock;

  const legs = tranches.map((t) => {
    const baseRateNow =
      t.type === "floating" ? a.baseRate + t.spread : t.coupon;
    let rateNow;
    if (t.type === "floating") {
      rateNow = newBase + t.spread;
    } else if (t.maturity <= horizonYear) {
      // Rolls at the new prevailing rate, keeping its original credit spread.
      const impliedSpread = t.coupon - a.baseRate;
      rateNow = newBase + Math.max(impliedSpread, 0.5);
    } else {
      rateNow = t.coupon;
    }
    return {
      ...t,
      baseInterest: (t.balance * baseRateNow) / 100,
      newInterest: (t.balance * rateNow) / 100,
      baseRatePct: baseRateNow,
      newRatePct: rateNow,
      repriced: t.type === "floating" || t.maturity <= horizonYear,
    };
  });

  const baseInterest = legs.reduce((s, l) => s + l.baseInterest, 0);
  const interest = legs.reduce((s, l) => s + l.newInterest, 0);

  const nopat = a.ebit * (1 - a.taxRate / 100);
  const unleveredFcf = nopat + a.ebit * 0.18 - a.capex - a.nwcChange; // + D&A proxy
  const pretax = a.ebit - interest;
  const netIncome = pretax * (1 - a.taxRate / 100);
  const leveredFcf = unleveredFcf - interest * (1 - a.taxRate / 100);

  // WACC: risk-free moves one-for-one with the shock.
  const riskFree = newBase;
  const costEquity = riskFree + a.beta * a.equityPremium;
  const totalDebt = tranches.reduce((s, t) => s + t.balance, 0);
  const costDebt = (interest / totalDebt) * 100;
  const equityValue0 = a.shares * 42; // anchor market cap for weights
  const wD = totalDebt / (totalDebt + equityValue0);
  const wE = 1 - wD;
  const wacc = wE * costEquity + wD * costDebt * (1 - a.taxRate / 100);

  const g = a.terminalGrowth;
  const ev = wacc > g ? (unleveredFcf * (1 + g / 100)) / ((wacc - g) / 100) : NaN;
  const equity = ev - a.netDebtForEV;
  const perShare = equity / a.shares;

  return {
    legs, shockBps, newBase, interest, baseInterest,
    deltaInterest: interest - baseInterest,
    netIncome, leveredFcf, unleveredFcf,
    coverage: interest > 0 ? a.ebitda / interest : Infinity,
    wacc, ev, equity, perShare, costEquity, costDebt, totalDebt,
  };
}

function Ctl({ label, value, onChange, min, max, step, suffix, hint }) {
  return (
    <label className="block mb-4">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-sm">{label}</span>
        <span className="text-sm font-mono" style={{ color: C.dim }}>{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full" style={{ accentColor: C.ink }} />
      {hint && <p className="text-xs mt-1" style={{ color: C.dim }}>{hint}</p>}
    </label>
  );
}

export default function InterestRateSensitivityTool() {
  const [shock, setShock] = useState(150);
  const [horizon, setHorizon] = useState(2029);
  const [a, setA] = useState(BASE);
  const set = (k) => (v) => setA((s) => ({ ...s, [k]: v }));

  const r = useMemo(() => sensitivity(shock, a, TRANCHES, horizon), [shock, a, horizon]);
  const flat = useMemo(() => sensitivity(0, a, TRANCHES, horizon), [a, horizon]);

  // Sweep the whole curve so the shape of the exposure is visible, not just one point.
  const curve = useMemo(() => {
    const out = [];
    for (let bps = -300; bps <= 400; bps += 25) {
      const s = sensitivity(bps, a, TRANCHES, horizon);
      out.push({
        bps,
        interest: Math.round(s.interest),
        fcf: Math.round(s.leveredFcf),
        perShare: Math.round(s.perShare * 100) / 100,
        coverage: Math.round(s.coverage * 100) / 100,
      });
    }
    return out;
  }, [a, horizon]);

  const ladder = useMemo(() => {
    const years = {};
    TRANCHES.forEach((t) => {
      years[t.maturity] = (years[t.maturity] || 0) + t.balance;
    });
    return Object.entries(years)
      .map(([y, v]) => ({ year: y, balance: v }))
      .sort((x, y) => x.year - y.year);
  }, []);

  const floatingShare =
    (TRANCHES.filter((t) => t.type === "floating").reduce((s, t) => s + t.balance, 0) /
      TRANCHES.reduce((s, t) => s + t.balance, 0)) * 100;

  const covenantBreach = r.coverage < 3.0;

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ background: C.paper, color: C.ink }}>
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 pb-5" style={{ borderBottom: `1px solid ${C.rule}` }}>
          <h1 className="text-3xl font-serif tracking-tight">Interest rate sensitivity tool</h1>
          <p className="mt-2 text-sm max-w-2xl" style={{ color: C.dim }}>
            Rates hit a levered company twice: the floating tranches reprice immediately,
            and the discount rate on every future cash flow moves with them. This
            separates the two.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <aside className="lg:col-span-1">
            <h2 className="text-sm mb-4" style={{ color: C.dim }}>Rate scenario</h2>
            <Ctl label="Parallel shift" value={shock} onChange={setShock}
              min={-300} max={400} step={25} suffix=" bps"
              hint={`Base rate ${a.baseRate.toFixed(2)}% → ${r.newBase.toFixed(2)}%`} />
            <Ctl label="Refinancing horizon" value={horizon} onChange={setHorizon}
              min={2026} max={2032} step={1} suffix=""
              hint="Fixed tranches maturing on or before this year roll at the new rate." />

            <h2 className="text-sm mb-4 mt-8 pt-6" style={{ color: C.dim, borderTop: `1px solid ${C.rule}` }}>
              Operating assumptions
            </h2>
            <Ctl label="EBIT" value={a.ebit} onChange={set("ebit")}
              min={200} max={2500} step={10} suffix="M" />
            <Ctl label="EBITDA" value={a.ebitda} onChange={set("ebitda")}
              min={300} max={3000} step={10} suffix="M" />
            <Ctl label="Capex" value={a.capex} onChange={set("capex")}
              min={0} max={900} step={10} suffix="M" />
            <Ctl label="Tax rate" value={a.taxRate} onChange={set("taxRate")}
              min={0} max={40} step={1} suffix="%" />
            <Ctl label="Terminal growth" value={a.terminalGrowth} onChange={set("terminalGrowth")}
              min={0} max={5} step={0.1} suffix="%" />
            <Ctl label="Equity beta" value={a.beta} onChange={set("beta")}
              min={0.4} max={2.5} step={0.05} suffix="" />
          </aside>

          <main className="lg:col-span-2">
            <div className="p-6 mb-6" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
              <p className="text-sm mb-1" style={{ color: C.dim }}>
                Annual interest expense at {shock >= 0 ? "+" : "−"}{Math.abs(shock)} bps
              </p>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-5xl font-serif"
                  style={{ color: r.deltaInterest > 0 ? C.neg : C.pos }}>
                  {money(r.interest)}
                </span>
                <span className="text-sm" style={{ color: C.dim }}>
                  {r.deltaInterest >= 0 ? "up" : "down"} {money(Math.abs(r.deltaInterest))} from{" "}
                  {money(flat.interest)}
                </span>
              </div>
              <p className="text-sm mt-3" style={{ color: C.dim }}>
                {floatingShare.toFixed(0)}% of the stack floats, so it reprices the day the
                curve moves. After tax, the hit to free cash flow is{" "}
                {money(Math.abs(r.deltaInterest * (1 - a.taxRate / 100)))}, and equity value
                per share goes from ${flat.perShare.toFixed(2)} to ${r.perShare.toFixed(2)}.
              </p>
            </div>

            {covenantBreach && (
              <div className="p-4 mb-6 text-sm"
                style={{ background: C.card, border: `1px solid ${C.neg}`, color: C.neg }}>
                Interest coverage falls to {r.coverage.toFixed(2)}×, below a typical 3.0×
                maintenance covenant. At this rate the credit agreement, not the income
                statement, becomes the binding constraint.
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                ["Interest coverage", `${r.coverage.toFixed(2)}×`, r.coverage >= 3],
                ["Levered free cash flow", money(r.leveredFcf), r.leveredFcf > 0],
                ["WACC", `${r.wacc.toFixed(2)}%`, null],
                ["Equity value per share", `$${r.perShare.toFixed(2)}`, r.perShare >= flat.perShare],
              ].map(([l, v, ok]) => (
                <div key={l} className="p-4" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
                  <p className="text-xs mb-2" style={{ color: C.dim }}>{l}</p>
                  <p className="font-mono text-lg"
                    style={{ color: ok === null ? C.ink : ok ? C.pos : C.neg }}>{v}</p>
                </div>
              ))}
            </div>

            <div className="p-5 mb-6" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
              <h2 className="text-sm mb-4" style={{ color: C.dim }}>
                Sensitivity across the curve — the marked line is your scenario
              </h2>
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={curve} margin={{ top: 5, right: 40, bottom: 22, left: 10 }}>
                    <CartesianGrid stroke={C.rule} vertical={false} />
                    <XAxis dataKey="bps" tick={{ fontSize: 11, fill: C.dim }} stroke={C.rule}
                      tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}`}
                      label={{ value: "Parallel shift (bps)", position: "insideBottom",
                        offset: -14, style: { fontSize: 11, fill: C.dim } }} />
                    <YAxis yAxisId="l" tick={{ fontSize: 11, fill: C.dim }} stroke={C.rule}
                      tickFormatter={(v) => `$${v}M`} />
                    <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: C.mark }}
                      stroke={C.rule} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      contentStyle={{ background: C.card, border: `1px solid ${C.rule}`, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine x={shock} stroke={C.mark} strokeDasharray="4 4" yAxisId="l" />
                    <ReferenceLine x={0} stroke={C.rule} yAxisId="l" />
                    <Line yAxisId="l" type="monotone" dataKey="interest" name="Interest expense"
                      stroke={C.neg} strokeWidth={2} dot={false} />
                    <Line yAxisId="l" type="monotone" dataKey="fcf" name="Levered FCF"
                      stroke={C.pos} strokeWidth={2} dot={false} />
                    <Line yAxisId="r" type="monotone" dataKey="perShare" name="Value per share"
                      stroke={C.mark} strokeWidth={2} dot={false} strokeDasharray="5 3" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs mt-3" style={{ color: C.dim }}>
                Interest rises linearly. Value per share falls convexly, because a higher
                discount rate compounds against every year of the terminal value.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
                <h2 className="text-sm mb-4" style={{ color: C.dim }}>Maturity ladder</h2>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ladder} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid stroke={C.rule} vertical={false} />
                      <XAxis dataKey="year" tick={{ fontSize: 11, fill: C.dim }} stroke={C.rule} />
                      <YAxis tick={{ fontSize: 11, fill: C.dim }} stroke={C.rule}
                        tickFormatter={(v) => `$${v}M`} />
                      <Tooltip formatter={(v) => money(v)}
                        contentStyle={{ background: C.card, border: `1px solid ${C.rule}`, fontSize: 12 }} />
                      <Bar dataKey="balance">
                        {ladder.map((d) => (
                          <Cell key={d.year} fill={Number(d.year) <= horizon ? C.mark : C.ink} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs mt-2" style={{ color: C.dim }}>
                  Gold bars refinance inside your horizon and pick up the new rate.
                </p>
              </div>

              <div className="p-5" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
                <h2 className="text-sm mb-3" style={{ color: C.dim }}>Debt stack</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ color: C.dim, borderBottom: `1px solid ${C.rule}` }}>
                      <th className="text-left font-normal py-2">Tranche</th>
                      <th className="text-right font-normal">Balance</th>
                      <th className="text-right font-normal">Rate</th>
                      <th className="text-right font-normal">Interest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.legs.map((l) => (
                      <tr key={l.id} style={{ borderBottom: `1px solid ${C.rule}` }}>
                        <td className="py-2">
                          {l.name}
                          <span className="text-xs block" style={{ color: C.dim }}>
                            {l.type} · due {l.maturity}
                          </span>
                        </td>
                        <td className="text-right font-mono">{money(l.balance)}</td>
                        <td className="text-right font-mono"
                          style={{ color: l.repriced ? C.mark : C.dim }}>
                          {l.newRatePct.toFixed(2)}%
                        </td>
                        <td className="text-right font-mono">{money(l.newInterest)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: `2px solid ${C.ink}` }}>
                      <td className="py-2">Total</td>
                      <td className="text-right font-mono">{money(r.totalDebt)}</td>
                      <td className="text-right font-mono">{r.costDebt.toFixed(2)}%</td>
                      <td className="text-right font-mono">{money(r.interest)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
