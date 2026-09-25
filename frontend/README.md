# AI Bank Reconciliation Assistant — frontend

React + TypeScript UI for the reconciliation API in `../api.py`. Vite,
Tailwind CSS, and TanStack Query for server state.

```bash
npm install
npm run dev      # http://localhost:5173
```

Requires the API running alongside it: `uvicorn api:app --reload` (from the
project root, with a virtualenv where `pip install -r requirements.txt` has
run). The API's CORS config already allows `http://localhost:5173`.

`VITE_API_BASE_URL` (see `.env.example`) points at the API; it defaults to
`http://127.0.0.1:8000` if unset.

## Structure

```
src/
  api/client.ts   fetch wrappers for /health, /reconcile, /explain, /ask
  api/types.ts    TypeScript types mirroring api.py's JSON shapes
  components/     Sidebar, MetricsBar, shared UI primitives
  components/tabs/  one component per tab (BRS, exceptions, journal entries,
                     matches, ask-AI chat)
  App.tsx         layout, tab state, and the one React Query hook every tab
                  reads from
```

`App.tsx` holds the "current dataset" (sample vs. uploaded CSVs, matching-rule
sliders, opening balance) and reconciles via a single query keyed on all of
those. Slider changes are debounced ~400ms before refetching. Approvals and
AI explanations reset whenever that key changes, since exception IDs are
only stable for a given dataset + config.
