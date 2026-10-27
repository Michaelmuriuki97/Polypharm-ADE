"""OpenFDA drug-label lookup for Polypharm ADE.

This endpoint displays retrieved label text and reports exact medicine-name
mentions found in a label's Drug Interactions section. It does not confirm or
rule out medication interactions.
"""
from __future__ import annotations

import re
from typing import Literal
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

if __package__:
    from .auth import current_user
else:
    from auth import current_user


router = APIRouter(prefix="/api/clinical", tags=["drug-label-lookup"])

OPENFDA_URL = "https://api.fda.gov/drug/label.json"
MAX_MEDICINES = 20

LABEL_FIELDS = [
    "drug_interactions",
    "warnings",
    "contraindications",
    "precautions",
    "drug_and_or_laboratory_test_interactions",
    "use_in_specific_populations",
]


class PatientContext(BaseModel):
    # Retained so existing frontend requests remain compatible.
    age: int | None = Field(default=None, ge=1, le=120)
    sex: Literal["female", "male", "other"] | None = None
    renalStatus: str = "unknown"
    hepaticStatus: str = "unknown"
    conditions: list[str] = Field(default_factory=list, max_length=30)


class AnalyzeRequest(BaseModel):
    medications: list[str] = Field(min_length=1, max_length=MAX_MEDICINES)
    patient: PatientContext = Field(default_factory=PatientContext)


def clean_name(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()[:160]


def lookup_labels(client: httpx.Client, name: str) -> list[dict]:
    # Restrict the search value to ordinary medicine-name characters.
    term = re.sub(r"[^A-Za-z0-9 .'-]", "", name).strip()
    if not term:
        return []

    query = (
        f'(openfda.generic_name:"{term}" '
        f'OR openfda.brand_name:"{term}")'
    )

    try:
        response = client.get(
            OPENFDA_URL,
            params={"search": query, "limit": 3},
        )

        # openFDA uses 404 when the query finds no matching label.
        if response.status_code == 404:
            return []

        response.raise_for_status()
        records = response.json().get("results", [])
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=504,
            detail="The FDA label service timed out. Please retry.",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail="Could not reach the FDA label service. Please retry later.",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail="The FDA label service returned an unreadable response.",
        ) from exc

    matches = []

    for record in records[:3]:
        metadata = record.get("openfda", {})
        brand_names = metadata.get("brand_name") or []
        generic_names = metadata.get("generic_name") or []

        brand = brand_names[0] if brand_names else name
        generic = generic_names[0] if generic_names else name

        sections = {}
        for field in LABEL_FIELDS:
            values = record.get(field) or []
            if values:
                sections[field] = "\n\n".join(
                    str(value) for value in values
                )[:5000]

        # Keep a match even if the label has none of the selected sections.
        matches.append(
            {
                "medicineEntered": name,
                "brandName": brand,
                "genericName": generic,
                "labelId": (record.get("id") or [None])[0],
                "sections": sections,
                "source": "FDA drug labeling via openFDA",
                "sourceUrl": (
                    "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query="
                    + quote(generic)
                ),
            }
        )

    return matches


