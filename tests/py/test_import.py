import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import import_excel  # noqa: E402
from site_keywords import category_for  # noqa: E402

RESULTS = ROOT / "data/source/HS_AUDIT_FINDINGS_SAMPLES.xlsx"
CHECKLIST = ROOT / "data/source/Excellence_HS_checklist.xlsx"


@pytest.fixture(scope="session")
def seed_dir(tmp_path_factory):
    out = tmp_path_factory.mktemp("seed")
    import_excel.main(["--results", str(RESULTS), "--checklist", str(CHECKLIST), "--out", str(out)])
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
def test_totals_match_excel(seed):
    t = {a['id']: a['totalScore'] for a in seed.audits}
    assert len(EXCEL_TOTALS) == 20 and set(t) == set(EXCEL_TOTALS)
    for audit_id, expected in EXCEL_TOTALS.items():
        assert abs(t[audit_id] - expected) < 1e-9, audit_id
def test_sibs_has_three_audits(seed): assert sum(a['contractorId']=='4800000838' for a in seed.audits) == 3
def test_alfahd_1272_q4_counts(seed):
    obs = [o for o in seed.observations if o['auditId']=='4800001272-Q4-2025-20251029']
    assert sum(o['kind']=='positive' for o in obs) == 14 and sum(o['kind']=='site' for o in obs) == 9
def test_multiline_observation_joined(seed):  # B4.1 for Al Fahd 1272 Q4 spans several rows
    o = next(o for o in seed.observations if o['auditId']=='4800001272-Q4-2025-20251029' and o['itemCode']=='B4.1')
    assert 'permit register' in o['text'] and '\n' in o['text']
def test_checklist_weights(seed):
    w = {i['code']: i['weight'] for i in seed.checklist}
    assert sum(v for k,v in w.items() if k.startswith('A')) == 45 and w['B2.2'] == 2 and w['C2.17'] == 3
def test_every_item_has_category(seed): assert all(i['category'] for i in seed.checklist)
def test_no_phone_numbers(seed_text): assert '055-' not in seed_text
def test_site_keywords(): assert category_for(None,'site','Tower light found operational without earthing') == 'permits'
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
