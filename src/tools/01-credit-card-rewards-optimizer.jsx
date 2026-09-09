/**
 * 01 — Credit Card Rewards Optimizer
 * Compare cards, spending categories, annual fees, and rewards to determine
 * which card generates the most value.
 *
 * Spec tech: React, Python, SQLite
 * This build: React (UI + optimizer). The card table below is the SQLite
 * `cards` / `card_multipliers` schema flattened into a literal; swap
 * CARDS for a fetch('/api/cards') call against the Python service.
 */
import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const C = {
  paper: "#EDEFF0", card: "#F7F8F8", ink: "#16232B", dim: "#5C7078",
  rule: "#C7CFD2", pos: "#1F5F4E", neg: "#A3341F", mark: "#B08814",
};

const CATS = [
  { key: "groceries", label: "Groceries", start: 550 },
  { key: "dining", label: "Dining and takeout", start: 400 },
  { key: "gas", label: "Gas and transit", start: 180 },
  { key: "travel", label: "Travel", start: 250 },
  { key: "online", label: "Online retail", start: 300 },
  { key: "other", label: "Everything else", start: 600 },
];

// Multipliers are points-per-dollar. cpp = cents per point when redeemed.
const CARDS = [
  { id: "flat2", name: "Flat-Rate 2%", fee: 0, bonus: 200, cpp: 1.0,
    mult: { groceries: 2, dining: 2, gas: 2, travel: 2, online: 2, other: 2 } },
  { id: "grocery", name: "Grocery Preferred", fee: 95, bonus: 250, cpp: 1.0,
    mult: { groceries: 6, dining: 1, gas: 3, travel: 1, online: 1, other: 1 } },
  { id: "dining", name: "Dining and Travel", fee: 95, bonus: 600, cpp: 1.25,
    mult: { groceries: 1, dining: 4, gas: 1, travel: 3, online: 1, other: 1 } },
  { id: "premium", name: "Premium Travel", fee: 550, bonus: 1200, cpp: 1.5,
    mult: { groceries: 1, dining: 3, gas: 1, travel: 5, online: 1, other: 1 },
    credits: 300, creditNote: "annual travel credit" },
  { id: "rotate", name: "Rotating 5%", fee: 0, bonus: 200, cpp: 1.0,
    mult: { groceries: 5, dining: 5, gas: 5, travel: 1, online: 5, other: 1 },
    cap: 1500, capNote: "5x capped at $1,500/quarter combined" },
  { id: "online", name: "Online Retail Card", fee: 0, bonus: 150, cpp: 1.0,
    mult: { groceries: 3, dining: 1, gas: 1, travel: 1, online: 5, other: 1 } },
];

const usd = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Annualized value of a card given monthly spend, net of fee, plus credits. */
function evaluate(card, spend, horizonYears) {
  let capLeft = card.cap ? card.cap * 4 : Infinity; // annual room at the bonus rate
  const rows = CATS.map((c) => {
    const annual = spend[c.key] * 12;
    const rate = card.mult[c.key];
    let pts;
    if (card.cap && rate > 1) {
      const atBonus = Math.min(annual, capLeft);
      capLeft -= atBonus;
      pts = atBonus * rate + (annual - atBonus) * 1;
    } else {
      pts = annual * rate;
    }
    return { cat: c.label, key: c.key, spend: annual, rate, value: (pts * card.cpp) / 100 };
  });
  const earn = rows.reduce((s, r) => s + r.value, 0);
  const credits = card.credits || 0;
  const bonusValue = (card.bonus * card.cpp) / 100 / horizonYears; // amortized
  const net = earn + credits + bonusValue - card.fee;
  return { rows, earn, credits, bonusValue, net, card };
}

function Slider({ label, value, onChange }) {
  return (
    <label className="block mb-4">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-sm" style={{ color: C.ink }}>{label}</span>
        <span className="text-sm font-mono" style={{ color: C.dim }}>{usd(value)}/mo</span>
      </div>
      <input
        type="range" min="0" max="3000" step="25" value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full" style={{ accentColor: C.ink }}
      />
    </label>
  );
}

