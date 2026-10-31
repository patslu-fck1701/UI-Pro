"""Versioned additive hotel migration. Existing Core/Business tables are untouched."""
import os
if __name__ == "__main__" and not (
    os.environ.get("WERKZ_HOTEL_POSTGRES_ENABLED") == "1"
    and os.environ.get("WERKZ_AI_PACKAGE") == "hotel"
    and os.environ.get("WERKZ_AI_MODE") == "production"
    and os.environ.get("WERKZ_HOTEL_RUN_MIGRATIONS") == "1"
    and os.environ.get("WERKZ_HOTEL_MIGRATION_CONTEXT") == "operator-cli"
):
    raise SystemExit("REFUSED: explicit isolated Hotel PostgreSQL migration approval required")
from alembic.config import Config
from alembic import command
from ...db import engine,ROOT
def migrate():
    with engine.begin() as connection:
        config=Config();config.set_main_option('script_location',str(ROOT/'migrations'));config.attributes['connection']=connection
        command.upgrade(config,'head')


if __name__ == "__main__":
    from ...db import MODE, PACKAGE, POSTGRES_ENABLED
    if not (POSTGRES_ENABLED and PACKAGE == "hotel" and MODE == "production"
            and os.environ.get("WERKZ_HOTEL_RUN_MIGRATIONS") == "1"
            and os.environ.get("WERKZ_HOTEL_MIGRATION_CONTEXT") == "operator-cli"):
        raise SystemExit("REFUSED: explicit isolated Hotel PostgreSQL migration approval required")
    migrate()
    print("PASS: Hotel PostgreSQL migration reached the configured head")
