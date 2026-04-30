# BillSplit

A web app for scanning receipts and splitting expenses with friends. Upload a photo or PDF of any receipt, let AI extract the line items, assign each item to the people sharing it, and track who owes what — including settlements when money is paid back.

## Features

- **Receipt scanning** — upload a photo (JPEG, PNG, WebP, GIF) or PDF; Claude or Gemini extracts merchant name, items, quantities, tax, tip, fees, and total
- **Item-level splitting** — assign each line item to one or more people; tax, tip, and fees are distributed proportionally
- **Expense tracking** — see your personal spending broken down by category and month, with filterable date ranges
- **Balance tracking** — see how much each person owes you across all receipts, with per-receipt drill-down
- **Settlement tracking** — record payments when someone pays you back; net balances update immediately
- **Export** — download any expense report or individual balance as a PDF or Excel (.xlsx) file
- **History** — browse all past receipts in a table grouped by month, with collapsible sections
- **Dark mode** — follows system preference, with a manual toggle
- **Google sign-in** — all data is private to your account, stored in Firestore

## Tech stack

- React 19 + TypeScript, Vite, Tailwind CSS v4
- Firebase (Google Auth + Firestore)
- Anthropic Claude API (`claude-sonnet-4-6`) for receipt extraction
- Google Gemini API as an alternative extraction backend
- `motion/react` for animations, `lucide-react` for icons

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd BillSplit
npm install
```

### 2. Firebase

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Firestore** and **Google sign-in** under Authentication
3. Copy your web app config into `firebase-applet-config.json`:

```json
{
  "apiKey": "...",
  "authDomain": "...",
  "projectId": "...",
  "storageBucket": "...",
  "messagingSenderId": "...",
  "appId": "...",
  "firestoreDatabaseId": "(default)"
}
```

4. Deploy the Firestore security rules:

```bash
firebase deploy --only firestore:rules
```

### 3. API keys

Create a `.env.local` file in the project root:

```env
ANTHROPIC_API_KEY=sk-ant-...
VITE_GEMINI_API_KEY=...
```

Both keys are used client-side. For a production deployment, proxy these calls through a backend (e.g. a Firebase Function) to avoid exposing keys in the browser bundle.

### 4. Run

```bash
npm run dev        # dev server on http://localhost:3000
npm run build      # production build → dist/
npm run lint       # TypeScript type-check
```

## Project structure

```
src/
  components/
    BalancesView.tsx    # who owes you, settlements
    ExpensesView.tsx    # your spending, category/month charts
    ReceiptUploader.tsx # drag-and-drop upload + AI extraction
    ReceiptView.tsx     # item editor, person assignment
    SplitSummary.tsx    # per-person breakdown for a single receipt
  lib/
    exportExpenses.ts   # PDF and XLSX export (no external deps)
    firebase.ts         # auth + db singletons
    myExpenses.ts       # compute personal spending from receipts
    owedBalances.ts     # compute per-person balances
    settlements.ts      # Firestore CRUD for settlements
    theme.ts            # dark mode toggle
    userProfile.ts      # display name + saved participants
    utils.ts            # currency formatting, date helpers
  services/
    claudeService.ts    # Anthropic SDK — receipt extraction
    geminiService.ts    # Gemini SDK — receipt extraction
  types.ts              # shared interfaces and constants
  App.tsx               # root — auth, routing, global state
```

## Data model (Firestore)

| Collection | Key fields |
|---|---|
| `receipts/{id}` | `userId`, `data` (items, totals), `people`, `timestamp` |
| `users/{uid}` | `displayName`, `participants` (saved person list) |
| `settlements/{id}` | `userId`, `personName`, `amount`, `currency`, `date`, `timestamp`, `note?` |

All documents are user-scoped; Firestore rules deny access to anyone other than the owning user.

## License

Apache 2.0 — see individual file headers.
