"""
Run:  pytest -q
Tests prove the engine finds every planted exception, the BRS math is right,
and the AI guardrails reject bad LLM output (using a fake LLM, so no API key needed).
"""
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from recon import ai
from recon.data import DataError, load_bank, load_ledger
from recon.engine import _is_transposition, reconcile, similarity
from recon.report import brs, proposed_entries

DATA = Path(__file__).parent.parent / "data"


@pytest.fixture(scope="module")
def result():
    return reconcile(load_bank(DATA / "bank_statement.csv"),
                     load_ledger(DATA / "general_ledger.csv"))


def by_type(result, kind):
    return result.exceptions[result.exceptions["type"] == kind]


# ---- Engine -------------------------------------------------------------------
def test_every_planted_exception_is_found(result):
    counts = result.exceptions["type"].value_counts().to_dict()
    assert counts == {"bank_charges": 2, "interest_income": 1, "dishonoured_cheque": 1,
                      "amount_mismatch": 1, "duplicate_entry": 1, "outstanding_cheque": 1,
                      "deposit_in_transit": 1, "unexplained_bank": 1}


def test_matching_is_one_to_one(result):
    assert result.matches["txn_id"].is_unique
    assert result.matches["entry_id"].is_unique


def test_missing_reference_still_matches_by_amount_and_date(result):
    window = result.matches[result.matches["match_pass"] == "window"]
    assert "UPI/ORION INFRA/SETTLEMENT" in set(window["bank_description"])


def test_transposition_error_detected(result):
    mm = by_type(result, "amount_mismatch").iloc[0]
    assert mm["difference"] == 270.0
    assert "transposition" in mm["detail"]


def test_transposition_rule():
    assert _is_transposition(270.0)       # 45,630 - 45,360
    assert not _is_transposition(100.0)


def test_fuzzy_similarity_ignores_banking_noise():
    assert similarity("RTGS DR ZENITH LUBRICANTS PO-5188",
                      "Payment to Zenith Lubricants for PO-5188") == 100


# ---- Reporting ------------------------------------------------------------------
def test_brs_difference_equals_unexplained_items(result):
    report = brs(result, 500_000)
    assert report["difference"] == report["unexplained_total"] == -12_000.0


def test_journal_entries_only_for_book_side_items(result):
    je = proposed_entries(result)
    fixes = result.exceptions.set_index("exception_id").loc[je["exception_id"], "fixes"]
    assert set(fixes) == {"books"}
    assert (je["amount"] > 0).all()


def test_bad_file_gives_clear_error(tmp_path):
    f = tmp_path / "bad.csv"
    f.write_text("date,amount\n2026-09-01,100\n")
    with pytest.raises(DataError, match="missing column"):
        load_bank(f)


# ---- AI guardrails (fake LLM) ------------------------------------------------------
def fake_llm(reply: dict):
    return lambda system, user, json_mode: json.dumps(reply)


def charge_id(result):
    return by_type(result, "bank_charges").iloc[0]["exception_id"]


def test_good_ai_answer_is_accepted(result, monkeypatch):
    eid = charge_id(result)
    amt = abs(float(by_type(result, "bank_charges").iloc[0]["amount"]))
    monkeypatch.setattr(ai, "provider", lambda: "gemini")
    monkeypatch.setattr(ai, "_call_llm", fake_llm({
        "explanation": "Bank fee.", "likely_cause": "Charges.", "recommended_action": "Book it.",
        "journal_entry": {"debit_account": "Bank Charges", "credit_account": "Bank",
                          "amount": amt, "narration": "fees"},
        "confidence": "high"}))
    x = ai.explain(result, eid)
    assert x.source == "gemini" and x.validation == "passed"


def test_hallucinated_amount_is_rejected(result, monkeypatch):
    eid = charge_id(result)
    monkeypatch.setattr(ai, "provider", lambda: "gemini")
    monkeypatch.setattr(ai, "_call_llm", fake_llm({
        "explanation": "Bank fee.", "likely_cause": "Charges.", "recommended_action": "Book it.",
        "journal_entry": {"debit_account": "Bank Charges", "credit_account": "Bank",
                          "amount": 9999.0, "narration": "fees"},
        "confidence": "high"}))
    x = ai.explain(result, eid)
    assert x.validation.startswith("failed")
    assert x.journal_entry.amount != 9999.0     # replaced by the computed entry
    assert x.confidence == "low"


def test_broken_json_falls_back_to_rules(result, monkeypatch):
    monkeypatch.setattr(ai, "provider", lambda: "gemini")
    monkeypatch.setattr(ai, "_call_llm", lambda s, u, json_mode: "not json at all")
    x = ai.explain(result, charge_id(result))
    assert x.source == "rules" and "not valid JSON" in x.validation


def test_offline_mode_explains_everything(result, monkeypatch):
    monkeypatch.setattr(ai, "provider", lambda: "rules")
    for eid in result.exceptions["exception_id"]:
        assert ai.explain(result, eid).explanation


# ---- API ------------------------------------------------------------------------
def test_api_end_to_end(monkeypatch):
    monkeypatch.setattr(ai, "provider", lambda: "rules")
    from api import app
    client = TestClient(app)
    assert client.get("/health").json()["status"] == "ok"
    with open(DATA / "bank_statement.csv", "rb") as b, open(DATA / "general_ledger.csv", "rb") as l:
        r = client.post("/reconcile", files={"bank_file": b, "ledger_file": l})
    assert r.status_code == 200 and r.json()["summary"]["exceptions"] == 9
    assert client.post("/explain/EX01").status_code == 200
    assert client.post("/explain/EX99").status_code == 404
    assert "answer" in client.post("/ask", json={"question": "why?"}).json()
