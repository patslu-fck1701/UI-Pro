"""Synthetic checks for SQLite and isolated PostgreSQL write-lock dispatch."""
from types import SimpleNamespace

import pytest
from backend.write_lock import begin_write


class FakeDatabase:
    def __init__(self, dialect):
        self.dialect = dialect
        self.commands = []
    def get_bind(self):
        return SimpleNamespace(dialect=SimpleNamespace(name=self.dialect))
    def execute(self, command):
        self.commands.append(str(command))


@pytest.mark.parametrize("dialect,expected", [
    ("sqlite", "BEGIN IMMEDIATE"),
    ("postgresql", "SELECT pg_advisory_xact_lock(884712, 20261031)"),
])
def test_safe_dialect_specific_lock(dialect, expected):
    db = FakeDatabase(dialect)
    begin_write(db)
    assert db.commands == [expected]


def test_unknown_dialect_fails_closed():
    db = FakeDatabase("mysql")
    with pytest.raises(RuntimeError, match="Unsupported"):
        begin_write(db)
    assert db.commands == []
