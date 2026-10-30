import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import import_excel  # noqa: E402
from site_keywords import category_for  # noqa: E402

RESULTS = ROOT / "data/source/HS_AUDIT_FINDINGS.xlsx"
CHECKLIST = ROOT / "data/source/AL_FAHD_1272_checklist.xlsx"


@pytest.fixture(scope="session")
def seed_dir(tmp_path_factory):
    out = tmp_path_factory.mktemp("seed")
    import_excel.main(["--results", str(RESULTS), "--checklist", str(CHECKLIST),
                       "--previous", str(ROOT / "data/seed/observations.json"), "--out", str(out)])
    return out


@pytest.fixture(scope="session")
def seed(seed_dir):
    load = lambda n: json.loads((seed_dir / f"{n}.json").read_text())
    return SimpleNamespace(
        contractors=load("contractors"),
        audits=load("audits"),
        observations=load("observations"),
        checklist=load("checklist"),
    )


@pytest.fixture(scope="session")
def seed_text(seed_dir):
    return "".join(p.read_text() for p in sorted(seed_dir.glob("*.json")))


def test_twenty_audits_twelve_contractors(seed): assert len(seed.audits) == 20 and len(seed.contractors) == 12
# Every audit's "TOTAL FINAL SCORE" cell, read straight from the workbook (checked cell by cell, not via the parser).
EXCEL_TOTALS = {
    '4800001134-Q4-2025-20251022': 0.67, '4800000901-Q4-2025-20251020': 0.68, '4800000838-Q4-2025-20251112': 0.62,
    '4800001322-Q4-2025-20251013': 0.62, '4800000838-Q4-2025-20251119': 0.65, '4800001112-Q4-2025-20251015': 0.620940170940171,
    '4800001272-Q4-2025-20251029': 0.71, '4800001131-Q4-2025-20251103': 0.74, '4800000876-Q4-2025-20251201': 0.64,
    '4800001134-Q1-2026-20260310': 0.64, '4800001112-Q1-2026-20260308': 0.60, '4800000882-Q1-2026-20260125': 0.68,
    '4200000026-Q1-2026-20260208': 0.60, '4800001322-Q1-2026-20260118': 0.76, '4800001440-Q1-2026-20260302': 0.60,
    '4800000838-Q1-2026-20260201': 0.72, '4800000892-Q1-2026-20260315': 0.62, '4800001272-Q1-2026-20260223': 0.65,
    '4800001131-Q1-2026-20260301': 0.85, '4800000876-Q1-2026-20260215': 0.66,
}
def test_reported_totals_match_excel(seed):
    t = {a['id']: a['reportedScore'] for a in seed.audits}
    assert len(EXCEL_TOTALS) == 20 and set(t) == set(EXCEL_TOTALS)
    for audit_id, expected in EXCEL_TOTALS.items():
        assert abs(t[audit_id] - expected) < 1e-9, audit_id
def test_total_is_the_formula_on_the_points(seed):
    for a in seed.audits:
        s = {x['code']: x for x in a['sections']}
        r = lambda c: min(s[c]['scored'], s[c]['possible']) / s[c]['possible']
        expected = (r('A') + r('B') + (r('C1') + r('C2')) / 2) / 3
        assert abs(a['totalScore'] - round(expected, 4)) < 1e-9, a['id']
    rpco = next(a for a in seed.audits if a['id'] == '4800001440-Q1-2026-20260302')
    assert rpco['totalScore'] == 0.4364 and any('60%' in i and '44%' in i for i in rpco['issues'])
def test_capped_and_copied_blocks_flagged(seed):
    by = {a['id']: a for a in seed.audits}
    assert any('21.5 points scored of 21' in i for i in by['4800001131-Q1-2026-20260301']['issues'])
    assert any('identical' in i for i in by['4800001322-Q4-2025-20251013']['issues'])
