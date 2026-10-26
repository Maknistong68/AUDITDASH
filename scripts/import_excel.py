"""Import the HSE audit workbooks into seed JSON (data/seed/*.json).

Usage:
  python -I scripts/import_excel.py --results data/source/HS_AUDIT_FINDINGS_SAMPLES.xlsx \
      --checklist data/source/Excellence_HS_checklist.xlsx --out data/seed
"""

import argparse
import json
import re
import sys
import warnings
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # `python -I` drops the script dir

import openpyxl  # noqa: E402

from contractors import CONTRACTS, contractor_for  # noqa: E402
from site_keywords import CODE_CATEGORY, category_for  # noqa: E402

BLOCK_WIDTH = 10
ITEM_CODE = re.compile(r"^[ABC]\d+(\.\d+)?$")
COMPLIANCE = {"full", "partial", "no", "n/a"}


def _load(path, **kw):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")  # "Data Validation extension is not supported"
        return openpyxl.load_workbook(path, data_only=True, **kw)


def _clean(v):
    return v.strip() if isinstance(v, str) else v


def _num(v):
    """Numbers as int when integral, float otherwise; None for N/A, errors and blanks."""
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    return int(v) if float(v).is_integer() else float(v)


def _empty(v):
    return v is None or (isinstance(v, str) and not v.strip())


# --------------------------------------------------------------------------- checklist

def parse_checklist(path):
    wb = _load(path)
    ws = wb["Health & Safety"]
    items, section, subsection = [], None, None
    for row in ws.iter_rows(values_only=True):
        code = re.sub(r"\s+", "", str(row[1])) if row[1] is not None else ""
        if code.startswith("InspectionScoreSummary") or code == "PART2":
            break
        if code in ("A", "B", "C") and isinstance(row[2], str):
            section, subsection = code, None
            continue
        if section is None or not code:
            continue
        compliance = str(row[9]).strip().lower() if row[9] is not None else ""
        weight = _num(row[8])
        if compliance in COMPLIANCE and weight is not None and ITEM_CODE.match(code):
            items.append({
                "code": code,
                "section": section,
                "subsection": subsection,
                "question": " ".join(str(row[2]).split()),
                "weight": weight,
                "category": CODE_CATEGORY.get(code),
            })
        elif section == "B" and re.fullmatch(r"B\d+", code):
            subsection = code
        elif section == "C" and re.fullmatch(r"C?\d+", code):
            subsection = "C" + code.lstrip("C")  # C sub-header "1" means C1
    return items


# --------------------------------------------------------------------------- results

def _block_cells(row, start):
    """(offset, value) for non-empty cells of a row inside one 10-column block."""
    return [(c - start, row[c]) for c in range(start, min(start + BLOCK_WIDTH, len(row)))
            if not _empty(row[c])]


def _find(rows, start, text, first_row=0, last_row=None):
    """(row, offset) of the first cell in the block whose stripped text equals `text`."""
    for r in range(first_row, last_row if last_row is not None else len(rows)):
        for off, v in _block_cells(rows[r], start):
            if isinstance(v, str) and v.strip() == text:
                return r, off
    return None


def _after_label(rows, start, label, first_row=0, last_row=None):
    """First non-empty cell right of `label` in the same row, within the block."""
    hit = _find(rows, start, label, first_row, last_row)
    if hit is None:
        return None
    r, off = hit
    for o, v in _block_cells(rows[r], start):
        if o > off:
            return v
    return None


def _to_date(v):
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    return datetime.strptime(str(v).strip(), "%d/%m/%Y").date()


def _sheet_meta(title):
    m = re.search(r"(Q\d)\s+(\d{4})\s+SUBREGION\s*(\d)", title, re.I)
    if not m:
        raise ValueError(f"Cannot read quarter/subregion from sheet name {title!r}")
    return f"{m.group(1).upper()}-{m.group(2)}", f"SR{m.group(3)}"


def _parse_sections(rows, start, hdr_row, total_row):
    sections, letter = [], None
    for r in range(hdr_row + 1, total_row):
        cells = _block_cells(rows[r], start)
        if len(cells) < 4 or not isinstance(cells[0][1], str):
            continue
        first = cells[0][1].strip()
        if first in ("A", "B", "C"):
            letter, code, label = first, first, str(cells[1][1]).strip()
        else:
            m = re.match(r"^(\d+)\.\s*(.*)$", first)
            if not m or letter is None:
                continue
            code, label = f"{letter}{m.group(1)}", m.group(2).strip()
        possible, scored = _num(cells[-3][1]), _num(cells[-2][1])
        if possible is None or scored is None:
            raise ValueError(f"Non-numeric section score for {code} in block at column {start}")
        sections.append({"code": code, "label": label, "possible": possible, "scored": scored})
    return sections


def _classify_kind(label):
    low = " ".join(label.lower().split())
    if re.fullmatch(r"positive( observations?)?", low):
        return "positive"
    if re.fullmatch(r"(other\s*/\s*site|site\s*/\s*other)( observations?| findings?)?", low):
        return "site"
    return None


