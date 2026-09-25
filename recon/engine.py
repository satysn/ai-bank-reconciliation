"""
The matching engine: pairs bank transactions with ledger entries, then
classifies whatever is left over.

How it works (the part to explain in an interview)
--------------------------------------------------
1. Both files go into an in-memory SQLite database.
2. SQL generates CANDIDATE pairs in three passes, strictest first:
     Pass 1  exact        same reference AND same amount
     Pass 2  window       same amount, dates within N days (references missing or garbled)
     Pass 3  near         same reference, or similar description, but the amount
                          differs slightly -> a "match with a difference" (likely an error)
3. Python scores candidates (date gap + fuzzy description similarity) and picks
   pairs greedily, best score first, so every transaction is used at most once
   (one-to-one matching).
4. Anything unmatched is classified by rules: bank charges, interest, bounced
   cheque, outstanding cheque, deposit in transit, duplicate, or unexplained.

The rules do the deciding. The AI layer (ai.py) only explains and drafts.
That split keeps the numbers auditable.
"""
from __future__ import annotations

import re
import sqlite3
from dataclasses import dataclass, field

import pandas as pd
from rapidfuzz import fuzz

# Words that appear in bank/ledger narrations but say nothing about WHO was paid.
NOISE = {"NEFT", "RTGS", "IMPS", "UPI", "ACH", "CR", "DR", "D", "PAYMENT", "RECEIPT",
         "TO", "FROM", "FOR", "AGAINST", "THE", "LTD", "PVT", "CHQ", "DEP", "DEPOSITED"}


def normalise(text: str) -> str:
    """'RTGS DR ZENITH LUBRICANTS PO-5188' -> 'ZENITH LUBRICANTS PO-5188'."""
    words = re.sub(r"[^A-Z0-9\- ]", " ", str(text).upper()).split()
    return " ".join(w for w in words if w not in NOISE)


def similarity(a: str, b: str) -> float:
    """0-100 score. token_set_ratio ignores word order and extra words."""
    return fuzz.token_set_ratio(normalise(a), normalise(b))


@dataclass
class ReconConfig:
    date_window_days: int = 5          # pass 2/3: how far apart dates can be
    near_amount_pct: float = 0.05      # pass 3: amounts within 5% count as "near"
    min_desc_similarity: float = 70.0  # pass 3: needed when references differ
    transit_days: int = 3              # receipts in the last N days = deposit in transit


@dataclass
class ReconResult:
    bank: pd.DataFrame
    ledger: pd.DataFrame
    matches: pd.DataFrame
    exceptions: pd.DataFrame
    period_end: pd.Timestamp
    config: ReconConfig = field(default_factory=ReconConfig)

    @property
    def summary(self) -> dict:
        clean = self.matches[self.matches["match_pass"] != "near"]
        return {
            "bank_transactions": len(self.bank),
            "ledger_entries": len(self.ledger),
            "auto_matched_pairs": len(clean),
            "matched_with_difference": int((self.matches["match_pass"] == "near").sum()),
            "exceptions": len(self.exceptions),
            "match_rate_pct": round(100 * len(clean) / max(len(self.bank), 1), 1),
            "by_pass": clean["match_pass"].value_counts().to_dict(),
            "exceptions_by_type": self.exceptions["type"].value_counts().to_dict()
            if len(self.exceptions) else {},
        }


# ---------------------------------------------------------------------------
# Step 1-3: candidate generation in SQL, selection in Python
# ---------------------------------------------------------------------------
CANDIDATE_SQL = {
    "exact": """
        SELECT b.txn_id, l.entry_id
        FROM bank b JOIN ledger l
          ON b.reference = l.reference AND b.reference <> ''
         AND b.amount_paise = l.amount_paise
    """,
    "window": """
        SELECT b.txn_id, l.entry_id
        FROM bank b JOIN ledger l
          ON b.amount_paise = l.amount_paise
         AND ABS(julianday(b.date) - julianday(l.date)) <= :window
    """,
    # Same sign, amounts within X%, dates within the window, amounts NOT equal.
    "near": """
        SELECT b.txn_id, l.entry_id
        FROM bank b JOIN ledger l
          ON (b.amount_paise > 0) = (l.amount_paise > 0)
         AND b.amount_paise <> l.amount_paise
         AND ABS(b.amount_paise - l.amount_paise) <= :pct * ABS(l.amount_paise)
         AND ABS(julianday(b.date) - julianday(l.date)) <= :window
    """,
}


