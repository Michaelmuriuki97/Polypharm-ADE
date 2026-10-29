"""Read the Pharmacy and Poisons Board's public medication-error dashboard."""
from __future__ import annotations

import asyncio
import re
import time
from datetime import datetime, timezone
from html.parser import HTMLParser

import httpx
from fastapi import APIRouter, HTTPException


router = APIRouter()
SOURCE_URL = "https://pv.pharmacyboardkenya.org/reports/medications_summary"
REFRESH_SECONDS = 15 * 60
_cached_payload: dict | None = None
_cached_at = 0.0
_cache_lock = asyncio.Lock()


class _DashboardTables(HTMLParser):
    """Collect visible table rows without requiring an HTML parsing package."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tables: list[list[list[str]]] = []
        self._table_depth = 0
        self._row: list[str] | None = None
        self._cell: list[str] | None = None

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag == "table":
            self._table_depth += 1
            if self._table_depth == 1:
                self.tables.append([])
        elif self._table_depth and tag == "tr":
            self._row = []
        elif self._table_depth and tag in {"td", "th"}:
            self._cell = []

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            value = " ".join(data.split())
            if value:
                self._cell.append(value)

    def handle_endtag(self, tag: str) -> None:
        if self._table_depth and tag in {"td", "th"} and self._cell is not None:
            assert self._row is not None
            self._row.append(" ".join(self._cell).strip())
            self._cell = None
        elif self._table_depth and tag == "tr" and self._row is not None:
            if any(self._row):
                self.tables[-1].append(self._row)
            self._row = None
        elif tag == "table" and self._table_depth:
            self._table_depth -= 1


def _number_from_row(row: list[str]) -> int | None:
    for value in reversed(row):
        digits = re.sub(r"[^0-9]", "", value)
        if digits:
            return int(digits)
    return None


def _extract_counts(html: str) -> tuple[int, int, int, int]:
    parser = _DashboardTables()
    parser.feed(html)

    total_errors: int | None = None
    by_year: dict[int, int] = {}
    for rows in parser.tables:
        table_text = " ".join(" ".join(row) for row in rows).casefold()
        is_error_table = "error" in table_text and "medication" in table_text
        if not is_error_table:
            continue

        has_county = "county" in table_text
        has_product = "product" in table_text or "intended" in table_text
        for row in rows:
            normalized = [cell.strip().casefold() for cell in row]
            if has_county and not has_product and "total" in normalized:
                total_errors = _number_from_row(row)
            for cell in row:
                match = re.fullmatch(r"20\d{2}", cell.strip())
                if match:
                    count = _number_from_row(row)
                    if count is not None:
                        by_year[int(match.group())] = count

    if total_errors is None or not by_year:
        raise ValueError("The public dashboard format did not contain the expected totals.")

    current_year = max(by_year)
    current_year_count = by_year[current_year]
    prior_year_count = by_year.get(current_year - 1, 0)
    return total_errors, current_year, current_year_count, prior_year_count


async def _fetch_dashboard() -> dict:
    async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
        response = await client.get(
            SOURCE_URL,
            headers={"User-Agent": "Polypharm-ADE safety dashboard/1.0"},
        )
        response.raise_for_status()

    total, current_year, current_year_count, prior_year = _extract_counts(response.text)
    return {
        "totalReportedErrors": total,
        "currentYear": current_year,
        "currentYearReportedErrors": current_year_count,
        "priorYearReportedErrors": prior_year,
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "source": SOURCE_URL,
    }


@router.get("/api/safety/live")
async def live_safety_data() -> dict:
    global _cached_payload, _cached_at
    now = time.monotonic()
    if _cached_payload is not None and now - _cached_at < REFRESH_SECONDS:
        return _cached_payload

    async with _cache_lock:
        now = time.monotonic()
        if _cached_payload is not None and now - _cached_at < REFRESH_SECONDS:
            return _cached_payload
        try:
            payload = await _fetch_dashboard()
        except (httpx.HTTPError, ValueError) as exc:
            raise HTTPException(
                status_code=502,
                detail="The live Pharmacy and Poisons Board report is temporarily unavailable.",
            ) from exc
        _cached_payload = payload
        _cached_at = time.monotonic()
        return payload
