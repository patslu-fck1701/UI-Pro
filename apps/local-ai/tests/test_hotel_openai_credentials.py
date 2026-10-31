"""Synthetic secret-loading tests: no real keys, network calls or Windows drive access."""
from pathlib import Path

from backend.modules.hotel.openai_credentials import openai_api_key


def test_disabled_without_explicit_source(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("WERKZ_HOTEL_OPENAI_ENV_FILE", raising=False)
    assert openai_api_key() == ""


def test_reads_only_named_key_from_operator_selected_private_file(tmp_path, monkeypatch):
    filename = tmp_path / "Gini – WerkZ AiZ Core.env"
    filename.write_text("# local only\nUNRELATED_SECRET=not-for-export\n"
                        "OPENAI_API_KEY='sk-synthetic-test-only'\n", encoding="utf-8-sig")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("WERKZ_HOTEL_OPENAI_ENV_FILE", str(filename))
    assert openai_api_key() == "sk-synthetic-test-only"
    monkeypatch.setenv("OPENAI_API_KEY", "sk-runtime-secret")
    assert openai_api_key() == "sk-runtime-secret"


def test_fails_closed_on_duplicate_key_or_invalid_source(tmp_path, monkeypatch):
    file = tmp_path / "secrets.env"
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("WERKZ_HOTEL_OPENAI_ENV_FILE", str(file))
    file.write_text("OPENAI_API_KEY=one\nOPENAI_API_KEY=two\n", encoding="utf-8")
    assert openai_api_key() == ""
    monkeypatch.setenv("WERKZ_HOTEL_OPENAI_ENV_FILE", str(tmp_path))
    assert openai_api_key() == ""


def test_never_loads_secret_from_relative_path(tmp_path, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("WERKZ_HOTEL_OPENAI_ENV_FILE", "secrets.env")
    assert openai_api_key() == ""
