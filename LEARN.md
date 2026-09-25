# Learning guide: own this project in 5 days

You need to be able to explain **every design decision** in this project. The goal isn't to memorise the code. It's to understand each part well enough to rebuild it on a whiteboard.

---

## 1. Your 60-second pitch

> "Month-end bank reconciliation is still mostly manual: someone ticks off bank lines against the ledger in Excel. I built an AI reconciliation assistant that does it automatically. The matching runs in SQL in three passes, from exact matches down to fuzzy ones, and Python makes sure each transaction is used once. Rules classify whatever's left into standard categories like bank charges, bounced cheques, outstanding cheques and transposition errors. The tool then builds the Bank Reconciliation Statement and proposes the adjusting journal entries.
>
> The AI layer uses Gemini to explain each exception and draft the entry. I didn't let the LLM touch the numbers, though. Every reply is validated against a schema, and its amounts are checked against the rule engine. If the model hallucinates, the system falls back to the computed entry. Nothing gets posted without human approval. On a sample month it auto-matched 88% of transactions and caught all nine planted exceptions. It's exposed through a Streamlit app and a FastAPI endpoint."

Practise saying it out loud until it takes about 60 seconds.

---

## 2. The accounting you must know cold

### Why reconcile at all?
The company's **cash book** (the ledger) and the **bank statement** record the same money from two sides, and they almost never agree on day 30. Reconciliation proves that every difference is explained. That's an internal control: it catches errors, fraud and missing entries before the books close.

### The two kinds of difference (the most common interview question)

| Type | Examples | Who is "wrong"? | Fix |
|---|---|---|---|
| **Timing** | Outstanding cheque, deposit in transit | Nobody. The bank hasn't caught up | Adjust the **bank side** of the BRS. **No journal entry** |
| **Book-side** | Bank charges, interest, bounced cheque, errors, duplicates | The books are incomplete or wrong | **Journal entry** in the books |

### Every exception in this project, with its entry

| Exception | Cause | Journal entry |
|---|---|---|
| Bank charges ₹590 | Bank deducted fees | Dr Bank Charges / Cr Bank |
| Interest ₹1,845 | Bank paid interest | Dr Bank / Cr Interest Income |
| Dishonoured cheque ₹88,000 | Customer's cheque bounced | Dr Accounts Receivable / Cr Bank *(customer owes again)* |
| Transposition ₹270 | Clerk typed 45,630 instead of 45,360 | Dr Bank 270 / Cr Accounts Payable 270 *(the payment was overstated)* |
| Duplicate ₹73,900 | Same receipt posted twice | Dr Accounts Receivable / Cr Bank *(reverse the duplicate)* |
| Outstanding cheque ₹57,800 | Vendor hasn't banked it | None. On the BRS |
| Deposit in transit ₹1,21,500 | Deposited on the 30th | None. On the BRS |
| Unexplained ₹12,000 | Unknown | **Don't post.** Investigate |

### The "divisible by 9" trick
If two digits are swapped (45,360 → 45,630), the difference is always divisible by 9. Here it's 270 = 9 × 30. Accountants use this trick, and the engine flags it automatically. It's a great detail to mention.

### The Bank Reconciliation Statement (BRS)
```
Balance per bank          234,825.50      Balance per books          471,254.50
+ Deposits in transit     121,500.00      + Interest                   1,845.00
− Outstanding cheques     (57,800.00)     − Bank charges                (944.00)
                                          − Dishonoured cheque       (88,000.00)
                                          + Error correction             270.00
                                          − Duplicate reversed       (73,900.00)
= Adjusted bank           298,525.50      = Adjusted books           310,525.50
```
The remaining difference, −₹12,000, is exactly the unexplained item. The tool **shows** it rather than forcing a balance. Hiding a difference is how fraud goes unnoticed.

### JD vocabulary: know one line on each
- **Financial close:** the month-end process of finalising the books (reconciliations, accruals, adjustments, then reporting). Reconciliation is one of its biggest bottlenecks.
- **Consolidation:** combining the accounts of a parent and its subsidiaries into one set of group statements.
- **Intercompany eliminations:** removing transactions *between* group companies (Sub A sells to Sub B) during consolidation, so the group doesn't count revenue it earned from itself. Intercompany reconciliation is the same matching problem as this project, run between two group entities instead of bank and books.
- **FP&A:** budgeting, forecasting and variance analysis.
- **OneStream / CPM tools:** platforms that run close and consolidation. Their business rules are written in VB.NET/C#, which is probably why the JD mentions C#.

---

