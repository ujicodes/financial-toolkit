/**
 * 05 — Working Capital Analyzer
 * Analyze accounts receivable, inventory, accounts payable, and cash conversion
 * cycles across companies.
 *
 * Spec tech: React, Python, PostgreSQL
 * This build: React. COMPANIES stands in for the `financials` table
 * (company_id, fiscal_year, revenue, cogs, ar, inventory, ap); the ratio math
 * matches the Postgres view that would normally compute it server-side.
 */
import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Cell, ReferenceLine,
} from "recharts";

const C = {
  paper: "#EDEFF0", card: "#F7F8F8", ink: "#16232B", dim: "#5C7078",
  rule: "#C7CFD2", pos: "#1F5F4E", neg: "#A3341F", mark: "#B08814",
};

// $ millions, trailing twelve months.
const COMPANIES = [
  { id: "MERIDIAN",  name: "Meridian Retail",     sector: "Retail",     revenue: 48200, cogs: 34700, ar: 1180, inventory: 6900, ap: 8400 },
  { id: "ALTUS",     name: "Altus Industrial",    sector: "Industrial", revenue: 21600, cogs: 15100, ar: 4300, inventory: 5200, ap: 2900 },
  { id: "NORTHBEAM", name: "Northbeam Software",  sector: "Software",   revenue: 7400,  cogs: 1480,  ar: 1650, inventory: 0,    ap: 240 },
  { id: "CASTELLAN", name: "Castellan Foods",     sector: "Consumer",   revenue: 33500, cogs: 21100, ar: 2900, inventory: 3100, ap: 4800 },
  { id: "VERGE",     name: "Verge Semiconductor", sector: "Hardware",   revenue: 18900, cogs: 11300, ar: 3400, inventory: 4700, ap: 1800 },
  { id: "HALCYON",   name: "Halcyon Apparel",     sector: "Retail",     revenue: 9600,  cogs: 5300,  ar: 780,  inventory: 2400, ap: 1100 },
];

const money = (n) =>
  (n < 0 ? "−" : "") + "$" + Math.abs(Math.round(n)).toLocaleString("en-US") + "M";

