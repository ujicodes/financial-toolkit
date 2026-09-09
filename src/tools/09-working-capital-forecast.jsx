/**
 * 09 — Working Capital Forecast
 * Forecast future cash needs using revenue growth, collection periods,
 * inventory turnover, and payment terms.
 *
 * Spec tech: Next.js, Python, PostgreSQL
 * This build: React + Recharts. `forecast()` is the Python service function;
 * the monthly rows it returns are exactly the shape you'd persist to the
 * `wc_forecast` table (scenario_id, month, revenue, ar, inventory, ap, cash).
 */
import { useState, useMemo } from "react";
import {
  ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";

const C = {
  paper: "#EDEFF0", card: "#F7F8F8", ink: "#16232B", dim: "#5C7078",
  rule: "#C7CFD2", pos: "#1F5F4E", neg: "#A3341F", mark: "#B08814",
};

const money = (n) =>
  (n < 0 ? "−" : "") + "$" + Math.abs(Math.round(n)).toLocaleString("en-US") + "k";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Seasonality index by month — sums to 12, so a flat year is all 1.0.
const SEASONS = {
  even:    Array(12).fill(1),
  retail:  [0.72,0.70,0.82,0.86,0.92,0.95,0.90,0.98,1.05,1.20,1.55,2.35].map((v,_,a)=>v*12/a.reduce((s,x)=>s+x,0)),
  summer:  [0.65,0.62,0.78,0.95,1.25,1.55,1.70,1.55,1.15,0.85,0.52,0.43].map((v,_,a)=>v*12/a.reduce((s,x)=>s+x,0)),
  b2b:     [0.85,0.88,1.18,0.90,0.92,1.22,0.88,0.86,1.20,0.92,0.94,1.25].map((v,_,a)=>v*12/a.reduce((s,x)=>s+x,0)),
};

/**
 * Monthly cash forecast. The key mechanic: revenue is recognized when billed,
 * but cash lands DSO days later, while inventory is bought DIO days ahead and
 * paid DPO days after that. Growth widens all three gaps at once — which is why
 * fast-growing profitable companies run out of money.
 */
function forecast(a) {
  const rows = [];
  let cash = a.openingCash;
  let ar = 0, inv = 0, ap = 0;
  const season = SEASONS[a.season];

  for (let m = 0; m < a.months; m++) {
    const monthIdx = m % 12;
    const yearFactor = Math.pow(1 + a.growth / 100, m / 12);
    const revenue = a.baseMonthlyRevenue * yearFactor * season[monthIdx];
    const cogs = revenue * (1 - a.grossMargin / 100);

    // Balances implied by the policy days, on this month's run rate.
    const arNew = (revenue * 12 / 365) * a.dso;
    const invNew = (cogs * 12 / 365) * a.dio;
    const apNew = (cogs * 12 / 365) * a.dpo;

    const dAR = arNew - ar;
    const dInv = invNew - inv;
    const dAP = apNew - ap;
    const dNWC = dAR + dInv - dAP;

    const opex = revenue * (a.opexPct / 100) + a.fixedOpex;
    const ebitda = revenue - cogs - opex;
    const tax = Math.max(0, ebitda - a.depreciation) * (a.taxRate / 100);
    const capex = a.capexPct / 100 * revenue;

    const operatingCash = ebitda - tax - dNWC;
    const freeCash = operatingCash - capex;

    cash += freeCash;
    ar = arNew; inv = invNew; ap = apNew;

    rows.push({
      i: m,
      label: `${MONTHS[monthIdx]} ${26 + Math.floor(m / 12)}`,
      revenue, cogs, ebitda, ar, inv, ap,
      nwc: ar + inv - ap,
      dNWC, operatingCash, freeCash, capex, tax,
      cash,
      revolver: cash < a.minCash ? a.minCash - cash : 0,
    });
  }

  const trough = rows.reduce((a2, b) => (b.cash < a2.cash ? b : a2), rows[0]);
  const peakNeed = Math.max(...rows.map((r) => r.revolver));
  const firstBreach = rows.find((r) => r.cash < a.minCash);

  return { rows, trough, peakNeed, firstBreach };
}

function Ctl({ label, value, onChange, min, max, step, suffix = "", prefix = "", hint }) {
  return (
    <label className="block mb-4">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-sm">{label}</span>
        <span className="text-sm font-mono" style={{ color: C.dim }}>
          {prefix}{value.toLocaleString("en-US")}{suffix}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full" style={{ accentColor: C.ink }} />
      {hint && <p className="text-xs mt-1" style={{ color: C.dim }}>{hint}</p>}
    </label>
  );
}

export default function WorkingCapitalForecast() {
  const [a, setA] = useState({
    baseMonthlyRevenue: 1400, growth: 45, grossMargin: 38,
    dso: 52, dio: 68, dpo: 34,
    opexPct: 18, fixedOpex: 210, capexPct: 4, taxRate: 24, depreciation: 45,
    openingCash: 2200, minCash: 750, months: 36, season: "retail",
  });
  const set = (k) => (v) => setA((s) => ({ ...s, [k]: v }));
  const f = useMemo(() => forecast(a), [a]);

  const chartData = f.rows.map((r) => ({
    label: r.label,
    Cash: Math.round(r.cash),
    Revenue: Math.round(r.revenue),
    "Working capital": Math.round(r.nwc),
    "Free cash flow": Math.round(r.freeCash),
  }));

  const ccc = a.dso + a.dio - a.dpo;
  const totalFcf = f.rows.reduce((s, r) => s + r.freeCash, 0);
  const totalEbitda = f.rows.reduce((s, r) => s + r.ebitda, 0);
  const wcAbsorbed = f.rows.reduce((s, r) => s + r.dNWC, 0);

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ background: C.paper, color: C.ink }}>
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 pb-5" style={{ borderBottom: `1px solid ${C.rule}` }}>
          <h1 className="text-3xl font-serif tracking-tight">Working capital forecast</h1>
          <p className="mt-2 text-sm max-w-2xl" style={{ color: C.dim }}>
            Profitable companies fail on timing. Every extra dollar of revenue has to be
            funded before it is collected — this projects how deep that hole gets and in
            which month you'd have to draw on a facility.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <aside className="lg:col-span-1">
            <h2 className="text-sm mb-4" style={{ color: C.dim }}>Business</h2>
            <Ctl label="Monthly revenue today" value={a.baseMonthlyRevenue}
              onChange={set("baseMonthlyRevenue")} min={100} max={20000} step={50}
              prefix="$" suffix="k" />
            <Ctl label="Annual growth" value={a.growth} onChange={set("growth")}
              min={-20} max={150} step={5} suffix="%" />
            <Ctl label="Gross margin" value={a.grossMargin} onChange={set("grossMargin")}
              min={5} max={90} step={1} suffix="%" />

            <div className="mb-5">
              <p className="text-sm mb-2">Seasonality</p>
              <div className="flex flex-wrap gap-2">
                {[["even","Flat"],["retail","Holiday peak"],["summer","Summer peak"],["b2b","Quarter-end"]].map(([k,l]) => (
                  <button key={k} onClick={() => set("season")(k)}
                    className="px-2 py-1 text-xs"
                    style={{
                      background: a.season === k ? C.mark : "transparent",
                      color: a.season === k ? C.card : C.dim,
                      border: `1px solid ${a.season === k ? C.mark : C.rule}`,
                    }}>{l}</button>
                ))}
              </div>
            </div>

            <h2 className="text-sm mb-4 mt-6 pt-6" style={{ color: C.dim, borderTop: `1px solid ${C.rule}` }}>
              Cash cycle policy
            </h2>
            <Ctl label="Days to collect" value={a.dso} onChange={set("dso")}
              min={0} max={150} step={1} suffix=" d" />
            <Ctl label="Days of inventory" value={a.dio} onChange={set("dio")}
              min={0} max={200} step={1} suffix=" d" />
            <Ctl label="Days to pay suppliers" value={a.dpo} onChange={set("dpo")}
              min={0} max={150} step={1} suffix=" d"
              hint={`Cash conversion cycle: ${ccc} days`} />

            <h2 className="text-sm mb-4 mt-6 pt-6" style={{ color: C.dim, borderTop: `1px solid ${C.rule}` }}>
              Cash and cost
            </h2>
            <Ctl label="Opening cash" value={a.openingCash} onChange={set("openingCash")}
              min={0} max={30000} step={100} prefix="$" suffix="k" />
            <Ctl label="Minimum cash to operate" value={a.minCash} onChange={set("minCash")}
              min={0} max={5000} step={50} prefix="$" suffix="k" />
            <Ctl label="Variable opex" value={a.opexPct} onChange={set("opexPct")}
              min={0} max={50} step={1} suffix="% of revenue" />
            <Ctl label="Fixed opex" value={a.fixedOpex} onChange={set("fixedOpex")}
              min={0} max={3000} step={10} prefix="$" suffix="k/mo" />
            <Ctl label="Capex" value={a.capexPct} onChange={set("capexPct")}
              min={0} max={20} step={0.5} suffix="% of revenue" />
            <Ctl label="Forecast length" value={a.months} onChange={set("months")}
              min={12} max={60} step={6} suffix=" months" />
          </aside>

          <main className="lg:col-span-2">
            <div className="p-6 mb-6" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
              <p className="text-sm mb-1" style={{ color: C.dim }}>
                {f.peakNeed > 0 ? "Peak external funding required" : "Lowest cash balance"}
              </p>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-5xl font-serif"
                  style={{ color: f.peakNeed > 0 ? C.neg : C.pos }}>
                  {money(f.peakNeed > 0 ? f.peakNeed : f.trough.cash)}
                </span>
                <span className="text-sm" style={{ color: C.dim }}>
                  {f.peakNeed > 0
                    ? `first needed in ${f.firstBreach.label}, deepest around ${f.trough.label}`
                    : `in ${f.trough.label}, never below the ${money(a.minCash)} floor`}
                </span>
              </div>
              <p className="text-sm mt-3" style={{ color: C.dim }}>
                Over {a.months} months the business earns {money(totalEbitda)} of EBITDA but
                working capital absorbs {money(wcAbsorbed)} of it, leaving{" "}
                <span className="font-mono" style={{ color: totalFcf >= 0 ? C.pos : C.neg }}>
                  {money(totalFcf)}
                </span>{" "}
                of free cash flow. Every day you shave off the {ccc}-day cycle releases
                roughly {money(f.rows[f.rows.length - 1].revenue * 12 / 365)} at the ending
                run rate.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                ["Cash conversion cycle", `${ccc} d`, ccc < 45],
                ["Ending cash", money(f.rows[f.rows.length - 1].cash), f.rows[f.rows.length - 1].cash > a.minCash],
                ["Ending working capital", money(f.rows[f.rows.length - 1].nwc), null],
                ["Cumulative free cash flow", money(totalFcf), totalFcf > 0],
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
                Cash balance against the minimum operating floor
              </h2>
              <div style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 40, left: 10 }}>
                    <CartesianGrid stroke={C.rule} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.dim }} stroke={C.rule}
                      angle={-45} textAnchor="end" interval={2} height={60} />
                    <YAxis tick={{ fontSize: 11, fill: C.dim }} stroke={C.rule}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(1)}M`} />
                    <Tooltip formatter={(v) => money(v)}
                      contentStyle={{ background: C.card, border: `1px solid ${C.rule}`, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine y={a.minCash} stroke={C.neg} strokeDasharray="5 4"
                      label={{ value: "minimum cash", fill: C.neg, fontSize: 10, position: "insideTopLeft" }} />
                    <ReferenceLine y={0} stroke={C.ink} />
                    <Bar dataKey="Free cash flow" fill={C.rule} />
                    <Area type="monotone" dataKey="Working capital" stroke={C.mark}
                      fill={C.mark} fillOpacity={0.10} strokeWidth={1.5} />
                    <Line type="monotone" dataKey="Cash" stroke={C.ink} strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs mt-3" style={{ color: C.dim }}>
                The gold band is capital locked in receivables and inventory net of what
                suppliers are financing. When it climbs faster than cash generation, the
                black line falls through the red floor.
              </p>
            </div>

            <div className="p-5" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
              <h2 className="text-sm mb-3" style={{ color: C.dim }}>
                Monthly detail — every third month
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ color: C.dim, borderBottom: `1px solid ${C.rule}` }}>
                      <th className="text-left font-normal py-2">Month</th>
                      <th className="text-right font-normal">Revenue</th>
                      <th className="text-right font-normal">Receivables</th>
                      <th className="text-right font-normal">Inventory</th>
                      <th className="text-right font-normal">Payables</th>
                      <th className="text-right font-normal">Δ WC</th>
                      <th className="text-right font-normal">Free cash</th>
                      <th className="text-right font-normal">Cash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.rows.filter((r) => r.i % 3 === 0).map((r) => (
                      <tr key={r.i} style={{
                        borderBottom: `1px solid ${C.rule}`,
                        background: r.cash < a.minCash ? "rgba(163,52,31,0.07)" : "transparent",
                      }}>
                        <td className="py-2">{r.label}</td>
                        <td className="text-right font-mono">{money(r.revenue)}</td>
                        <td className="text-right font-mono">{money(r.ar)}</td>
                        <td className="text-right font-mono">{money(r.inv)}</td>
                        <td className="text-right font-mono">{money(r.ap)}</td>
                        <td className="text-right font-mono"
                          style={{ color: r.dNWC > 0 ? C.neg : C.pos }}>{money(-r.dNWC)}</td>
                        <td className="text-right font-mono"
                          style={{ color: r.freeCash >= 0 ? C.pos : C.neg }}>{money(r.freeCash)}</td>
                        <td className="text-right font-mono"
                          style={{ color: r.cash < a.minCash ? C.neg : C.ink }}>{money(r.cash)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs mt-4" style={{ color: C.dim }}>
                Δ WC is shown as its cash effect, so a negative number means working capital
                grew and consumed cash. Shaded rows fall below the operating floor.
              </p>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
