"""Push data/seed/*.json to the Supabase tables (after scripts/import_excel.py).

    SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... python3 scripts/sync_supabase.py [--seed data/seed]

Upserts every row by id (checklist items by code), in batches, through PostgREST with the service role (which
bypasses row-level security: keep that key on the machine that runs imports, never in the app's public env).
Rows that disappeared from the seed are not deleted: remove them in the dashboard if an audit was withdrawn.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

TABLES = {  # table -> (seed file, key column, extra columns from the record)
    "contractors": ("contractors.json", "id", {}),
    "checklist_items": ("checklist.json", "code", {}),
    "audits": ("audits.json", "id", {"contractor_id": "contractorId", "quarter": "quarter"}),
    "observations": ("observations.json", "id", {"audit_id": "auditId"}),
}
BATCH = 300


def rows_for(table, seed):
    file, key, extra = TABLES[table]
    now = datetime.now(timezone.utc).isoformat()
    out = []
    for i, r in enumerate(json.loads((seed / file).read_text(encoding="utf-8"))):
        row = {key: r[key if key == "id" else "code"], "position": i, "doc": r, "updated_at": now}
        row.update({col: r[src] for col, src in extra.items()})
        out.append(row)
    return out, key


def upsert(url, key, table, rows, on_conflict):
    req = urllib.request.Request(
        f"{url}/rest/v1/{table}?on_conflict={on_conflict}",
        data=json.dumps(rows).encode("utf-8"),
        method="POST",
        headers={
            "apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as res:
        return res.status


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", default=str(Path(__file__).resolve().parents[1] / "data" / "seed"))
    args = ap.parse_args(argv)
    url, key = os.environ.get("SUPABASE_URL", "").rstrip("/"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (Supabase dashboard → Project settings → API keys).")
    seed = Path(args.seed)
    try:
        for table in TABLES:  # contractors before audits before observations (foreign keys)
            rows, on_conflict = rows_for(table, seed)
            for k in range(0, len(rows), BATCH):
                upsert(url, key, table, rows[k:k + BATCH], on_conflict)
            print(f"  {table}: {len(rows)} rows")
        meta = json.loads((seed / "meta.json").read_text(encoding="utf-8"))
        upsert(url, key, "meta", [{"id": 1, "doc": meta, "updated_at": datetime.now(timezone.utc).isoformat()}], "id")
        print("  meta: 1 row")
    except urllib.error.HTTPError as e:
        sys.exit(f"{e.code} from Supabase: {e.read().decode('utf-8', 'replace')[:400]}")


if __name__ == "__main__":
    main()
