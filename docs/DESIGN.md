# How the optimizer works

All of this is in `src/engine.js`.

## 1. The problem

The tool chooses the weight of each bucket (country × type × rating) and of cash to maximize

> expected alpha against the index − trading cost,

with cash earning SOFR. Weights are in % of NAV, returns in %, so alpha comes out in bp.

It is subject to these limits:

| Limit | What it controls |
|---|---|
| Tracking error | √(a′Qa) ≤ limit, where a is the vector of active weights. |
| Beta | Beta to the index stays within a band. |
| Active positions | By country, region, rating and type, in market value % or in CTDTS as a share of index DTS. |
| Cash | Between a minimum and a maximum. |
| Turnover | One-way turnover under a cap. |
| Bull-case and bear-case alpha | If every name lands in its bull (or bear) case at once, alpha stays above a floor. |
| Single name | If one country alone lands in its bull or bear case, the alpha lost stays under a cap. |
| Macro factors | Alpha for a +1 std move in each factor stays between a minimum and a maximum. |
| Overrides | Hold (keep today's weight) and Exclude (sell whole), for buckets and for single bonds. |

## 2. The risk model

- **Spread return.** A bucket's return from spreads is −DTS × (relative spread change).
- **Covariance.** S is the covariance of relative spread changes between buckets: loading × loading × country covariance, plus a residual variance.
- **Return covariance.** Q = E S E, with E the diagonal matrix of bucket DTS.
- **Tracking error** is √(a′Qa). **Beta** is (w′Q w_index) ÷ (w_index′Q w_index).

## 3. Bull and bear cases

Each bucket has a bull and a bear return.

- **From scenarios:** the probability-weighted average of the best (worst) 25% of outcomes.
- **From a standard move:** base scenario plus (minus) DTS × the size of the move. Used where a scenario is missing, or for every bond when that option is on.
- **Size of the move:** K standard deviations, or a percentile of a lognormal distribution. The volatility is the bucket's own, its country's, or the average of its rating group.

`shocks()` and `cases()` compute these.

## 4. The solver

The objective and every limit except tracking error are linear. Tracking error is one second-order cone. So the relaxed problem is convex.

- **Variables:** a buy and a sell amount per free bucket. Held and excluded buckets are fixed trades and drop out.
- **Method:** ADMM, the method OSQP uses, with a projection onto a ball for the tracking error cone. Rows are scaled, the step size adapts on a schedule, and infeasibility is detected with a certificate.
- **Checked** against cvxpy with the CLARABEL solver on 31 cases: largest difference 0.06 bp.
- **Unreachable limits.** If an override makes a limit impossible, that limit is widened just enough and flagged.

`prepare()` builds the problem, `admm()` solves it, `finish()` turns the solution into weights, statistics and a report on every limit.

## 5. From buckets to bonds

`mapBonds()` spreads each bucket's trade over its bonds.

- **Buys** go to the bonds with the highest expected return, up to +1% active each.
- **Sells** come from the lowest expected return first.
- **Bond overrides:** a held bond is skipped, an excluded bond is sold whole.

## 6. Non-convex features (heuristics)

- **Minimum trade size** (`solvePruned`, `solveMin`). Solve, find trades below the minimum in CTDTS or in dollars, drop the smallest offenders, freeze the remaining set and solve again. A country whose net trade is too small becomes a switch with no net trade. Trades that cure a limit breach are exempt.
- **Small positions** (`sellSmall`). After solving, any country whose holding is below the threshold is excluded and the problem is solved again, up to four rounds.

Neither is proven optimal. A production build should hand these to a mixed-integer solver.

## 7. Explaining the answer

- **Price of each binding limit.** The limit is loosened by one step and the problem solved again in full. The extra alpha is reported.
- **Frontier.** Best net alpha at each tracking error limit from 20 to 300 bp.
- **Trade attractiveness.** For each trade, alpha added ÷ tracking error added, measured by removing that trade from the proposal.
- **Macro exposures.** Sum over bonds of active weight × the bond's return for a +1 std factor move.
- **Position limits.** For each country and bond, the allowed range of the active position: the tighter of the active limit and the limits implied by the single-name bull and bear cases.

## 8. Running in the page

The page creates a Web Worker from the engine's own text, so solving does not freeze the interface. `makeSession()` answers each request with the solution first, then the limit prices one by one, then the frontier. If a worker cannot start, the page solves on the main thread.
