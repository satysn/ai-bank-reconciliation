"""
Generate a realistic sample month (September 2026) of bank and ledger data
for a fictional company, "Kaveri Steel Tubes Pvt Ltd".

Most transactions appear in BOTH files (they should match). On top of that,
we deliberately plant the classic reconciliation exceptions an accountant
sees at month-end, so the engine has something real to find:

  Planted exception              Where it shows up          Real-world cause
  ------------------------------ -------------------------- ------------------------------
  Outstanding cheque             ledger only                cheque issued, not yet cleared
  Deposit in transit             ledger only                deposited 30 Sep, bank credits in Oct
  Bank charges                   bank only                  bank deducted fees + GST
  Interest credited              bank only                  bank paid interest
  Dishonoured (bounced) cheque   bank only                  customer's cheque bounced
  Transposition error            both, amounts differ       clerk typed 45,630 instead of 45,360
  Duplicate ledger entry         ledger has it twice        same invoice posted twice
  Unexplained bank debit         bank only                  needs investigation
Plus "noise" that SHOULD still match: date lags of 1-3 days and messy,
differently-worded descriptions.

Run:  python data/generate_sample_data.py
"""
import random
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

random.seed(42)  # same "random" data every run, so results are reproducible
OUT = Path(__file__).parent
START = date(2026, 9, 1)

customers = ["Shree Ganesh Engg", "Bharat Pipes Ltd", "Orion Infra Pvt Ltd",
             "Deccan Fabricators", "Sunrise Boilers", "Konark Projects"]
vendors = ["Tata Steel Supply", "JSW Coils Depot", "Odisha Power Distribution",
           "Bluedart Logistics", "Mahanadi Packaging", "Zenith Lubricants"]

bank, ledger = [], []


def add(d, desc_bank, desc_ledger, ref, amount, account, lag=0):
    """Add one transaction to both files. `lag` = days the bank posts after the books."""
    ledger.append(dict(date=d, description=desc_ledger, reference=ref,
                       amount=amount, account=account))
    bank.append(dict(date=d + timedelta(days=lag), description=desc_bank,
                     reference=ref, amount=amount))


# ---- 1. Normal, matching activity (with realistic noise) ----------------------
for i in range(40):
    d = START + timedelta(days=random.randint(0, 26))
    lag = random.choice([0, 0, 0, 1, 2, 3])          # bank sometimes posts later
    if random.random() < 0.5:                         # customer receipt
        c = random.choice(customers)
        amt = round(random.uniform(20_000, 250_000), 2)
        inv = f"INV-{2400 + i}"
        add(d, f"NEFT CR {c.upper()} {inv}", f"Receipt from {c} against {inv}",
            f"NEFT{700100 + i}", amt, "Accounts Receivable", lag)
    else:                                             # vendor payment
        v = random.choice(vendors)
        amt = -round(random.uniform(10_000, 180_000), 2)
        po = f"PO-{5100 + i}"
        add(d, f"RTGS DR {v.upper()[:18]} {po}", f"Payment to {v} for {po}",
            f"RTGS{880200 + i}", amt, "Accounts Payable", lag)

# A few with the SAME amount but a missing/garbled reference, so only the
# amount + date-window pass (not the exact pass) can match them.
add(date(2026, 9, 12), "UPI/ORION INFRA/SETTLEMENT", "Receipt - Orion Infra (part payment)",
    "", 64_250.00, "Accounts Receivable", lag=1)
add(date(2026, 9, 18), "ACH D- ODISHA PWR DIST", "Electricity bill Sep - Odisha Power Distribution",
    "EB-SEP", -38_410.00, "Electricity Expense", lag=2)
# Monthly salary run, bank shows one lump sum.
add(date(2026, 9, 28), "BULK SAL UPLOAD SEP26", "Salaries for September 2026",
    "SAL-0926", -412_600.00, "Salaries Payable")

# ---- 2. Planted exceptions ----------------------------------------------------
# Outstanding cheque: issued 29 Sep, vendor hasn't banked it yet.
ledger.append(dict(date=date(2026, 9, 29), description="Chq 004512 to Mahanadi Packaging",
                   reference="CHQ004512", amount=-57_800.00, account="Accounts Payable"))
# Deposit in transit: cheque deposited on the 30th, bank credits in October.
ledger.append(dict(date=date(2026, 9, 30), description="Chq deposited - Konark Projects INV-2471",
                   reference="DEP-3009", amount=121_500.00, account="Accounts Receivable"))
# Bank charges (incl. 18% GST) - the books don't know yet.
bank.append(dict(date=date(2026, 9, 30), description="SERVICE CHG SEP26 INCL GST",
                 reference="CHG0926", amount=-590.00))
# Interest credited by the bank.
bank.append(dict(date=date(2026, 9, 30), description="INT CREDIT Q2 SB/CA",
                 reference="INT0926", amount=1_845.00))
# Dishonoured cheque: the receipt matched earlier, then the bank reversed it.
add(date(2026, 9, 10), "CHQ DEP 118834 DECCAN FABRICATORS", "Receipt from Deccan Fabricators Chq 118834",
    "CHQ118834", 88_000.00, "Accounts Receivable", lag=1)
bank.append(dict(date=date(2026, 9, 14), description="CHQ RETURN 118834 FUNDS INSUFFICIENT",
                 reference="CHQ118834R", amount=-88_000.00))
bank.append(dict(date=date(2026, 9, 14), description="CHQ RETURN CHARGES 118834",
                 reference="RTNCHG118834", amount=-354.00))
# Transposition error: bank paid 45,360; clerk booked 45,630 (diff 270, divisible by 9).
ledger.append(dict(date=date(2026, 9, 16), description="Payment to Zenith Lubricants for PO-5188",
                   reference="RTGS880288", amount=-45_630.00, account="Accounts Payable"))
bank.append(dict(date=date(2026, 9, 16), description="RTGS DR ZENITH LUBRICANTS PO-5188",
                 reference="RTGS880288", amount=-45_360.00))
# Duplicate ledger entry: same invoice receipt posted twice.
add(date(2026, 9, 22), "NEFT CR SUNRISE BOILERS INV-2455", "Receipt from Sunrise Boilers against INV-2455",
    "NEFT700455", 73_900.00, "Accounts Receivable")
ledger.append(dict(date=date(2026, 9, 23), description="Receipt from Sunrise Boilers against INV-2455",
                   reference="NEFT700455", amount=73_900.00, account="Accounts Receivable"))
# Unexplained bank debit - nobody recognises it. Needs investigation.
bank.append(dict(date=date(2026, 9, 25), description="IMPS DR 9821XXXX12 MISC",
                 reference="IMPS55120", amount=-12_000.00))

# ---- 3. Save -------------------------------------------------------------------
bank_df = pd.DataFrame(bank).sort_values("date").reset_index(drop=True)
ledger_df = pd.DataFrame(ledger).sort_values("date").reset_index(drop=True)
bank_df.insert(0, "txn_id", [f"B{i + 1:03d}" for i in range(len(bank_df))])
ledger_df.insert(0, "entry_id", [f"L{i + 1:03d}" for i in range(len(ledger_df))])
bank_df.to_csv(OUT / "bank_statement.csv", index=False)
ledger_df.to_csv(OUT / "general_ledger.csv", index=False)
print(f"bank_statement.csv: {len(bank_df)} rows | general_ledger.csv: {len(ledger_df)} rows")
