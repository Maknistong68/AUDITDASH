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

from contractors import contractor_for, register  # noqa: E402
from privacy import HASHES_FILE, REVIEW_FILE, name_hashes, pseudonymise, review_candidates, save_hashes, skeleton, write_review  # noqa: E402
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
                # From the code itself: the Rev template labels the B11/B12 sub-headers "B1.1"/"B1.2".
                "subsection": code.split(".")[0] if section in ("B", "C") else None,
                "question": " ".join(str(row[2]).split()),
                "weight": weight,
                "category": CODE_CATEGORY.get(code),
            })
        elif section == "B" and re.fullmatch(r"B\d+", code):
            subsection = code
        elif section == "C" and re.fullmatch(r"C?\d+", code):
            subsection = "C" + code.lstrip("C")  # C sub-header "1" means C1
    return items


# --------------------------------------------------------------------------- five audit types

TYPE_SHEETS = {"security": "Security", "environmental": "Environment", "welfare": "Worker Welfare"}
SECTION_CODE = re.compile(r"^[A-Z]$")
TYPED_ITEM_CODE = re.compile(r"^[A-Z]\d+(\.\d+)?$")
SUBHEADER_CODE = re.compile(r"^[A-Z]\d+$")
HS_SECTION_TITLES = {"A": "Documentation & Management", "B": "Operational Controls", "C": "Safety Culture & Performance"}


def parse_typed_checklist(path, kind):
    """Checklist for security / environmental / welfare: {"type", "sections", "items"}.

    Layout per section: a letter row (letter | title | ... | "Weight" | "Compliance"), then item rows
    (code | question | ... | weight | Full/Partial/No/N/A). Environmental also has sub-header rows
    (G1 | title | weight, no compliance) whose code becomes the `subsection` of the G1.x items.
    Items without a numeric weight (welfare E1, E2) default to 1. `category` is the slug `<type>:<letter>`.
    """
    ws = _load(path)[TYPE_SHEETS[kind]]
    sections, items, section, subsection = [], [], None, None
    for row in ws.iter_rows(values_only=True):
        code = re.sub(r"\s+", "", str(row[1])) if row[1] is not None else ""
        if code.startswith("InspectionScoreSummary") or code == "PART2":
            break
        if SECTION_CODE.match(code) and isinstance(row[2], str) and str(row[8]).strip().lower() == "weight":
            section, subsection = code, None
            sections.append({"code": code, "title": " ".join(row[2].split()), "category": f"{kind}:{code}"})
            continue
        if section is None or not TYPED_ITEM_CODE.match(code):
            continue
        compliance = str(row[9]).strip().lower() if row[9] is not None else ""
        if code[0] != section:
            # Workbook typo: welfare section D's items are labelled C1..C6. Re-letter to the section.
            code = section + code[1:]
        if compliance in COMPLIANCE:
            weight = _num(row[8] if not isinstance(row[8], str) else _to_number(row[8]))
            items.append({
                "code": code,
                "section": section,
                "subsection": subsection if "." in code else None,
                "question": " ".join(str(row[2]).split()),
                "weight": weight if weight is not None else 1,
                "category": f"{kind}:{section}",
            })
        elif SUBHEADER_CODE.match(code):
            subsection = code
    return {"type": kind, "sections": sections, "items": items}


def _to_number(v):
    try:
        return float(v.strip())
    except ValueError:
        return None


def parse_crc(path):
    """CRC: 13 inspection program areas (numbered rows), weight 1, one section 'A'. Codes CRC1..CRC13."""
    ws = _load(path)["CRC"]
    items, started = [], False
    for row in ws.iter_rows(values_only=True):
        if isinstance(row[1], str) and row[1].strip() == "Inspection Program Areas":
            started = True
            continue
        if not started:
            continue
        n = str(row[1]).strip() if row[1] is not None else ""
        if not n.isdigit():
            break
        items.append({
            "code": f"CRC{n}", "section": "A", "subsection": None,
            "question": " ".join(str(row[3]).split()), "weight": 1, "category": "crc:A",
        })
    return {"type": "crc",
            "sections": [{"code": "A", "title": "Critical Risk Control Inspections", "category": "crc:A"}],
            "items": items}


