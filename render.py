#!/usr/bin/env python3
"""
Renders series-explorer-template5.html.j2 → series-explorer-template5.html

Usage:
    pip install jinja2
    python3 render.py

Data sources (edit these, then re-run):
    nav_links.csv     — nav bar: columns Name, Link, Category, Subcategory
    series_data.json  — table rows (or run generate_data.py to rebuild)
"""
import csv, json
from pathlib import Path
from jinja2 import Environment, FileSystemLoader

MONTHS = [
    "Jan 25", "Feb 25", "Mar 25", "Apr 25", "May 25", "Jun 25", "Jul 25",
    "Aug 25", "Sep 25", "Oct 25", "Nov 25", "Dec 25",
    "Jan 26", "Feb 26", "Mar 26", "Apr 26", "May 26", "Jun 26",
    "Jul 26", "Aug 26", "Sep 26",
]


def load_nav(path):
    """
    Parse nav_links.csv into the NAV structure expected by the JS renderNav().
    Categories without a Subcategory get a flat pages list.
    Categories with Subcategory entries get a subcats list instead.
    """
    cats = {}  # ordered dict: category label → {subcats, pages}
    for row in csv.DictReader(open(path)):
        cat = row["Category"].strip()
        subcat = row["Subcategory"].strip()
        page = {"name": row["Name"].strip(), "link": row["Link"].strip()}
        if cat not in cats:
            cats[cat] = {"subcats": {}, "pages": []}
        if subcat:
            cats[cat]["subcats"].setdefault(subcat, []).append(page)
        else:
            cats[cat]["pages"].append(page)

    nav = []
    for label, data in cats.items():
        entry = {"id": label.lower(), "label": label}
        if data["subcats"]:
            entry["subcats"] = [
                {"id": sc.lower(), "label": sc, "pages": pages}
                for sc, pages in data["subcats"].items()
            ]
        else:
            entry["pages"] = data["pages"]
        nav.append(entry)
    return nav


env = Environment(loader=FileSystemLoader("."))
# tojson filter: used in template as {{ value | tojson }}
env.filters["tojson"] = lambda v: json.dumps(v, separators=(",", ":"))

nav_js = load_nav("nav_links.csv")
rows   = json.loads(Path("series_data.json").read_text())

# Unique sorted values for the filter dropdowns — derived from the row data
states     = sorted({r["state"]    for r in rows})
metros     = sorted({r["metro"]    for r in rows})
industries = sorted({r["industry"] for r in rows})

html = env.get_template("series-explorer-template5.html.j2").render(
    rows=rows,
    nav_js=nav_js,
    months=MONTHS,
    states=states,
    metros=metros,
    industries=industries,
)
Path("series-explorer-template5.html").write_text(html)
print("Rendered → series-explorer-template5.html")
