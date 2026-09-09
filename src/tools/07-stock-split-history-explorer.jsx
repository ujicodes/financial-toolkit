/**
 * 07 — Stock Split History Explorer
 * Visualize historical stock splits, split-adjusted prices, and company
 * performance before and after each split.
 *
 * Spec tech: React, Python, Chart.js
 * This build: React + Recharts.
 *
 * DATA NOTE — read before using this in a portfolio.
 * The split events (dates and ratios) are the real public record. The price
 * series is SYNTHETIC: a seeded random walk anchored to each company's split
 * dates, generated so the adjustment math and the event-window analytics are
 * demonstrable offline. Replace `buildSeries` with the Python loader:
 *
 *     import yfinance as yf
 *     hist = yf.Ticker(sym).history(period="max", auto_adjust=False)
 *     splits = yf.Ticker(sym).splits
 *
 * Everything downstream — the adjustment factors, the event windows, the
 * charts — runs unchanged on real data.
 */
import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, BarChart, Bar, Cell, Legend,
} from "recharts";

const C = {
  paper: "#EDEFF0", card: "#F7F8F8", ink: "#16232B", dim: "#5C7078",
  rule: "#C7CFD2", pos: "#1F5F4E", neg: "#A3341F", mark: "#B08814",
};

const COMPANIES = {
  AAPL: { name: "Apple", start: 1997, drift: 0.019, vol: 0.075, p0: 4.2,
    splits: [
      { date: "2000-06-21", ratio: 2 }, { date: "2005-02-28", ratio: 2 },
      { date: "2014-06-09", ratio: 7 }, { date: "2020-08-31", ratio: 4 },
    ] },
  NVDA: { name: "Nvidia", start: 1999, drift: 0.023, vol: 0.11, p0: 2.1,
    splits: [
      { date: "2001-09-17", ratio: 2 }, { date: "2006-04-07", ratio: 2 },
      { date: "2021-07-20", ratio: 4 }, { date: "2024-06-10", ratio: 10 },
    ] },
  AMZN: { name: "Amazon", start: 1997, drift: 0.021, vol: 0.10, p0: 1.6,
    splits: [
      { date: "1998-06-02", ratio: 2 }, { date: "1999-01-05", ratio: 3 },
      { date: "1999-09-02", ratio: 2 }, { date: "2022-06-06", ratio: 20 },
    ] },
  TSLA: { name: "Tesla", start: 2010, drift: 0.028, vol: 0.145, p0: 1.6,
    splits: [{ date: "2020-08-31", ratio: 5 }, { date: "2022-08-25", ratio: 3 }] },
  GOOGL: { name: "Alphabet", start: 2004, drift: 0.016, vol: 0.072, p0: 50,
    splits: [{ date: "2014-04-03", ratio: 2 }, { date: "2022-07-18", ratio: 20 }] },
};

/** Deterministic PRNG so the demo series never changes between reloads. */
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * Monthly series from `start` to today. Prices are generated on a
 * split-ADJUSTED basis, then un-adjusted backwards through the split factors
 * to recover what the raw tape would have printed.
 */
function buildSeries(sym) {
  const c = COMPANIES[sym];
  const rand = rng(sym.split("").reduce((a, ch) => a + ch.charCodeAt(0), 7) * 9973);
  const months = (2026 - c.start) * 12;
  const rows = [];
  let adj = c.p0;

  for (let m = 0; m <= months; m++) {
    const d = new Date(c.start, m, 1);
    if (d > new Date()) break;
    // Box-Muller for a normal shock.
    const u = Math.max(rand(), 1e-9), v = Math.max(rand(), 1e-9);
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    adj *= Math.exp(c.drift + c.vol * z);
    rows.push({ date: d, iso: d.toISOString().slice(0, 10), adjusted: adj });
  }

  // Cumulative factor: a price before split k must be multiplied by the
  // product of every ratio at or after k to state it on today's basis.
  rows.forEach((r) => {
    let factor = 1;
    c.splits.forEach((s) => { if (r.iso < s.date) factor *= s.ratio; });
    r.raw = r.adjusted * factor;
    r.factor = factor;
  });

  return rows;
}

/** Return in a window of N months either side of an event index. */
function windowReturn(rows, idx, months) {
  const from = months < 0 ? Math.max(0, idx + months) : idx;
  const to = months < 0 ? idx : Math.min(rows.length - 1, idx + months);
  if (from === to) return 0;
  return ((rows[to].adjusted / rows[from].adjusted) - 1) * 100;
}

