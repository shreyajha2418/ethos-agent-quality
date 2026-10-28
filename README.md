# Ethos Agent Quality Program

A small web app for Ethos's operations team. It shows four agents on a **standing ladder** (Good standing → Watch → Training → Termination), the lapses they faced, and the reasoning behind each decision. You can apply a course correction, notify the agent, and watch the agent's card move on the board.

The principle: **Ethos penalises agents only for lapses they cause, and gives risky agents smaller advances until they prove themselves.** The stage sets the size of future advances; the cause sets how fast the agent repays.

All figures are illustrative. There is no backend, login or AI model. Seed data lives in the repo and progress is saved in your browser's `localStorage`. **Reset demo** restores the seed.

## Run locally

Requires Node 18.17 or newer.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # rules unit tests (Vitest)
npm run build      # production build
```

## Try the demo

1. Click **Review** on each of the four incoming cases. Watch the five reasoning steps, click **Apply course correction**, confirm, then **Notify agent** and **Send**.
2. Expected results:
   - **Priya**: Good standing → Training (at her request). Keeps the full ₹10,000 advance; both lapses repaid at the slower pace; uses her one strike-count reset.
   - **Marcus**: Good standing → Watch. ₹5,000 (6-month) advances until his next 3 policies stay clean; unearned advance repaid at the current pace; team debt share ₹20,000 at the slower pace; keeps manager role.
   - **Dana**: billing bug found → Ethos fault. Stays in Good standing; no strikes; Ethos absorbs ₹26,667.
   - **Leo**: policy-switch rule applied to all 3 replacements. Stays in Good standing; each new policy pays ₹2,500 (3 months), then quarterly.
3. Open any agent and use **Try it** to test edge cases: add a lapse with any cause, add a clean policy, add a policy switch (cheaper policy or replacement), or have the agent ask for training. For example, add oversold lapses to Marcus until he reaches Training, then one more terminates him; or add a skill-gap lapse to Dana and then 3 clean policies to earn back Good standing.

## Project layout

```
app/                 Next.js App Router entry (layout, page, global styles)
components/          Dashboard, LadderBoard, AgentCard, AgentPanel, HowItWorks, ActivityLog, ui
data/seed.ts         The four agents, their incoming cases and sample evidence
lib/rules.ts         All program rules and tunable numbers (pure functions, no UI)
lib/rules.test.ts    Unit tests for every rule and the four seed outcomes
lib/messages.ts      Text of the agent notification
lib/store.ts         Zustand store with localStorage persistence
```

The UI never decides an outcome. It calls `evaluateCase` and `applyOutcome` in `lib/rules.ts`. Tunable numbers (advance sizes, recovery pace, window size, triggers) are in `PROGRAM` at the top of that file.

## Deploy to Vercel

### Option A: GitHub + Vercel dashboard

```bash
# 1. Create an empty repo on GitHub (no README), e.g. ethos-agent-quality
git remote add origin https://github.com/<your-username>/ethos-agent-quality.git
git push -u origin main
```

2. Go to https://vercel.com/new, sign in with GitHub, and import the repo.
3. Keep the defaults (Framework: Next.js, no environment variables) and click **Deploy**.
4. Vercel gives you a public URL like `https://ethos-agent-quality.vercel.app`. Every push to `main` redeploys.

### Option B: Vercel CLI

```bash
npm i -g vercel
vercel          # first run: log in and accept the defaults
vercel --prod   # production deploy, prints the public URL
```

## Rule decisions worth knowing

- **Rolling window** means the last 5 policies (clean or lapsed). Older strikes drop out.
- **Earn-back resets only on a strike.** A lapse that is Ethos's fault, no-fault or inconclusive doesn't reset the agent's count of clean policies.
- **Earn-back from Training** works the same way: once training is done, the next 3 clean policies return the agent to Good standing.
- **Oversold final warning** applies when an agent reached Training with an oversold lapse in the window. It stays in force after earn-back.
- **Training by request** moves all of the agent's own existing debt to the slower pace and uses their one strike-count reset.
- **Unearned advance** = the advance × the share of its months not yet earned (12 for the full advance, 6 for the ₹5,000 stage advance, each quarter for the ₹2,500 switch advance).