def parse_hs_typed(path, items):
    ws = _load(path)["Health & Safety"]
    titles = dict(HS_SECTION_TITLES)
    for row in ws.iter_rows(values_only=True):
        code = str(row[1]).strip() if row[1] is not None else ""
        if code in titles and isinstance(row[2], str) and str(row[8]).strip().lower() == "weight":
            titles[code] = " ".join(row[2].split())
    return {"type": "hs",
            "sections": [{"code": c, "title": t, "category": None} for c, t in titles.items()],
            "items": items}


def parse_all_checklists(path, hs_items):
    return {"hs": parse_hs_typed(path, hs_items),
            **{k: parse_typed_checklist(path, k) for k in TYPE_SHEETS},
            "crc": parse_crc(path)}


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


def _norm(t):
    return " ".join(str(t).lower().split())


def _summary_findings(path, checklist):
    """(normalised comment, itemCode) rows from Part 3 of the checklist workbook's H&S sheet.

    ONLY used for audit 4800001112-Q4-2025-20251015, whose results-workbook rows lost their
    SR# codes. In the checklist sheet each row has the SR# code, or (last few rows) only the
    question text, which is matched to a checklist question (unique match required).
    """
    ws = _load(path)["Health & Safety"]
    by_question = {}
    for i in checklist:
        by_question.setdefault(_norm(i["question"]), []).append(i["code"])
    out, in_part3 = [], False
    for row in ws.iter_rows(values_only=True):
        if isinstance(row[1], str) and row[1].strip() == "Summary of Findings":
            in_part3 = True
        if not in_part3 or len(row) < 7 or _empty(row[6]) or isinstance(row[6], (int, float)):
            continue
        code = re.sub(r"\s+", "", str(row[1])) if row[1] is not None else ""
        if not ITEM_CODE.match(code):
            hits = [c for q, cs in by_question.items() if not _empty(row[2]) and
                    (q == _norm(row[2]) or q.startswith(_norm(row[2]))) for c in cs]
            code = hits[0] if len(set(hits)) == 1 else None
        out.append((_norm(row[6]), code))
    return out


def _match_comment(text, pool):
    """Consume and return the code of the first pool entry whose comment matches `text`."""
    t = _norm(text)
    for idx, (c, code) in enumerate(pool):
        if code and (c[:80] == t[:80] or (len(t) > 30 and (t[:60] in c or c[:60] in t))):
            del pool[idx]
            return code
    return None


def _match_question(notes, questions):
    n = " ".join(notes.lower().split())
    if not n:
        return None
    for q, code in questions:
        if q == n or q.startswith(n) or n.startswith(q):
            return code
    return None


