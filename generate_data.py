#!/usr/bin/env python3
"""
Generates series_data.json with sample data.
Edit this script and re-run to regenerate, or edit series_data.json directly.
"""
import json, random

random.seed(42)  # Fixed seed = reproducible data

MONTHS_COUNT = 21
FUTURE = {18, 19, 20}  # Jul/Aug/Sep 2026 — displayed as dashes

ACCOUNTS = [
    {"name": "Apex Corp",    "sub": "California · Technology", "state": "California", "metro": "Los Angeles",   "industry": "Technology",    "cls": "row-a", "category": "2025"},
    {"name": "Brightfield",  "sub": "New York · Finance",      "state": "New York",   "metro": "New York City", "industry": "Finance",       "cls": "row-b", "category": "2026"},
    {"name": "Crestline",    "sub": "Texas · Energy",          "state": "Texas",      "metro": "Houston",       "industry": "Energy",        "cls": "row-c", "category": "Splice"},
    {"name": "Duskwood",     "sub": "Florida · Healthcare",    "state": "Florida",    "metro": "Miami",         "industry": "Healthcare",    "cls": "row-d", "category": "2025"},
    {"name": "Everhill",     "sub": "Washington · Technology", "state": "Washington", "metro": "Seattle",       "industry": "Technology",    "cls": "row-a", "category": "2026"},
    {"name": "Fable Inc",    "sub": "Illinois · Retail",       "state": "Illinois",   "metro": "Chicago",       "industry": "Retail",        "cls": "row-b", "category": "Splice"},
    {"name": "Greystone",    "sub": "California · Finance",    "state": "California", "metro": "San Francisco", "industry": "Finance",       "cls": "row-c", "category": "2025"},
    {"name": "Holloway",     "sub": "Texas · Manufacturing",   "state": "Texas",      "metro": "Dallas",        "industry": "Manufacturing", "cls": "row-d", "category": "2026"},
    {"name": "Iris Labs",    "sub": "New York · Healthcare",   "state": "New York",   "metro": "New York City", "industry": "Healthcare",    "cls": "row-a", "category": "Splice"},
    {"name": "Jetform",      "sub": "California · Technology", "state": "California", "metro": "Los Angeles",   "industry": "Technology",    "cls": "row-b", "category": "2025"},
    {"name": "Kova Systems", "sub": "Washington · Energy",     "state": "Washington", "metro": "Seattle",       "industry": "Energy",        "cls": "row-c", "category": "2026"},
    {"name": "Luminary",     "sub": "Illinois · Finance",      "state": "Illinois",   "metro": "Chicago",       "industry": "Finance",       "cls": "row-d", "category": "Splice"},
    {"name": "Meriter",      "sub": "Florida · Retail",        "state": "Florida",    "metro": "Miami",         "industry": "Retail",        "cls": "row-a", "category": "2025"},
    {"name": "Novella",      "sub": "Texas · Technology",      "state": "Texas",      "metro": "Dallas",        "industry": "Technology",    "cls": "row-b", "category": "2026"},
    {"name": "Orbit Co",     "sub": "California · Manufacturing", "state": "California", "metro": "Los Angeles", "industry": "Manufacturing", "cls": "row-c", "category": "Splice"},
]

# Base revenue ($M) per account — drives the value range
BASES = [6.5, 5.0, 7.5, 4.0, 6.0, 2.5, 7.0, 4.5, 6.5, 3.5, 8.0, 5.5, 4.0, 6.0, 7.5]

SUB_LABELS = ["Budget", "Actual spend", "Variance"]


def rnd(lo, hi):
    return round(random.uniform(lo, hi), 1)


def make_vals(base):
    """21-month series; indices 18–20 are null (future)."""
    return [rnd(base * 0.75, base * 1.25) if mi not in FUTURE else None
            for mi in range(MONTHS_COUNT)]


def make_quarters(vals):
    """Four quarter rows that together roughly sum to the parent child vals."""
    return [
        {"label": f"Q{q + 1}",
         "vals": [round(v * rnd(0.2, 0.35), 1) if v is not None else None for v in vals]}
        for q in range(4)
    ]


rows = []
for i, acc in enumerate(ACCOUNTS):
    base = BASES[i]
    vals = make_vals(base)

    # i % 5 == 3 → not expandable (rows 3, 8, 13)
    expandable = (i % 5 != 3)

    children = []
    for ci, label in enumerate(SUB_LABELS):
        cbase = rnd(base * 0.5, base * 0.9)
        cvals = make_vals(cbase)
        # (i + ci) % 3 == 2 → child not expandable
        child_expandable = ((i + ci) % 3 != 2)
        child = {"label": label, "expandable": child_expandable, "vals": cvals}
        if child_expandable:
            child["quarters"] = make_quarters(cvals)
        children.append(child)

    row = {k: acc[k] for k in ["name", "sub", "state", "metro", "industry", "cls", "category"]}
    row["expandable"] = expandable
    row["vals"] = vals
    row["children"] = children
    rows.append(row)

with open("series_data.json", "w") as f:
    json.dump(rows, f, indent=2)

print("Generated series_data.json")
