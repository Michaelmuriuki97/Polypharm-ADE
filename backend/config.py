"""Load settings from backend/.env without adding another dependency."""
from pathlib import Path
import os

env_file = Path(__file__).resolve().parent / ".env"

if env_file.is_file():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()

        if value[:1] in ("'", '"') and value[-1:] == value[:1]:
            value = value[1:-1]

        if key:
            os.environ[key] = value