def _parse_observations(rows, start, audit_id, questions=(), findings=(), tally=None):
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
        # The evidence cell and anything after it; a comment that is only "NA" / "COMPLIANT" says the same.
        marker = evidence_marker(v for o, v in cells if o > com_col) or (evidence_marker([text]) if _BARE_MARK.match(text) else None)
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
            notes = " ".join(str(v) for o, v in left if o > sr_col and not _classify_kind(str(v)))
            entries.append({"kind": kind, "code": code, "numbered": numbered, "notes": notes,
                            "parts": [text] if text else [], "photo": photo, "marker": marker})
        elif entries and (text or photo):
            if text:
                entries[-1]["parts"].append(text)
            entries[-1]["photo"] = entries[-1]["photo"] or photo

    # Audit 4800001112-Q4-2025-20251015 (Abyatona Zone F, Q4) numbers its positives 1..N and
    # then lists per-checklist-item notes, unnumbered, under the same "Positive Observations"
    # label. Those are findings, not positives: import them as negatives, resolving itemCode
    # by matching the row's notes text to a checklist question (None if no match).
    if any(e["kind"] == "positive" and e["numbered"] for e in entries):
        pool = list(findings)  # codes recovered from the checklist workbook's Part 3
        for e in entries:
            if e["kind"] == "positive" and not e["numbered"]:
                e["kind"] = "negative"
                e["code"] = (_match_question(e["notes"], questions)
                             or _match_comment(" ".join(e["parts"]), pool))

    if tally is not None:  # evidence markers per SR# row of the block, kept observations or not
        t = tally.setdefault(audit_id, {"compliant": 0, "na": 0})
        for e in entries:
            if e["code"] and e["marker"]:
                t[e["marker"]] += 1

    # Template rows: a checklist code with no comment and no photo is not an observation. Pictures are never
    # imported (owner, 2026-10-30); a photo-only row still takes an id so ids stay stable (gaps allowed), like
    # dropped "Not Applicable" notes.
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
            "marker": e["marker"],
        })
    return [o for o in out if o["text"].strip() and not is_na_note(o["text"])]


_COMPLIANT = re.compile(r"(?<![a-z])compliant(?![a-z])", re.I)
_NON_COMPLIANT = re.compile(r"non[\s\-]*compliant", re.I)
_NA_MARK = re.compile(r"^\W*(n\s*/\s*a|na|not\s+applicable)(?![a-z])", re.I)


def evidence_marker(values):
    """'compliant' / 'na' / None from the evidence cell(s) right of the comment on an SR# row.

    Auditors type "COMPLIANT" (not "NON-COMPLIANT") or "N/A" / "NA" / "NOT APPLICABLE" there to say the item
    needs no finding; anything else ("Picture", free text, a document name) is no marker. Case-insensitive.
    """
    for v in values:
        if not isinstance(v, str):
            continue
        t = " ".join(v.split())
        if _NA_MARK.match(t):
            return "na"
        if _COMPLIANT.search(t) and not _NON_COMPLIANT.search(t):
            return "compliant"
    return None


_BARE_MARK = re.compile(r"^\W*(n\s*/\s*a|na|not\s+applicable|compliant)\W*$", re.I)


_NA_NOTE = re.compile(r"^(not\s+applicable|n/a|na[ -])", re.I)


def is_na_note(text):
    """True for auditor notes that only say the item did not apply ("Not Applicable...", "N/A", "NA - ...").

    Leading bullets, asterisks, dashes and whitespace are ignored. Such notes are not observations.
    """
    t = re.sub(r"^[\s\u2022\u00b7*\-\u2013\u2014]+", "", text or "")
    return bool(_NA_NOTE.match(t)) or t.strip().lower() in ("n/a", "na", "not applicable")


def parse_results(path, checklist=(), checklist_path=None, tally=None):
    """(contractors, audits, observations). `tally`, when a dict, receives {auditId: {"compliant": n, "na": n}}:
    the evidence markers on the SR# rows of each audit's block (rows without a comment included)."""
    questions = [(" ".join(i["question"].lower().split()), i["code"]) for i in checklist]
    wb = _load(path)
    findings = _summary_findings(checklist_path, checklist) if checklist_path else []
    contractors, audits, observations = {}, [], []
    for ws in wb.worksheets:
        if not re.search(r"SUBREGION", ws.title, re.I):
            continue
        quarter, sheet_sr = _sheet_meta(ws.title)
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
            sections = _parse_sections(rows, start, hdr[0], tot[0])
            score, issues = true_score(sections, total)
            audits.append({
                "id": audit_id,
                "contractorId": info["contractNo"],
                "subregion": sheet_sr,  # where the contractor was that quarter: the sheet it is filed under
                "quarter": quarter,
                "date": when.isoformat(),
                "location": " ".join(str(location).split()),
                "inspectionNo": str(inspection).strip(),
                "auditors": auditors,
                "totalScore": score,
                "reportedScore": total,
                "source": f"{Path(path).name} › {ws.title} › column {openpyxl.utils.get_column_letter(start + 1)}",
                "issues": issues,
                "sections": sections,
            })
            observations.extend(_parse_observations(rows, start, audit_id, questions, findings, tally))
    return contractor_rows(audits), audits, observations