const money = (n) =>
  "$" + n.toLocaleString("en-US", { maximumFractionDigits: n < 10 ? 2 : 0 });

export default function StockSplitHistoryExplorer() {
  const [sym, setSym] = useState("NVDA");
  const [basis, setBasis] = useState("adjusted");
  const [logScale, setLogScale] = useState(true);

  const rows = useMemo(() => buildSeries(sym), [sym]);
  const c = COMPANIES[sym];

  const events = useMemo(() => {
    return c.splits.map((s) => {
      let idx = rows.findIndex((r) => r.iso >= s.date);
      if (idx < 0) idx = rows.length - 1;
      const priceBefore = rows[Math.max(0, idx - 1)];
      return {
        ...s,
        idx,
        year: s.date.slice(0, 4),
        label: `${s.ratio}-for-1`,
        rawBefore: priceBefore.raw,
        rawAfter: priceBefore.raw / s.ratio,
        pre12: windowReturn(rows, idx, -12),
        pre3: windowReturn(rows, idx, -3),
        post3: windowReturn(rows, idx, 3),
        post12: windowReturn(rows, idx, 12),
      };
    });
  }, [rows, c]);

  const chartData = rows.map((r) => ({
    iso: r.iso,
    year: r.date.getFullYear(),
    value: Math.round((basis === "adjusted" ? r.adjusted : r.raw) * 100) / 100,
  }));

  const cumulativeSplit = c.splits.reduce((a, s) => a * s.ratio, 1);
  const totalReturn = ((rows[rows.length - 1].adjusted / rows[0].adjusted) - 1) * 100;

  const eventChart = events.map((e) => ({
    name: `${e.label} · ${e.year}`,
    "12 months before": Math.round(e.pre12),
    "12 months after": Math.round(e.post12),
  }));

  const avgPre = events.reduce((s, e) => s + e.pre12, 0) / events.length;
  const avgPost = events.reduce((s, e) => s + e.post12, 0) / events.length;

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ background: C.paper, color: C.ink }}>
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 pb-5" style={{ borderBottom: `1px solid ${C.rule}` }}>
          <h1 className="text-3xl font-serif tracking-tight">Stock split history explorer</h1>
          <p className="mt-2 text-sm max-w-2xl" style={{ color: C.dim }}>
            A split changes the share count, never the value of the company. This shows
            what the raw tape printed, what the adjusted history looks like, and how the
            stock actually behaved around each announcement.
          </p>
        </header>

        <div className="p-3 mb-6 text-xs"
          style={{ background: C.card, border: `1px solid ${C.mark}`, color: C.ink }}>
          Split dates and ratios are the real public record. The price series is a seeded
          synthetic walk so the adjustment math runs offline — swap in a yfinance pull
          before quoting any of these returns.
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {Object.keys(COMPANIES).map((k) => (
            <button key={k} onClick={() => setSym(k)}
              className="px-3 py-2 text-sm"
              style={{
                background: k === sym ? C.ink : C.card,
                color: k === sym ? C.card : C.ink,
                border: `1px solid ${k === sym ? C.ink : C.rule}`,
              }}>
              {COMPANIES[k].name}
            </button>
          ))}
        </div>

        <div className="p-6 mb-6" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
          <p className="text-sm mb-1" style={{ color: C.dim }}>
            Cumulative split factor for {c.name}
          </p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-5xl font-serif" style={{ color: C.mark }}>
              {cumulativeSplit.toLocaleString()}×
            </span>
            <span className="text-sm" style={{ color: C.dim }}>
              one share bought before {c.splits[0].date.slice(0, 4)} is{" "}
              {cumulativeSplit.toLocaleString()} shares today
            </span>
          </div>
          <p className="text-sm mt-3" style={{ color: C.dim }}>
            Across {c.splits.length} splits. The adjusted series is up{" "}
            {totalReturn.toLocaleString("en-US", { maximumFractionDigits: 0 })}% over the
            window — the raw price line is up the same amount, {cumulativeSplit}× less
            per share.
          </p>
        </div>

        <div className="p-5 mb-6" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
          <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
            <h2 className="text-sm" style={{ color: C.dim }}>
              Price history — vertical marks are splits
            </h2>
            <div className="flex gap-2">
              {[["adjusted", "Split-adjusted"], ["raw", "As it traded"]].map(([k, l]) => (
                <button key={k} onClick={() => setBasis(k)}
                  className="px-2 py-1 text-xs"
                  style={{
                    background: basis === k ? C.mark : "transparent",
                    color: basis === k ? C.card : C.dim,
                    border: `1px solid ${basis === k ? C.mark : C.rule}`,
                  }}>{l}</button>
              ))}
              <button onClick={() => setLogScale((s) => !s)}
                className="px-2 py-1 text-xs"
                style={{
                  background: logScale ? C.ink : "transparent",
                  color: logScale ? C.card : C.dim,
                  border: `1px solid ${logScale ? C.ink : C.rule}`,
                }}>Log scale</button>
            </div>
          </div>
          <div style={{ height: 340 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid stroke={C.rule} vertical={false} />
                <XAxis dataKey="iso" tick={{ fontSize: 11, fill: C.dim }} stroke={C.rule}
                  tickFormatter={(v) => v.slice(0, 4)} minTickGap={40} />
                <YAxis tick={{ fontSize: 11, fill: C.dim }} stroke={C.rule}
                  scale={logScale ? "log" : "linear"}
                  domain={logScale ? ["auto", "auto"] : [0, "auto"]}
                  allowDataOverflow tickFormatter={(v) => money(v)} />
                <Tooltip formatter={(v) => money(v)}
                  contentStyle={{ background: C.card, border: `1px solid ${C.rule}`, fontSize: 12 }} />
                {c.splits.map((s) => (
                  <ReferenceLine key={s.date} x={rows.find((r) => r.iso >= s.date)?.iso}
                    stroke={C.mark} strokeDasharray="4 4"
                    label={{ value: `${s.ratio}:1`, fill: C.mark, fontSize: 10, position: "top" }} />
                ))}
                <Line type="monotone" dataKey="value" stroke={C.ink} strokeWidth={1.8} dot={false}
                  name={basis === "adjusted" ? "Split-adjusted" : "As traded"} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs mt-3" style={{ color: C.dim }}>
            {basis === "raw"
              ? "On the raw basis every split shows up as a cliff. Nobody lost money on those days — the share count changed underneath the price."
              : "Adjusted, the cliffs vanish: each pre-split price has been divided by the cumulative factor so the whole history is stated in today's shares."}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="p-5" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
            <h2 className="text-sm mb-4" style={{ color: C.dim }}>
              Performance around each split
            </h2>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventChart} margin={{ top: 5, right: 10, bottom: 40, left: 0 }}>
                  <CartesianGrid stroke={C.rule} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.dim }}
                    angle={-20} textAnchor="end" interval={0} stroke={C.rule} />
                  <YAxis tick={{ fontSize: 11, fill: C.dim }} stroke={C.rule}
                    tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v) => `${v}%`}
                    contentStyle={{ background: C.card, border: `1px solid ${C.rule}`, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={0} stroke={C.ink} />
                  <Bar dataKey="12 months before" fill={C.dim} />
                  <Bar dataKey="12 months after" fill={C.pos} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs mt-3" style={{ color: C.dim }}>
              Average of {avgPre.toFixed(0)}% into the split and {avgPost.toFixed(0)}% out
              of it. Companies split after a run, which is why the left bars are tall —
              that's selection, not a signal you can trade.
            </p>
          </div>

          <div className="p-5" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
            <h2 className="text-sm mb-3" style={{ color: C.dim }}>Split record</h2>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: C.dim, borderBottom: `1px solid ${C.rule}` }}>
                  <th className="text-left font-normal py-2">Date</th>
                  <th className="text-left font-normal">Ratio</th>
                  <th className="text-right font-normal">Before</th>
                  <th className="text-right font-normal">After</th>
                  <th className="text-right font-normal">−3m</th>
                  <th className="text-right font-normal">+3m</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.date} style={{ borderBottom: `1px solid ${C.rule}` }}>
                    <td className="py-2 font-mono text-xs">{e.date}</td>
                    <td style={{ color: C.mark }}>{e.label}</td>
                    <td className="text-right font-mono">{money(e.rawBefore)}</td>
                    <td className="text-right font-mono">{money(e.rawAfter)}</td>
                    <td className="text-right font-mono"
                      style={{ color: e.pre3 >= 0 ? C.pos : C.neg }}>{e.pre3.toFixed(0)}%</td>
                    <td className="text-right font-mono"
                      style={{ color: e.post3 >= 0 ? C.pos : C.neg }}>{e.post3.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs mt-4" style={{ color: C.dim }}>
              "Before" and "after" are the raw quoted price either side of the ex-date.
              Market capitalization is identical across that line.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
