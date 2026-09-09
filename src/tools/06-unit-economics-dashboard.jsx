/**
 * 06 — Unit Economics Dashboard
 * Calculate CAC, LTV, gross margin, payback period, churn, and contribution
 * margin for a business.
 *
 * Spec tech: Next.js, TypeScript, Recharts
 * This build: React + Recharts. Port straight into app/dashboard/page.tsx as a
 * client component; the Inputs and Economics shapes below are the two
 * interfaces you'd declare.
 */
import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend, Area, AreaChart,
} from "recharts";

const C = {
  paper: "#EDEFF0", card: "#F7F8F8", ink: "#16232B", dim: "#5C7078",
  rule: "#C7CFD2", pos: "#1F5F4E", neg: "#A3341F", mark: "#B08814",
};

const usd = (n) =>
  (n < 0 ? "−" : "") + "$" + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 });

/**
 * Cohort economics on a monthly grid.
 * LTV is computed from the discounted retention curve rather than the
 * ARPU/churn shortcut, so it stays honest when churn is high.
 */
function economics(i) {
  const cac = i.newCustomers > 0 ? (i.salesMarketing + i.onboardingCost * i.newCustomers) / i.newCustomers : 0;
  const grossMarginPct = ((i.arpu - i.cogsPerUser) / i.arpu) * 100;
  const contributionPerUser = i.arpu - i.cogsPerUser - i.supportCost;
  const contributionMarginPct = (contributionPerUser / i.arpu) * 100;

  const monthlyDiscount = Math.pow(1 + i.discountRate / 100, 1 / 12) - 1;
  const churn = i.churn / 100;

  const curve = [];
  let survival = 1;
  let cumulative = -cac;
  let ltv = 0;
  let paybackMonth = null;

  for (let m = 1; m <= 60; m++) {
    survival *= 1 - churn;
    const df = Math.pow(1 + monthlyDiscount, -m);
    const contribution = contributionPerUser * survival;
    ltv += contribution * df;
    cumulative += contribution;
    if (paybackMonth === null && cumulative >= 0) paybackMonth = m;
    curve.push({
      month: m,
      retention: Math.round(survival * 1000) / 10,
      cumulative: Math.round(cumulative),
      cac: Math.round(-cac),
      breakeven: 0,
    });
  }

  const ratio = cac > 0 ? ltv / cac : Infinity;
  const avgLifeMonths = churn > 0 ? 1 / churn : Infinity;
  const burnMultiple = i.newCustomers > 0
    ? i.salesMarketing / (i.newCustomers * contributionPerUser * 12) : 0;

  return {
    cac, ltv, ratio, curve, paybackMonth, grossMarginPct,
    contributionPerUser, contributionMarginPct, avgLifeMonths, burnMultiple,
    annualContribution: contributionPerUser * 12,
  };
}