function ratios(c) {
  const dso = (c.ar / c.revenue) * 365;
  const dio = c.cogs > 0 ? (c.inventory / c.cogs) * 365 : 0;
  const dpo = c.cogs > 0 ? (c.ap / c.cogs) * 365 : 0;
  const ccc = dso + dio - dpo;
  const nwc = c.ar + c.inventory - c.ap;
  return {
    ...c, dso, dio, dpo, ccc, nwc,
    nwcPctRev: (nwc / c.revenue) * 100,
    cashPerDay: c.revenue / 365,
  };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export default function WorkingCapitalAnalyzer() {
  const [focus, setFocus] = useState("ALTUS");
  const [sector, setSector] = useState("All");

  const all = useMemo(() => COMPANIES.map(ratios), []);
  const sectors = ["All", ...new Set(COMPANIES.map((c) => c.sector))];
  const peers = sector === "All" ? all : all.filter((c) => c.sector === sector);

  const target = all.find((c) => c.id === focus);
  const med = {
    dso: median(peers.map((p) => p.dso)),
    dio: median(peers.map((p) => p.dio)),
    dpo: median(peers.map((p) => p.dpo)),
    ccc: median(peers.map((p) => p.ccc)),
  };

  // Cash released if the focus company moved each component to the peer median.
  const release = {
    ar: ((target.dso - med.dso) / 365) * target.revenue,
    inv: ((target.dio - med.dio) / 365) * target.cogs,
    ap: ((med.dpo - target.dpo) / 365) * target.cogs,
  };
  const totalRelease = release.ar + release.inv + release.ap;

  const chartData = all
    .slice()
    .sort((a, b) => a.ccc - b.ccc)
    .map((c) => ({
      name: c.id, ccc: Math.round(c.ccc),
      DSO: Math.round(c.dso), DIO: Math.round(c.dio), DPO: -Math.round(c.dpo),
    }));

  const scatter = all.map((c) => ({
    x: Math.round(c.ccc), y: Math.round(c.nwcPctRev * 10) / 10,
    z: c.revenue, name: c.id,
  }));

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ background: C.paper, color: C.ink }}>
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 pb-5" style={{ borderBottom: `1px solid ${C.rule}` }}>
          <h1 className="text-3xl font-serif tracking-tight">Working capital analyzer</h1>
          <p className="mt-2 text-sm max-w-2xl" style={{ color: C.dim }}>
            The cash conversion cycle is how long a dollar stays trapped between paying a
            supplier and collecting from a customer. Shorter is cheaper. Negative means
            customers fund the business.
          </p>
        </header>

        <div className="flex flex-wrap gap-2 mb-6">
          {all.map((c) => (
            <button key={c.id} onClick={() => setFocus(c.id)}
              className="px-3 py-2 text-sm"
              style={{
                background: c.id === focus ? C.ink : C.card,
                color: c.id === focus ? C.card : C.ink,
                border: `1px solid ${c.id === focus ? C.ink : C.rule}`,
              }}>
              {c.name}
            </button>
          ))}
        </div>

        <div className="p-6 mb-6" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
          <p className="text-sm mb-1" style={{ color: C.dim }}>
            {target.name} — cash conversion cycle
          </p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-5xl font-serif"
              style={{ color: target.ccc <= med.ccc ? C.pos : C.neg }}>
              {target.ccc.toFixed(0)} days
            </span>
            <span className="text-sm" style={{ color: C.dim }}>
              against a peer median of {med.ccc.toFixed(0)} — a gap of{" "}
              {Math.abs(target.ccc - med.ccc).toFixed(0)} days
            </span>
          </div>
          <p className="text-sm mt-3" style={{ color: C.dim }}>
            Each day of the cycle ties up {money(target.cashPerDay)}. Closing the gap to
            the median would free{" "}
            <span className="font-mono" style={{ color: totalRelease > 0 ? C.pos : C.neg }}>
              {money(totalRelease)}
            </span>{" "}
            of cash without selling anything more.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            ["Days sales outstanding", target.dso, med.dso, "lower"],
            ["Days inventory", target.dio, med.dio, "lower"],
            ["Days payable", target.dpo, med.dpo, "higher"],
            ["Net working capital", target.nwcPctRev, null, null],
          ].map(([label, v, m, better]) => {
            const good = m === null ? null :
              better === "lower" ? v <= m : v >= m;
            return (
              <div key={label} className="p-4" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
                <p className="text-xs mb-2" style={{ color: C.dim }}>{label}</p>
                <p className="font-mono text-xl">
                  {v.toFixed(0)}{m === null ? "% of revenue" : " d"}
                </p>
                {m !== null && (
                  <p className="font-mono text-xs mt-1"
                    style={{ color: good ? C.pos : C.neg }}>
                    {v > m ? "+" : "−"}{Math.abs(v - m).toFixed(0)} d vs median
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="p-5" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
            <h2 className="text-sm mb-4" style={{ color: C.dim }}>
              Cycle composition — payables run below the line because they fund the business
            </h2>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} stackOffset="sign"
                  margin={{ top: 5, right: 10, bottom: 30, left: 0 }}>
                  <CartesianGrid stroke={C.rule} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.dim }}
                    angle={-25} textAnchor="end" interval={0} stroke={C.rule} />
                  <YAxis tick={{ fontSize: 11, fill: C.dim }} stroke={C.rule}
                    tickFormatter={(v) => `${v}d`} />
                  <Tooltip formatter={(v) => `${Math.abs(v)} days`}
                    contentStyle={{ background: C.card, border: `1px solid ${C.rule}`, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={0} stroke={C.ink} />
                  <Bar dataKey="DSO" stackId="c" fill={C.ink} name="Receivables" />
                  <Bar dataKey="DIO" stackId="c" fill={C.mark} name="Inventory" />
                  <Bar dataKey="DPO" stackId="c" fill={C.pos} name="Payables" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-5" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
            <h2 className="text-sm mb-4" style={{ color: C.dim }}>
              Cycle length against working capital intensity
            </h2>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 5, right: 20, bottom: 30, left: 0 }}>
                  <CartesianGrid stroke={C.rule} />
                  <XAxis type="number" dataKey="x" name="CCC" unit="d"
                    tick={{ fontSize: 11, fill: C.dim }} stroke={C.rule}
                    label={{ value: "Cash conversion cycle (days)", position: "insideBottom",
                      offset: -18, style: { fontSize: 11, fill: C.dim } }} />
                  <YAxis type="number" dataKey="y" name="NWC" unit="%"
                    tick={{ fontSize: 11, fill: C.dim }} stroke={C.rule} />
                  <ZAxis type="number" dataKey="z" range={[60, 400]} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{ background: C.card, border: `1px solid ${C.rule}`, fontSize: 12 }}
                    formatter={(v, n) => [v, n]}
                    labelFormatter={() => ""} />
                  <ReferenceLine x={0} stroke={C.ink} />
                  <Scatter data={scatter}>
                    {scatter.map((s) => (
                      <Cell key={s.name} fill={s.name === focus ? C.mark : C.ink}
                        fillOpacity={s.name === focus ? 1 : 0.45} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs mt-2" style={{ color: C.dim }}>
              Bubble size is revenue. {target.name} is highlighted.
            </p>
          </div>
        </div>

        <div className="p-5 mb-6" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
          <div className="flex justify-between items-baseline mb-4 flex-wrap gap-3">
            <h2 className="text-sm" style={{ color: C.dim }}>All companies</h2>
            <div className="flex gap-2">
              {sectors.map((s) => (
                <button key={s} onClick={() => setSector(s)}
                  className="px-2 py-1 text-xs"
                  style={{
                    background: s === sector ? C.mark : "transparent",
                    color: s === sector ? C.card : C.dim,
                    border: `1px solid ${s === sector ? C.mark : C.rule}`,
                  }}>{s}</button>
              ))}
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: C.dim, borderBottom: `1px solid ${C.rule}` }}>
                <th className="text-left font-normal py-2">Company</th>
                <th className="text-right font-normal">Revenue</th>
                <th className="text-right font-normal">DSO</th>
                <th className="text-right font-normal">DIO</th>
                <th className="text-right font-normal">DPO</th>
                <th className="text-right font-normal">CCC</th>
                <th className="text-right font-normal">NWC</th>
                <th className="text-right font-normal">NWC / revenue</th>
              </tr>
            </thead>
            <tbody>
              {peers.sort((a, b) => a.ccc - b.ccc).map((c) => (
                <tr key={c.id} onClick={() => setFocus(c.id)}
                  className="cursor-pointer"
                  style={{
                    borderBottom: `1px solid ${C.rule}`,
                    background: c.id === focus ? "rgba(176,136,20,0.10)" : "transparent",
                  }}>
                  <td className="py-2">{c.name}</td>
                  <td className="text-right font-mono">{money(c.revenue)}</td>
                  <td className="text-right font-mono">{c.dso.toFixed(0)}</td>
                  <td className="text-right font-mono">{c.dio.toFixed(0)}</td>
                  <td className="text-right font-mono">{c.dpo.toFixed(0)}</td>
                  <td className="text-right font-mono"
                    style={{ color: c.ccc < 0 ? C.pos : c.ccc > med.ccc ? C.neg : C.ink }}>
                    {c.ccc.toFixed(0)}
                  </td>
                  <td className="text-right font-mono">{money(c.nwc)}</td>
                  <td className="text-right font-mono">{c.nwcPctRev.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-5" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
          <h2 className="text-sm mb-3" style={{ color: C.dim }}>
            Where {target.name}'s cash would come from
          </h2>
          <table className="w-full text-sm">
            <tbody>
              {[
                ["Collect receivables at the median pace", release.ar, `${target.dso.toFixed(0)}d → ${med.dso.toFixed(0)}d`],
                ["Hold inventory at the median pace", release.inv, `${target.dio.toFixed(0)}d → ${med.dio.toFixed(0)}d`],
                ["Pay suppliers at the median pace", release.ap, `${target.dpo.toFixed(0)}d → ${med.dpo.toFixed(0)}d`],
              ].map(([l, v, note]) => (
                <tr key={l} style={{ borderBottom: `1px solid ${C.rule}` }}>
                  <td className="py-2">{l}</td>
                  <td className="text-right font-mono text-xs" style={{ color: C.dim }}>{note}</td>
                  <td className="text-right font-mono" style={{ color: v >= 0 ? C.pos : C.neg }}>
                    {money(v)}
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: `2px solid ${C.ink}` }}>
                <td className="py-2">One-time cash release</td>
                <td />
                <td className="text-right font-mono"
                  style={{ color: totalRelease >= 0 ? C.pos : C.neg }}>{money(totalRelease)}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs mt-4" style={{ color: C.dim }}>
            This is a one-time release, not recurring earnings. Stretching payables also
            costs supplier goodwill and any early-payment discount.
          </p>
        </div>
      </div>
    </div>
  );
}