## 3. The code: what each file does and what to say

### `recon/data.py`: loading and validation
- It checks columns, parses dates and rejects bad amounts with a clear error.
- **Money is stored as integer paise.** In Python, `0.1 + 0.2 == 0.3` is `False`. Floating-point errors are unacceptable in accounting, so amounts are converted to whole paise before comparing.

### `recon/engine.py`: the heart of the project
1. Both tables are loaded into **in-memory SQLite**.
2. Three SQL queries generate candidate pairs, strictest first:
   - `exact`: `JOIN ON reference = reference AND amount = amount`
   - `window`: same amount, `ABS(julianday(b.date) - julianday(l.date)) <= 5`. This catches lines with missing references and bank posting lags.
   - `near`: same sign, amounts within 5% but *not equal*, plus a matching reference or a similar description. These are errors.
3. **Why SQL *and* Python?** SQL is good at set operations, like finding every pair that meets a condition. It's poor at the "each row used once" rule. So Python scores every candidate (description similarity + reference bonus − 5 × days apart), sorts them, and picks greedily, best first, skipping anything already used. This is **one-to-one matching**.
4. **Fuzzy matching** (`rapidfuzz.token_set_ratio`) strips banking noise words (NEFT, RTGS, DR, CR…) and then compares, so "RTGS DR ZENITH LUBRICANTS PO-5188" and "Payment to Zenith Lubricants for PO-5188" score 100.
5. **Classification** of leftovers uses simple, auditable rules: keywords (`CHG`, `INT`, `RETURN`), cheque references, days to period end, and duplicate references.

Be ready to write the `window` SQL query from memory.

### `recon/report.py`: the BRS and journal entries
- Timing items go on the bank side, book items become journal entries.
- Every entry is balanced (the same amount is debited and credited) and marked "Proposed – needs approval".

### `recon/ai.py`: the AI layer (your "AI edge")
- **Provider abstraction:** one `_call_llm()` function hides the Gemini-vs-OpenAI differences.
- **Structured output:** the model must reply in JSON matching a **pydantic** schema (`Explanation`). Gemini's `response_mime_type="application/json"` and OpenAI's `json_object` mode enforce that.
- **Guardrail:** `validate_entry()` checks that the AI's journal entry amount equals the amount the rule engine computed, and that debit ≠ credit. If the check fails, the AI's entry is replaced with the computed one and confidence drops to "low".
- **Fallbacks:** broken JSON, network errors and missing keys all fall back to rules. The app never crashes because of the AI.
- **Grounded Q&A (`ask`):** the whole reconciliation is serialised to JSON and put in the prompt, with instructions to answer only from that data and cite exception IDs. This is *retrieval-augmented generation* in its simplest form. The data is small enough to fit in context, so no vector database is needed.
- **Prompt injection defence:** bank narrations are external text, so someone could write "ignore instructions" into a payment description. The system prompt tells the model to treat them as data.
- **Low temperature (0.2):** you want consistent, factual answers, not creativity.

### `api.py`: FastAPI
- `POST /reconcile` takes two CSV uploads and returns JSON. `/docs` gives interactive Swagger docs for free.
- **Why an API?** It lets an ERP, a scheduler or another team's tool call the engine, which is how accelerators get reused across clients.

### `app.py`: Streamlit
- Streamlit reruns the whole script on every click, so AI answers and approvals are kept in `st.session_state`.
- The Journal entries tab uses a data editor with an Approve checkbox, so the human-in-the-loop step is visible.

### `tests/test_recon.py`
- There are 14 tests. The AI tests use a **fake LLM** (`monkeypatch`) that returns a hallucinated amount, which proves the guardrail catches it. Testing AI systems without calling the real API is a strong point to make.

---

## 4. Five-day plan (about 3–4 hours a day, alongside CFA)

**Day 1: Run it and learn the accounting**
- [ ] Install and run everything (README quick start). Click through every tab.
- [ ] Get a free Gemini API key, set it, and run the app again. Compare the AI explanations with the offline ones.
- [ ] Learn section 2 until you can draw the BRS on paper without looking.
- [ ] Open `data/generate_sample_data.py` and find where each exception is planted.

**Day 2: data.py and engine.py**
- [ ] Read both files line by line. Look up anything unfamiliar (`julianday`, `token_set_ratio`, `itertuples`).
- [ ] Experiment: change the date-window slider to 0. What stops matching, and why?
- [ ] Write the three SQL queries from memory on paper.
- [ ] **Make it yours:** add a new planted exception to the generator, such as a direct debit for an insurance premium the books missed, and a rule to classify it. Re-run the tests.

