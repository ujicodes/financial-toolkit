/**
 * 04 — Revenue Growth Decomposer
 * Break revenue growth into price increases, volume changes, new customers,
 * churn, and expansion.
 *
 * Spec tech: Python, Pandas, Plotly
 * This build: React + Recharts. `decompose()` is a direct port of the pandas
 * bridge — feed it a DataFrame grouped by period and it returns the same
 * eight components, so the notebook and the app never disagree.
 */
import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const C = {
  paper: "#EDEFF0", card: "#F7F8F8", ink: "#16232B", dim: "#5C7078",
  rule: "#C7CFD2", pos: "#1F5F4E", neg: "#A3341F", mark: "#B08814",
};

const money = (n) =>
  (n < 0 ? "−" : "") + "$" + Math.abs(Math.round(n)).toLocaleString("en-US");

/**
 * Volume/price/customer bridge from opening to closing revenue.
 * Every component is additive: they must sum back to the delta exactly.
 */
function decompose(a) {
  const openRev = a.customers * a.asp;

  const churnedCustomers = a.customers * (a.churnRate / 100);
  const retained = a.customers - churnedCustomers;

  // 1. Customers lost, valued at last period's price.
  const churn = -churnedCustomers * a.asp;

  // 2. Price taken on the customers who stayed, at last period's volume.
  const aspNew = a.asp * (1 + a.priceChange / 100);
  const price = retained * (aspNew - a.asp);

  // 3. Seats/usage added by retained customers, at the new price.
  const expansion = retained * aspNew * (a.expansionRate / 100);

  // 4. Downgrades by retained customers, at the new price.
  const contraction = -retained * aspNew * (a.contractionRate / 100);

  // 5. Customers won, at the new price.
  const newBiz = a.newCustomers * aspNew;

  const closeRev = openRev + churn + price + expansion + contraction + newBiz;

  const grr = ((openRev + churn + contraction) / openRev) * 100;
  const nrr = ((openRev + churn + contraction + expansion + price) / openRev) * 100;

  return {
    openRev, closeRev, churn, price, expansion, contraction, newBiz,
    churnedCustomers, retained, aspNew,
    closeCustomers: retained + a.newCustomers,
    growth: ((closeRev - openRev) / openRev) * 100,
    grr, nrr,
  };
}

function Ctl({ label, value, onChange, min, max, step, suffix, hint }) {
  return (
    <label className="block mb-4">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-sm">{label}</span>
        <span className="text-sm font-mono" style={{ color: C.dim }}>
          {value.toLocaleString("en-US")}{suffix}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full" style={{ accentColor: C.ink }} />
      {hint && <p className="text-xs mt-1" style={{ color: C.dim }}>{hint}</p>}
    </label>
  );
}

