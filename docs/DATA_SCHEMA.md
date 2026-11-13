# The data file

The tool reads one JSON file. `data/sample_universe.json` is a complete example: it is the mock universe written in this format.

Units used throughout:

- **Weights** are in % of NAV (2.5 means 2.5%).
- **Spreads** are in basis points.
- **Returns** are 12-month total returns in % (6.2 means 6.2%).
- **Covariances** are of relative spread changes, annualised, in decimals (0.09 is a 30% volatility).

## Top level

| Field | Required | Meaning |
|---|---|---|
| `meta` | no | `name`, `asOf` (date), `horizonMonths`. Shown in the page header. |
| `settings` | no | `costBaseBp` (default 30), `sofr` (%), `navMio` (portfolio size in $ mio). |
| `regions` | no | List of region names. Default: Latin America, Europe & Central Asia, Middle East, Africa, Asia. |
| `countries` | yes | List of countries, see below. |
| `bonds` | yes | List of bonds, see below. |
| `risk` | yes | The covariance, see below. |
| `macro` | no | The macro factors, see below. |

## `countries`

| Field | Required | Meaning |
|---|---|---|
| `code` | yes | Short code, used by bonds and by the covariance (`"MX"`). |
| `name` | yes | Display name. |
| `region` | yes | One of the region names. |
| `rating` | no | `IG`, `BB`, `B` or `CCC`. If missing it is taken from the country's largest sovereign bucket. |

## `bonds`

One entry per bond in the index or in the portfolio.

| Field | Required | Meaning |
|---|---|---|
| `id` | no | Your identifier (ISIN). |
| `name` | yes | Display name (`"MX 6.375 2035"`). |
| `country` | yes | A country `code`. |
| `type` | yes | `Sovereign`, `Quasi` or `Corporate`. |
| `rating` | yes | Rating bucket: `IG`, `BB`, `B` or `CCC`. |
| `spread` | yes | Spread in bp. |
| `spreadDuration` | yes | Spread duration in years. |
| `duration` | no | Modified duration. Defaults to the spread duration. Sets the duration bucket and the US yield effect. |
| `price`, `yield` | no | Shown in the bond view. |
| `maturity`, `coupon` | no | Maturity year and coupon, shown in the bond view. |
| `indexWeight` | yes | Weight in the index, %. The index is rescaled to 100%. Use 0 for an off-index bond. |
| `portfolioWeight` | yes | Weight in the current portfolio, % of NAV. Cash is 100 minus the total. |
| `scenarios` | yes* | 1 to 4 entries of `{name, prob, ret}`. Probabilities are rescaled to add to 1. |
| `expectedReturn` | yes* | Used only when there are no scenarios. |
| `costBp` | no | Bid-ask cost of trading this bond, in bp. Without it the cost is the base cost scaled by rating and type. |
| `macro` | no | One number per macro factor: this bond's return in % if the factor rises by 1 standard deviation. |

\* Give `scenarios` or `expectedReturn`.

How scenarios are used:

- **Expected return** is the probability-weighted average of the scenario returns.
- **Base scenario** is the one whose name contains "base", otherwise the most probable one.
- **Upside and downside.** A scenario above the base is an upside, one below it a downside. A bond with no upside (or no downside) gets the standard spread move for its bull (or bear) case.
- **Bull and bear cases** from scenarios are the average of the best and the worst 25% of outcomes by probability.

## Buckets

The optimizer groups bonds into buckets by country × type × rating. You do not list buckets: they are built from the bonds. A bucket's spread, DTS and returns are the index-weighted averages of its bonds. Bucket identifiers look like `MX-SOV-IG`, `MX-QS-BB`, `MX-CORP-B`.

## `risk`

Give one of the two.

**`countryCov`** (the usual case): covariance of relative spread changes between countries.

```json
"risk": {
  "countryCov": { "codes": ["MX", "BR"], "matrix": [[0.090, 0.045], [0.045, 0.110]] },
  "typeLoading": [1.0, 1.0, 1.0],
  "typeResidualVol": [0.04, 0.10, 0.16],
  "buckets": { "MX-QS-BB": { "loading": 1.1, "residualVol": 0.12 } }
}
```

- `typeLoading`: how strongly sovereign, quasi and corporate buckets load on their country. Default 1 each.
- `typeResidualVol`: volatility specific to a bucket, on top of its country. Defaults 0.04, 0.10, 0.16.
- `buckets`: optional overrides for single buckets.

The covariance between two buckets is loading × loading × country covariance, plus the residual variance on the diagonal.

**`bucketCov`**: the full bucket-level matrix, if you have one. `keys` are bucket identifiers, `matrix` is square in the same order.

## `macro`

```json
"macro": { "factors": [ { "name": "US 10y yield", "std": "+85 bp", "tip": "US Treasury yields rise." } ] }
```

- `factors` names the factors and says what a 1 standard deviation move is. The order must match each bond's `macro` list.
- Without `macro.factors` and without any bond `macro` list, the Macro tab is empty and no macro limit applies.
- If `macro.factors` is missing but bonds carry `macro` lists of length 7, the built-in seven factors are assumed.

## Checking a file

```bash
python tools/validate.py data/private/universe.json
node tools/check_data.js data/private/universe.json
```

Compare the printed index DTS, tracking error and beta of the current portfolio with your own risk system. If they disagree, the usual causes are:

- spreads given in % instead of bp,
- covariance given in percent squared instead of decimals,
- a covariance of absolute spread changes instead of relative ones,
- weights given as fractions instead of %.