def build_interaction_summary(results: list[dict]) -> dict:
    """Find entered medicines explicitly named in retrieved label interaction text."""
    aliases = {
        item["medicine"]: {item["medicine"]}
        for item in results
    }

    # Also check matched generic and brand names. A label may use a generic
    # name even when the user entered a brand name, or the reverse.
    for item in results:
        for label in item.get("labels", []):
            for name in (
                label.get("genericName"),
                label.get("brandName"),
            ):
                if name:
                    aliases[item["medicine"]].add(name.strip())

    mentions = []
    seen = set()

    for source_item in results:
        source_medicine = source_item["medicine"]

        for label in source_item.get("labels", []):
            interaction_text = (
                label.get("sections", {}).get("drug_interactions", "")
            )
            if not interaction_text:
                continue

            for other_item in results:
                other_medicine = other_item["medicine"]

                if other_medicine == source_medicine:
                    continue

                found_match = None

                for alias in aliases[other_medicine]:
                    alias = alias.strip()
                    if len(alias) < 3:
                        continue

                    pattern = (
                        r"(?<![A-Za-z0-9])"
                        + re.escape(alias)
                        + r"(?![A-Za-z0-9])"
                    )
                    match = re.search(
                        pattern,
                        interaction_text,
                        flags=re.IGNORECASE,
                    )

                    if match:
                        found_match = match
                        break

                if not found_match:
                    continue

                pair = tuple(
                    sorted(
                        [
                            source_medicine.casefold(),
                            other_medicine.casefold(),
                        ]
                    )
                )
                label_id = label.get("labelId") or label.get("sourceUrl")
                unique_key = (pair, label_id)

                if unique_key in seen:
                    continue

                seen.add(unique_key)

                start = max(0, found_match.start() - 100)
                end = min(
                    len(interaction_text),
                    found_match.end() + 180,
                )
                excerpt = " ".join(interaction_text[start:end].split())

                mentions.append(
                    {
                        "labelMedicine": source_medicine,
                        "mentionedMedicine": other_medicine,
                        "labelName": (
                            label.get("brandName")
                            or label.get("genericName")
                            or source_medicine
                        ),
                        "excerpt": excerpt,
                        "sourceUrl": label.get("sourceUrl"),
                    }
                )

    if mentions:
        status = "label_mentions_found"
        message = (
            "Retrieved FDA Drug Interactions text explicitly mentions "
            "another medicine in your list. This is a text match to verify, "
            "not a confirmed interaction."
        )
    else:
        status = "no_direct_mention_detected"
        message = (
            "No exact medicine-name mention between your entered medicines "
            "was detected in the retrieved Drug Interactions text. This "
            "lookup cannot rule out an interaction."
        )

    return {
        "status": status,
        "message": message,
        "mentions": mentions,
    }


@router.get("/health")
def clinical_health():
    return {
        "status": "ok",
        "mode": "openFDA-label-lookup",
        "aiConfigured": False,
        "evidenceProviders": ["openFDA drug labeling"],
    }


@router.post("/analyze")
def analyze_medications(
    payload: AnalyzeRequest,
    user: dict = Depends(current_user),
):
    medications = []
    seen = set()

    for raw in payload.medications:
        name = clean_name(raw)
        if name and name.casefold() not in seen:
            seen.add(name.casefold())
            medications.append(name)

    if not medications:
        raise HTTPException(
            status_code=422,
            detail="Add at least one valid medicine name.",
        )

    results = []

    try:
        with httpx.Client(
            headers={
                "User-Agent": "Polypharm-ADE-Label-Lookup/1.0",
                "Accept": "application/json",
            },
            timeout=20,
        ) as client:
            for medicine in medications:
                results.append(
                    {
                        "medicine": medicine,
                        "labels": lookup_labels(client, medicine),
                    }
                )
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail="Could not reach the FDA label service. Please retry later.",
        ) from exc

    found_count = sum(len(item["labels"]) for item in results)
    interaction_summary = build_interaction_summary(results)

    limitations = [
        "This is an FDA label lookup, not an AI review or a definitive interaction analysis.",
        "The interaction summary only checks for explicit medicine-name mentions in retrieved label text.",
        "A missing label match or mention does not mean that a medicine or combination is safe.",
        "FDA labels may not include every risk and may vary by product.",
        "Verify the product and label information with a pharmacist or prescriber.",
    ]

    return {
        "summary": (
            f"Found {found_count} FDA label match(es) for "
            f"{len(medications)} medicine(s)."
        ),
        "labels": results,
        "interactionSummary": interaction_summary,
        "limitations": limitations,
        "metadata": {
            "mode": "openFDA label lookup",
            "source": "FDA drug labeling via openFDA",
            "validatedForClinicalUse": False,
        },
    }