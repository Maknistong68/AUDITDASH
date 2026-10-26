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
def test_totals_match_excel(seed):
    t = {a['id']: a['totalScore'] for a in seed.audits}
    assert t['4800001272-Q4-2025-20251029'] == 0.71
    assert t['4800001131-Q1-2026-20260301'] == 0.85
    assert abs(t['4800001112-Q4-2025-20251015'] - 0.620940170940171) < 1e-9
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