function Ctl({ label, value, onChange, min, max, step, prefix = "", suffix = "", hint }) {
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

function Metric({ label, value, verdict, note }) {
  return (
    <div className="p-4" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
      <p className="text-xs mb-2" style={{ color: C.dim }}>{label}</p>
      <p className="font-mono text-xl"
        style={{ color: verdict === null ? C.ink : verdict ? C.pos : C.neg }}>{value}</p>
      {note && <p className="text-xs mt-1" style={{ color: C.dim }}>{note}</p>}
    </div>
  );
}

export default function UnitEconomicsDashboard() {
  const [i, setI] = useState({
    arpu: 210, cogsPerUser: 46, supportCost: 18, churn: 2.4,
    salesMarketing: 940000, newCustomers: 1350, onboardingCost: 90, discountRate: 12,
  });
  const set = (k) => (v) => setI((s) => ({ ...s, [k]: v }));
  const e = useMemo(() => economics(i), [i]);

  const healthy = e.ratio >= 3;
  const fastPayback = e.paybackMonth !== null && e.paybackMonth <= 12;

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ background: C.paper, color: C.ink }}>
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 pb-5" style={{ borderBottom: `1px solid ${C.rule}` }}>
          <h1 className="text-3xl font-serif tracking-tight">Unit economics dashboard</h1>
          <p className="mt-2 text-sm max-w-2xl" style={{ color: C.dim }}>
            One customer, followed for five years. What they cost to acquire, what they
            contribute each month while they stay, and the month the cohort finally
            crosses back above zero.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <aside className="lg:col-span-1">
            <h2 className="text-sm mb-4" style={{ color: C.dim }}>Revenue and cost per customer</h2>
            <Ctl label="Monthly revenue" value={i.arpu} onChange={set("arpu")}
              min={5} max={2000} step={5} prefix="$" />
            <Ctl label="Cost of service" value={i.cogsPerUser} onChange={set("cogsPerUser")}
              min={0} max={800} step={2} prefix="$"
              hint="Hosting, payment fees, licensed data." />
            <Ctl label="Support and success" value={i.supportCost} onChange={set("supportCost")}
              min={0} max={400} step={2} prefix="$" />
            <Ctl label="Monthly churn" value={i.churn} onChange={set("churn")}
              min={0.2} max={15} step={0.1} suffix="%"
              hint={`Average customer life: ${e.avgLifeMonths === Infinity ? "—" : (e.avgLifeMonths / 12).toFixed(1)} years`} />

            <h2 className="text-sm mb-4 mt-8 pt-6" style={{ color: C.dim, borderTop: `1px solid ${C.rule}` }}>
              Acquisition
            </h2>
            <Ctl label="Sales and marketing spend" value={i.salesMarketing} onChange={set("salesMarketing")}
              min={0} max={5000000} step={10000} prefix="$" suffix=" / period" />
            <Ctl label="Customers acquired" value={i.newCustomers} onChange={set("newCustomers")}
              min={1} max={10000} step={25} />
            <Ctl label="Onboarding cost per customer" value={i.onboardingCost} onChange={set("onboardingCost")}
              min={0} max={2000} step={10} prefix="$" />
            <Ctl label="Discount rate" value={i.discountRate} onChange={set("discountRate")}
              min={0} max={30} step={1} suffix="%"
              hint="Applied to future contribution when computing LTV." />
          </aside>

          <main className="lg:col-span-2">
            <div className="p-6 mb-6" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
              <p className="text-sm mb-1" style={{ color: C.dim }}>Lifetime value to acquisition cost</p>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-5xl font-serif" style={{ color: healthy ? C.pos : C.neg }}>
                  {e.ratio === Infinity ? "∞" : `${e.ratio.toFixed(1)}×`}
                </span>
                <span className="text-sm" style={{ color: C.dim }}>
                  {usd(e.ltv)} of discounted contribution against {usd(e.cac)} to acquire
                </span>
              </div>
              <p className="text-sm mt-3" style={{ color: C.dim }}>
                {healthy
                  ? "Above 3×, which is the level venture investors treat as fundable."
                  : "Below 3×. Either acquisition is too expensive, churn is too high, or price is too low — the curve below shows which."}
                {" "}
                {e.paybackMonth === null
                  ? "The cohort never pays back within five years."
                  : `Payback lands in month ${e.paybackMonth}.`}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Metric label="Customer acquisition cost" value={usd(e.cac)} verdict={null} />
              <Metric label="Payback period"
                value={e.paybackMonth === null ? "never" : `${e.paybackMonth} mo`}
                verdict={fastPayback}
                note={fastPayback ? "inside a year" : "past a year"} />
              <Metric label="Gross margin" value={`${e.grossMarginPct.toFixed(0)}%`}
                verdict={e.grossMarginPct >= 70} />
              <Metric label="Contribution margin" value={`${e.contributionMarginPct.toFixed(0)}%`}
                verdict={e.contributionMarginPct > 0}
                note={`${usd(e.contributionPerUser)}/mo per customer`} />
            </div>

            <div className="p-5 mb-6" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
              <h2 className="text-sm mb-4" style={{ color: C.dim }}>
                Cumulative contribution per customer — the cohort starts in the hole by
                exactly one CAC
              </h2>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={e.curve} margin={{ top: 5, right: 20, bottom: 20, left: 10 }}>
                    <CartesianGrid stroke={C.rule} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.dim }} stroke={C.rule}
                      label={{ value: "Months since acquisition", position: "insideBottom",
                        offset: -12, style: { fontSize: 11, fill: C.dim } }} />
                    <YAxis tick={{ fontSize: 11, fill: C.dim }} stroke={C.rule}
                      tickFormatter={(v) => usd(v)} />
                    <Tooltip formatter={(v) => usd(v)}
                      contentStyle={{ background: C.card, border: `1px solid ${C.rule}`, fontSize: 12 }} />
                    <ReferenceLine y={0} stroke={C.ink} strokeWidth={1.5} />
                    {e.paybackMonth && (
                      <ReferenceLine x={e.paybackMonth} stroke={C.mark} strokeDasharray="4 4"
                        label={{ value: `payback · m${e.paybackMonth}`, fill: C.mark,
                          fontSize: 11, position: "top" }} />
                    )}
                    <Line type="monotone" dataKey="cumulative" name="Cumulative contribution"
                      stroke={C.pos} strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
                <h2 className="text-sm mb-4" style={{ color: C.dim }}>Retention curve</h2>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={e.curve} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid stroke={C.rule} vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.dim }} stroke={C.rule} />
                      <YAxis tick={{ fontSize: 11, fill: C.dim }} stroke={C.rule}
                        tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                      <Tooltip formatter={(v) => `${v}%`}
                        contentStyle={{ background: C.card, border: `1px solid ${C.rule}`, fontSize: 12 }} />
                      <Area type="monotone" dataKey="retention" stroke={C.ink}
                        fill={C.ink} fillOpacity={0.12} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-5" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
                <h2 className="text-sm mb-3" style={{ color: C.dim }}>Per-customer income statement</h2>
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      ["Monthly revenue", i.arpu, C.ink],
                      ["Cost of service", -i.cogsPerUser, C.neg],
                      ["Support and success", -i.supportCost, C.neg],
                    ].map(([l, v, col]) => (
                      <tr key={l} style={{ borderBottom: `1px solid ${C.rule}` }}>
                        <td className="py-2">{l}</td>
                        <td className="text-right font-mono" style={{ color: col }}>{usd(v)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderBottom: `2px solid ${C.ink}` }}>
                      <td className="py-2">Monthly contribution</td>
                      <td className="text-right font-mono"
                        style={{ color: e.contributionPerUser > 0 ? C.pos : C.neg }}>
                        {usd(e.contributionPerUser)}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${C.rule}` }}>
                      <td className="py-2">Annualized</td>
                      <td className="text-right font-mono">{usd(e.annualContribution)}</td>
                    </tr>
                    <tr>
                      <td className="py-2">Lifetime value, discounted</td>
                      <td className="text-right font-mono">{usd(e.ltv)}</td>
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
