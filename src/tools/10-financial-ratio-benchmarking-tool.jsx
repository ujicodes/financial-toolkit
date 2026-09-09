/**
 * 10 — Financial Ratio Benchmarking Tool
 * Compare a company's margins, liquidity, leverage, efficiency, and returns
 * against industry peers.
 *
 * Spec tech: React, Python, Plotly
 * This build: React + Recharts. COMPANIES is the raw financials table; every
 * ratio is derived at read time rather than stored, so the Python ETL only
 * ever has to load statements, never metrics.
 */
import { useState, useMemo } from "react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell,
  ReferenceLine, Legend,
} from "recharts";

const C = {
  paper: "#EDEFF0", card: "#F7F8F8", ink: "#16232B", dim: "#5C7078",
  rule: "#C7CFD2", pos: "#1F5F4E", neg: "#A3341F", mark: "#B08814",
};

// $ millions, trailing twelve months.
const COMPANIES = [
  { id: "MRD", name: "Meridian Retail",     sector: "Consumer",
    revenue: 48200, cogs: 34700, opex: 9800, interest: 310, netIncome: 2570,
    cash: 3100, ar: 1180, inventory: 6900, currentAssets: 12400, currentLiabilities: 11800,
    totalDebt: 7200, equity: 9400, totalAssets: 31000, da: 1700 },
  { id: "ALT", name: "Altus Industrial",    sector: "Industrial",
    revenue: 21600, cogs: 15100, opex: 4200, interest: 420, netIncome: 1430,
    cash: 1900, ar: 4300, inventory: 5200, currentAssets: 12100, currentLiabilities: 6800,
    totalDebt: 6900, equity: 8800, totalAssets: 26500, da: 980 },
  { id: "NBM", name: "Northbeam Software",  sector: "Technology",
    revenue: 7400, cogs: 1480, opex: 4100, interest: 45, netIncome: 1350,
    cash: 4800, ar: 1650, inventory: 0, currentAssets: 6900, currentLiabilities: 2400,
    totalDebt: 900, equity: 6100, totalAssets: 9800, da: 310 },
  { id: "CAS", name: "Castellan Foods",     sector: "Consumer",
    revenue: 33500, cogs: 21100, opex: 8400, interest: 540, netIncome: 2680,
    cash: 1400, ar: 2900, inventory: 3100, currentAssets: 8200, currentLiabilities: 8900,
    totalDebt: 11200, equity: 7900, totalAssets: 34000, da: 1450 },
  { id: "VRG", name: "Verge Semiconductor", sector: "Technology",
    revenue: 18900, cogs: 11300, opex: 4000, interest: 180, netIncome: 2740,
    cash: 6200, ar: 3400, inventory: 4700, currentAssets: 15100, currentLiabilities: 5300,
    totalDebt: 3400, equity: 17600, totalAssets: 27400, da: 1600 },
  { id: "HAL", name: "Halcyon Apparel",     sector: "Consumer",
    revenue: 9600, cogs: 5300, opex: 3300, interest: 130, netIncome: 640,
    cash: 720, ar: 780, inventory: 2400, currentAssets: 4200, currentLiabilities: 2600,
    totalDebt: 1800, equity: 3300, totalAssets: 8100, da: 340 },
  { id: "PNT", name: "Pinnacle Logistics",  sector: "Industrial",
    revenue: 26800, cogs: 21400, opex: 3100, interest: 610, netIncome: 1180,
    cash: 900, ar: 3900, inventory: 620, currentAssets: 6100, currentLiabilities: 6400,
    totalDebt: 9800, equity: 5200, totalAssets: 28900, da: 2200 },
  { id: "ORY", name: "Orion Health",        sector: "Healthcare",
    revenue: 14200, cogs: 7600, opex: 4300, interest: 220, netIncome: 1520,
    cash: 2300, ar: 2600, inventory: 1900, currentAssets: 7400, currentLiabilities: 4100,
    totalDebt: 4100, equity: 8600, totalAssets: 19400, da: 720 },
];

