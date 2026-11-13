# Decisions, assumptions and open items

Last updated 13 November 2026.

## Decided by Kazim

- **Universe.** About 60 emerging-market countries, each with government, quasi-government and corporate bonds.
- **Two stages.** The optimizer allocates to country × type × quality buckets first, then maps the bucket trades to bonds.
- **Against an index.** Everything is shown against the index: alpha, tracking error, beta, active positions.
- **Risk model.** Covariance of relative spread changes.
- **CTDTS** means contribution to duration times spread.
- **Limits.** Country, region, quality, type, cash, beta, tracking error, turnover; bull-case and bear-case limits (being too underweight a name that rallies loses alpha); macro factor exposure limits with a minimum and a maximum, ±100 bp by default.
- **Cash** earns the SOFR rate.
- **Bull and bear cases.** A 2 standard deviation spread tightening and widening, by default only where a bond has no scenario, with a switch to apply it to every bond. The move can also be a percentile. The distribution can be the bond's own, its country's, or that of similarly rated bonds.
- **Minimum trade size** at bond and country level: at least 5 CTDTS and at least $10 mio. Both must hold. Both editable.
- **Portfolio size** $5 billion by default, editable.
- **Measures.** Every statistic viewable in market value %, DTS, DTS ratio or CTDTS.
- **Buckets in charts.** Region, quality (rating), duration and type.
- **Drill-down.** Bucket → country → maturity or type → bond, with all of a bond's statistics and scenarios.
- **Explanations** on hover for buttons, sliders and charts.
- **Trade selection.** Trades ranked by attractiveness (alpha added ÷ tracking error added), at country or bond level. All selected at the start; unticking a trade leaves its money in cash and updates the statistics. A Redistribute button re-solves without the unticked countries or bonds.
- **Macro factors.** Active exposures in bp of alpha for a 1 std move, recalculated on every change, plus the five best trades to raise or lower each exposure. "Best" means most exposure for the alpha, using single buys and sells.
- **Keep unchanged.** Options to keep beta and tracking error at today's level.
- **Limits shown on both sides** for countries and bonds, including those implied by the bull and bear cases, in every measure.
- **Overrides.** Free, Hold and Exclude at bond level and at every aggregate level.
- **Sell small positions.** An option to sell country exposure below a threshold in market value % or CTDTS.
- **Real data** arrives as an export from MATLAB or Python.

## Assumptions made while building, not yet confirmed

- **Units.** DTS = spread duration × spread in bp. CTDTS = market value % × DTS, so the CTDTS of all positions adds up to portfolio DTS. DTS ratio = portfolio CTDTS ÷ index CTDTS. The "DTS" view of a group is the average DTS of the holdings. On this basis 5 CTDTS is about $14 mio in a bond of average DTS at $5 bn.
- **Size of a standard deviation move.** K × the annual relative spread volatility, applied to the base scenario. Tightening is capped at 90% of the spread. If a shorter horizon was meant, the volatility needs scaling.
- **Percentile moves** assume a lognormal distribution with the same volatility, so the widening is larger than the matching tightening. A real build should read percentiles from history.
- **Scenario-based bull and bear** are the probability-weighted average of the best and worst 25% of a bond's scenario outcomes.
- **Single-name limit.** A cap on the alpha lost if one country alone lands in its bull or bear case. This is the limit that turns into a per-country lower and upper position limit.
- **Minimum trade size at country level** applies to the country's net trade. A switch inside a country with no net trade is allowed. Trades that bring a breached limit back in line are exempt.
- **Small positions** are judged per country. Their sales are exempt from the minimum trade size. Countries that are held are left alone.
- **Maturity level of the drill-down** uses duration buckets: 0–3y, 3–5y, 5–7y, 7–10y, 10y+.
- **Keep tracking error unchanged** is a cap at today's level. The optimizer normally uses all of it.
- **Keep beta unchanged** holds beta within 0.005 of today's.
- **Trade attractiveness** is measured by taking one trade out of the full proposal and leaving its money in cash. Sells that fund the buys therefore rank low.
- **Macro factors chosen:** US 10y yield, US dollar, risk aversion (VIX), oil, industrial metals, global growth (PMI), China growth. Sensitivities in the mock data are invented. US yields work mainly through duration, the other factors through spreads.
- **Excluding one bond** lets the optimizer buy other bonds in the same bucket.
- **Trading cost** is a base cost in bp scaled by rating and type, unless the data file gives a cost per bond.

## Open items

- Confirm the assumptions above, especially the units and the horizon of the volatility.
- Replace the mock macro sensitivities with regression estimates.
- Score sells against the buys they fund in the Selection tab, instead of against cash.
- A minimum holding size per bond (the small-position rule is per country).
- A mixed-integer solver for the minimum trade size in a production build.
- Reconcile tracking error and beta on real data against the firm's risk system.
