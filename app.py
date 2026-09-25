"""
Streamlit front end for the AI Bank Reconciliation Assistant.

Run:  streamlit run app.py
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd
import streamlit as st

from recon import ai
from recon.data import DataError, load_bank, load_ledger
from recon.engine import ReconConfig, reconcile
from recon.report import brs, proposed_entries

DATA = Path(__file__).parent / "data"
LABELS = {
    "amount_mismatch": "Amount mismatch", "bank_charges": "Bank charges",
    "interest_income": "Interest credited", "dishonoured_cheque": "Dishonoured cheque",
    "duplicate_entry": "Duplicate entry", "outstanding_cheque": "Outstanding cheque",
    "deposit_in_transit": "Deposit in transit", "unexplained_bank": "Unexplained (bank)",
    "unexplained_ledger": "Unexplained (books)",
}

st.set_page_config(page_title="AI Bank Reconciliation", page_icon="🏦", layout="wide")
st.title("AI Bank Reconciliation Assistant")
st.caption("Matches bank statement lines to ledger entries, classifies the differences, "
           "and uses an LLM to explain them and draft adjusting entries for approval.")

# ---- Sidebar: inputs and settings -----------------------------------------------
with st.sidebar:
    st.header("Data")
    source = st.radio("Source", ["Sample month (Sep 2026)", "Upload my own CSVs"])
    if source.startswith("Upload"):
        bank_file = st.file_uploader("Bank statement CSV", type="csv")
        ledger_file = st.file_uploader("General ledger CSV", type="csv")
        st.caption("Bank columns: txn_id, date, description, reference, amount  \n"
                   "Ledger columns: entry_id, date, description, reference, amount, account")
    else:
        bank_file, ledger_file = DATA / "bank_statement.csv", DATA / "general_ledger.csv"
    opening = st.number_input("Opening balance (INR, both sides agreed)", value=500_000.0,
                              step=10_000.0)

    st.header("Matching rules")
    window = st.slider("Date window (days)", 0, 10, 5)
    pct = st.slider("'Near amount' tolerance (%)", 0.0, 10.0, 5.0, 0.5)

    st.header("AI")
    p = ai.provider()
    if p == "rules":
        st.info("Offline mode: explanations come from built-in rules. Set GEMINI_API_KEY "
                "or OPENAI_API_KEY before launching to use an LLM.")
    else:
        st.success(f"Using {p.title()} ({ai.GEMINI_MODEL if p == 'gemini' else ai.OPENAI_MODEL})")

if bank_file is None or ledger_file is None:
    st.info("Upload both files in the sidebar to start.")
    st.stop()

try:
    bank, ledger = load_bank(bank_file), load_ledger(ledger_file)
except DataError as err:
    st.error(str(err))
    st.stop()

cfg = ReconConfig(date_window_days=window, near_amount_pct=pct / 100)
result = reconcile(bank, ledger, cfg)
report = brs(result, opening)
entries = proposed_entries(result)
s = result.summary

# Remember AI answers and approvals across reruns (Streamlit reruns on every click).
st.session_state.setdefault("explanations", {})
st.session_state.setdefault("approved", set())
st.session_state.setdefault("chat", [])
data_key = (source, window, pct)
if st.session_state.get("data_key") != data_key:
    st.session_state.update(data_key=data_key, explanations={}, approved=set())

# ---- Headline numbers -----------------------------------------------------------
c1, c2, c3, c4, c5 = st.columns(5)
c1.metric("Bank lines", s["bank_transactions"])
c2.metric("Ledger entries", s["ledger_entries"])
c3.metric("Auto-matched", s["auto_matched_pairs"], f"{s['match_rate_pct']}% of bank lines")
c4.metric("Exceptions", s["exceptions"])
diff = report["difference"]
c5.metric("Unreconciled difference", f"₹{diff:,.2f}",
          "Reconciled" if abs(diff) < 0.01 else "Investigate",
          delta_color="normal" if abs(diff) < 0.01 else "inverse")

tab_brs, tab_ex, tab_je, tab_match, tab_ask = st.tabs(
    ["Reconciliation statement", "Exceptions", "Journal entries", "Matches", "Ask AI"])

# ---- Tab 1: Bank Reconciliation Statement ----------------------------------------
with tab_brs:
    def brs_table(lines, total_label, total):
        df = pd.DataFrame(lines + [(total_label, total)], columns=["Item", "INR"])
        return df.style.format({"INR": "{:,.2f}"})

    left, right = st.columns(2)
    with left:
        st.subheader("Bank side")
        st.caption("Timing differences: the books are right, the bank hasn't caught up.")
        st.dataframe(brs_table(report["bank_lines"], "Adjusted bank balance",
                               report["adjusted_bank"]), hide_index=True, use_container_width=True)
    with right:
        st.subheader("Book side")
        st.caption("Items the books are missing or got wrong: these need journal entries.")
        st.dataframe(brs_table(report["book_lines"], "Adjusted book balance",
                               report["adjusted_book"]), hide_index=True, use_container_width=True)
    if abs(diff) < 0.01:
        st.success("Adjusted balances agree. The account is reconciled.")
    else:
        st.warning(f"Adjusted balances differ by ₹{diff:,.2f}. This equals the unexplained "
                   f"item(s) {', '.join(report['unexplained_ids'])}, which must be "
                   "investigated before month-end close.")

# ---- Tab 2: Exceptions + AI explanations -----------------------------------------
with tab_ex:
    ex = result.exceptions.copy()
    ex["type"] = ex["type"].map(LABELS)
    st.dataframe(ex.drop(columns=["side"]), hide_index=True, use_container_width=True,
                 column_config={"amount": st.column_config.NumberColumn(format="%.2f"),
                                "detail": st.column_config.TextColumn(width="large")})

    if st.button("Explain all exceptions with AI", type="primary"):
        with st.spinner("Asking the AI..."):
            for eid in result.exceptions["exception_id"]:
                st.session_state.explanations[eid] = ai.explain(result, eid)

    for e in result.exceptions.itertuples():
        with st.expander(f"{e.exception_id} · {LABELS[e.type]} · ₹{e.amount:,.2f}"):
            st.write(e.detail)
            if st.button("Explain with AI", key=f"btn_{e.exception_id}"):
                with st.spinner("Thinking..."):
                    st.session_state.explanations[e.exception_id] = ai.explain(
                        result, e.exception_id)
            x = st.session_state.explanations.get(e.exception_id)
            if x:
                st.markdown(f"**What happened:** {x.explanation}")
                st.markdown(f"**Likely cause:** {x.likely_cause}")
                st.markdown(f"**Recommended action:** {x.recommended_action}")
                st.caption(f"Source: {x.source} · confidence: {x.confidence} · "
                           f"entry check: {x.validation}")
                if x.journal_entry:
                    je = x.journal_entry
                    st.code(f"Dr  {je.debit_account:<32} {je.amount:>12,.2f}\n"
                            f"    Cr  {je.credit_account:<28} {je.amount:>12,.2f}\n"
                            f"({je.narration})", language=None)

# ---- Tab 3: Journal entries with human approval -----------------------------------
with tab_je:
    st.write("Proposed adjusting entries. Nothing is posted until a reviewer approves it.")
    if entries.empty:
        st.info("No book-side adjustments needed.")
    else:
        view = entries.copy()
        view["approve"] = view["exception_id"].isin(st.session_state.approved)
        edited = st.data_editor(
            view, hide_index=True, use_container_width=True,
            disabled=[c for c in view.columns if c != "approve"],
            column_config={"approve": st.column_config.CheckboxColumn("Approve"),
                           "amount": st.column_config.NumberColumn(format="%.2f")})
        st.session_state.approved = set(edited.loc[edited["approve"], "exception_id"])
        approved = edited[edited["approve"]].drop(columns=["approve"]).assign(status="Approved")
        st.metric("Approved", f"{len(approved)} of {len(entries)}")
        st.download_button("Download approved entries (CSV)", approved.to_csv(index=False),
                           "approved_journal_entries.csv", disabled=approved.empty)

# ---- Tab 4: Matches ----------------------------------------------------------------
with tab_match:
    st.write("How each pair was matched. **exact** = same reference and amount; "
             "**window** = same amount within the date window; **near** = same reference "
             "or similar description but a different amount (flagged as an exception).")
    st.dataframe(result.matches, hide_index=True, use_container_width=True)

# ---- Tab 5: Ask AI -------------------------------------------------------------------
with tab_ask:
    st.write("Ask about this reconciliation. Answers are grounded in the data above.")
    st.caption("Try: *Which items need a journal entry?* · *Why don't the balances agree?* · "
               "*What should I tell the collections team?*")
    for role, text in st.session_state.chat:
        st.chat_message(role).write(text)
    if q := st.chat_input("Your question"):
        st.chat_message("user").write(q)
        with st.spinner("Thinking..."):
            answer = ai.ask(result, q, opening)
        st.chat_message("assistant").write(answer)
        st.session_state.chat += [("user", q), ("assistant", answer)]
