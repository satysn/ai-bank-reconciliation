"""
Loading and validating the two input files.

Finance rule #1: never trust input data. Before matching anything we check
that the columns exist, dates parse, and amounts are numbers. A clear error
here is much better than a silently wrong reconciliation later.
"""
from __future__ import annotations

import pandas as pd

BANK_COLUMNS = ["txn_id", "date", "description", "reference", "amount"]
LEDGER_COLUMNS = ["entry_id", "date", "description", "reference", "amount", "account"]


class DataError(ValueError):
    """Raised when an input file is not in the expected shape."""


def _clean(df: pd.DataFrame, required: list[str], name: str) -> pd.DataFrame:
    df = df.copy()
    df.columns = [c.strip().lower() for c in df.columns]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise DataError(f"{name}: missing column(s) {missing}. Expected {required}.")

    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    if df["date"].isna().any():
        bad = df.loc[df["date"].isna()].index.tolist()[:5]
        raise DataError(f"{name}: unreadable date in row(s) {bad}.")

    df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
    if df["amount"].isna().any():
        bad = df.loc[df["amount"].isna()].index.tolist()[:5]
        raise DataError(f"{name}: non-numeric amount in row(s) {bad}.")

    for col in ("description", "reference"):
        df[col] = df[col].fillna("").astype(str).str.strip()

    # Money is stored as integer paise, not floats. 0.1 + 0.2 != 0.3 in floating
    # point, and "almost equal" is not good enough for accounting.
    df["amount_paise"] = (df["amount"] * 100).round().astype("int64")
    return df


def load_bank(src) -> pd.DataFrame:
    """`src` can be a file path or an uploaded file object."""
    return _clean(pd.read_csv(src, dtype={"reference": str}), BANK_COLUMNS, "Bank statement")


def load_ledger(src) -> pd.DataFrame:
    df = _clean(pd.read_csv(src, dtype={"reference": str}), LEDGER_COLUMNS, "General ledger")
    df["account"] = df["account"].fillna("Suspense").astype(str)
    return df
