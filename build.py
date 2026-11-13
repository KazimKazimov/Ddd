#!/usr/bin/env python3
"""Build the single-file optimizer page.

    python build.py                       -> dist/index.html running on the built-in mock universe
    python build.py --data my_data.json   -> dist/index.html with your data built in
    python build.py --data my_data.json --out dist/desk.html

The page is src/page.html with src/engine.js (and, optionally, a data file) placed inside it.
Open the result in any modern browser; nothing else is needed.
"""
import argparse, json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", help="data file in the format of docs/DATA_SCHEMA.md")
    ap.add_argument("--out", default=str(ROOT / "dist" / "index.html"))
    a = ap.parse_args()

    page = (ROOT / "src" / "page.html").read_text(encoding="utf-8")
    engine = (ROOT / "src" / "engine.js").read_text(encoding="utf-8")
    if "</script" in engine:
        sys.exit("src/engine.js must not contain a closing script tag")
    if page.count("/*ENGINE*/") != 1 or page.count("/*DATA*/") != 1:
        sys.exit("src/page.html must contain the /*ENGINE*/ and /*DATA*/ markers exactly once")

    data = "/*DATA*/"
    if a.data:
        obj = json.loads(pathlib.Path(a.data).read_text(encoding="utf-8"))
        data = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).replace("</", "<\\/")
    out = page.replace("/*DATA*/", data).replace("/*ENGINE*/", engine)

    dest = pathlib.Path(a.out)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(out, encoding="utf-8")
    print(f"wrote {dest} ({len(out.encode('utf-8')) // 1024} KB){' with ' + a.data if a.data else ' with the mock universe'}")


if __name__ == "__main__":
    main()
