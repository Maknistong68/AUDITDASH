"""Category assignment: checklist code -> category, plus keyword pass for site findings."""

import re

CATEGORY_CODES = {
    "leadership": ["A9", "A11", "A12", "A15", "C1.1", "C1.2", "C1.3", "C1.5", "C1.7", "C1.8", "C2.6"],
    "plans": ["A1", "A2", "A6", "A13", "C2.2", "C2.3", "C2.4", "C2.5"]
    + [f"C2.{n}" for n in range(7, 20)],
    "rams": ["B1.1", "B1.2", "C1.9", "C1.10", "C1.11", "C1.12"],
    "permits": ["B4.1", "B4.2", "B5.1", "B5.2", "B5.3"],
    "competence": ["A3", "B2.1", "B2.2", "B2.3", "B2.4", "B6.7", "B7.1", "B7.2"],
    "subcontractor": ["B6.1", "B6.2", "B6.3", "B6.4", "B6.5", "B6.6", "B6.9"],
    "monitoring": ["A4", "A5", "A8", "A10", "A14", "C1.4", "C1.6"],
    "incident": ["A7", "B3.1", "B3.2", "B3.3", "B8.1"],
    "site": ["B6.8", "B9.1", "B9.2", "B9.3", "B10.1", "B10.2"],
    "health": ["B11.1", "B11.2", "B11.3", "B12.1", "B12.2"],
}

CODE_CATEGORY = {code: cat for cat, codes in CATEGORY_CODES.items() for code in codes}

# Order matters: first matching group wins.
_KEYWORDS = [
    ("permits", r"permit|lifting|excavat|electric|earthing"),
    ("competence", r"training|competen|certificat"),
    ("health", r"mosquito|toilet|clinic|medicin|nurse|first aid|\bheat\b|\bwater\b"),
]


def category_for(code, kind, text):
    """Category id for an observation, or None when it has none (e.g. positives)."""
    if kind == "positive":
        return None
    if code:
        return CODE_CATEGORY.get(code)
    if kind == "site":
        for cat, pattern in _KEYWORDS:
            if re.search(pattern, text or "", re.I):
                return cat
        return "site"
    return None
