# Context for Claude Code

This repository is an EM bond portfolio optimizer that runs in the browser. Read `docs/DESIGN.md`, `docs/DATA_SCHEMA.md` and `docs/DECISIONS.md` before changing behaviour.

## Layout and build

- `src/engine.js`: everything numerical. Loaded three ways: inline in the page, inside a Web Worker made from the same text, and by Node (`module.exports` at the bottom) for tests. Keep it dependency-free, ES5-style, and never write a closing script tag inside it.
- `src/page.html`: the interface. Contains two markers, `/*ENGINE*/` and `/*DATA*/`, replaced by `build.py`.
- `python build.py [--data file.json] [--out path]` writes `dist/index.html`. Always rebuild and commit `dist/index.html` after changing `src/`.
- `node tests/test_engine.js` must pass before committing. The default solve on the mock universe is net alpha 116.2 bp, tracking error 85 bp.

## Conventions that must not drift

- Everything is measured against the index: alpha, tracking error, beta, active positions.
- Weights are in % of NAV. Returns are in %. Alpha and costs are in bp (weight % × return % = bp).
- Engine `dts` = spread duration × spread / 100. Displayed DTS = engine `dts` × 100. CTDTS = weight % × engine `dts`.
- The covariance is of relative spread changes, annualised, in decimals.
- Wording in the interface is plain English, amounts are in "$ mio", and every control has a `data-tip` explanation.

## Working rules

- The optimizer allocates to country × type × rating buckets, then `mapBonds` maps bucket trades to bonds. Bond-level overrides (`p.frozen`: 1 hold, 2 exclude) and bucket overrides (`p.locks`) both exist.
- Non-convex features (minimum trade size, selling small positions) are heuristics layered on the convex solve: `solvePruned`, `solveMin`, `sellSmall`.
- Real data never goes in the repository. `data/private/` is ignored.
- Test interface changes at a phone width (390 px) and a desktop width, with no horizontal overflow.
