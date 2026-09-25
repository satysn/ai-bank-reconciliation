"""
REST API for the reconciliation engine, so other systems (an ERP, a scheduler,
a web front end) can call it without the Streamlit UI.

Run:   uvicorn api:app --reload
Docs:  http://127.0.0.1:8000/docs   (FastAPI builds interactive docs automatically)

Endpoints
  GET  /health                       is the service up? which AI provider?
  POST /reconcile                    upload bank + ledger CSVs, get results as JSON
  POST /reconcile/sample             run on the built-in sample data
  POST /explain/{exception_id}       AI explanation for one exception (sample data)
  POST /ask                          ask a question about the sample reconciliation
"""
from __future__ import annotations

import io
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel

from recon import ai
from recon.data import DataError, load_bank, load_ledger
from recon.engine import ReconResult, reconcile
from recon.report import brs, proposed_entries

DATA = Path(__file__).parent / "data"
app = FastAPI(title="AI Bank Reconciliation Assistant", version="1.0")


def _to_json(result: ReconResult, opening_balance: float) -> dict:
    return {
        "summary": result.summary,
        "bank_reconciliation_statement": brs(result, opening_balance),
        "exceptions": result.exceptions.astype(object).where(
            result.exceptions.notna(), None).to_dict(orient="records"),
        "proposed_journal_entries": proposed_entries(result).to_dict(orient="records"),
        "matches": result.matches.astype(str).to_dict(orient="records"),
    }


def _sample() -> ReconResult:
    return reconcile(load_bank(DATA / "bank_statement.csv"),
                     load_ledger(DATA / "general_ledger.csv"))


@app.get("/health")
def health():
    return {"status": "ok", "ai_provider": ai.provider()}


@app.post("/reconcile")
async def reconcile_files(bank_file: UploadFile = File(...), ledger_file: UploadFile = File(...),
                          opening_balance: float = 0.0):
    try:
        bank = load_bank(io.BytesIO(await bank_file.read()))
        ledger = load_ledger(io.BytesIO(await ledger_file.read()))
    except DataError as err:
        raise HTTPException(status_code=422, detail=str(err))
    return _to_json(reconcile(bank, ledger), opening_balance)


@app.post("/reconcile/sample")
def reconcile_sample(opening_balance: float = 500_000.0):
    return _to_json(_sample(), opening_balance)


@app.post("/explain/{exception_id}")
def explain(exception_id: str):
    result = _sample()
    if exception_id not in set(result.exceptions["exception_id"]):
        raise HTTPException(status_code=404, detail=f"No exception {exception_id}")
    return ai.explain(result, exception_id).model_dump()


class Question(BaseModel):
    question: str


@app.post("/ask")
def ask(q: Question):
    return {"answer": ai.ask(_sample(), q.question, opening_balance=500_000.0)}