/** Every ratio, plus the direction that counts as "good". */
const METRICS = [
  { key: "grossMargin",  label: "Gross margin",        group: "Margins",     fmt: "pct", higher: true },
  { key: "opMargin",     label: "Operating margin",    group: "Margins",     fmt: "pct", higher: true },
  { key: "netMargin",    label: "Net margin",          group: "Margins",     fmt: "pct", higher: true },
  { key: "current",      label: "Current ratio",       group: "Liquidity",   fmt: "x",   higher: true },
  { key: "quick",        label: "Quick ratio",         group: "Liquidity",   fmt: "x",   higher: true },
  { key: "cashRatio",    label: "Cash ratio",          group: "Liquidity",   fmt: "x",   higher: true },
  { key: "debtEquity",   label: "Debt to equity",      group: "Leverage",    fmt: "x",   higher: false },
  { key: "netDebtEbitda",label: "Net debt to EBITDA",  group: "Leverage",    fmt: "x",   higher: false },
  { key: "coverage",     label: "Interest coverage",   group: "Leverage",    fmt: "x",   higher: true },
  { key: "assetTurn",    label: "Asset turnover",      group: "Efficiency",  fmt: "x",   higher: true },
  { key: "invTurn",      label: "Inventory turnover",  group: "Efficiency",  fmt: "x",   higher: true },
  { key: "arTurn",       label: "Receivables turnover",group: "Efficiency",  fmt: "x",   higher: true },
  { key: "roe",          label: "Return on equity",    group: "Returns",     fmt: "pct", higher: true },
  { key: "roa",          label: "Return on assets",    group: "Returns",     fmt: "pct", higher: true },
  { key: "roic",         label: "Return on capital",   group: "Returns",     fmt: "pct", higher: true },
];

const GROUPS = ["Margins", "Liquidity", "Leverage", "Efficiency", "Returns"];

function ratios(c) {
  const ebit = c.revenue - c.cogs - c.opex;
  const ebitda = ebit + c.da;
  const netDebt = c.totalDebt - c.cash;
  const investedCapital = c.totalDebt + c.equity - c.cash;
  return {
    ...c, ebit, ebitda,
    grossMargin: ((c.revenue - c.cogs) / c.revenue) * 100,
    opMargin: (ebit / c.revenue) * 100,
    netMargin: (c.netIncome / c.revenue) * 100,
    current: c.currentAssets / c.currentLiabilities,
    quick: (c.currentAssets - c.inventory) / c.currentLiabilities,
    cashRatio: c.cash / c.currentLiabilities,
    debtEquity: c.totalDebt / c.equity,
    netDebtEbitda: netDebt / ebitda,
    coverage: ebit / c.interest,
    assetTurn: c.revenue / c.totalAssets,
    invTurn: c.inventory > 0 ? c.cogs / c.inventory : null,
    arTurn: c.revenue / c.ar,
    roe: (c.netIncome / c.equity) * 100,
    roa: (c.netIncome / c.totalAssets) * 100,
    roic: (ebit * 0.76 / investedCapital) * 100,
  };
}

const fmt = (v, kind) => {
  if (v === null || !isFinite(v)) return "—";
  return kind === "pct" ? `${v.toFixed(1)}%` : `${v.toFixed(2)}×`;
};

/** Percentile rank within the peer set, flipped when lower is better. */
function percentile(value, values, higherIsBetter) {
  const clean = values.filter((v) => v !== null && isFinite(v));
  if (value === null || !isFinite(value) || clean.length < 2) return null;
  const below = clean.filter((v) => (higherIsBetter ? v < value : v > value)).length;
  return (below / (clean.length - 1)) * 100;
}