def contractor_rows(audits):
    """Every register contractor, in register order: its status, its project names, and its current sub-region (that of
    its latest audit; null before its first audit). Each audit keeps the sub-region of its own sheet."""
    latest = {}
    for a in sorted(audits, key=lambda a: (a["date"], a["id"])):
        latest[a["contractorId"]] = a["subregion"]
    return [{"id": r["contractNo"], "name": r["name"], "contractNo": r["contractNo"],
             "subregion": latest.get(r["contractNo"]), "active": r["status"] == "active", "aliases": r["aliases"]}
            for r in register()]


# --------------------------------------------------------------------------- honest score

def _ratio(sec):
    return None if not sec or not sec["possible"] else min(sec["scored"], sec["possible"]) / sec["possible"]


def true_score(sections, reported=None):
    """(score, issues): the workbook formula applied to the workbook's own points, nothing added.

    Section A = points scored / possible; B = points scored / possible; C = mean(C1, C2) (the template's
    AVERAGE(C1, C2)); total = mean of the applicable sections. Points scored above possible are capped. The
    template's "+0.012" on the total and hand-typed Final Score cells are ignored; each difference is reported.
    """
    by = {s["code"]: s for s in sections}
    issues = []
    for s in sections:
        if s["scored"] > s["possible"]:
            issues.append(f"{s['code']}: {s['scored']:g} points scored of {s['possible']:g} possible (capped at {s['possible']:g})")
    c_parts = [r for r in (_ratio(by.get("C1")), _ratio(by.get("C2"))) if r is not None]
    parts = [r for r in (_ratio(by.get("A")), _ratio(by.get("B")), sum(c_parts) / len(c_parts) if c_parts else None) if r is not None]
    score = round(sum(parts) / len(parts), 4) if parts else None
    if reported is not None and score is not None and round(reported * 100) != round(score * 100):
        issues.append(f"Excel total {round(reported * 100)}% differs from {round(score * 100)}% computed from its own points")
    return score, issues


def flag_duplicates(audits):
    """Audits of different contractors whose section points are identical: likely a copied block."""
    seen = {}
    for a in audits:
        key = tuple((s["code"], s["possible"], s["scored"]) for s in a["sections"])
        if key in seen and seen[key]["contractorId"] != a["contractorId"]:
            for x, y in ((a, seen[key]), (seen[key], a)):
                x["issues"].append(f"Section points identical to audit {y['id']}: check for a copied block")
        seen.setdefault(key, a)


# --------------------------------------------------------------------------- completed checklist workbook

def _quarter_of(d):
    return f"Q{(d.month - 1) // 3 + 1}-{d.year}"


def _label_value(rows, label):
    """Value right of a header label (' Project:', ' Date:', ...) in the first rows of the H&S sheet."""
    for row in rows[:6]:
        for i, v in enumerate(row):
            if isinstance(v, str) and v.strip() == label:
                return next((x for x in row[i + 1:] if not _empty(x)), None)
    return None


SECTION_LABELS = {"A": "MANAGEMENT", "B": "PROCESS AND PROCEDURES (ASSESSED ON SITE)", "C": "PLANNING AND COMMITMENT"}
# Part 2 row names (results workbook); Part 1 sub-headers are used when present, these when mislabelled.
SUB_LABELS = {
    "B1": "Risk Assessments Method Statements", "B2": "Competent Person Designation", "B3": "Emergency Response",
    "B4": "Work Permit", "B5": "Utility Clearance", "B6": "Subcontractor Management", "B7": "Training",
    "B8": "Incident reporting", "B9": "Fire Prevention", "B10": "Personal Protective Equipment", "B11": "Medical",
    "B12": "Occupational and Health Surveillance", "C1": "Leadership Engagement", "C2": "Planning",
}