def test_checklist_audit_from_part1():
    # A completed checklist workbook imports as one audit (`--audit`), scored from its Part 1 answers.
    import json as _json
    checklist = import_excel.parse_checklist(CHECKLIST)
    c, a, obs = import_excel.parse_checklist_audit(CHECKLIST, checklist)
    assert a['id'] == '4800001272-Q3-2026-20260719' and len(a['answers']) == 81 and a['totalScore'] == 0.5955
    s = {x['code']: x for x in a['sections']}
    assert (s['A']['possible'], s['A']['scored']) == (49, 23) and (s['B8']['possible'], s['B8']['scored']) == (4, 2)
    assert len(obs) == 84 and sum(o['kind'] == 'positive' for o in obs) == 5 and sum(o['kind'] == 'site' for o in obs) == 11
def test_no_photos(seed): assert all('hasPhoto' not in o for o in seed.observations)
def test_sibs_has_three_audits(seed): assert sum(a['contractorId']=='4800000838' for a in seed.audits) == 3
def test_alfahd_1272_q4_counts(seed):
    obs = [o for o in seed.observations if o['auditId']=='4800001272-Q4-2025-20251029']
    assert sum(o['kind']=='positive' for o in obs) == 14 and sum(o['kind']=='site' for o in obs) == 9
def test_multiline_observation_joined(seed):  # B4.1 for Al Fahd 1272 Q4 spans several rows
    o = next(o for o in seed.observations if o['auditId']=='4800001272-Q4-2025-20251029' and o['itemCode']=='B4.1')
    assert 'permit register' in o['text'] and '\n' in o['text']
def test_checklist_weights(seed):
    w = {i['code']: i['weight'] for i in seed.checklist}
    # The Rev template's weights (A totals 49; B11/B12 sub-headers mislabelled in the sheet, subsection from the code)
    assert sum(v for k,v in w.items() if k.startswith('A')) == 49 and w['B2.2'] == 2 and w['C2.17'] == 3
    sub = {i['code']: i['subsection'] for i in seed.checklist}
    assert sub['B11.2'] == 'B11' and sub['B12.1'] == 'B12' and sub['C1.3'] == 'C1'
def test_every_item_has_category(seed): assert all(i['category'] for i in seed.checklist)
def test_no_phone_numbers(seed_text): assert '055-' not in seed_text
def test_site_keywords(): assert category_for(None,'site','Tower light found operational without earthing') == 'site'
def test_site_keywords_health(): assert category_for(None,'site','Mosquito presence was observed') == 'health'
def test_site_default(): assert category_for(None,'site','Parking area requires expansion') == 'site'
def test_positive_has_no_category(): assert category_for(None,'positive','Neat offices') is None
def test_site_keywords_medicine(): assert category_for(None,'site','Medicine expired, site nurse not maintaining inventory') == 'health'
def test_mislabelled_audit_notes_imported_as_negatives(seed):  # 4800001112-Q4-2025-20251015
    obs = [o for o in seed.observations if o['auditId']=='4800001112-Q4-2025-20251015']
    neg = [o for o in obs if o['kind']=='negative']
    assert sum(o['kind']=='positive' for o in obs) == 17 and len(neg) >= 40
    assert all(o['category'] for o in neg)
def test_every_non_positive_has_category(seed):
    assert all(o['category'] for o in seed.observations if o['kind'] != 'positive')
def test_mislabelled_audit_item_codes_recovered(seed):
    neg = [o for o in seed.observations if o['auditId']=='4800001112-Q4-2025-20251015' and o['kind']=='negative']
    assert sum(bool(o['itemCode']) for o in neg) >= 50


@pytest.mark.parametrize("text,expected", [
    ("Not Applicable.\nThere were no Oxy-Fuel rigs at site", True),
    ("• not applicable - no excavation", True),
    ("* N/A - no hot work", True),
    ("NA - no confined space", True),
    ("NA-no lifting", True),
    ("N/A", True),
    ("  - Not applicable", True),
    ("NAZ Steel subcontractor approved", False),
    ("Nail guns were stored safely", False),
    ("Yes, there is a medical facility", False),
    ("", False),
])
def test_is_na_note(text, expected):
    assert import_excel.is_na_note(text) is expected