def _to_sqlite(df: pd.DataFrame, name: str, con: sqlite3.Connection) -> None:
    out = df.copy()
    out["date"] = out["date"].dt.strftime("%Y-%m-%d")
    out.to_sql(name, con, index=False)


def _score(b: pd.Series, l: pd.Series, cfg: ReconConfig) -> tuple[float, int, float]:
    gap = abs((b["date"] - l["date"]).days)
    desc = similarity(b["description"], l["description"])
    ref_bonus = 20 if b["reference"] and b["reference"] == l["reference"] else 0
    # Closer dates, similar text and a shared reference all push the score up.
    score = desc + ref_bonus - 5 * gap
    return score, gap, desc


def match(bank: pd.DataFrame, ledger: pd.DataFrame, cfg: ReconConfig) -> pd.DataFrame:
    con = sqlite3.connect(":memory:")
    _to_sqlite(bank, "bank", con)
    _to_sqlite(ledger, "ledger", con)
    b_idx, l_idx = bank.set_index("txn_id"), ledger.set_index("entry_id")

    used_b, used_l, rows = set(), set(), []
    params = {"window": cfg.date_window_days, "pct": cfg.near_amount_pct}
    for pass_name, sql in CANDIDATE_SQL.items():
        cands = pd.read_sql_query(sql, con, params=params)
        scored = []
        for b_id, l_id in cands.itertuples(index=False):
            if b_id in used_b or l_id in used_l:
                continue
            b, l = b_idx.loc[b_id], l_idx.loc[l_id]
            score, gap, desc = _score(b, l, cfg)
            if pass_name == "near":
                same_ref = b["reference"] and b["reference"] == l["reference"]
                if not same_ref and desc < cfg.min_desc_similarity:
                    continue  # a near amount alone is not evidence of a match
            scored.append((score, b_id, l_id, gap, desc))
        # Greedy one-to-one: best-scoring pair wins, each row used once.
        for score, b_id, l_id, gap, desc in sorted(scored, reverse=True):
            if b_id in used_b or l_id in used_l:
                continue
            used_b.add(b_id)
            used_l.add(l_id)
            rows.append({
                "txn_id": b_id, "entry_id": l_id, "match_pass": pass_name,
                "bank_date": b_idx.loc[b_id, "date"].date(),
                "ledger_date": l_idx.loc[l_id, "date"].date(),
                "date_gap_days": gap, "desc_similarity": round(desc),
                "bank_amount": b_idx.loc[b_id, "amount"],
                "ledger_amount": l_idx.loc[l_id, "amount"],
                "difference": round(b_idx.loc[b_id, "amount"] - l_idx.loc[l_id, "amount"], 2),
                "bank_description": b_idx.loc[b_id, "description"],
                "ledger_description": l_idx.loc[l_id, "description"],
            })
    con.close()
    return pd.DataFrame(rows, columns=[
        "txn_id", "entry_id", "match_pass", "bank_date", "ledger_date", "date_gap_days",
        "desc_similarity", "bank_amount", "ledger_amount", "difference",
        "bank_description", "ledger_description"])