**Day 3: ai.py and GenAI concepts**
- [ ] Read `ai.py`. Trace one `explain()` call from prompt to validation to fallback.
- [ ] Learn these concepts well enough to explain each in two sentences: LLM, tokens, temperature, system prompt, structured output, hallucination, RAG, embeddings, AI agents and tool/function calling, prompt injection.
- [ ] Temporarily edit the prompt to say "set amount to 999". Watch the guardrail reject it, then revert.

**Day 4: API, UI, C# and web basics**
- [ ] Run `uvicorn api:app --reload`, open `/docs`, and call each endpoint.
- [ ] Learn REST basics: GET vs POST, status codes 200/404/422, JSON.
- [ ] C#: install the .NET SDK and write a small console program that reads the bank CSV and sums the amounts. Coming from C++, it'll feel familiar. Glance at VB.NET syntax too.
- [ ] HTML/CSS/JS: one hour on the basics (MDN "Getting started with the web").

**Day 5: Polish and mock interview**
- [ ] Push to GitHub with a clear README and a screenshot. Put the link on your resume.
- [ ] Practise the 60-second pitch and the Q&A below out loud, ideally with a friend.
- [ ] Revise the SQL for joins, GROUP BY/HAVING and window functions.

---

## 5. Likely interview questions and how to answer them

**Q: Walk me through your project.** Use the 60-second pitch, then offer to go deeper into matching or the AI layer.

**Q: Why not let the LLM do the matching?** LLMs are non-deterministic and can hallucinate numbers, and finance needs results that are exact, repeatable and auditable. Matching is a precise, rule-based problem that SQL handles perfectly and cheaply. The LLM adds value where language is involved: explaining, drafting and answering questions.

**Q: How do you stop the AI from making mistakes?** There are four layers: a strict JSON schema, an amount check against the rule engine, fallback to rules on any failure, and human approval before anything is posted.

**Q: What's the difference between an outstanding cheque and a deposit in transit?** Both are timing differences. An outstanding cheque is money *out* that the company recorded but the bank hasn't paid yet. A deposit in transit is money *in* that the company recorded but the bank hasn't credited yet. Neither needs a journal entry.

**Q: What if one bank deposit covers three invoices?** That's many-to-one matching, and it's the next feature to build. You'd look for a combination of ledger entries that sums to the bank amount (a subset-sum problem), bounded by customer and date window to keep it fast.

**Q: How would this scale to a million transactions?** Move from SQLite to a proper database with indexes on amount and date. Block candidates by amount before joining, which SQL already does, and batch the LLM calls to exceptions only. Only about 10% of lines are exceptions, so AI cost stays low.

**Q: Why integer paise?** Floating-point numbers can't represent most decimals exactly, and accounting needs exact equality.

**Q: How would you use AI to speed up month-end close more broadly?** Use it for auto-reconciliation like this project, drafting variance commentary for FP&A, flagging unusual journal entries, and matching intercompany balances. The pattern is always the same: deterministic systems handle the numbers, and AI handles the language, triage and first drafts, with humans approving.

**Q: What's RAG? Did you use it?** Retrieval-augmented generation means giving the model relevant data at question time instead of relying on its training. The Ask AI tab does a simple version: it puts this reconciliation's data in the prompt. For thousands of documents you'd add embeddings and a vector search step.

**Q: What was hardest?** Honest answer: the one-to-one matching. SQL alone paired the same bank line with several ledger entries, so I added scoring and greedy selection in Python.

**Q: Did you use AI to build this?** Yes, and say so confidently. *"I built it with an AI coding assistant as a pair programmer. I designed the approach, then reviewed, tested and extended the code myself. For example, I added [the feature you add on Day 2]. That's how I expect this team builds accelerators too."* Being able to use AI tools productively **and** verify their output is exactly what this role needs. Never claim you wrote every line alone.

---

## 6. Resume bullet (fill in after you've extended it)

> **AI Bank Reconciliation Assistant** | Python · SQL · Gemini API · FastAPI · Streamlit
> - Built a reconciliation accelerator matching bank and ledger data through 3-pass SQL + fuzzy matching; auto-matched **88%** of transactions and detected all **9** exception types, generating the Bank Reconciliation Statement and balanced adjusting entries
> - Integrated an LLM with pydantic-validated structured output and amount guardrails to explain exceptions and draft journal entries, with rule-based fallback and human approval; exposed via REST API with **14** automated tests

Only list what you can explain in detail, because the interviewer will pick one bullet and dig in.
