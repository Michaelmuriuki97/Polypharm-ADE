"""Small SQLite/PostgreSQL connection layer for account persistence.

Production on Vercel uses the Postgres URL injected by the Neon Marketplace
integration. Local development can continue using the ignored SQLite file.
"""
from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import Any, Iterable


BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = Path(
    os.getenv("POLYPHARM_AUTH_DB", str(BASE_DIR / "data" / "polypharm_auth.db"))
)
DATABASE_URL = (
    os.getenv("DATABASE_URL")
    or os.getenv("POSTGRES_URL")
    or os.getenv("NEON_DATABASE_URL")
    or ""
).strip()


class Connection:
    """Expose one execute API for local SQLite and deployed PostgreSQL."""

    def __init__(self) -> None:
        self.is_postgres = bool(DATABASE_URL)
        if self.is_postgres:
            import psycopg
            from psycopg.rows import dict_row

            self.raw = psycopg.connect(
                DATABASE_URL,
                connect_timeout=10,
                row_factory=dict_row,
                sslmode="require",
            )
        else:
            DB_PATH.parent.mkdir(parents=True, exist_ok=True)
            self.raw = sqlite3.connect(DB_PATH, timeout=10)
            self.raw.row_factory = sqlite3.Row
            self.raw.execute("PRAGMA foreign_keys = ON")

    def execute(self, query: str, params: Iterable[Any] = ()):
        if self.is_postgres:
            query = query.replace("?", "%s")
        return self.raw.execute(query, tuple(params))

    def commit(self) -> None:
        self.raw.commit()

    def __enter__(self) -> "Connection":
        return self

    def __exit__(self, exc_type, exc_value, traceback) -> None:
        try:
            if exc_type is not None:
                self.raw.rollback()
            self.raw.commit() if exc_type is None else None
        finally:
            self.raw.close()


def connect_db() -> Connection:
    return Connection()


def is_postgres() -> bool:
    return bool(DATABASE_URL)


def integrity_error_types() -> tuple[type[BaseException], ...]:
    if not DATABASE_URL:
        return (sqlite3.IntegrityError,)

    import psycopg

    return (psycopg.IntegrityError,)