# ---------------------------------------------------------------------------
# Step 4: classify what is left over
# ---------------------------------------------------------------------------
def _is_transposition(diff: float) -> bool:
    """Swapping two digits (45,360 -> 45,630) always gives a difference divisible by 9."""
    paise = round(abs(diff) * 100)
    return paise > 0 and paise % 100 == 0 and (paise // 100) % 9 == 0


def classify(bank, ledger, matches, cfg: ReconConfig, period_end) -> pd.DataFrame:
    matched_b, matched_l = set(matches["txn_id"]), set(matches["entry_id"])
    ex = []

    def add(kind, side, amount, detail, txn_id=None, entry_id=None, difference=None,
            fixes="books", account=None):
        ex.append(dict(type=kind, side=side, txn_id=txn_id, entry_id=entry_id,
                       amount=round(amount, 2), difference=difference, fixes=fixes,
                       account=account, detail=detail))

    # (a) Pairs that matched but with a different amount -> an error in the books.
    for m in matches[matches["match_pass"] == "near"].itertuples():
        acct = ledger.set_index("entry_id").loc[m.entry_id, "account"]
        hint = (" The difference is divisible by 9, a classic sign of a transposition "
                "error (two digits swapped)." if _is_transposition(m.difference) else "")
        add("amount_mismatch", "both", m.ledger_amount,
            f"Bank shows {m.bank_amount:,.2f} but the books show {m.ledger_amount:,.2f} "
            f"(difference {m.difference:,.2f}).{hint}",
            txn_id=m.txn_id, entry_id=m.entry_id, difference=m.difference, account=acct)

    # (b) Bank-only items: things the bank knows and the books don't (yet).
    for b in bank[~bank["txn_id"].isin(matched_b)].itertuples():
        d = b.description.upper()
        if "RETURN" in d and not re.search(r"CHG|CHARGE", d):
            orig = ledger[ledger["reference"].apply(
                lambda r: bool(r) and b.reference.startswith(r))]
            acct = orig["account"].iloc[0] if len(orig) else "Accounts Receivable"
            src = f" (original receipt {orig['entry_id'].iloc[0]})" if len(orig) else ""
            add("dishonoured_cheque", "bank", b.amount,
                f"Customer cheque returned unpaid{src}. The receipt must be reversed "
                "and the amount is again owed by the customer.", txn_id=b.txn_id, account=acct)
        elif re.search(r"CHG|CHARGE|FEE|COMMISSION", d):
            add("bank_charges", "bank", b.amount,
                "Bank deducted charges that are not yet recorded in the books.",
                txn_id=b.txn_id, account="Bank Charges")
        elif re.search(r"\bINT\b|INTEREST", d):
            add("interest_income", "bank", b.amount,
                "Bank credited interest that is not yet recorded in the books.",
                txn_id=b.txn_id, account="Interest Income")
        else:
            add("unexplained_bank", "bank", b.amount,
                "No matching ledger entry and no known pattern. Needs investigation "
                "before anything is posted.", txn_id=b.txn_id, fixes="investigate")

    # (c) Ledger-only items: things the books recorded that the bank hasn't.
    matched_ledger = ledger[ledger["entry_id"].isin(matched_l)]
    for l in ledger[~ledger["entry_id"].isin(matched_l)].itertuples():
        twin = matched_ledger[(matched_ledger["reference"] == l.reference)
                              & (matched_ledger["amount_paise"] == l.amount_paise)
                              & (l.reference != "")]
        text = f"{l.reference} {l.description}".upper()
        days_to_end = (period_end - l.date).days
        if len(twin):
            add("duplicate_entry", "ledger", l.amount,
                f"Same reference and amount as {twin['entry_id'].iloc[0]}, which already "
                "matched the bank. Likely posted twice.", entry_id=l.entry_id, account=l.account)
        elif l.amount < 0 and re.search(r"CHQ|CHEQUE", text):
            add("outstanding_cheque", "ledger", l.amount,
                "Cheque issued and recorded, but the payee has not yet presented it. "
                "Timing difference: no journal entry needed.",
                entry_id=l.entry_id, fixes="bank_side", account=l.account)
        elif l.amount > 0 and days_to_end <= cfg.transit_days:
            add("deposit_in_transit", "ledger", l.amount,
                f"Deposited {days_to_end} day(s) before period end; the bank will credit it "
                "next period. Timing difference: no journal entry needed.",
                entry_id=l.entry_id, fixes="bank_side", account=l.account)
        else:
            add("unexplained_ledger", "ledger", l.amount,
                "Recorded in the books but not found on the bank statement.",
                entry_id=l.entry_id, fixes="investigate", account=l.account)

    df = pd.DataFrame(ex, columns=["type", "side", "txn_id", "entry_id", "amount",
                                   "difference", "fixes", "account", "detail"])
    df.insert(0, "exception_id", [f"EX{i + 1:02d}" for i in range(len(df))])
    return df


def reconcile(bank: pd.DataFrame, ledger: pd.DataFrame,
              cfg: ReconConfig | None = None, period_end=None) -> ReconResult:
    cfg = cfg or ReconConfig()
    period_end = pd.Timestamp(period_end) if period_end else ledger["date"].max().normalize()
    matches = match(bank, ledger, cfg)
    exceptions = classify(bank, ledger, matches, cfg, period_end)
    return ReconResult(bank, ledger, matches, exceptions, period_end, cfg)
