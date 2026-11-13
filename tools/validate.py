#!/usr/bin/env python3
"""Quick checks on a data file before it goes to the optimizer. No packages needed.

    python tools/validate.py data/my_universe.json

It reports problems in plain words. `node tools/check_data.js` is the final test (it runs the engine).
"""
import json, math, sys

RATINGS = ["IG", "BB", "B", "CCC"]
TYPES = {"sov", "sovereign", "government", "quasi", "quasi-sovereign", "quasi-government", "corp", "corporate"}


def main(path):
    d = json.load(open(path, encoding="utf-8"))
    errs, warns = [], []
    regions = d.get("regions") or ["Latin America", "Europe & Central Asia", "Middle East", "Africa", "Asia"]
    countries = {c.get("code"): c for c in d.get("countries", [])}
    if not countries:
        errs.append('no "countries"')
    for code, c in countries.items():
        if c.get("region") not in regions:
            errs.append(f"country {code}: region {c.get('region')!r} is not in the regions list")
    bonds = d.get("bonds", [])
    if not bonds:
        errs.append('no "bonds"')
    wi = wp = 0.0
    buckets = set()
    for i, b in enumerate(bonds):
        nm = b.get("name") or b.get("id") or f"bond {i}"
        if b.get("country") not in countries:
            errs.append(f"{nm}: country {b.get('country')!r} is not in the countries list")
        if str(b.get("type", "")).lower() not in TYPES:
            errs.append(f"{nm}: type must be Sovereign, Quasi or Corporate")
        if b.get("rating") not in RATINGS:
            errs.append(f"{nm}: rating must be one of {RATINGS}")
        for f in ("spread", "spreadDuration"):
            v = b.get(f)
            if not isinstance(v, (int, float)) or not math.isfinite(v):
                errs.append(f"{nm}: {f} is missing or not a number")
        if isinstance(b.get("spread"), (int, float)) and not 1 <= b["spread"] <= 10000:
            warns.append(f"{nm}: spread {b['spread']} bp looks out of range (expected basis points)")
        sc = b.get("scenarios") or []
        if not sc and b.get("expectedReturn") is None:
            errs.append(f"{nm}: needs scenarios or expectedReturn")
        if sc:
            ps = sum(s.get("prob", 0) for s in sc)
            if abs(ps - 1) > 0.01:
                warns.append(f"{nm}: scenario probabilities add up to {ps:.3f}; they will be rescaled to 1")
            if len(sc) > 4:
                warns.append(f"{nm}: {len(sc)} scenarios (1 to 4 expected)")
        wi += b.get("indexWeight") or 0
        wp += b.get("portfolioWeight") or 0
        buckets.add((b.get("country"), str(b.get("type")).lower(), b.get("rating")))
    if abs(wi - 100) > 0.5:
        warns.append(f"index weights add up to {wi:.2f}, not 100; they will be rescaled")
    if wp > 100.01:
        errs.append(f"portfolio weights add up to {wp:.2f}% (more than 100)")
    risk = d.get("risk", {})
    if "bucketCov" in risk:
        k, m = risk["bucketCov"].get("keys", []), risk["bucketCov"].get("matrix", [])
        if len(m) != len(k) or any(len(r) != len(k) for r in m):
            errs.append("risk.bucketCov: matrix must be square and match keys")
    elif "countryCov" in risk:
        k, m = risk["countryCov"].get("codes", []), risk["countryCov"].get("matrix", [])
        if len(m) != len(k) or any(len(r) != len(k) for r in m):
            errs.append("risk.countryCov: matrix must be square and match codes")
        missing = sorted(set(b.get("country") for b in bonds) - set(k))
        if missing:
            errs.append(f"risk.countryCov has no row for: {', '.join(map(str, missing))}")
        for i in range(min(len(k), len(m))):
            if m[i][i] > 4:
                warns.append(f"risk.countryCov: variance {m[i][i]} for {k[i]} looks like percent squared; use decimals (0.09 = 30% vol)")
                break
    else:
        errs.append("risk needs countryCov or bucketCov")
    nf = len((d.get("macro") or {}).get("factors", []))
    if nf:
        bad = [b.get("name") for b in bonds if not isinstance(b.get("macro"), list) or len(b["macro"]) != nf]
        if bad:
            warns.append(f"{len(bad)} bonds lack a macro list of length {nf}; their sensitivities count as zero")
    print(f"{len(countries)} countries, {len(buckets)} buckets, {len(bonds)} bonds, cash {100 - wp:.2f}%, {nf} macro factors")
    for w in warns[:40]:
        print("warning:", w)
    for e in errs[:40]:
        print("ERROR:  ", e)
    print("OK" if not errs else f"{len(errs)} errors")
    return 1 if errs else 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.exit(main(sys.argv[1]))
