"""
REST API for the reconciliation engine, so other systems (an ERP, a scheduler,
a web front end) can call it without the Streamlit UI.

Run:   uvicorn api:app --reload
Docs:  http://127.0.0.1:8000/docs   (FastAPI builds interactive docs automatically)

Endpoints
  GET  /health                       is the service up? which AI provider?
  POST /reconcile                    upload bank + ledger CSVs, get results as JSON
  POST /reconcile/sample             run on the built-in sample data
  POST /explain/{exception_id}       AI explanation for one exception
  POST /ask                          ask a question about a reconciliation

/explain and /ask default to the sample data, but also accept an optional
`context` with the same bank/ledger CSV text and matching-rule parameters
used for /reconcile, so a caller (e.g. the React frontend) can ask about a
reconciliation built from its own uploaded files rather than only the sample
month. It's plain JSON (not a file upload) since the caller already has the
CSV text in memory from its own file picker.
"""
from __future__ import annotations

import io
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from recon import ai
from recon.data import DataError, load_bank, load_ledger
from recon.engine import ReconConfig, ReconResult, reconcile
from recon.report import brs, proposed_entries

DATA = Path(__file__).parent / "data"
app = FastAPI(title="AI Bank Reconciliation Assistant", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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


class ReconContext(BaseModel):
    """Identifies which reconciliation /explain and /ask should talk about."""
    bank_csv: Optional[str] = None
    ledger_csv: Optional[str] = None
    window: int = 5
    pct: float = 5.0


def _reconcile_from_context(ctx: Optional[ReconContext]) -> ReconResult:
    """No context at all -> exact legacy behaviour (sample data, default config).
    A context always carries the caller's current window/pct, even when it's
    pointing at the sample CSVs, so /explain and /ask stay in sync with
    whatever config produced the exception IDs the caller is looking at."""
    if ctx is None:
        return _sample()
    cfg = ReconConfig(date_window_days=ctx.window, near_amount_pct=ctx.pct / 100)
    if ctx.bank_csv and ctx.ledger_csv:
        bank = load_bank(io.StringIO(ctx.bank_csv))
        ledger = load_ledger(io.StringIO(ctx.ledger_csv))
    else:
        bank = load_bank(DATA / "bank_statement.csv")
        ledger = load_ledger(DATA / "general_ledger.csv")
    return reconcile(bank, ledger, cfg)


@app.get("/health")
def health():
    return {"status": "ok", "ai_provider": ai.provider()}


@app.post("/reconcile")
async def reconcile_files(bank_file: UploadFile = File(...), ledger_file: UploadFile = File(...),
                          opening_balance: float = 0.0, window: int = 5, pct: float = 5.0):
    try:
        bank = load_bank(io.BytesIO(await bank_file.read()))
        ledger = load_ledger(io.BytesIO(await ledger_file.read()))
    except DataError as err:
        raise HTTPException(status_code=422, detail=str(err))
    cfg = ReconConfig(date_window_days=window, near_amount_pct=pct / 100)
    return _to_json(reconcile(bank, ledger, cfg), opening_balance)


@app.post("/reconcile/sample")
def reconcile_sample(opening_balance: float = 500_000.0, window: int = 5, pct: float = 5.0):
    cfg = ReconConfig(date_window_days=window, near_amount_pct=pct / 100)
    result = reconcile(load_bank(DATA / "bank_statement.csv"),
                       load_ledger(DATA / "general_ledger.csv"), cfg)
    return _to_json(result, opening_balance)


@app.post("/explain/{exception_id}")
def explain(exception_id: str, ctx: Optional[ReconContext] = None):
    try:
        result = _reconcile_from_context(ctx)
    except DataError as err:
        raise HTTPException(status_code=422, detail=str(err))
    if exception_id not in set(result.exceptions["exception_id"]):
        raise HTTPException(status_code=404, detail=f"No exception {exception_id}")
    return ai.explain(result, exception_id).model_dump()


class Question(BaseModel):
    question: str
    context: Optional[ReconContext] = None
    opening_balance: float = 500_000.0


@app.post("/ask")
def ask(q: Question):
    try:
        result = _reconcile_from_context(q.context)
    except DataError as err:
        raise HTTPException(status_code=422, detail=str(err))
    return {"answer": ai.ask(result, q.question, opening_balance=q.opening_balance)}