def test_no_na_notes_in_seed(seed):
    assert not any(import_excel.is_na_note(o["text"]) for o in seed.observations)
    ids = [o["id"] for o in seed.observations]
    assert len(ids) == len(set(ids))


# --------------------------------------------------------------------------- five audit types (Task 9)
TYPES = ("hs", "security", "environmental", "welfare", "crc")


@pytest.fixture(scope="session")
def typed(seed_dir):
    # The checklist workbook in data/source has only the H&S sheet; the other types' checklists come from the committed
    # import of the full checklist workbook (data/seed/checklists), which the importer leaves untouched.
    def load(t):
        p = seed_dir / "checklists" / f"{t}.json"
        return json.loads((p if p.exists() else ROOT / "data/seed/checklists" / f"{t}.json").read_text())
    return {t: load(t) for t in TYPES}


def test_checklists_written_for_every_type(typed):
    for t in TYPES:
        assert typed[t]["type"] == t and len(typed[t]["items"]) > 0 and len(typed[t]["sections"]) > 0


def test_codes_unique_per_type_and_weights_numeric(typed):
    for t in TYPES:
        codes = [i["code"] for i in typed[t]["items"]]
        assert len(codes) == len(set(codes)), t
        assert all(isinstance(i["weight"], (int, float)) and not isinstance(i["weight"], bool) and i["weight"] > 0
                   for i in typed[t]["items"]), t


def test_hs_typed_matches_legacy_checklist(typed, seed):
    assert typed["hs"]["items"] == seed.checklist


def test_item_counts(typed):
    assert len(typed["hs"]["items"]) == len(import_excel.parse_checklist(CHECKLIST))
    assert len(typed["security"]["items"]) == 73
    assert len(typed["environmental"]["items"]) == 76 and len(typed["welfare"]["items"]) == 118


def test_non_hs_category_is_section_slug(typed):
    for t in ("security", "environmental", "welfare", "crc"):
        sec_ids = {s["category"] for s in typed[t]["sections"]}
        assert sec_ids == {f"{t}:{s['code']}" for s in typed[t]["sections"]}
        for i in typed[t]["items"]:
            assert i["category"] == f"{t}:{i['section']}" and i["category"] in sec_ids
        assert all(s["title"] for s in typed[t]["sections"])


def test_security_sections_a_to_q(typed):
    assert [s["code"] for s in typed["security"]["sections"]] == list("ABCDEFGHIJKLMNOPQ")
    assert typed["security"]["sections"][0]["title"] == "Documentation"


def test_environment_subheaders_not_items(typed):
    codes = {i["code"] for i in typed["environmental"]["items"]}
    assert "G1.1" in codes and "G1" not in codes and "H3.4" in codes
    assert next(i for i in typed["environmental"]["items"] if i["code"] == "G1.1")["subsection"] == "G1"


def test_welfare_missing_weight_defaults_to_one(typed):
    w = {i["code"]: i["weight"] for i in typed["welfare"]["items"]}
    assert w["E1"] == 1 and w["E2"] == 1


def test_crc_thirteen_areas(typed):
    items = typed["crc"]["items"]
    assert len(items) == 13
    assert [i["code"] for i in items] == [f"CRC{n}" for n in range(1, 14)]
    assert all(i["weight"] == 1 and i["section"] == "A" and i["category"] == "crc:A" for i in items)
    assert items[0]["question"] == "Confined Space"
    assert items[8]["question"] == items[12]["question"] == "Working in the Heat"


def test_lifting_site_finding_maps_to_site():
    assert category_for(None, 'site', 'Lifting operation without a lift plan') == 'site'
    assert category_for('B4.1', 'negative', 'x') == 'documents'


# --------------------------------------------------------------------------- evidence markers (COMPLIANT / N/A)

NBC_Q1 = "4200000026-Q1-2026-20260208"


@pytest.fixture(scope="session")
def marker_tally():
    tally = {}
    checklist = import_excel.parse_checklist(CHECKLIST)
    import_excel.parse_results(RESULTS, checklist, CHECKLIST, tally)
    return tally


