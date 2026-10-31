"""Hide people's names in observation text (PDPL data minimisation, audit 2026-10-31 §5).

Three layers, applied per audit so that one person keeps one label ("Person A", "Person B", …) across the notes
of that audit and a note still reads ("Person A's CV is approved"):

1. Titled names: "Mr. Sherif Elgohary", "MR. Thamer", "Eng Abdul Al-Harbi", "Mr. Mohd. Alkishief", "(Mr Akbar shah)".
2. Listed names. Auditors write many names without a title, in brackets or in lists, and no pattern finds those
   safely. Put them in data/source/names.txt (one per line; git-ignored like the workbooks). The import stores
   only their SHA-256 in data/privacy-names.sha256, which is committed, so any later import on any machine hides
   the same names without the list itself ever entering the repository.
3. Everything the first two layers did not catch that still looks like a name (two or three capitalised words that
   are not vocabulary of the checklist, a contractor or the site) is written to data/source/privacy-review.txt for a
   human to read after every import. Add the real names to names.txt and import again.

The importer prints the counts of all three. The count of names hidden says what was replaced, not that nothing
is left: the review file does.
"""

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NAMES_FILE = ROOT / "data" / "source" / "names.txt"
REVIEW_FILE = ROOT / "data" / "source" / "privacy-review.txt"
HASHES_FILE = ROOT / "data" / "privacy-names.sha256"

# Title case in any spelling ("Mr", "mr", "Mrs", "Dr", "Eng", "Engr", "Sheikh"); all-caps only with its period
# ("MR. Thamer"), so "MSRA", "MST" and "MSDS" never count; "Ms", "Miss", "Mx" only as written in title case.
_TITLE = r"(?:[Mm]rs?|[Dd]r|[Ee]ngr?|[Ss]heikh|Ms|Miss|Mx|(?:MR|MRS|DR|ENG|ENGR)(?=\.))"
# A capitalised (or ALL-CAPS) word, "Mohd." included; name connectors; a lowercase surname is taken only when
# punctuation follows it ("(Mr. Akbar shah)"), so "Mr. Monawar and" keeps "and".
_WORD = r"[A-Z][A-Za-z'\-]*\.?"
_CONN = r"(?:[Aa][Ll]-|[Bb]in|[Ii]bn|[Aa]bu)"
NAME = re.compile(
    rf"\b{_TITLE}(?:\.[ \t]*|[ \t]+)({_WORD}(?:[ \t]+(?:{_CONN}[ \t]*)?{_WORD}){{0,2}}"
    rf"(?:[ \t]+[a-z][a-z'\-]+(?=[ \t]*(?:[),.;:/]|$)))?)"
)
_RUN = re.compile(r"[A-Za-z][A-Za-z'\-]*")

# Words that end a capitalised run in the review pass: role titles, site and checklist vocabulary, months.
_STOP = set("""
a an the and or of for to in on at by with from as is are was were be not no yes also both two three
january february march april may june july august september october november december
mon tue wed thu fri sat sun q1 q2 q3 q4 sr1 sr2 sr3
contractor contractors subcontractor subcontractors supervisor supervisors manager managers engineer engineers
officer officers coordinator electrician electricians nurse paramedic doctor doctors worker workers staff team site
safety health hse hsse hsw environmental environment security welfare plan plans policy procedure procedures
program programme training matrix register permit permits method statement risk assessment assessments
audit audits auditor auditors auditee inspection inspections checklist report reports review evidence
approved approval code class aconex neom pmc pmo client project projects zone port coast guard culvert box
pipe line expansion sub region subregion kingdom saudi arabia ksa co company contracting consortium
excavation lifting scaffold scaffolding electrical fire emergency first aid ppe msra rams ptw car ncr dab cv
crane cranes mobile rail cable cathodic protection asphalt concrete pavement paving interlock compaction
weekly monthly daily quarterly annual yearly major minor violation smoke drill expired medicine trend indicators
""".split())

_LABEL = re.compile(r"\bPerson [A-Z]+\b")
_TITLED_LABEL = re.compile(rf"\b{_TITLE}\.?[ \t]*(Person [A-Z]+\b)")


def _label(n: int) -> str:
    s = ""
    n += 1
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return f"Person {s}"


def _sha(name: str) -> str:
    return hashlib.sha256(re.sub(r"\s+", " ", name.strip().lower()).encode("utf-8")).hexdigest()