def _parse_observations(rows, start, audit_id):
    hdr = _find(rows, start, "SR#")
    com = _find(rows, start, "Observation/Comment", hdr[0])
    sr_col, com_col = hdr[1], com[1]
    entries = []  # dicts: kind, code, numbered, parts, photo
    for r in range(hdr[0] + 1, len(rows)):
        row = rows[r]
        cells = _block_cells(row, start)
        left = [(o, v) for o, v in cells if sr_col <= o < com_col]
        text = row[start + com_col] if start + com_col < len(row) else None
        text = text.rstrip() if isinstance(text, str) and text.strip() else ""
        photo = any(o > com_col and "picture" in str(v).lower() for o, v in cells)
        code = kind = None
        numbered = False
        sr = next((v for o, v in left if o == sr_col), None)
        if isinstance(sr, (int, float)) or (isinstance(sr, str) and sr.strip().isdigit()):
            numbered = True
        elif isinstance(sr, str):
            m = re.match(r"^([ABC]\d+(?:\.\d+)?)", re.sub(r"\s+", "", sr))
            code = m.group(1) if m else None
        for o, v in left:
            if isinstance(v, str) and _classify_kind(v):
                kind = _classify_kind(v)
        if code and not kind:
            kind = "negative"  # a code with a Positive/Site label stays positive/site
        if kind:
            entries.append({"kind": kind, "code": code, "numbered": numbered,
                            "parts": [text] if text else [], "photo": photo})
        elif entries and (text or photo):
            if text:
                entries[-1]["parts"].append(text)
            entries[-1]["photo"] = entries[-1]["photo"] or photo

    # Some blocks number their positives 1..N and then list further notes under the same
    # "Positive Observations" label without a number; those are not positives.
    dropped = 0
    if any(e["kind"] == "positive" and e["numbered"] for e in entries):
        kept = [e for e in entries if not (e["kind"] == "positive" and not e["numbered"])]
        dropped = len(entries) - len(kept)
        entries = kept
    if dropped:
        print(f"WARNING: {audit_id}: dropped {dropped} unnumbered rows labelled 'Positive "
              f"Observations' after a numbered list (mislabelled checklist notes)", file=sys.stderr)

    # Template rows: a checklist code with no comment and no photo is not an observation.
    entries = [e for e in entries if e["parts"] or e["photo"]]
    out = []
    for n, e in enumerate(entries, 1):
        text = "\n".join(e["parts"])
        out.append({
            "id": f"{audit_id}-{n}",
            "auditId": audit_id,
            "itemCode": e["code"],
            "kind": e["kind"],
            "text": text,
            "category": category_for(e["code"], e["kind"], text),
            "hasPhoto": e["photo"],
        })
    return out


def parse_results(path):
    wb = _load(path)
    contractors, audits, observations = {}, [], []
    for ws in wb.worksheets:
        if not re.search(r"SUBREGION", ws.title, re.I):
            continue
        quarter, _sheet_sr = _sheet_meta(ws.title)
        rows = [list(r) for r in ws.iter_rows(values_only=True)]
        starts = [c for c, v in enumerate(rows[0]) if isinstance(v, str) and "Project" in v]
        for start in starts:
            raw = _after_label(rows, start, "Project:", 0, 3)
            info = contractor_for(raw)
            when = _to_date(_after_label(rows, start, "Date:", 0, 3))
            audit_id = f"{info['contractNo']}-{quarter}-{when:%Y%m%d}"
            location = _after_label(rows, start, "Location:", 0, 3)
            inspection = _after_label(rows, start, "Inspection No.:", 0, 3)
            auditors = [" ".join(a.split()) for a in str(_after_label(rows, start, "Auditor:", 0, 3)).split(",") if a.strip()]
            hdr = _find(rows, start, "Inspection Program Areas")
            tot = _find(rows, start, "TOTAL FINAL SCORE")
            total = _num(_after_label(rows, start, "TOTAL FINAL SCORE"))
            if hdr is None or tot is None or total is None:
                raise ValueError(f"Missing Part 2 score table for {audit_id}")
            audits.append({
                "id": audit_id,
                "contractorId": info["contractNo"],
                "quarter": quarter,
                "date": when.isoformat(),
                "location": " ".join(str(location).split()),
                "inspectionNo": str(inspection).strip(),
                "auditors": auditors,
                "totalScore": total,
                "sections": _parse_sections(rows, start, hdr[0], tot[0]),
            })
            contractors.setdefault(info["contractNo"], {
                "id": info["contractNo"], "name": info["name"],
                "contractNo": info["contractNo"], "subregion": info["subregion"]})
            observations.extend(_parse_observations(rows, start, audit_id))
    order = {no: i for i, no in enumerate(CONTRACTS)}
    return (sorted(contractors.values(), key=lambda c: order[c["id"]]), audits, observations)


# --------------------------------------------------------------------------- CLI

def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", required=True)
    ap.add_argument("--checklist", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args(argv)
    checklist = parse_checklist(args.checklist)
    contractors, audits, observations = parse_results(args.results)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    for name, data in (("checklist", checklist), ("contractors", contractors),
                       ("audits", audits), ("observations", observations)):
        (out / f"{name}.json").write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(contractors)} contractors, {len(audits)} audits, "
          f"{len(observations)} observations, {len(checklist)} checklist items")


if __name__ == "__main__":
    main()
