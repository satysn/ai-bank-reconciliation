"""
Turns reconciliation results into the two outputs an accountant actually uses:

1. Proposed adjusting journal entries, for items the BOOKS got wrong or don't know about.
2. The Bank Reconciliation Statement (BRS), which proves the two balances agree
   once every difference is explained.

Two kinds of difference (a very common interview question)
----------------------------------------------------------
* Timing differences (outstanding cheques, deposits in transit): the books are
  RIGHT, the bank just hasn't caught up. These are adjusted on the BANK side of the
  BRS. No journal entry.
* Book-side items (bank charges, interest, bounced cheques, errors, duplicates):
  the books are INCOMPLETE or WRONG. These need a journal entry.
"""
from __future__ import annotations

import pandas as pd

from .engine import ReconResult

BANK_ACCOUNT = "Bank - Current A/c"


def proposed_entries(result: ReconResult) -> pd.DataFrame:
    """One balanced journal entry (debit = credit) per book-side exception."""
    rows = []
    for e in result.exceptions.itertuples():
        amt = abs(e.amount)
        if e.type == "bank_charges":
            dr, cr, why = "Bank Charges (incl. GST)", BANK_ACCOUNT, "Record bank charges"
        elif e.type == "interest_income":
            dr, cr, why = BANK_ACCOUNT, "Interest Income", "Record interest credited by bank"
        elif e.type == "dishonoured_cheque":
            dr, cr, why = e.account, BANK_ACCOUNT, "Reverse receipt for dishonoured cheque"
        elif e.type == "duplicate_entry":
            # Reverse the duplicate: swap the sides of the original posting.
            if e.amount > 0:
                dr, cr = e.account, BANK_ACCOUNT
            else:
                dr, cr = BANK_ACCOUNT, e.account
            why = f"Reverse duplicate posting {e.entry_id}"
        elif e.type == "amount_mismatch":
            amt = abs(e.difference)
            # difference = bank - books. Positive -> books understated bank.
            if e.difference > 0:
                dr, cr = BANK_ACCOUNT, e.account
            else:
                dr, cr = e.account, BANK_ACCOUNT
            why = f"Correct amount on {e.entry_id} to match bank"
        else:
            continue  # timing differences and unexplained items: no entry
        rows.append({"exception_id": e.exception_id, "debit_account": dr,
                     "credit_account": cr, "amount": round(amt, 2), "narration": why,
                     "status": "Proposed - needs approval"})
    return pd.DataFrame(rows, columns=["exception_id", "debit_account", "credit_account",
                                       "amount", "narration", "status"])


def brs(result: ReconResult, opening_balance: float = 0.0) -> dict:
    """
    Bank Reconciliation Statement.

    Adjusted bank balance = bank closing + deposits in transit - outstanding cheques
    Adjusted book balance = book closing + interest - charges - bounced cheques
                            +/- error corrections - duplicates
    If every difference is explained, the two adjusted balances are equal.
    """
    ex = result.exceptions
    bank_close = float(opening_balance + result.bank["amount"].sum())
    book_close = float(opening_balance + result.ledger["amount"].sum())

    def total(kind, col="amount"):
        return float(ex.loc[ex["type"] == kind, col].sum())

    dit, oc = total("deposit_in_transit"), total("outstanding_cheque")  # oc is negative
    bank_lines = [("Balance as per bank statement", bank_close),
                  ("Add: deposits in transit", dit),
                  ("Less: outstanding cheques", oc)]
    adj_bank = bank_close + dit + oc

    book_lines = [("Balance as per books", book_close),
                  ("Add: interest credited by bank", total("interest_income")),
                  ("Less: bank charges", total("bank_charges")),
                  ("Less: dishonoured cheques", total("dishonoured_cheque")),
                  ("Add/(less): error corrections", total("amount_mismatch", "difference")),
                  ("Less: duplicate postings reversed", -total("duplicate_entry"))]
    adj_book = sum(v for _, v in book_lines)

    # Unexplained items stay as a visible, un-hidden difference.
    unexplained = ex[ex["type"].isin(["unexplained_bank", "unexplained_ledger"])]
    return {
        "bank_lines": bank_lines, "adjusted_bank": round(adj_bank, 2),
        "book_lines": book_lines, "adjusted_book": round(adj_book, 2),
        "difference": round(adj_bank - adj_book, 2),
        "unexplained_ids": unexplained["exception_id"].tolist(),
        "unexplained_total": round(float(unexplained["amount"].sum()), 2),
    }
