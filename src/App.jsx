import { useState } from "react";

import CreditCard from "./tools/01-credit-card-rewards-optimizer.jsx";
import Mortgage from "./tools/02-mortgage-payment-simulator.jsx";
import Currency from "./tools/03-currency-exposure-calculator.jsx";
import RevenueGrowth from "./tools/04-revenue-growth-decomposer.jsx";
import WorkingCapital from "./tools/05-working-capital-analyzer.jsx";
import UnitEconomics from "./tools/06-unit-economics-dashboard.jsx";
import StockSplits from "./tools/07-stock-split-history-explorer.jsx";
import RateSensitivity from "./tools/08-interest-rate-sensitivity-tool.jsx";
import WCForecast from "./tools/09-working-capital-forecast.jsx";
import RatioBenchmark from "./tools/10-financial-ratio-benchmarking-tool.jsx";

const C = {
  paper: "#EDEFF0", card: "#F7F8F8", ink: "#16232B",
  dim: "#5C7078", rule: "#C7CFD2", mark: "#B08814",
};

const TOOLS = [
  { id: "unit",     label: "Unit economics",       Component: UnitEconomics },
  { id: "revenue",  label: "Revenue growth",       Component: RevenueGrowth },
  { id: "ratio",    label: "Ratio benchmarking",   Component: RatioBenchmark },
  { id: "rates",    label: "Rate sensitivity",     Component: RateSensitivity },
  { id: "wc",       label: "Working capital",      Component: WorkingCapital },
  { id: "wcf",      label: "Cash forecast",        Component: WCForecast },
  { id: "fx",       label: "Currency exposure",    Component: Currency },
  { id: "splits",   label: "Stock splits",         Component: StockSplits },
];

export default function App() {
  const [active, setActive] = useState("unit");
  const Active = TOOLS.find((t) => t.id === active).Component;

  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <nav className="px-4 py-3" style={{ background: C.ink }}>
        <p className="font-serif text-lg mb-3" style={{ color: C.paper }}>
          Financial analysis toolkit
        </p>
        <div className="flex flex-wrap gap-2">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className="px-3 py-2 text-sm"
              style={{
                background: t.id === active ? C.mark : "transparent",
                color: t.id === active ? C.ink : C.paper,
                border: `1px solid ${t.id === active ? C.mark : C.dim}`,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>
      <Active />
    </div>
  );
}