export default function RevenueGrowthDecomposer() {
  const [a, setA] = useState({
    customers: 1850, asp: 14400, newCustomers: 420,
    churnRate: 9, priceChange: 6, expansionRate: 11, contractionRate: 3,
  });
  const set = (k) => (v) => setA((s) => ({ ...s, [k]: v }));
  const d = useMemo(() => decompose(a), [a]);

  // Waterfall: an invisible riser bar plus the visible delta bar.
  const steps = [
    { name: "Opening ARR", value: d.openRev, type: "total" },
    { name: "Churn", value: d.churn, type: "delta" },
    { name: "Contraction", value: d.contraction, type: "delta" },
    { name: "Price", value: d.price, type: "delta" },
    { name: "Expansion", value: d.expansion, type: "delta" },
    { name: "New customers", value: d.newBiz, type: "delta" },
    { name: "Closing ARR", value: d.closeRev, type: "total" },
  ];
  let cursor = 0;
  const bars = steps.map((s) => {
    if (s.type === "total") {
      cursor = s.value;
      return { name: s.name, riser: 0, bar: s.value, value: s.value, kind: "total" };
    }
    const start = cursor;
    cursor += s.value;
    return {
      name: s.name,
      riser: Math.min(start, cursor),
      bar: Math.abs(s.value),
      value: s.value,
      kind: s.value >= 0 ? "up" : "down",
    };
  });

  const ranked = [
    { label: "New customers", v: d.newBiz },
    { label: "Expansion", v: d.expansion },
    { label: "Price", v: d.price },
    { label: "Contraction", v: d.contraction },
    { label: "Churn", v: d.churn },
  ].sort((x, y) => Math.abs(y.v) - Math.abs(x.v));

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ background: C.paper, color: C.ink }}>
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 pb-5" style={{ borderBottom: `1px solid ${C.rule}` }}>
          <h1 className="text-3xl font-serif tracking-tight">Revenue growth decomposer</h1>
          <p className="mt-2 text-sm max-w-2xl" style={{ color: C.dim }}>
            "We grew 27%" tells you nothing about whether the business is healthy. This
            splits the number into the five forces that produced it, in an additive
            bridge that reconciles to the penny.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <aside className="lg:col-span-1">
            <h2 className="text-sm mb-4" style={{ color: C.dim }}>Opening book</h2>
            <Ctl label="Customers" value={a.customers} onChange={set("customers")}
              min={100} max={10000} step={50} suffix="" />
            <Ctl label="Average contract value" value={a.asp} onChange={set("asp")}
              min={1000} max={60000} step={500} suffix="" />

            <h2 className="text-sm mb-4 mt-8 pt-6" style={{ color: C.dim, borderTop: `1px solid ${C.rule}` }}>
              What happened this year
            </h2>
            <Ctl label="Logo churn" value={a.churnRate} onChange={set("churnRate")}
              min={0} max={40} step={0.5} suffix="%"
              hint="Customers who left entirely." />
            <Ctl label="Contraction" value={a.contractionRate} onChange={set("contractionRate")}
              min={0} max={25} step={0.5} suffix="%"
              hint="Downgrades among customers who stayed." />
            <Ctl label="Price change" value={a.priceChange} onChange={set("priceChange")}
              min={-15} max={30} step={0.5} suffix="%" />
            <Ctl label="Expansion" value={a.expansionRate} onChange={set("expansionRate")}
              min={0} max={50} step={0.5} suffix="%"
              hint="Seats and usage added by existing customers." />
            <Ctl label="New customers won" value={a.newCustomers} onChange={set("newCustomers")}
              min={0} max={3000} step={10} suffix="" />
          </aside>

          <main className="lg:col-span-2">
            <div className="p-6 mb-6" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
              <p className="text-sm mb-1" style={{ color: C.dim }}>Revenue growth</p>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-5xl font-serif"
                  style={{ color: d.growth >= 0 ? C.pos : C.neg }}>
                  {d.growth >= 0 ? "+" : "−"}{Math.abs(d.growth).toFixed(1)}%
                </span>
                <span className="text-sm" style={{ color: C.dim }}>
                  {money(d.openRev)} → {money(d.closeRev)}
                </span>
              </div>
              <p className="text-sm mt-3" style={{ color: C.dim }}>
                {ranked[0].label} is the largest single force at {money(ranked[0].v)}.
                {d.nrr >= 100
                  ? ` Net revenue retention of ${d.nrr.toFixed(0)}% means the existing book grows on its own, before a single new logo.`
                  : ` Net revenue retention is ${d.nrr.toFixed(0)}%, so the existing book shrinks and new sales are carrying all the growth.`}
              </p>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                ["Gross retention", `${d.grr.toFixed(0)}%`, d.grr >= 90 ? C.pos : C.neg],
                ["Net retention", `${d.nrr.toFixed(0)}%`, d.nrr >= 100 ? C.pos : C.neg],
                ["Closing customers", Math.round(d.closeCustomers).toLocaleString(), C.ink],
                ["New ACV", money(d.aspNew), C.ink],
              ].map(([l, v, col]) => (
                <div key={l} className="p-3" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
                  <p className="text-xs mb-1" style={{ color: C.dim }}>{l}</p>
                  <p className="font-mono text-base" style={{ color: col }}>{v}</p>
                </div>
              ))}
            </div>

            <div className="p-5 mb-6" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
              <h2 className="text-sm mb-4" style={{ color: C.dim }}>Opening to closing bridge</h2>
              <div style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bars} margin={{ top: 5, right: 10, bottom: 45, left: 10 }}>
                    <CartesianGrid stroke={C.rule} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.dim }}
                      angle={-25} textAnchor="end" interval={0} stroke={C.rule} />
                    <YAxis tick={{ fontSize: 11, fill: C.dim }} stroke={C.rule}
                      tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`} />
                    <Tooltip
                      contentStyle={{ background: C.card, border: `1px solid ${C.rule}`, fontSize: 12 }}
                      formatter={(v, n, p) => [money(p.payload.value), p.payload.name]} />
                    <Bar dataKey="riser" stackId="w" fill="transparent" />
                    <Bar dataKey="bar" stackId="w">
                      {bars.map((b, i) => (
                        <Cell key={i}
                          fill={b.kind === "total" ? C.ink : b.kind === "up" ? C.pos : C.neg} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-5" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
              <h2 className="text-sm mb-3" style={{ color: C.dim }}>Components, ranked by size</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: C.dim, borderBottom: `1px solid ${C.rule}` }}>
                    <th className="text-left font-normal py-2">Driver</th>
                    <th className="text-right font-normal">Amount</th>
                    <th className="text-right font-normal">Points of growth</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((r) => (
                    <tr key={r.label} style={{ borderBottom: `1px solid ${C.rule}` }}>
                      <td className="py-2">{r.label}</td>
                      <td className="text-right font-mono"
                        style={{ color: r.v >= 0 ? C.pos : C.neg }}>{money(r.v)}</td>
                      <td className="text-right font-mono">
                        {((r.v / d.openRev) * 100).toFixed(1)} pts
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: `2px solid ${C.ink}` }}>
                    <td className="py-2">Net change</td>
                    <td className="text-right font-mono">{money(d.closeRev - d.openRev)}</td>
                    <td className="text-right font-mono">{d.growth.toFixed(1)} pts</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs mt-4" style={{ color: C.dim }}>
                Price is measured on retained customers only, so it never double-counts
                revenue already credited to new business or expansion.
              </p>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
