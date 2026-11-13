#!/usr/bin/env python3
"""Example: write the optimizer's data file from your own tables with pandas.

Adapt the four loaders at the top to your sources (database, Excel, MATLAB export). Everything
below them is the mapping into the format of docs/DATA_SCHEMA.md.

    python tools/export_example.py --out data/private/universe.json
    python tools/validate.py data/private/universe.json
    node tools/check_data.js data/private/universe.json
    python build.py --data data/private/universe.json --out dist/desk.private.html
"""
import argparse, json
import pandas as pd


# ---- 1. replace these with your own queries -------------------------------------------------
def load_bonds() -> pd.DataFrame:
    """One row per bond. Columns: id, name, country, type, rating, maturity, coupon, price, yield,
    spread (bp), duration, spread_duration, index_weight (%), portfolio_weight (%), cost_bp (optional)."""
    raise NotImplementedError


def load_scenarios() -> pd.DataFrame:
    """One row per bond and scenario (1 to 4 per bond). Columns: id, scenario, prob, ret (12-month total return, %)."""
    raise NotImplementedError


def load_country_cov() -> pd.DataFrame:
    """Square table, index and columns = country codes. Covariance of RELATIVE spread changes,
    annualised, in decimals (0.09 = 30% volatility)."""
    raise NotImplementedError


def load_macro_returns() -> pd.DataFrame:
    """Optional. Index = bond id, one column per macro factor: the bond's return in % for a +1 std move."""
    return pd.DataFrame()


COUNTRIES = [  # code, name, region, sovereign rating bucket
    # ("MX", "Mexico", "Latin America", "IG"),
]
REGIONS = ["Latin America", "Europe & Central Asia", "Middle East", "Africa", "Asia"]
MACRO_FACTORS = [  # name, what a 1 std move is, one-line explanation
    # ("US 10y yield", "+85 bp", "US Treasury yields rise."),
]


# ---- 2. mapping into the data file ----------------------------------------------------------
def build() -> dict:
    bonds, scen, cov, mac = load_bonds(), load_scenarios(), load_country_cov(), load_macro_returns()
    by_bond = {k: g for k, g in scen.groupby("id")}
    out = []
    for r in bonds.itertuples(index=False):
        b = {
            "id": r.id, "name": r.name, "country": r.country, "type": r.type, "rating": r.rating,
            "maturity": int(r.maturity), "coupon": float(r.coupon), "price": float(r.price), "yield": float(getattr(r, "yield")),
            "spread": float(r.spread), "duration": float(r.duration), "spreadDuration": float(r.spread_duration),
            "indexWeight": float(r.index_weight), "portfolioWeight": float(r.portfolio_weight),
            "scenarios": [{"name": s.scenario, "prob": float(s.prob), "ret": float(s.ret)} for s in by_bond[r.id].itertuples()],
        }
        if "cost_bp" in bonds.columns and pd.notna(r.cost_bp):
            b["costBp"] = float(r.cost_bp)
        if len(mac) and r.id in mac.index:
            b["macro"] = [float(x) for x in mac.loc[r.id].values]
        out.append(b)
    codes = list(cov.index)
    return {
        "meta": {"name": "EMD universe", "asOf": str(pd.Timestamp.today().date()), "horizonMonths": 12},
        "settings": {"costBaseBp": 30, "sofr": 3.9, "navMio": 5000},
        "regions": REGIONS,
        "countries": [{"code": c, "name": n, "region": g, "rating": q} for c, n, g, q in COUNTRIES],
        "bonds": out,
        "risk": {"countryCov": {"codes": codes, "matrix": cov.loc[codes, codes].values.tolist()},
                 "typeLoading": [1.0, 1.0, 1.0], "typeResidualVol": [0.04, 0.10, 0.16]},
        "macro": {"factors": [{"name": n, "std": s, "tip": t} for n, s, t in MACRO_FACTORS]},
    }


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    json.dump(build(), open(a.out, "w", encoding="utf-8"), ensure_ascii=False)
    print("wrote", a.out)
