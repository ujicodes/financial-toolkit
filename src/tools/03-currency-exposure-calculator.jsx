/**
 * 03 — Currency Exposure Calculator
 * Calculate how foreign currency movements affect the revenue, expenses, and
 * profits of a multinational company.
 *
 * Spec tech: Python, FastAPI, React
 * This build: React (UI + exposure math). The `calc` function mirrors the
 * FastAPI POST /exposure handler — same inputs, same shape out — so the
 * frontend swaps to a fetch without touching the render layer.
 */
import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  ReferenceLine,
} from "recharts";

const C = {
  paper: "#EDEFF0", card: "#F7F8F8", ink: "#16232B", dim: "#5C7078",
  rule: "#C7CFD2", pos: "#1F5F4E", neg: "#A3341F", mark: "#B08814",
};

const usd = (n) =>
  (n < 0 ? "−" : "") +
  Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 1, notation: "compact" });

const pct = (n) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}%`;

// Amounts are in local currency, millions. rate = USD per 1 unit of local.
const START = [
  { code: "EUR", name: "Euro",            revenue: 820,   expense: 610,   rate: 1.08,   shock: 0 },
  { code: "GBP", name: "Pound sterling",  revenue: 410,   expense: 250,   rate: 1.27,   shock: 0 },
  { code: "JPY", name: "Japanese yen",    revenue: 68000, expense: 41000, rate: 0.0067, shock: 0 },
  { code: "MXN", name: "Mexican peso",    revenue: 3100,  expense: 5400,  rate: 0.058,  shock: 0 },
  { code: "INR", name: "Indian rupee",    revenue: 9200,  expense: 15800, rate: 0.012,  shock: 0 },
  { code: "BRL", name: "Brazilian real",  revenue: 640,   expense: 390,   rate: 0.19,   shock: 0 },
];

const DOMESTIC = { revenue: 2400, expense: 1750 }; // USD millions, no FX exposure

/** Translate local-currency results into USD at base and shocked rates. */
function calc(rows, globalShock, hedgeRatio) {
  const legs = rows.map((r) => {
    const shockPct = r.shock !== 0 ? r.shock : globalShock;
    const shocked = r.rate * (1 + shockPct / 100);
    const effective = r.rate + (shocked - r.rate) * (1 - hedgeRatio / 100);

    const revBase = r.revenue * r.rate;
    const revNew = r.revenue * effective;
    const expBase = r.expense * r.rate;
    const expNew = r.expense * effective;

    return {
      ...r, shockPct,
      revBase, revNew, expBase, expNew,
      profitBase: revBase - expBase,
      profitNew: revNew - expNew,
      netExposure: (r.revenue - r.expense) * r.rate,
      impact: (revNew - expNew) - (revBase - expBase),
    };
  });

  const sum = (k) => legs.reduce((s, l) => s + l[k], 0);
  const base = {
    revenue: sum("revBase") + DOMESTIC.revenue,
    expense: sum("expBase") + DOMESTIC.expense,
  };
  const shocked = {
    revenue: sum("revNew") + DOMESTIC.revenue,
    expense: sum("expNew") + DOMESTIC.expense,
  };
  base.profit = base.revenue - base.expense;
  shocked.profit = shocked.revenue - shocked.expense;

  return { legs, base, shocked, impact: shocked.profit - base.profit };
}

export default function CurrencyExposureCalculator() {
  const [rows, setRows] = useState(START);
  const [globalShock, setGlobalShock] = useState(-10);
  const [hedge, setHedge] = useState(0);

  const r = useMemo(() => calc(rows, globalShock, hedge), [rows, globalShock, hedge]);

  const setShock = (code, v) =>
    setRows((s) => s.map((x) => (x.code === code ? { ...x, shock: v } : x)));

  const marginBase = (r.base.profit / r.base.revenue) * 100;
  const marginNew = (r.shocked.profit / r.shocked.revenue) * 100;

  const chartData = r.legs
    .map((l) => ({ code: l.code, impact: Math.round(l.impact), net: Math.round(l.netExposure) }))
    .sort((a, b) => a.impact - b.impact);

  const worst = chartData[0];
  const naturalHedge = r.legs.filter((l) => Math.sign(l.revenue - l.expense) < 0);

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ background: C.paper, color: C.ink }}>
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 pb-5" style={{ borderBottom: `1px solid ${C.rule}` }}>
          <h1 className="text-3xl font-serif tracking-tight">Currency exposure calculator</h1>
          <p className="mt-2 text-sm max-w-2xl" style={{ color: C.dim }}>
            Revenue and costs sit in six currencies. Move the rates and watch what
            translation does to the consolidated USD result. Costs in a currency
            offset revenue in the same currency — that's the natural hedge.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <aside className="lg:col-span-1">
            <h2 className="text-sm mb-3" style={{ color: C.dim }}>Rate shock</h2>
            <label className="block mb-5">
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-sm">All currencies vs USD</span>
                <span className="text-sm font-mono">{pct(globalShock)}</span>
              </div>
              <input type="range" min="-40" max="40" step="1" value={globalShock}
                onChange={(e) => setGlobalShock(Number(e.target.value))}
                className="w-full" style={{ accentColor: C.ink }} />
              <p className="text-xs mt-1" style={{ color: C.dim }}>
                Negative means the dollar strengthens and foreign earnings translate down.
              </p>
            </label>

            <label className="block mb-6 pb-6" style={{ borderBottom: `1px solid ${C.rule}` }}>
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-sm">Hedge coverage</span>
                <span className="text-sm font-mono">{hedge}%</span>
              </div>
              <input type="range" min="0" max="100" step="5" value={hedge}
                onChange={(e) => setHedge(Number(e.target.value))}
                className="w-full" style={{ accentColor: C.mark }} />
              <p className="text-xs mt-1" style={{ color: C.dim }}>
                Share of the move neutralized by forwards, at zero assumed cost.
              </p>
            </label>

            <h2 className="text-sm mb-3" style={{ color: C.dim }}>Override a single currency</h2>
            {rows.map((row) => (
              <label key={row.code} className="block mb-3">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-sm">{row.code}</span>
                  <span className="text-xs font-mono" style={{ color: row.shock ? C.mark : C.dim }}>
                    {row.shock ? pct(row.shock) : "follows global"}
                  </span>
                </div>
                <input type="range" min="-40" max="40" step="1" value={row.shock}
                  onChange={(e) => setShock(row.code, Number(e.target.value))}
                  className="w-full" style={{ accentColor: row.shock ? C.mark : C.rule }} />
              </label>
            ))}
          </aside>

          <main className="lg:col-span-2">
            <div className="p-6 mb-6" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
              <p className="text-sm mb-1" style={{ color: C.dim }}>Operating profit impact</p>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-5xl font-serif"
                  style={{ color: r.impact >= 0 ? C.pos : C.neg }}>
                  {usd(r.impact)}
                </span>
                <span className="text-sm" style={{ color: C.dim }}>
                  taking profit from {usd(r.base.profit)} to {usd(r.shocked.profit)}
                </span>
              </div>
              <p className="text-sm mt-3" style={{ color: C.dim }}>
                Operating margin moves from {marginBase.toFixed(1)}% to {marginNew.toFixed(1)}%.
                {worst && worst.impact < 0 &&
                  ` ${worst.code} does the most damage at ${usd(worst.impact)}.`}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                ["Revenue", r.base.revenue, r.shocked.revenue],
                ["Expenses", r.base.expense, r.shocked.expense],
                ["Operating profit", r.base.profit, r.shocked.profit],
              ].map(([label, b, n]) => (
                <div key={label} className="p-4" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
                  <p className="text-xs mb-2" style={{ color: C.dim }}>{label}</p>
                  <p className="font-mono text-lg">{usd(n)}</p>
                  <p className="font-mono text-xs mt-1"
                    style={{ color: n - b >= 0 ? C.pos : C.neg }}>
                    {n - b >= 0 ? "+" : "−"}{usd(Math.abs(n - b)).replace("−", "")} vs base
                  </p>
                </div>
              ))}
            </div>

            <div className="p-5 mb-6" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
              <h2 className="text-sm mb-4" style={{ color: C.dim }}>
                Profit impact by currency
              </h2>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid stroke={C.rule} vertical={false} />
                    <XAxis dataKey="code" tick={{ fontSize: 11, fill: C.dim }} stroke={C.rule} />
                    <YAxis tick={{ fontSize: 11, fill: C.dim }} stroke={C.rule}
                      tickFormatter={(v) => `$${v}M`} />
                    <Tooltip formatter={(v) => `$${v}M`}
                      contentStyle={{ background: C.card, border: `1px solid ${C.rule}`, fontSize: 12 }} />
                    <ReferenceLine y={0} stroke={C.ink} />
                    <Bar dataKey="impact">
                      {chartData.map((d) => (
                        <Cell key={d.code} fill={d.impact >= 0 ? C.pos : C.neg} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-5" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
              <h2 className="text-sm mb-3" style={{ color: C.dim }}>Exposure by currency</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: C.dim, borderBottom: `1px solid ${C.rule}` }}>
                    <th className="text-left font-normal py-2">Currency</th>
                    <th className="text-right font-normal">Revenue</th>
                    <th className="text-right font-normal">Expense</th>
                    <th className="text-right font-normal">Net exposure</th>
                    <th className="text-right font-normal">Move</th>
                    <th className="text-right font-normal">Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {r.legs.map((l) => (
                    <tr key={l.code} style={{ borderBottom: `1px solid ${C.rule}` }}>
                      <td className="py-2">{l.code} <span style={{ color: C.dim }}>· {l.name}</span></td>
                      <td className="text-right font-mono">{usd(l.revBase)}</td>
                      <td className="text-right font-mono">{usd(l.expBase)}</td>
                      <td className="text-right font-mono"
                        style={{ color: l.netExposure >= 0 ? C.ink : C.mark }}>
                        {usd(l.netExposure)}
                      </td>
                      <td className="text-right font-mono">{pct(l.shockPct)}</td>
                      <td className="text-right font-mono"
                        style={{ color: l.impact >= 0 ? C.pos : C.neg }}>
                        {usd(l.impact)}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2">United States</td>
                    <td className="text-right font-mono">{usd(DOMESTIC.revenue)}</td>
                    <td className="text-right font-mono">{usd(DOMESTIC.expense)}</td>
                    <td className="text-right font-mono" style={{ color: C.dim }}>none</td>
                    <td className="text-right font-mono" style={{ color: C.dim }}>—</td>
                    <td className="text-right font-mono" style={{ color: C.dim }}>—</td>
                  </tr>
                </tbody>
              </table>
              {naturalHedge.length > 0 && (
                <p className="text-xs mt-4" style={{ color: C.dim }}>
                  {naturalHedge.map((n) => n.code).join(" and ")} carry more cost than revenue,
                  so a weaker local currency there actually helps profit. They partly offset
                  the earnings translated out of {r.legs.filter((l) => l.netExposure > 0).map((l) => l.code).join(", ")}.
                </p>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