def load_names(path=NAMES_FILE):
    """Plain names from the local list (never committed)."""
    if not Path(path).exists():
        return []
    names = [ln.strip() for ln in Path(path).read_text(encoding="utf-8").splitlines()]
    return [n for n in names if n and not n.startswith("#")]


def load_hashes(path=HASHES_FILE):
    if not Path(path).exists():
        return set()
    return {ln.strip() for ln in Path(path).read_text(encoding="utf-8").splitlines() if ln.strip() and not ln.startswith("#")}


def save_hashes(hashes, path=HASHES_FILE):
    path.write_text("# SHA-256 of lower-cased names hidden at import (scripts/privacy.py). Add names in data/source/names.txt.\n"
                    + "".join(h + "\n" for h in sorted(hashes)), encoding="utf-8")


def name_hashes(names=None, hashes=None):
    """The committed hashes plus those of the local list (the importer saves the union)."""
    return (load_hashes() if hashes is None else set(hashes)) | {_sha(n) for n in (load_names() if names is None else names)}


def _hashed_sub(text, hashes, label_for):
    """Replace every run of 1–3 words whose SHA-256 is listed, longest run first. Returns (text, count)."""
    toks = list(_RUN.finditer(text))
    out, i, last, n = [], 0, 0, 0
    while i < len(toks):
        hit = 0
        for k in (3, 2, 1):
            if i + k > len(toks):
                continue
            span = text[toks[i].start():toks[i + k - 1].end()]
            if k > 1 and not re.fullmatch(r"[A-Za-z'\-]+(?:[ \t]+[A-Za-z'\-]+)*", span):
                continue
            if _sha(span) in hashes:
                hit = k
                break
        if hit:
            out.append(text[last:toks[i].start()])
            out.append(label_for(text[toks[i].start():toks[i + hit - 1].end()]))
            last = toks[i + hit - 1].end()
            i += hit
            n += 1
        else:
            i += 1
    out.append(text[last:])
    return "".join(out), n


def pseudonymise(observations, hashes=None):
    """Replace names in place, per audit. Returns (titled names replaced, listed names replaced)."""
    hashes = name_hashes() if hashes is None else hashes
    seen, titled_n, listed_n = {}, 0, 0
    for o in observations:
        labels = seen.setdefault(o["auditId"], {})

        def label_for(raw):
            key = re.sub(r"\s+", " ", raw).strip().lower().rstrip(".")
            if key not in labels and " " not in key:  # "Mr. Sherif" after "Mr. Sherif Elgohary": the same person
                key = next((k for k in labels if k.startswith(key + " ")), key)
            return labels.setdefault(key, _label(len(set(labels.values()))))

        def titled(m):
            nonlocal titled_n
            titled_n += 1
            return label_for(m.group(1))

        text = NAME.sub(titled, o["text"])
        if hashes:
            text, n = _hashed_sub(text, hashes, label_for)
            listed_n += n
        o["text"] = _TITLED_LABEL.sub(r"\1", text)  # "Mr. sabeer" → listed layer → "Mr. Person B" → "Person B"
    return titled_n, listed_n


def skeleton(text: str) -> str:
    """Text with every label (and a surname left beside one by an older import) removed: equal across imports."""
    return re.sub(r"\s+", " ", re.sub(r"\bPerson [A-Z]+\b(?:[ \t]+[a-z][a-z'\-]+(?=[ \t]*(?:[),.;:/]|$)))?", "", text)).strip()


def review_candidates(observations, vocabulary=()):
    """[(auditId, phrase)] of capitalised runs of 2–3 words that look like names and are not known vocabulary."""
    vocab = {w.lower() for w in vocabulary} | _STOP
    run = re.compile(r"\b([A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+){1,2})\b")
    caps = re.compile(r"\b([A-Z]{3,}(?:[ \t]+[A-Z]{3,}){1,2})\b")
    out, seen = [], set()
    for o in observations:
        for rx in (run, caps):
            for m in rx.finditer(o["text"]):
                words = m.group(1).split()
                if any(w.lower() in vocab for w in words) or m.group(1).startswith("Person "):
                    continue
                key = (o["auditId"], m.group(1))
                if key not in seen:
                    seen.add(key)
                    out.append(key)
    return out


def write_review(candidates, path=REVIEW_FILE):
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = ["# Capitalised phrases the import could not clear. Add real names to names.txt and import again.", ""]
    lines += [f"{a}\t{p}" for a, p in candidates]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
