"""Contractor alias table: every raw `Project` string seen in the results workbook."""

import re

# contractNo -> (name, subregion)
CONTRACTS = {
    "4800001134": ("Abyatona (Box Culvert H55)", "SR1"),
    "4800001112": ("Abyatona (Zone F Culvert)", "SR1"),
    "4800000901": ("Al-Biriki", "SR1"),
    "4800000838": ("SIBS", "SR1"),
    "4800001322": ("PPCO", "SR1"),
    "4800000882": ("Al Fahd (SBC Expansion)", "SR1"),
    "4200000026": ("NBC", "SR1"),
    "4800001440": ("RPCO", "SR1"),
    "4800000892": ("TDP", "SR1"),
    "4800001272": ("Al Fahd (Coast Guard)", "SR2"),
    "4800001131": ("JV-ECH (Port T1)", "SR2"),
    "4800000876": ("Sarco Disa (Port T2)", "SR2"),
}

_ALIASES = {
    "4800001134": ["4800001134-ABYATONA"],
    "4800001112": ["4800001112-ABYATONA"],
    "4800000901": ["480000901-AL-BIRIKI"],
    "4800000838": ["SIBS 838", "SIBS - 4800000838", "800000838-SIBS"],
    "4800001322": ["4800001322-PPCO"],
    "4800000882": ["4800000882-AL FAHD"],
    "4200000026": ["4200000026 - NBC"],
    "4800001440": ["4800001440-RPCO"],
    "4800000892": ["4800000892-TDP"],
    "4800001272": ["AL FAHD-4800001272"],
    "4800001131": ["JV-ECH-T1-4800001131"],
    "4800000876": [
        "Design and Build for OXAGON Terminal 2 (T2) Dredging and Quay Walls-D&B",
        "Sarco Disa - 4800000876",
    ],
}


def _norm(raw: str) -> str:
    return re.sub(r"\s+", " ", str(raw)).strip()


# raw project string -> {contractNo, name, subregion}
CONTRACTORS = {
    _norm(alias): {"contractNo": no, "name": CONTRACTS[no][0], "subregion": CONTRACTS[no][1]}
    for no, aliases in _ALIASES.items()
    for alias in aliases
}


def contractor_for(raw: str) -> dict:
    key = _norm(raw)
    if key not in CONTRACTORS:
        raise ValueError(f"Unknown project string: {raw!r}")
    return CONTRACTORS[key]
