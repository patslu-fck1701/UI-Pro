"""Dialect-aware, transactional write serialization for existing hotel workflows.

SQLite preserves BEGIN IMMEDIATE behavior. PostgreSQL uses a transaction-level
advisory lock instead; it is released automatically on COMMIT or ROLLBACK.
Only the explicitly configured hotel-test database/schema uses PostgreSQL.
"""
from sqlalchemy import text


def begin_write(db):
    dialect = db.get_bind().dialect.name
    if dialect == "sqlite":
        db.execute(text("BEGIN IMMEDIATE"))
    elif dialect == "postgresql":
        # Deterministic, transaction-scoped application mutex. No table-wide
        # locks and no SQL injection; safe for small synthetic test workloads.
        db.execute(text("SELECT pg_advisory_xact_lock(884712, 20261031)"))
    else:
        raise RuntimeError("Unsupported hotel database backend.")
