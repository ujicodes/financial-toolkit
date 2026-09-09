# Financial analysis toolkit

Eight interactive financial analysis tools with a shared visual system, built in
React. Every figure is computed live from the inputs — no static screenshots, no
hardcoded results.

**Live: https://financial-toolkit-gilt.vercel.app**

| Tool | What it computes |
|------|------------------|
| Unit economics | CAC, contribution margin, discounted LTV, LTV:CAC, and the month a cohort crosses back above zero |
| Revenue growth | Additive bridge across churn, contraction, price, expansion and new business; gross and net revenue retention |
| Ratio benchmarking | 15 ratios in five families, percentile-ranked against a selectable peer set |
| Rate sensitivity | Interest expense across a fixed/floating debt stack, coverage, free cash flow and DCF valuation, swept across the rate curve |
| Working capital | DSO, DIO, DPO and cash conversion cycle across companies; cash releasable by hitting peer medians |
| Cash forecast | Monthly AR/inventory/AP projection with seasonality; peak funding need against a minimum-cash floor |
| Currency exposure | Translation impact on revenue, cost and operating profit by currency, with hedge coverage and natural-hedge identification |
| Stock splits | Cumulative split factors, raw vs split-adjusted price restatement, event-window returns |

Two further tools (mortgage simulator, credit card rewards optimizer) are in
`src/tools` but not wired into the live navigation.

## Design system

Shared across every tool, defined as the `C` object at the top of each file.

| Token | Hex | Use |
|---|---|---|
| paper | `#EDEFF0` | page ground |
| card | `#F7F8F8` | panel fill |
| ink | `#16232B` | text, primary series |
| dim | `#5C7078` | labels, secondary text |
| rule | `#C7CFD2` | hairlines, gridlines |
| pos | `#1F5F4E` | favorable values |
| neg | `#A3341F` | unfavorable values |
| mark | `#B08814` | selected state |

Green and red encode direction rather than decorate. Serif carries the single
headline figure each tool exists to answer; monospace is used only for numerals
so digits align in tables.

## Running locally

```bash
npm install
npm run dev
```

Built with React, Vite, Recharts and Tailwind CSS.

## Data

The company financials are constructed, not real filings — they exist to
demonstrate the calculations. The one exception is the stock split tool, where
the split dates and ratios are the actual public record but the price series is
a seeded synthetic walk; that file carries an inline warning and the yfinance
snippet needed to replace it.
