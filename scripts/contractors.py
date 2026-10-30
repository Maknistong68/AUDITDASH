"""The contractor register: data/contractors.csv (opens in Excel).

One row per contractor (work order): contract_no, name, status (active / inactive), project_names (every
"Project:" string the workbooks use for it, separated by " | "). Add a contractor by adding a row; deactivate
one by setting status to inactive (its audits stay in the history). The sub-region is not here: it belongs to
each audit and is read from its sheet name ("Q1 2026 SUBREGION2"), so a contractor moved between sub-regions
follows the workbook quarter by quarter.
"""

import csv
import re
from pathlib import Path

REGISTER = Path(__file__).resolve().parents[1] / "data" / "contractors.csv"
STATUSES = {"active", "inactive"}


def _norm(raw: str) -> str:
    return re.sub(r"\s+", " ", str(raw)).strip()


def load_register(path=REGISTER):
    """[{contractNo, name, status, aliases}] in register order. Raises on a bad row (so a typo never imports)."""
    rows, seen_no, seen_alias = [], set(), {}
    with open(path, newline="", encoding="utf-8-sig") as f:
        for n, r in enumerate(csv.DictReader(f), 2):
            no = _norm(r.get("contract_no", ""))
            name = _norm(r.get("name", ""))
            status = _norm(r.get("status", "")).lower() or "active"
            aliases = [_norm(a) for a in (r.get("project_names") or "").split("|") if _norm(a)]
            if not no or not name:
                raise ValueError(f"{path.name} row {n}: contract_no and name are required")
            if status not in STATUSES:
                raise ValueError(f"{path.name} row {n}: status must be active or inactive, not {status!r}")
            if no in seen_no:
                raise ValueError(f"{path.name} row {n}: contract {no} is listed twice")
            for a in aliases:
                if a in seen_alias:
                    raise ValueError(f"{path.name} row {n}: project name {a!r} already belongs to {seen_alias[a]}")
                seen_alias[a] = no
            seen_no.add(no)
            rows.append({"contractNo": no, "name": name, "status": status, "aliases": aliases})
    return rows


_ROWS = load_register()
# contractNo -> name (register order: the order contractors are listed in)
CONTRACTS = {r["contractNo"]: r["name"] for r in _ROWS}
_BY_NO = {r["contractNo"]: r for r in _ROWS}
_BY_ALIAS = {a: r for r in _ROWS for a in r["aliases"]}


def contractor_for(raw: str) -> dict:
    """{contractNo, name, status} for a raw "Project:" string: an exact project name, else the contract number in it."""
    key = _norm(raw)
    hit = _BY_ALIAS.get(key)
    if hit is None:
        nos = [no for no in _BY_NO if no in re.sub(r"\D", " ", key).split()]
        hit = _BY_NO[nos[0]] if len(nos) == 1 else None
    if hit is None:
        raise ValueError(f"Unknown project {raw!r}: add it to {REGISTER.name} (a new row, or its project_names)")
    return {"contractNo": hit["contractNo"], "name": hit["name"], "status": hit["status"]}


def register():
    return [dict(r) for r in _ROWS]