def sections_from_answers(checklist, answers, labels):
    """Part 2 rebuilt from Part 1: A, B, B1..B12, C, C1, C2 as {code, label, possible, scored}.

    Full = weight, Partial = weight / 2, No = 0; N/A items count in neither possible nor scored.
    """
    value = {"full": 1, "partial": 0.5, "no": 0}
    acc = {}
    for item in checklist:
        a = answers.get(item["code"])
        if a is None or a == "na":
            continue
        for code in {item["section"], item["subsection"] or item["section"]}:
            p, sc = acc.get(code, (0, 0))
            acc[code] = (p + item["weight"], sc + item["weight"] * value[a])
    order = ["A", "B"] + [f"B{i}" for i in range(1, 13)] + ["C", "C1", "C2"]
    num = lambda x: int(x) if float(x).is_integer() else x
    return [{"code": c, "label": SECTION_LABELS.get(c) or SUB_LABELS[c],
             "possible": num(acc.get(c, (0, 0))[0]), "scored": num(acc.get(c, (0, 0))[1])} for c in order]


def parse_checklist_audit(path, checklist):
    """One completed H&S checklist workbook (Part 1 answers + Part 3 notes) -> (contractor, audit, observations).

    Scores come from Part 1 answers with the workbook formula (true_score); Part 2's cached values are only
    compared, never used. Pictures are not imported.
    """
    ws = _load(path)["Health & Safety"]
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    info = contractor_for(_label_value(rows, "Project:"))
    when = _to_date(_label_value(rows, "Date:"))
    quarter = _quarter_of(when)
    audit_id = f"{info['contractNo']}-{quarter}-{when:%Y%m%d}"
    answers, labels, reported, part2 = {}, {}, None, {}
    for row in rows:
        code = re.sub(r"\s+", "", str(row[1])) if row[1] is not None else ""
        if code == "TOTAL FINAL SCORE".replace(" ", ""):
            reported = _num(row[7])
        if ITEM_CODE.match(code) and isinstance(row[9], str) and row[9].strip().lower() in COMPLIANCE:
            answers.setdefault(code, {"n/a": "na"}.get(row[9].strip().lower(), row[9].strip().lower()))
        elif re.fullmatch(r"B\d+|C\d+", code) and isinstance(row[2], str):
            labels[code] = " ".join(row[2].split())
    sections = sections_from_answers(checklist, answers, labels)
    score, issues = true_score(sections, reported)
    observations = _parse_observations(rows, 1, audit_id)
    location = " ".join(str(_label_value(rows, "Location:")).split())
    m = re.search(r"sub\s*-?\s*region\s*(\d+)", location, re.I)
    return (
        {"id": info["contractNo"], "name": info["name"], "contractNo": info["contractNo"]},
        {
            "id": audit_id,
            "contractorId": info["contractNo"],
            "subregion": f"SR{m.group(1)}" if m else None,
            "quarter": quarter,
            "date": when.isoformat(),
            "location": " ".join(str(_label_value(rows, "Location:")).split()),
            "inspectionNo": str(_label_value(rows, "Inspection No.:")).strip(),
            "auditors": [" ".join(a.split()) for a in str(_label_value(rows, "Auditor:")).split(",") if a.strip()],
            "totalScore": score,
            "reportedScore": reported,
            "source": f"{Path(path).name} › Health & Safety",
            "issues": issues,
            "answers": answers,
            "sections": sections,
        },
        observations,
    )


def keep_codes(observations, previous):
    """Reuse a previous seed's itemCode for notes whose code cannot be read now (same id, same text).

    Audit 4800001112-Q4-2025-20251015's codes were recovered from that audit's own checklist workbook, which is
    no longer in data/source; its earlier import keeps them.
    """
    previous = [dict(o) for o in previous]
    pseudonymise(previous)  # an older seed may have hidden fewer names; compare both as this import hides them
    prev = {o["id"]: o for o in previous}
    for o in observations:
        p = prev.get(o["id"])
        if o["itemCode"] is None and p and p.get("itemCode") and skeleton(p["text"]) == skeleton(o["text"]):
            o["itemCode"] = p["itemCode"]
            o["category"] = p["category"]


