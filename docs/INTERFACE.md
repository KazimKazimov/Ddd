# The interface

All of this is in `src/page.html`. Hover over any control, number or chart for an explanation. On a phone, tap its label or an ⓘ.

## Header

- **Data badge.** Says whether the page runs on the mock universe or on a loaded file.
- **Load a data file.** Loads a JSON file for this browser tab. **Back to mock data** drops it.

## Top strip

Expected alpha, tracking error, beta and turnover of the proposal, each against its limit. It stays visible while you scroll.

## Limits panel

| Section | Controls |
|---|---|
| Presets | Cautious, Balanced, Bold. |
| Portfolio | Size in $ bn, and the cash rate (SOFR). |
| Risk, positions and scenarios | Basis for active limits (market value % or CTDTS). Sliders: tracking error, turnover, beta minimum and maximum, country, region, quality and type active limits, cash minimum and maximum, bull-case and bear-case alpha floors, single-name cap, trading cost. |
| Keep unchanged | Tick boxes to hold tracking error and beta at today's level. |
| Bull and bear move | Where it applies (missing scenarios only, or every bond). Size as standard deviations or a percentile. Distribution from the bond itself, its country, or its rating. |
| Macro factor limits | A minimum and a maximum for each factor, in bp of alpha per +1 std. |
| Minimum trade size | In CTDTS and in $ mio. Both must be met. |
| Small positions | Sell country holdings below a threshold in market value % or CTDTS. |
| Overrides | The list of held and excluded positions. Tap one to remove it. |

Any change re-solves in about a second.

## Current vs proposed

A table of every risk number for today's portfolio and the proposal, against its limit. Below it, **What is holding alpha back** ranks the binding limits by the alpha gained from loosening each one step.

## Tabs

A measure switch (market value %, DTS, DTS ratio, CTDTS) applies to Trades, Exposures and Positions.

| Tab | What it shows |
|---|---|
| Trades | Buys and sells, grouped by region, rating, duration, type, country, bucket or bond. |
| Selection | Trades ranked by attractiveness, with tick boxes. Unticking updates the statistics; Redistribute re-solves without the unticked trades. |
| Frontier | Best alpha at each tracking error limit, with today's portfolio, the proposal and the index marked. Tap the curve to move the limit. |
| Exposures | Active positions by region, rating, duration, type and country, with the limit on each side. Then macro factor exposures and the largest single-name scenario losses. |
| Macro | Macro factor exposures, and for a chosen factor the five best trades to raise it and to lower it. |
| Positions | A sortable table at any level, including the minimum and maximum allowed position for countries and bonds. |

## Drill-down

Tap any row to open it: bucket (region, rating, duration, type) → country → type or duration → bond.

Each level shows:

- the **override control** (Free, Hold, Exclude),
- the position in all four measures,
- for a country or a bond, **Limits on this position**: the allowed range, today's and the proposed position, and which limit sets each end.

The bond view adds its analytics, expected return against the index and against cash, its scenarios, and the bull and bear outcomes the limits use.