@pytest.mark.parametrize("cells, expected", [
    (["COMPLIANT"], "compliant"), (["Compliant"], "compliant"), (["compliant - see photo"], "compliant"),
    (["NON-COMPLIANT"], None), (["Non Compliant"], None), (["non-compliant"], None),
    (["N/A"], "na"), (["NA"], "na"), (["na"], "na"), (["Not Applicable"], "na"), (["NOT APPLICABLE - no rigs"], "na"),
    (["Picture"], None), (["First audit schedule in first quarter"], None), (["Addressed in A9"], None),
    ([None, 3, "Picture", "COMPLIANT"], "compliant"), ([], None), (["NATIONAL standard"], None),
])
def test_evidence_marker(cells, expected):
    assert import_excel.evidence_marker(cells) == expected


def test_nbc_q1_markers(marker_tally):
    t = marker_tally[NBC_Q1]
    assert t["compliant"] >= 16 and t["na"] >= 10, t


def test_marker_totals_reported_per_audit(marker_tally, seed):
    assert set(marker_tally) == {a["id"] for a in seed.audits if "answers" not in a}  # results-workbook audits
    assert all(set(t) == {"compliant", "na"} for t in marker_tally.values())
    assert sum(t["compliant"] for t in marker_tally.values()) > sum(t["na"] for t in marker_tally.values()) > 0


def test_observations_carry_marker(seed):
    assert all(o["marker"] in (None, "compliant", "na") for o in seed.observations)
    nbc = {o["itemCode"]: o["marker"] for o in seed.observations if o["auditId"] == NBC_Q1 and o["itemCode"]}
    assert nbc["B2.2"] == nbc["B3.1"] == nbc["C2.16"] == "compliant"
    assert nbc["B6.1"] == "na"
    assert nbc["A1"] is None


# --------------------------------------------------------------------------- contractor register, sub-region per audit

def test_audit_subregion_is_its_sheet(seed):
    wb = import_excel._load(RESULTS)
    by_sheet = {}
    for ws in wb.worksheets:
        q, sr = import_excel._sheet_meta(ws.title)
        by_sheet.setdefault(q, set()).add(sr)
    assert all(a["subregion"] in by_sheet[a["quarter"]] for a in seed.audits)
    jv = [a for a in seed.audits if a["contractorId"] == "4800001131"]
    assert {a["subregion"] for a in jv} == {"SR2"}


def test_contractors_carry_status_aliases_and_latest_subregion(seed):
    for c in seed.contractors:
        assert c["active"] is True and c["aliases"]
        last = max((a for a in seed.audits if a["contractorId"] == c["id"]), key=lambda a: a["date"])
        assert c["subregion"] == last["subregion"]


def _register(tmp_path, rows):
    p = tmp_path / "contractors.csv"
    p.write_text("contract_no,name,status,project_names\n" + "\n".join(rows) + "\n", encoding="utf-8")
    return p


def test_register_rows(tmp_path):
    from contractors import load_register
    rows = load_register(_register(tmp_path, ["1,One,active,ONE-1 | One Co", "2,Two,inactive,", "3,Three,,THREE"]))
    assert [(r["contractNo"], r["status"], r["aliases"]) for r in rows] == [
        ("1", "active", ["ONE-1", "One Co"]), ("2", "inactive", []), ("3", "active", ["THREE"])]


@pytest.mark.parametrize("bad, msg", [
    (["1,One,paused,"], "status"),
    (["1,One,active,", "1,Again,active,"], "twice"),
    (["1,One,active,X", "2,Two,active,X"], "already belongs"),
    ([",NoNumber,active,"], "required"),
])
def test_register_rejects_bad_rows(tmp_path, bad, msg):
    from contractors import load_register
    with pytest.raises(ValueError, match=msg):
        load_register(_register(tmp_path, bad))


def test_unknown_project_says_where_to_add_it():
    from contractors import contractor_for
    with pytest.raises(ValueError, match="contractors.csv"):
        contractor_for("A brand new contractor")
    assert contractor_for("Renamed project 4800001440")["contractNo"] == "4800001440"