# --------------------------------------------------------------------------- CLI

def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", required=True)
    ap.add_argument("--checklist", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--audit", action="append", default=[],
                    help="a completed H&S checklist workbook to import as one more audit (repeatable)")
    ap.add_argument("--previous", help="earlier observations.json whose recovered item codes are kept")
    args = ap.parse_args(argv)
    checklist = parse_checklist(args.checklist)
    tally = {}
    contractors, audits, observations = parse_results(args.results, checklist, None, tally)
    for path in args.audit:
        c, a, obs = parse_checklist_audit(path, checklist)
        if any(x["id"] == a["id"] for x in audits):
            raise ValueError(f"Audit {a['id']} is already in the results workbook")
        if a["subregion"] is None:  # location names no sub-region: where the contractor was last
            before = [x for x in audits if x["contractorId"] == a["contractorId"] and x["date"] < a["date"]]
            a["subregion"] = max(before, key=lambda x: x["date"])["subregion"] if before else None
        if a["subregion"] is None:
            raise ValueError(f"Audit {a['id']}: no sub-region in its location and no earlier audit to take it from")
        audits.append(a)
        observations.extend(obs)
    audits.sort(key=lambda a: (a["date"], a["id"]))
    contractors = contractor_rows(audits)
    flag_duplicates(audits)
    hashes = name_hashes()
    save_hashes(hashes)  # the local names.txt, if any, joins the committed hash list
    titled, listed = pseudonymise(observations, hashes)  # before keep_codes: the previous seed has names hidden too
    if args.previous and Path(args.previous).exists():
        keep_codes(observations, json.loads(Path(args.previous).read_text(encoding="utf-8")))
    review = review_candidates(observations, [w for c in checklist for w in re.findall(r"[A-Za-z]+", c["question"])]
                               + [w for c in contractors for w in re.findall(r"[A-Za-z]+", c["name"])])
    write_review(review)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    for name, data in (("checklist", checklist), ("contractors", contractors),
                       ("audits", audits), ("observations", observations)):
        (out / f"{name}.json").write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    quarters = sorted({a["quarter"] for a in audits}, key=lambda q: (q[3:], q[:2]))
    regions = sorted({a["subregion"] for a in audits}, key=lambda r: int(r[2:]))
    meta = {"quarters": quarters, "regions": regions, "source": [Path(args.results).name, *(Path(p).name for p in args.audit)]}
    (out / "meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    (out / "checklists").mkdir(exist_ok=True)
    (out / "checklists" / "hs.json").write_text(
        json.dumps(parse_hs_typed(args.checklist, checklist), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    sheets = set(_load(args.checklist).sheetnames)
    for kind, doc in parse_all_checklists(args.checklist, checklist).items() if set(TYPE_SHEETS.values()) <= sheets else ():
        (out / "checklists" / f"{kind}.json").write_text(
            json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    for audit_id, t in tally.items():
        if t["compliant"] or t["na"]:
            print(f"  {audit_id}: {t['compliant']} COMPLIANT, {t['na']} N/A evidence markers")
    for a in audits:
        for issue in a["issues"]:
            print(f"  ! {a['id']}: {issue}")
    print(f"  privacy: {titled} titled names and {listed} listed names replaced by Person A, B, …; "
          f"{len(review)} phrases to review in {REVIEW_FILE.relative_to(Path.cwd()) if REVIEW_FILE.is_relative_to(Path.cwd()) else REVIEW_FILE}")
    print(f"{len(contractors)} contractors, {len(audits)} audits, "
          f"{len(observations)} observations, {len(checklist)} checklist items")


if __name__ == "__main__":
    main()