export default function CreditCardRewardsOptimizer() {
  const [spend, setSpend] = useState(
    Object.fromEntries(CATS.map((c) => [c.key, c.start]))
  );
  const [horizon, setHorizon] = useState(2);
  const [selected, setSelected] = useState("premium");

  const results = useMemo(
    () => CARDS.map((c) => evaluate(c, spend, horizon)).sort((a, b) => b.net - a.net),
    [spend, horizon]
  );

  const best = results[0];
  const runnerUp = results[1];
  const detail = results.find((r) => r.card.id === selected) || best;

  const totalSpend = CATS.reduce((s, c) => s + spend[c.key], 0) * 12;

  // Best two-card pairing: each category routed to whichever of the pair pays more.
  const pair = useMemo(() => {
    let top = null;
    for (let i = 0; i < CARDS.length; i++) {
      for (let j = i + 1; j < CARDS.length; j++) {
        const a = CARDS[i], b = CARDS[j];
        let earn = 0;
        CATS.forEach((c) => {
          const annual = spend[c.key] * 12;
          const va = annual * a.mult[c.key] * a.cpp / 100;
          const vb = annual * b.mult[c.key] * b.cpp / 100;
          earn += Math.max(va, vb);
        });
        const net = earn + (a.credits || 0) + (b.credits || 0)
          + (a.bonus * a.cpp / 100 + b.bonus * b.cpp / 100) / horizon
          - a.fee - b.fee;
        if (!top || net > top.net) top = { a, b, net };
      }
    }
    return top;
  }, [spend, horizon]);

  const chartData = results.map((r) => ({
    name: r.card.name, net: Math.round(r.net), id: r.card.id,
  }));

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ background: C.paper, color: C.ink }}>
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 pb-5" style={{ borderBottom: `1px solid ${C.rule}` }}>
          <h1 className="text-3xl font-serif tracking-tight">Credit card rewards optimizer</h1>
          <p className="mt-2 text-sm max-w-xl" style={{ color: C.dim }}>
            Set your monthly spending. Every card is scored on rewards earned at its own
            point value, net of annual fee, with the signup bonus spread across your
            expected holding period.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Assumptions rail */}
          <aside className="lg:col-span-1">
            <h2 className="text-sm mb-4" style={{ color: C.dim }}>Monthly spending</h2>
            {CATS.map((c) => (
              <Slider key={c.key} label={c.label} value={spend[c.key]}
                onChange={(v) => setSpend((s) => ({ ...s, [c.key]: v }))} />
            ))}
            <div className="pt-4 mt-2" style={{ borderTop: `1px solid ${C.rule}` }}>
              <div className="flex justify-between text-sm mb-3">
                <span>Annual spend</span>
                <span className="font-mono">{usd(totalSpend)}</span>
              </div>
              <label className="block">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-sm">Years you'll keep the card</span>
                  <span className="text-sm font-mono" style={{ color: C.dim }}>{horizon}</span>
                </div>
                <input type="range" min="1" max="10" step="1" value={horizon}
                  onChange={(e) => setHorizon(Number(e.target.value))}
                  className="w-full" style={{ accentColor: C.ink }} />
                <p className="text-xs mt-1" style={{ color: C.dim }}>
                  Longer holds dilute the signup bonus and expose the annual fee.
                </p>
              </label>
            </div>
          </aside>

          {/* Results field */}
          <main className="lg:col-span-2">
            <div className="p-6 mb-6" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
              <p className="text-sm mb-1" style={{ color: C.dim }}>Highest net value</p>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-5xl font-serif" style={{ color: C.pos }}>
                  {usd(best.net)}
                </span>
                <span className="text-sm" style={{ color: C.dim }}>per year on</span>
                <span className="text-lg font-serif">{best.card.name}</span>
              </div>
              <p className="text-sm mt-3" style={{ color: C.dim }}>
                It beats {runnerUp.card.name} by {usd(best.net - runnerUp.net)} a year.
                {best.card.fee > 0 && best.earn > 0 && totalSpend > 0 &&
                  ` The ${usd(best.card.fee)} fee is covered — you'd need ${usd(
                    best.card.fee / (best.earn / totalSpend)
                  )} of annual spend to break even on it.`}
              </p>
            </div>

            <div className="p-5 mb-6" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
              <h2 className="text-sm mb-4" style={{ color: C.dim }}>
                Net annual value by card — click a bar for the breakdown
              </h2>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 40, left: 0 }}>
                    <CartesianGrid stroke={C.rule} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.dim }}
                      angle={-20} textAnchor="end" interval={0} stroke={C.rule} />
                    <YAxis tick={{ fontSize: 11, fill: C.dim }} stroke={C.rule}
                      tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(v) => usd(v)}
                      contentStyle={{ background: C.card, border: `1px solid ${C.rule}`, fontSize: 12 }} />
                    <Bar dataKey="net" onClick={(d) => setSelected(d.id)} cursor="pointer">
                      {chartData.map((d) => (
                        <Cell key={d.id}
                          fill={d.id === selected ? C.mark : d.net >= 0 ? C.pos : C.neg} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-5 mb-6" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
              <h2 className="font-serif text-lg mb-1">{detail.card.name}</h2>
              <p className="text-xs mb-4" style={{ color: C.dim }}>
                {usd(detail.card.fee)} annual fee · {detail.card.cpp}¢ per point
                {detail.card.capNote && ` · ${detail.card.capNote}`}
                {detail.card.creditNote && ` · ${usd(detail.card.credits)} ${detail.card.creditNote}`}
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: C.dim, borderBottom: `1px solid ${C.rule}` }}>
                    <th className="text-left font-normal py-2">Category</th>
                    <th className="text-right font-normal">Annual spend</th>
                    <th className="text-right font-normal">Rate</th>
                    <th className="text-right font-normal">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.rows.map((r) => (
                    <tr key={r.key} style={{ borderBottom: `1px solid ${C.rule}` }}>
                      <td className="py-2">{r.cat}</td>
                      <td className="text-right font-mono">{usd(r.spend)}</td>
                      <td className="text-right font-mono">{r.rate}×</td>
                      <td className="text-right font-mono">{usd(r.value)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2">Signup bonus, spread over {horizon} yr</td>
                    <td /><td />
                    <td className="text-right font-mono">{usd(detail.bonusValue)}</td>
                  </tr>
                  {detail.credits > 0 && (
                    <tr>
                      <td className="py-2">Statement credits</td>
                      <td /><td />
                      <td className="text-right font-mono">{usd(detail.credits)}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-2">Annual fee</td>
                    <td /><td />
                    <td className="text-right font-mono" style={{ color: C.neg }}>
                      −{usd(detail.card.fee)}
                    </td>
                  </tr>
                  <tr style={{ borderTop: `2px solid ${C.ink}` }}>
                    <td className="py-2">Net value</td>
                    <td /><td />
                    <td className="text-right font-mono"
                      style={{ color: detail.net >= 0 ? C.pos : C.neg }}>
                      {usd(detail.net)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {pair && (
              <div className="p-5" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
                <h2 className="text-sm mb-2" style={{ color: C.dim }}>Best two-card pairing</h2>
                <p className="font-serif text-lg">
                  {pair.a.name} + {pair.b.name}
                </p>
                <p className="text-sm mt-2" style={{ color: C.dim }}>
                  Routing each category to whichever card pays more returns{" "}
                  <span className="font-mono" style={{ color: C.pos }}>{usd(pair.net)}</span>{" "}
                  a year — {usd(pair.net - best.net)} above the best single card, before
                  the hassle of tracking two statements.
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
