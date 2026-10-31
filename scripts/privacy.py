"""Hide people's names in observation text (PDPL data minimisation, audit 2026-10-31 §5).

Auditors write names after a title ("Mr. Sherif Elgohary", "Eng. Naeem"). Each distinct name becomes
"Person A", "Person B", … within its audit, so a note still reads ("Person A's CV is approved") and two notes
about the same person still match. Names written without a title are not detected: keep titles in the Excel,
or check the printed count after an import.
"""

import re

_TITLE = r"(?:Mr|Mrs|Ms|Miss|Mx|Dr|Eng|Engr|Sheikh)"
# A title, then one to three capitalised words ("Mr. Morched Chebbo", "Mr.Monawar", "Eng. Abdul Al-Harbi").
NAME = re.compile(rf"\b{_TITLE}\.?\s*((?:[A-Z][A-Za-z'\-]+)(?:\s+(?:[A-Z][A-Za-z'\-]+|al-|Al-|bin|Bin|ibn)){{0,2}})")


def _label(n: int) -> str:
    s = ""
    n += 1
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return f"Person {s}"


def pseudonymise(observations):
    """Replace titled names in place, per audit. Returns how many names were replaced."""
    seen, count = {}, 0
    for o in observations:
        names = seen.setdefault(o["auditId"], {})

        def sub(m):
            nonlocal count
            count += 1
            key = m.group(1).lower()
            if key not in names and " " not in key:  # "Mr. Sherif" after "Mr. Sherif Elgohary": the same person
                key = next((k for k in names if k.startswith(key + " ")), key)
            names.setdefault(key, _label(len(set(names.values()))))
            return names[key]

        o["text"] = NAME.sub(sub, o["text"])
    return count


def hidden_text(observation):
    """The observation's text as pseudonymise would leave it (the observation itself is not changed)."""
    copy = dict(observation)
    pseudonymise([copy])
    return copy["text"]
