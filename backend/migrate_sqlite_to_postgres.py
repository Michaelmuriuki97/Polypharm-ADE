"""Copy existing SQLite auth records into the configured PostgreSQL database.

Run once with DATABASE_URL set and a trusted SQLite export available locally:
    python -m backend.migrate_sqlite_to_postgres path/to/polypharm_auth.db

The migration is additive and idempotent. Existing Postgres rows are preserved.
"""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

from .database import connect_db, is_postgres
from .auth import init_auth_db


TABLES = ("users", "auth_sessions", "password_reset_tokens")
COLUMNS = {
    "users": "id, full_name, email, password_hash, created_at",
    "auth_sessions": "id, user_id, token_hash, expires_at, created_at",
    "password_reset_tokens": "id, user_id, token_hash, expires_at, created_at",
}


def migrate(source_path: Path) -> dict[str, int]:
    if not is_postgres():
        raise RuntimeError("Set DATABASE_URL to the target PostgreSQL database first.")
    if not source_path.is_file():
        raise FileNotFoundError(f"SQLite export not found: {source_path}")

    init_auth_db()
    source = sqlite3.connect(f"file:{source_path.resolve().as_posix()}?mode=ro", uri=True)
    source.row_factory = sqlite3.Row
    counts: dict[str, int] = {}
    try:
        with connect_db() as target:
            for table in TABLES:
                columns = COLUMNS[table]
                rows = source.execute(f"SELECT {columns} FROM {table}").fetchall()
                placeholders = ", ".join("?" for _ in columns.split(", "))
                for row in rows:
                    target.execute(
                        f"INSERT INTO {table} ({columns}) VALUES ({placeholders}) "
                        "ON CONFLICT DO NOTHING",
                        tuple(row[column.strip()] for column in columns.split(",")),
                    )
                counts[table] = len(rows)

            for table in TABLES:
                target.execute(
                    "SELECT setval(pg_get_serial_sequence(?, 'id'), "
                    f"GREATEST(COALESCE((SELECT MAX(id) FROM {table}), 1), 1), "
                    f"COALESCE((SELECT MAX(id) FROM {table}), 0) > 0)",
                    (table,),
                )
    finally:
        source.close()
    return counts


if __name__ == "__main__":
    sqlite_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("data/polypharm_auth.db")
    result = migrate(sqlite_path)
    print("SQLite records read:", ", ".join(f"{name}={count}" for name, count in result.items()))
