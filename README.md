# EM Bond Optimizer

A portfolio optimization tool for an emerging-market hard-currency bond portfolio managed against an index. Given the current portfolio, the index and a set of limits, it proposes the trades that maximize expected alpha, and shows why.

It is one web page. The optimizer runs in the browser, so there is nothing to install to use it.

**Status:** working prototype. It ships with a synthetic universe (60 countries, 110 buckets, 342 bonds). The next step is to run it on real data: see [Running on real data](#running-on-real-data).

## Open it

Open `dist/index.html` in Chrome, Edge, Safari or Firefox. That is the whole tool, running on the mock universe.

## What is in this repository

| Path | What it is |
|---|---|
| `dist/index.html` | The built tool. Open it in a browser. |
| `src/engine.js` | The optimizer: universe, risk model, solver, bond mapping, minimum trade size, data loader. Plain JavaScript, no dependencies. |
| `src/page.html` | The interface: layout, styles and all the screens. |
| `build.py` | Puts the engine (and optionally a data file) into the page and writes `dist/index.html`. |
| `data/sample_universe.json` | The mock universe written in the real data format. Use it as the template. |
| `tools/validate.py` | Quick checks on a data file, in plain words. |
| `tools/check_data.js` | The definitive check: loads the file with the engine and solves once. |
| `tools/export_example.py`, `tools/export_example.m` | Example writers for the data file, from pandas and from MATLAB. |
| `tests/test_engine.js` | Engine tests, including the data-file round trip. |
| `docs/DESIGN.md` | How the optimizer works. |
| `docs/DATA_SCHEMA.md` | The data file, field by field. |
| `docs/INTERFACE.md` | Every screen and control. |
| `docs/DECISIONS.md` | What was decided, what is assumed, and what is still open. |
| `CLAUDE.md` | Context for continuing the work with Claude Code. |

## Set up on a new computer

You need Python 3 to build and Node.js 18 or later to run the tests and the data check. Neither is needed just to open the tool.

```bash
git clone https://github.com/KazimKazimov/ddd.git
cd ddd
node tests/test_engine.js      # should end with "all passed"
python build.py                # rebuilds dist/index.html
```

## Running on real data

1. **Write the data file.** Your MATLAB or Python pipeline writes one JSON file in the format of [docs/DATA_SCHEMA.md](docs/DATA_SCHEMA.md). Start from `tools/export_example.py` or `tools/export_example.m`, and compare against `data/sample_universe.json`.
2. **Check it.**
   ```bash
   python tools/validate.py data/private/universe.json
   node tools/check_data.js data/private/universe.json
   ```
   The second command prints the index DTS, the current portfolio's tracking error and beta, and one solve. Compare those numbers with your own risk system before trusting anything else.
3. **Use it.** Either
   - build it into the page: `python build.py --data data/private/universe.json --out dist/desk.private.html`, or
   - open `dist/index.html` and click **Load a data file**. The file stays in that browser tab only.

`data/private/` and `*.private.*` are in `.gitignore`, so real positions are not committed by accident.

## Changing the tool

Edit `src/engine.js` or `src/page.html`, then run `python build.py` and `node tests/test_engine.js`. `dist/index.html` is generated: do not edit it by hand.

## Known limits of the prototype

- The minimum trade size and the sale of small positions make the problem non-convex. Both are solved by a prune-and-re-solve heuristic, which is not proven optimal. A production build should use a mixed-integer solver.
- The optimizer works on buckets and then maps to bonds. Bond-level numbers (macro exposures, the bond limits) can differ by a few basis points from the bucket-level limits the optimizer applies.
- Percentile shocks assume a lognormal distribution built from the covariance. They are not read from an empirical history.
- See [docs/DECISIONS.md](docs/DECISIONS.md) for the full list of assumptions that still need confirming.
