/**
 * 02 — Mortgage Payment Simulator
 * Compare mortgage rates, down payments, loan terms, and extra payments to
 * visualize total interest and payoff dates.
 *
 * Spec tech: Next.js, TypeScript, Chart.js
 * This build: React + Recharts (renders standalone). To port: drop the
 * component into app/simulator/page.tsx, type the Scenario interface off
 * the shape used in `scenarios` state, and swap the chart for react-chartjs-2.
 */
import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const C = {
  paper: "#EDEFF0", card: "#F7F8F8", ink: "#16232B", dim: "#5C7078",
  rule: "#C7CFD2", pos: "#1F5F4E", neg: "#A3341F", mark: "#B08814",
};
const SERIES = [C.ink, C.mark, C.pos];

const usd = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/**
 * Standard amortization with optional constant extra principal.
 * Returns the monthly payment, month-by-month balance, total interest,
 * and the month the loan closes.
 */
function amortize({ price, downPct, rate, years, extra }) {
  const principal = price * (1 - downPct / 100);
  const r = rate / 100 / 12;
  const n = years * 12;
  const pmt = r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
  let bal = principal;
  let interest = 0;
  const schedule = [{ month: 0, balance: principal, interestPaid: 0 }];
  let m = 0;
  while (bal > 0.01 && m < n + 600) {
    m++;
    const int = bal * r;
    let princ = pmt - int + extra;
    if (princ > bal) princ = bal;
    interest += int;
    bal -= princ;
    if (m % 12 === 0 || bal <= 0.01) {
      schedule.push({ month: m, balance: Math.max(bal, 0), interestPaid: interest });
    }
  }
  return { principal, pmt, schedule, interest, months: m };
}

function payoffLabel(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function Num({ label, value, onChange, min, max, step, suffix }) {
  return (
    <label className="block mb-3">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs" style={{ color: C.dim }}>{label}</span>
        <span className="text-xs font-mono">{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full" style={{ accentColor: C.ink }} />
    </label>
  );
}

const BLANK = { price: 550000, downPct: 20, rate: 6.5, years: 30, extra: 0 };

export default function MortgagePaymentSimulator() {
  const [scenarios, setScenarios] = useState([
    { ...BLANK, name: "30-year baseline" },
    { ...BLANK, years: 15, rate: 5.9, name: "15-year" },
    { ...BLANK, extra: 400, name: "30-year + $400/mo" },
  ]);

  const runs = useMemo(
    () => scenarios.map((s) => ({ ...s, ...amortize(s) })),
    [scenarios]
  );

  const update = (i, patch) =>
    setScenarios((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  // Align every scenario onto one x-axis of years.
  const maxYears = Math.ceil(Math.max(...runs.map((r) => r.months)) / 12);
  const chartData = [];
  for (let y = 0; y <= maxYears; y++) {
    const row = { year: y };
    runs.forEach((r, i) => {
      const pt = r.schedule.find((p) => p.month === y * 12);
      row[`s${i}`] = pt ? Math.round(pt.balance) : (y * 12 > r.months ? 0 : undefined);
    });
    chartData.push(row);
  }

  const cheapest = runs.reduce((a, b) => (a.interest <= b.interest ? a : b));
  const dearest = runs.reduce((a, b) => (a.interest >= b.interest ? a : b));

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ background: C.paper, color: C.ink }}>
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 pb-5" style={{ borderBottom: `1px solid ${C.rule}` }}>
          <h1 className="text-3xl font-serif tracking-tight">Mortgage payment simulator</h1>
          <p className="mt-2 text-sm max-w-xl" style={{ color: C.dim }}>
            Three scenarios, amortized month by month. Change any assumption and the
            balance curves, lifetime interest, and payoff dates all move together.
          </p>
        </header>

        <div className="p-6 mb-8" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
          <p className="text-sm mb-1" style={{ color: C.dim }}>
            Interest saved by choosing {cheapest.name} over {dearest.name}
          </p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-5xl font-serif" style={{ color: C.pos }}>
              {usd(dearest.interest - cheapest.interest)}
            </span>
            <span className="text-sm" style={{ color: C.dim }}>
              and it closes {Math.round((dearest.months - cheapest.months) / 12 * 10) / 10} years earlier
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {scenarios.map((s, i) => (
            <div key={i} className="p-4" style={{ background: C.card, border: `1px solid ${C.rule}`, borderTop: `3px solid ${SERIES[i]}` }}>
              <input value={s.name} onChange={(e) => update(i, { name: e.target.value })}
                className="w-full font-serif text-base mb-3 bg-transparent"
                style={{ color: C.ink, borderBottom: `1px solid ${C.rule}` }} />
              <Num label="Home price" value={s.price} onChange={(v) => update(i, { price: v })}
                min={100000} max={2000000} step={10000} suffix="" />
              <Num label="Down payment" value={s.downPct} onChange={(v) => update(i, { downPct: v })}
                min={0} max={50} step={1} suffix="%" />
              <Num label="Rate" value={s.rate} onChange={(v) => update(i, { rate: v })}
                min={2} max={12} step={0.1} suffix="%" />
              <Num label="Term" value={s.years} onChange={(v) => update(i, { years: v })}
                min={5} max={40} step={5} suffix=" yr" />
              <Num label="Extra principal" value={s.extra} onChange={(v) => update(i, { extra: v })}
                min={0} max={3000} step={50} suffix="/mo" />
            </div>
          ))}
        </div>

        <div className="p-5 mb-8" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
          <h2 className="text-sm mb-4" style={{ color: C.dim }}>Loan balance over time</h2>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid stroke={C.rule} vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: C.dim }} stroke={C.rule}
                  label={{ value: "Years from today", position: "insideBottom", offset: -12,
                    style: { fontSize: 11, fill: C.dim } }} />
                <YAxis tick={{ fontSize: 11, fill: C.dim }} stroke={C.rule}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => usd(v)}
                  contentStyle={{ background: C.card, border: `1px solid ${C.rule}`, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {runs.map((r, i) => (
                  <Line key={i} type="monotone" dataKey={`s${i}`} name={r.name}
                    stroke={SERIES[i]} strokeWidth={2} dot={false} connectNulls={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-5" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: C.dim, borderBottom: `1px solid ${C.rule}` }}>
                <th className="text-left font-normal py-2">Scenario</th>
                <th className="text-right font-normal">Loan amount</th>
                <th className="text-right font-normal">Monthly P&amp;I</th>
                <th className="text-right font-normal">Total interest</th>
                <th className="text-right font-normal">Total paid</th>
                <th className="text-right font-normal">Payoff</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.rule}` }}>
                  <td className="py-2">
                    <span className="inline-block w-2 h-2 mr-2" style={{ background: SERIES[i] }} />
                    {r.name}
                  </td>
                  <td className="text-right font-mono">{usd(r.principal)}</td>
                  <td className="text-right font-mono">{usd(r.pmt)}</td>
                  <td className="text-right font-mono"
                    style={{ color: r.interest === cheapest.interest ? C.pos : C.ink }}>
                    {usd(r.interest)}
                  </td>
                  <td className="text-right font-mono">{usd(r.principal + r.interest)}</td>
                  <td className="text-right font-mono">{payoffLabel(r.months)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs mt-4" style={{ color: C.dim }}>
            Principal and interest only. Property tax, insurance, PMI, and closing costs
            are excluded — add them before comparing against rent.
          </p>
        </div>
      </div>
    </div>
  );
}
