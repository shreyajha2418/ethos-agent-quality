# Ethos Agent Quality Program

A small web app for Ethos's operations team. It shows four agents on a **standing ladder** (Good standing → Watch → Training → Termination), the lapses they faced, and the reasoning behind each decision. You can apply a course correction, notify the agent, and watch the agent's card move on the board.

The point it makes: **the cause of a lapse decides the consequence, and an agent's pay follows their standing.**

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
   - **Priya**: Good standing → Training (voluntary). Full advance kept, slower recovery, count resets once.
   - **Marcus**: Good standing → Watch. Unearned + 10% at normal pace; team debt share ₹20,000 at slower pace; keeps manager role.
   - **Dana**: billing bug found → Ethos fault. Stays in Good standing; Ethos absorbs ₹26,667.
   - **Leo**: replacement rule applied to all 3 policies. Stays in Good standing.
3. Open any agent and use **Try it** to test edge cases. For example, add oversold lapses to Marcus until he reaches Training, then one more terminates him; or add a skill-gap lapse to Dana and then 3 clean policies to earn back Good standing.

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

The UI never decides an outcome. It calls `evaluateCase` and `applyOutcome` in `lib/rules.ts`. Tunable numbers (advance, fee, recovery pace, window size, triggers) are in `PROGRAM` at the top of that file.

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

- **Rolling window** means the last 5 policies (clean or lapsed). Older lapses drop out, so Marcus's June lapse rolls out after a few more sales.
- **Earn-back from Training**: 3 clean policies also return a trainee to Good standing. The brief only defines earn-back for Watch.
- **Oversold final warning** applies when an agent reached Training with an oversold lapse in the window. It stays in force after earn-back.
- **Voluntary training** waives the 10% fee and moves recovery to the slower pace, whatever the cause.
- **Unearned advance** = the advance × the share of its period not yet earned (12 months for the full advance, 3 months for each reduced advance).
