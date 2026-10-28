'use client';

import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { CAUSE_INFO, KEY_RULE, formatINR, totals, type EventTag } from '@/lib/rules';
import LadderBoard from './LadderBoard';
import AgentPanel from './AgentPanel';
import HowItWorks from './HowItWorks';
import ActivityLog from './ActivityLog';
import { CauseTag } from './ui';

const LEGEND: EventTag[] = ['ethos', 'nofault', 'inconclusive', 'skill', 'oversold', 'ignored', 'switch'];

function Stat({ label, value, dot }: { label: string; value: string; dot?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 bg-surface px-4 py-3">
      <span className="flex items-center gap-1.5 text-xs text-muted">
        {dot && <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />}
        {label}
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 8, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="num text-xl font-medium"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

export default function Dashboard() {
  const agentsMap = useStore((s) => s.agents);
  const cases = useStore((s) => s.cases);
  const reset = useStore((s) => s.reset);
  const [panel, setPanel] = useState<{ agentId: string; caseId?: string } | null>(null);
  const [how, setHow] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    useStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const agents = useMemo(() => Object.values(agentsMap), [agentsMap]);
  const t = totals(agents);
  const count = (...st: string[]) => agents.filter((a) => st.includes(a.standing)).length;

  return (
    <MotionConfig reducedMotion="user">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="eyebrow">Ethos · Operations</p>
            <h1 className="text-[22px] font-bold tracking-tight">Agent Quality Program</h1>
            <p className="max-w-2xl text-muted">Ethos penalises agents only for lapses they cause, and gives risky agents smaller advances until they prove themselves.</p>
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="Demo controls">
            <button type="button" className="btn" onClick={() => setHow(true)}>How it works</button>
            <button type="button" className="btn" onClick={() => setLogOpen(true)}>Activity log</button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setPanel(null);
                reset();
                setToast('Demo reset to the five seed cases');
              }}
            >
              Reset demo
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
        <section aria-label="Summary" className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
          <Stat label="Good standing" value={String(count('good'))} dot="bg-good" />
          <Stat label="On Watch or Training" value={String(count('watch', 'training'))} dot="bg-watch" />
          <Stat label="Absorbed by Ethos" value={formatINR(t.absorbed)} />
          <Stat label="Being recovered" value={formatINR(t.recovering)} />
        </section>

        <section aria-labelledby="queue-h">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 id="queue-h" className="text-base font-semibold">Incoming cases</h2>
            {cases.length > 0 && <span className="text-xs text-muted">{cases.length} waiting</span>}
          </div>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            {cases.length === 0 ? (
              <p className="px-4 py-5 text-center text-muted">
                <span className="font-semibold text-good">All cases reviewed.</span> Open any agent and use “Try it” to test more.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                <AnimatePresence initial={false}>
                  {cases.map((c) => {
                    const a = agentsMap[c.agentId];
                    const tag: EventTag = c.kind === 'lapse' ? c.cause : c.kind;
                    return (
                      <motion.li
                        key={c.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 sm:flex-nowrap"
                      >
                        <span className="w-32 shrink-0 font-semibold">{a.name}</span>
                        <span className="order-3 flex min-w-0 basis-full items-center gap-2 sm:order-none sm:basis-auto sm:flex-1">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${tagDot(tag)}`} aria-label={CAUSE_INFO[tag].label} />
                          <span className="truncate text-muted">
                            <span className="text-ink">{c.title}.</span> {c.summary}
                          </span>
                        </span>
                        <button type="button" className="btn btn-primary btn-sm ml-auto" onClick={() => setPanel({ agentId: c.agentId, caseId: c.id })}>
                          Review
                        </button>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </section>

        <section aria-labelledby="board-h">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <h2 id="board-h" className="text-base font-semibold">Standing ladder</h2>
              <p className="text-xs text-muted">{KEY_RULE}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5" aria-label="Cause colours">
              {LEGEND.map((tag) => (
                <CauseTag key={tag} tag={tag} />
              ))}
            </div>
          </div>
          <LadderBoard agents={agents} cases={cases} onOpen={(id) => setPanel({ agentId: id })} />
        </section>
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 pt-2 text-xs text-muted sm:px-6">Illustrative figures. Prototype for the Ethos PM case.</footer>

      <AgentPanel
        key={panel ? `${panel.agentId}:${panel.caseId ?? ''}` : 'none'}
        agentId={panel?.agentId ?? null}
        initialCaseId={panel?.caseId}
        onClose={() => setPanel(null)}
        onToast={setToast}
      />
      <HowItWorks open={how} onClose={() => setHow(false)} />
      <ActivityLog open={logOpen} onClose={() => setLogOpen(false)} />

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-5 left-1/2 z-[100] -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-[13px] text-bg shadow-lift"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

function tagDot(tag: EventTag) {
  const map: Record<EventTag, string> = {
    ethos: 'bg-c-ethos', nofault: 'bg-c-nofault', skill: 'bg-c-skill', oversold: 'bg-c-oversold', ignored: 'bg-c-ignored',
    inconclusive: 'bg-c-inconclusive', switch: 'bg-c-replacement', clean: 'bg-c-clean', team: 'bg-c-team', request: 'bg-c-team',
  };
  return map[tag];
}