export default function FinancialRatioBenchmarkingTool() {
  const [focus, setFocus] = useState("CAS");
  const [peerSet, setPeerSet] = useState("All");
  const [group, setGroup] = useState("Margins");

  const all = useMemo(() => COMPANIES.map(ratios), []);
  const sectors = ["All", ...new Set(COMPANIES.map((c) => c.sector))];
  const peers = peerSet === "All" ? all : all.filter((c) => c.sector === peerSet);
  const target = all.find((c) => c.id === focus);

  const scored = useMemo(() => {
    return METRICS.map((m) => {
      const values = peers.map((p) => p[m.key]);
      const pctl = percentile(target[m.key], values, m.higher);
      const sorted = values.filter((v) => v !== null && isFinite(v)).sort((a, b) => a - b);
      const med = sorted.length
        ? (sorted.length % 2
          ? sorted[(sorted.length - 1) / 2]
          : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
        : null;
      return { ...m, value: target[m.key], percentile: pctl, median: med };
    });
  }, [target, peers]);

  const radar = GROUPS.map((g) => {
    const items = scored.filter((s) => s.group === g && s.percentile !== null);
    const avg = items.reduce((s, i) => s + i.percentile, 0) / (items.length || 1);
    return { group: g, score: Math.round(avg) };
  });

  const groupMetrics = scored.filter((s) => s.group === group);
  const comparison = peers.map((p) => ({
    name: p.id,
    ...Object.fromEntries(groupMetrics.map((m) => [m.label, p[m.key] === null ? 0 : Number(p[m.key].toFixed(2))])),
  }));

  const strongest = [...radar].sort((a, b) => b.score - a.score)[0];
  const weakest = [...radar].sort((a, b) => a.score - b.score)[0];
  const overall = Math.round(radar.reduce((s, r) => s + r.score, 0) / radar.length);

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ background: C.paper, color: C.ink }}>
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 pb-5" style={{ borderBottom: `1px solid ${C.rule}` }}>
          <h1 className="text-3xl font-serif tracking-tight">Financial ratio benchmarking</h1>
          <p className="mt-2 text-sm max-w-2xl" style={{ color: C.dim }}>
            A ratio on its own means nothing. Fifteen ratios across five families, each
            scored as a percentile against the peers you choose — that's a read on where a
            company actually stands.
          </p>
        </header>

        <div className="flex flex-wrap gap-2 mb-4">
          {all.map((c) => (
            <button key={c.id} onClick={() => setFocus(c.id)}
              className="px-3 py-2 text-sm"
              style={{
                background: c.id === focus ? C.ink : C.card,
                color: c.id === focus ? C.card : C.ink,
                border: `1px solid ${c.id === focus ? C.ink : C.rule}`,
              }}>{c.name}</button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-6 items-center">
          <span className="text-xs mr-1" style={{ color: C.dim }}>Benchmark against</span>
          {sectors.map((s) => (
            <button key={s} onClick={() => setPeerSet(s)}
              className="px-2 py-1 text-xs"
              style={{
                background: s === peerSet ? C.mark : "transparent",
                color: s === peerSet ? C.card : C.dim,
                border: `1px solid ${s === peerSet ? C.mark : C.rule}`,
              }}>{s === "All" ? "All companies" : s}</button>
          ))}
          <span className="text-xs ml-1" style={{ color: C.dim }}>· {peers.length} peers</span>
        </div>

        <div className="p-6 mb-6" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
          <p className="text-sm mb-1" style={{ color: C.dim }}>
            {target.name} — composite percentile
          </p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-5xl font-serif"
              style={{ color: overall >= 50 ? C.pos : C.neg }}>{overall}th</span>
            <span className="text-sm" style={{ color: C.dim }}>
              across all five ratio families
            </span>
          </div>
          <p className="text-sm mt-3" style={{ color: C.dim }}>
            Strongest on {strongest.group.toLowerCase()} at the {strongest.score}th
            percentile, weakest on {weakest.group.toLowerCase()} at the {weakest.score}th.
            {weakest.group === "Leverage" &&
              " Carrying more debt than peers isn't a verdict on its own — it's a verdict once you check whether the returns justify it."}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="p-5" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
            <h2 className="text-sm mb-2" style={{ color: C.dim }}>
              Percentile by ratio family — 50 is the peer median
            </h2>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radar} outerRadius="72%">
                  <PolarGrid stroke={C.rule} />
                  <PolarAngleAxis dataKey="group" tick={{ fontSize: 12, fill: C.ink }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: C.dim }}
                    stroke={C.rule} />
                  <Tooltip formatter={(v) => `${v}th percentile`}
                    contentStyle={{ background: C.card, border: `1px solid ${C.rule}`, fontSize: 12 }} />
                  <Radar dataKey="score" stroke={C.ink} fill={C.mark} fillOpacity={0.28}
                    strokeWidth={2} name={target.name} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-5" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
            <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
              <h2 className="text-sm" style={{ color: C.dim }}>Peer comparison</h2>
              <div className="flex flex-wrap gap-1">
                {GROUPS.map((g) => (
                  <button key={g} onClick={() => setGroup(g)}
                    className="px-2 py-1 text-xs"
                    style={{
                      background: g === group ? C.ink : "transparent",
                      color: g === group ? C.card : C.dim,
                      border: `1px solid ${g === group ? C.ink : C.rule}`,
                    }}>{g}</button>
                ))}
              </div>
            </div>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparison} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid stroke={C.rule} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.dim }} stroke={C.rule} />
                  <YAxis tick={{ fontSize: 11, fill: C.dim }} stroke={C.rule} />
                  <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.rule}`, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <ReferenceLine y={0} stroke={C.ink} />
                  {groupMetrics.map((m, i) => (
                    <Bar key={m.key} dataKey={m.label}
                      fill={[C.ink, C.mark, C.pos][i % 3]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="p-5" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
          <h2 className="text-sm mb-4" style={{ color: C.dim }}>
            {target.name} against the peer median
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: C.dim, borderBottom: `1px solid ${C.rule}` }}>
                <th className="text-left font-normal py-2">Ratio</th>
                <th className="text-left font-normal">Family</th>
                <th className="text-right font-normal">{target.id}</th>
                <th className="text-right font-normal">Peer median</th>
                <th className="text-left font-normal pl-6" style={{ width: "30%" }}>Percentile</th>
              </tr>
            </thead>
            <tbody>
              {scored.map((m) => (
                <tr key={m.key} style={{ borderBottom: `1px solid ${C.rule}` }}>
                  <td className="py-2">{m.label}</td>
                  <td style={{ color: C.dim }} className="text-xs">{m.group}</td>
                  <td className="text-right font-mono">{fmt(m.value, m.fmt)}</td>
                  <td className="text-right font-mono" style={{ color: C.dim }}>
                    {fmt(m.median, m.fmt)}
                  </td>
                  <td className="pl-6">
                    {m.percentile === null ? (
                      <span className="text-xs" style={{ color: C.dim }}>not comparable</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-3" style={{ background: C.paper, position: "relative" }}>
                          <div style={{
                            width: `${m.percentile}%`, height: "100%",
                            background: m.percentile >= 50 ? C.pos : C.neg,
                          }} />
                          <div style={{
                            position: "absolute", left: "50%", top: 0, bottom: 0,
                            width: 1, background: C.ink,
                          }} />
                        </div>
                        <span className="font-mono text-xs" style={{ width: 32 }}>
                          {m.percentile.toFixed(0)}
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs mt-4" style={{ color: C.dim }}>
            The tick at the centre of each bar is the peer median. Leverage ratios are
            scored inverted — less debt ranks higher — while interest coverage is scored
            normally, so the two can disagree and that disagreement is informative.
          </p>
        </div>
      </div>
    </div>
  );
}
