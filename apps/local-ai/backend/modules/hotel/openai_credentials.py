"""Read only the OpenAI key from a private, operator-configured env file.

Never copy the env file into Git, Render, logs or API responses. Cloud deployments
should instead use their own secret environment variable OPENAI_API_KEY.
"""
import os
from pathlib import Path


def openai_api_key() -> str:
    direct = os.environ.get("OPENAI_API_KEY", "").strip()
    if direct:
        return direct

    location = os.environ.get("WERKZ_HOTEL_OPENAI_ENV_FILE", "")
    if not location:
        return ""
    try:
        path = Path(location)
        # Only an explicitly selected absolute regular file may be read.
        if not path.is_absolute() or path.is_symlink() or not path.is_file():
            return ""
        if path.stat().st_size > 65536:
            return ""
        key = ""
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            item = line.strip()
            if not item or item.startswith("#"):
                continue
            if item.startswith("export "):
                item = item[len("export "):].strip()
            name, delimiter, value = item.partition("=")
            if delimiter and name.strip() == "OPENAI_API_KEY":
                if key:
                    # Ambiguous duplicate keys fail closed.
                    return ""
                value = value.strip()
                if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
                    value = value[1:-1]
                if not value or len(value) > 4096 or any(c.isspace() for c in value):
                    return ""
                key = value
        return key
    except (OSError, UnicodeError, ValueError):
        return ""
