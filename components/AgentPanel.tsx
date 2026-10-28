'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { notifyMessage } from '@/lib/messages';
import {
  CAUSE_INFO,
  LAPSE_CAUSES,
  PROGRAM,
  evaluateCase,
  formatINR,
  paceLabel,
  standingLabel,
  upfrontPerPolicy,
  strikeCount,
  SWITCH_LABEL,
  type Agent,
  type Case,
  type LapseCause,
  type Outcome,
  type StandingState,
  type SwitchType,
} from '@/lib/rules';
import type { TryKind } from '@/lib/store';
import { CauseTag, Disclosure, Modal, SlideOver, StandingBadge } from './ui';

interface Result {
  outcome: Outcome;
  c: Case;
  agentAfter: Agent;
  notified: boolean;
}

export default function AgentPanel({
  agentId,
  initialCaseId,
  onClose,
  onToast,
}: {
  agentId: string | null;
  initialCaseId?: string;
  onClose: () => void;
  onToast: (t: string) => void;
}) {
  const agent = useStore((s) => (agentId ? s.agents[agentId] : undefined));
  const allCases = useStore((s) => s.cases);
  const applyCase = useStore((s) => s.applyCase);
  const addTryCase = useStore((s) => s.addTryCase);
  const setCause = useStore((s) => s.setCause);
  const addLog = useStore((s) => s.addLog);

  const [caseId, setCaseId] = useState<string | undefined>(initialCaseId);
  const [result, setResult] = useState<Result | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [appealOpen, setAppealOpen] = useState(false);
  const reviewRef = useRef<HTMLDivElement>(null);

  const pending = useMemo(() => allCases.filter((c) => c.agentId === agentId), [allCases, agentId]);
  const selected = pending.find((c) => c.id === caseId) ?? pending[0];
  const outcome = useMemo(() => (agent && selected ? evaluateCase(agent, selected) : null), [agent, selected]);

  const open = Boolean(agentId && agent);

  function confirmApply() {
    if (!selected || !agent) return;
    const o = applyCase(selected.id);
    setConfirmOpen(false);
    if (!o) return;
    const after = useStore.getState().agents[agent.id];
    setResult({ outcome: o, c: selected, agentAfter: after, notified: false });
    onToast(
      o.from.standing === o.to.standing && o.from.voluntary === o.to.voluntary
        ? `${agent.firstName} stays in ${standingLabel(o.to)}`
        : `${agent.firstName} moved to ${standingLabel(o.to)}`,
    );
  }

  function tryIt(kind: TryKind, opts?: { cause?: LapseCause; requestedTraining?: boolean; switchType?: SwitchType }) {
    if (!agent) return;
    const id = addTryCase(agent.id, kind, opts);
    if (!id) return;
    setResult(null);
    setCaseId(id);
    requestAnimationFrame(() => reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  return (
    <SlideOver open={open} onClose={onClose} labelledBy="panel-title" dim={false}>
      {agent && (
        <>
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-surface px-5 py-4">
            <div className="min-w-0">
              <h2 id="panel-title" className="text-xl font-semibold">{agent.name}</h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="rounded border border-line px-1.5 font-semibold uppercase tracking-wide">{agent.roleTag}</span>
                {agent.profile}
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close panel" className="rounded px-1.5 text-2xl leading-none text-muted hover:text-ink">×</button>
          </div>

          <div className="flex flex-col gap-4 px-5 pb-10 pt-4">
            <Summary agent={agent} />

            <div ref={reviewRef} className="scroll-mt-24">
              <AnimatePresence mode="wait" initial={false}>
                {result ? (
                  <ResultBlock
                    key="result"
                    result={result}
                    onNotify={() => setNotifyOpen(true)}
                    onAppeal={() => setAppealOpen(true)}
                    onDone={() => setResult(null)}
                    hasMore={pending.length > 0}
                  />
                ) : selected && outcome ? (
                  <motion.section
                    key={`case-${selected.id}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    aria-labelledby="case-h"
                    className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4"
                  >
                    <div>
                      <p className="eyebrow">Case review · {selected.date}</p>
                      <h3 id="case-h" className="text-base font-semibold">{selected.title}</h3>
                      <p className="text-muted">{selected.summary}</p>
                    </div>
                    {pending.length > 1 && (
                      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pending cases">
                        {pending.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            aria-pressed={c.id === selected.id}
                            onClick={() => setCaseId(c.id)}
                            className={`btn btn-sm ${c.id === selected.id ? 'border-accent text-accent' : ''}`}
                          >
                            {c.title}
                          </button>
                        ))}
                      </div>
                    )}
                    <ReasoningSteps
                      key={`${selected.id}:${selected.kind === 'lapse' ? selected.cause : ''}`}
                      c={selected}
                      o={outcome}
                      onCause={(cause) => setCause(selected.id, cause)}
                    />
                    <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                      <button type="button" className="btn btn-primary" onClick={() => setConfirmOpen(true)}>Apply course correction</button>
                      <button type="button" className="btn" onClick={() => setAppealOpen(true)}>Appeal</button>
                    </div>
                  </motion.section>
                ) : (
                  <motion.p key="none" className="rounded-xl border border-dashed border-line px-4 py-4 text-center text-muted">
                    No case to review for {agent.firstName}. {agent.standing !== 'terminated' && 'Use “Try it” below to add one.'}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <History agent={agent} />
            <Money agent={agent} />
            <TryIt agent={agent} onAdd={tryIt} />
          </div>

          {selected && outcome && (
            <ConfirmModal open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={confirmApply} agent={agent} o={outcome} />
          )}
          {result && (
            <NotifyModal
              open={notifyOpen}
              onClose={() => setNotifyOpen(false)}
              result={result}
              onSend={(edited) => {
                addLog(`Notification sent to ${result.agentAfter.firstName}${edited ? ' (edited)' : ''}`);
                setResult({ ...result, notified: true });
                setNotifyOpen(false);
                onToast(`Notification sent to ${result.agentAfter.firstName}`);
              }}
            />
          )}
          <AppealModal
            open={appealOpen}
            onClose={() => setAppealOpen(false)}
            name={agent.firstName}
            onLog={() => {
              addLog(`Appeal path shown for ${agent.firstName}`);
              setAppealOpen(false);
            }}
          />
        </>
      )}
    </SlideOver>
  );
}

/* ---------------------------------------------------------------- */

function Summary({ agent }: { agent: Agent }) {
  const up = upfrontPerPolicy(agent);
  const onEarnBack = agent.standing === 'watch' || agent.standing === 'training';
  const k = PROGRAM.earnBackCleanPolicies;
  const streak = Math.min(agent.cleanStreak, k);
  return (
    <section aria-label="Summary" className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StandingBadge s={agent} />
        {agent.manager && <span className="text-xs text-muted">Keeps manager role · {agent.manager.team}</span>}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted">Advance per new policy</dt>
          <dd><span className="num font-medium">{formatINR(up.amount)}</span> <span className="block text-xs text-muted">{up.detail}</span></dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Strikes (last {PROGRAM.rollingWindow} policies)</dt>
          <dd className="num font-medium">{strikeCount(agent.window)} of {PROGRAM.rollingWindow}</dd>
          {agent.resetUsed && <dd className="text-xs text-muted">One reset used</dd>}
        </div>
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-xs text-muted">Earn-back</dt>
          {onEarnBack ? (
            <dd className="flex flex-col gap-1">
              <span className="num font-medium">{streak} of {k} clean</span>
              <span className="grid grid-cols-3 gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={k} aria-valuenow={streak} aria-label="Earn-back progress">
                {Array.from({ length: k }, (_, i) => (
                  <motion.span key={i} className="h-1.5 rounded-full bg-line" animate={{ backgroundColor: i < streak ? 'rgb(var(--good))' : 'rgb(var(--line))' }} />
                ))}
              </span>
            </dd>
          ) : (
            <dd className="text-muted">{agent.standing === 'good' ? 'Not needed' : 'Not available'}</dd>
          )}
        </div>
      </dl>
      {agent.finalWarning && agent.standing !== 'terminated' && (
        <p className="mt-3 rounded-lg bg-terminated/10 px-3 py-2 text-xs text-terminated">Final warning: one more oversold lapse means Termination.</p>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- */

function ReasoningSteps({ c, o, onCause }: { c: Case; o: Outcome; onCause: (cause: LapseCause) => void }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? 5 : 1);
  useEffect(() => {
    if (reduce || shown >= 5) return;
    const t = setTimeout(() => setShown((n) => n + 1), 600);
    return () => clearTimeout(t);
  }, [shown, reduce]);

  const ev = c.evidence;
  const steps: { title: string; body: React.ReactNode }[] = [
    {
      title: 'Ethos billing check',
      body: (
        <div className="flex items-start gap-2">
          <span
            className={`mt-0.5 shrink-0 rounded-md border px-1.5 text-xs font-semibold ${o.billingCheck.bugFound ? 'border-watch/40 bg-watch/10 text-watch' : 'border-good/40 bg-good/10 text-good'}`}
          >
            {o.billingCheck.label}
          </span>
          <span>{o.billingCheck.text}</span>
        </div>
      ),
    },
    {
      title: 'Evidence',
      body: (
        <dl className="flex flex-col gap-2">
          <Evidence label="Call transcript">{ev.transcript}</Evidence>
          {c.kind !== 'request' && <Evidence label="First-payment check">{ev.firstPayment}</Evidence>}
          {c.kind !== 'request' && <Evidence label={`Check-in confidence${ev.confidenceNote ? ` (${ev.confidenceNote})` : ''}`}>
            <span className="flex items-center gap-2">
              <span className="num">{ev.confidence}/100</span>
              <span className="h-1.5 w-32 overflow-hidden rounded-full bg-line"><span className="block h-full bg-accent" style={{ width: `${ev.confidence}%` }} /></span>
            </span>
          </Evidence>}
        </dl>
      ),
    },
    {
      title: 'Cause identified',
      body: (
        <div className="flex flex-wrap items-center gap-2">
          <CauseTag tag={o.tag} long />
          {c.kind === 'lapse' && (
            <label className="flex items-center gap-1.5 text-xs text-muted">
              Change
              <select className="field py-1 text-xs" value={c.cause} onChange={(e) => onCause(e.target.value as LapseCause)} aria-label="Change cause">
                {LAPSE_CAUSES.map((k) => (
                  <option key={k} value={k}>{CAUSE_INFO[k].long}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      ),
    },
    { title: 'Rule applied', body: <p className="rounded-lg bg-sunken px-3 py-2">{o.rule}</p> },
    { title: 'Effect', body: <Effect o={o} /> },
  ];

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col">
        {steps.map((s, i) => (
          <AnimatePresence key={s.title} initial={false}>
            {i < shown && (
              <motion.li
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-[1.75rem_1fr] gap-3 border-t border-line py-3 first:border-t-0 first:pt-0"
              >
                <span className="num flex h-6 w-6 items-center justify-center rounded-full border border-line bg-sunken text-xs">{i + 1}</span>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="font-semibold">{s.title}</span>
                  {s.body}
                </div>
              </motion.li>
            )}
          </AnimatePresence>
        ))}
      </ol>
      {shown < 5 && (
        <button type="button" className="self-start text-xs font-medium text-accent underline underline-offset-2" onClick={() => setShown(5)}>
          Show all steps
        </button>
      )}
    </div>
  );
}

function Evidence({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-line pl-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted">
        <span className="rounded border border-line px-1 text-[9.5px] font-bold uppercase tracking-wider">Sample</span>
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

function BeforeAfter({ from, to }: { from: StandingState; to: StandingState }) {
  const f = upfrontPerPolicy(from);
  const t = upfrontPerPolicy(to);
  const side = (label: string, s: StandingState, u: typeof f, after: boolean) => (
    <div className={`flex min-w-0 flex-col gap-1 rounded-lg border p-3 ${after ? 'border-accent/60 bg-accent/5' : 'border-line'}`}>
      <span className="eyebrow">{label}</span>
      <StandingBadge s={s} />
      <span className="num text-lg font-medium">{formatINR(u.amount)}</span>
      <span className="text-xs text-muted">per new policy · {u.detail}</span>
    </div>
  );
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      {side('Before', from, f, false)}
      <span className="text-muted" aria-hidden>→</span>
      {side('After', to, t, true)}
    </div>
  );
}

function moneyLine(o: Outcome): string {
  if (o.money.absorbed) return `Ethos absorbs ${formatINR(o.money.absorbed)}. Nothing recovered from the agent.`;
  if (!o.money.ownRecovered) return 'No money changes.';
  return `Repay ${formatINR(o.money.ownRecovered)} of unearned advance at ${paceLabel(o.money.pace ?? 'current')}.`;
}

function Effect({ o }: { o: Outcome }) {
  return (
    <div className="flex flex-col gap-2">
      <BeforeAfter from={o.from} to={o.to} />
      <ul className="list-disc space-y-0.5 pl-5 text-[13px]">
        <li>{moneyLine(o)}</li>
        {o.tag !== 'clean' && o.tag !== 'request' && <li>{o.strike ? `Strike: yes${o.resetApplied ? '; the strike count then resets (once)' : ` (${o.strikesAfter} in the last ${PROGRAM.rollingWindow} policies)`}.` : 'Strike: no.'}</li>}
        {o.money.movedToSlower > 0 && !o.notes.some((n) => n.startsWith('Existing debt')) && <li>Existing debt moves to the slower pace.</li>}
        {o.notes.filter((n) => !(o.strike && n.startsWith('Strike count resets'))).map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function ResultBlock({ result, onNotify, onAppeal, onDone, hasMore }: { result: Result; onNotify: () => void; onAppeal: () => void; onDone: () => void; hasMore: boolean }) {
  const o = result.outcome;
  const moved = o.from.standing !== o.to.standing || o.from.voluntary !== o.to.voluntary;
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      aria-live="polite"
      className="flex flex-col gap-3 rounded-xl border border-accent/50 bg-surface p-4"
    >
      <div>
        <p className="eyebrow text-accent">Course correction applied</p>
        <h3 className="text-base font-semibold">
          {moved ? `${result.agentAfter.firstName} moved to ${standingLabel(o.to)}` : `${result.agentAfter.firstName} stays in ${standingLabel(o.to)}`}
        </h3>
      </div>
      <BeforeAfter from={o.from} to={o.to} />
      <p className="text-[13px] text-muted">{moneyLine(o)}{o.money.teamShare ? ` Team debt share ${formatINR(o.money.teamShare)} at ${paceLabel('slower')}.` : ''}</p>
      <div className="flex flex-wrap gap-2">
        {result.notified ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-good/10 px-3 py-1.5 text-[13px] font-medium text-good">✓ Agent notified</span>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onNotify}>Notify agent</button>
        )}
        <button type="button" className="btn" onClick={onAppeal}>Appeal</button>
        <button type="button" className="btn" onClick={onDone}>{hasMore ? 'Next case' : 'Done'}</button>
      </div>
    </motion.section>
  );
}

/* ---------------------------------------------------------------- */

function History({ agent }: { agent: Agent }) {
  const rows = agent.history.slice().reverse();
  return (
    <Disclosure title="History" meta={`${agent.history.length} events`}>
      {rows.length === 0 ? (
        <p className="text-muted">No lapses or policy switches on record.</p>
      ) : (
        <ol className="flex flex-col">
          {rows.map((e) => (
            <li key={e.id} className="grid grid-cols-[5.5rem_1fr_auto] items-start gap-x-3 gap-y-1 border-t border-line py-2 text-[13px] first:border-t-0 first:pt-0">
              <span className="text-xs text-muted">{e.date}</span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{e.policy}</span>
                  <CauseTag tag={e.tag} />
                </span>
                <span className="text-xs text-muted">{e.note}</span>
              </span>
              {e.kind === 'lapse' || e.kind === 'switch' ? (
                <span className={`whitespace-nowrap rounded px-1.5 text-[11px] font-semibold ${e.strike ? 'bg-terminated/10 text-terminated' : 'bg-sunken text-muted'}`}>
                  Strike? {e.strike ? 'Yes' : 'No'}
                </span>
              ) : (
                <span />
              )}
            </li>
          ))}
        </ol>
      )}
    </Disclosure>
  );
}

function Money({ agent }: { agent: Agent }) {
  const own = agent.history.filter((e) => e.kind !== 'team-debt');
  const team = agent.history.filter((e) => e.kind === 'team-debt');
  const unearned = own.reduce((s, e) => s + e.recovered, 0);
  const slower = own.filter((e) => e.pace === 'slower').reduce((s, e) => s + e.recovered, 0);
  const current = own.filter((e) => e.pace === 'current').reduce((s, e) => s + e.recovered, 0);
  const absorbed = agent.history.reduce((s, e) => s + e.absorbed, 0);
  const teamShare = team.reduce((s, e) => s + e.recovered, 0);
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-4 border-t border-line py-1.5 first:border-t-0">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
  return (
    <Disclosure title="Repaying the unearned advance" meta={formatINR(unearned + teamShare) + ' owed'}>
      <dl className="text-[13px]">
        {row('Unearned advance owed', <span className="num">{formatINR(unearned)}</span>)}
        {row('Slower pace (20% of each payout)', <span className="num">{formatINR(slower)}</span>)}
        {row(`Current pace (${PROGRAM.currentRecoveryPct * 100}% of each payout)`, <span className="num">{formatINR(current)}</span>)}
        {row('Absorbed by Ethos', <span className="num">{formatINR(absorbed)}</span>)}
        {agent.manager && row('Team debt share (slower pace)', <span className="num">{formatINR(teamShare)}</span>)}
      </dl>
      <p className="mt-2 text-xs text-muted">The stage sets the size of future advances. The cause sets how fast the agent repays.</p>
      {agent.manager && (
        <p className="mt-2 text-xs text-muted">
          Managers carry {PROGRAM.managerTeamDebtShare * 100}% of the team’s new agent-caused debt, earn a share of the team’s bonus for policies customers keep paying, and repay at the slower pace.
        </p>
      )}
    </Disclosure>
  );
}

function TryIt({
  agent,
  onAdd,
}: {
  agent: Agent;
  onAdd: (kind: TryKind, opts?: { cause?: LapseCause; requestedTraining?: boolean; switchType?: SwitchType }) => void;
}) {
  const [cause, setCauseSel] = useState<LapseCause>('skill');
  const [asked, setAsked] = useState(false);
  const [switchType, setSwitchType] = useState<SwitchType>('downgrade');
  const off = agent.standing === 'terminated';
  return (
    <Disclosure title="Try it" meta="test the rules">
      {off ? (
        <p className="text-muted">{agent.firstName} has been terminated, so no new policies can be added.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted">Each action creates a case that goes through the same review, apply and notify flow.</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Cause
              <select id="try-cause" className="field" value={cause} onChange={(e) => setCauseSel(e.target.value as LapseCause)}>
                {LAPSE_CAUSES.map((k) => (
                  <option key={k} value={k}>{CAUSE_INFO[k].long}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 pb-2 text-[13px]">
              <input id="try-asked" type="checkbox" checked={asked} onChange={(e) => setAsked(e.target.checked)} />
              Agent asked for training
            </label>
            <button type="button" className="btn" onClick={() => onAdd('lapse', { cause, requestedTraining: asked })}>Add lapse</button>
          </div>
          <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Switch type
              <select id="try-switch" className="field" value={switchType} onChange={(e) => setSwitchType(e.target.value as SwitchType)}>
                {(['downgrade', 'replacement'] as const).map((k) => (
                  <option key={k} value={k}>{SWITCH_LABEL[k]}</option>
                ))}
              </select>
            </label>
            <button type="button" className="btn" onClick={() => onAdd('switch', { switchType })}>Add policy switch</button>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <button type="button" className="btn" onClick={() => onAdd('clean')}>Add clean policy</button>
            {agent.standing !== 'training' && (
              <button type="button" className="btn" onClick={() => onAdd('request')}>Agent asks for training</button>
            )}
          </div>
        </div>
      )}
    </Disclosure>
  );
}

/* ---------------------------------------------------------------- */

function ConfirmModal({ open, onClose, onConfirm, agent, o }: { open: boolean; onClose: () => void; onConfirm: () => void; agent: Agent; o: Outcome }) {
  const f = upfrontPerPolicy(o.from);
  const t = upfrontPerPolicy(o.to);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Apply course correction for ${agent.firstName}?`}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onConfirm} data-autofocus>Confirm</button>
        </>
      }
    >
      <p className="mb-1">
        <strong>{standingLabel(o.from)} → {standingLabel(o.to)}</strong>, upfront per new policy {formatINR(f.amount)} → {formatINR(t.amount)}.
      </p>
      <p className="text-muted">
        {moneyLine(o)}
        {o.money.teamShare ? ` Team debt share ${formatINR(o.money.teamShare)} at the slower pace.` : ''}
      </p>
    </Modal>
  );
}

function NotifyModal({ open, onClose, result, onSend }: { open: boolean; onClose: () => void; result: Result; onSend: (edited: boolean) => void }) {
  const original = useMemo(() => notifyMessage(result.agentAfter, result.c, result.outcome), [result]);
  const [text, setText] = useState(original);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (open) {
      setText(original);
      setEditing(false);
    }
  }, [open, original]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Notify ${result.agentAfter.firstName}`}
      footer={
        <>
          <button type="button" className="btn" onClick={() => setEditing(true)} disabled={editing}>Edit</button>
          <button type="button" className="btn btn-primary" onClick={() => onSend(text !== original)} data-autofocus>Send</button>
        </>
      }
    >
      <p className="mb-2 text-xs text-muted">To {result.agentAfter.name} · agent portal and SMS · preview</p>
      {editing ? (
        <textarea
          aria-label="Message to agent"
          className="field min-h-[320px] w-full resize-y leading-relaxed"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
      ) : (
        <div className="whitespace-pre-wrap rounded-xl border border-line bg-sunken px-4 py-3 text-[13px] leading-relaxed">{text}</div>
      )}
    </Modal>
  );
}

function AppealModal({ open, onClose, name, onLog }: { open: boolean; onClose: () => void; name: string; onLog: () => void }) {
  const steps = [
    ['Extra evidence', `${name} submits new evidence within 14 days: call recordings, customer messages, payment proof.`],
    ['Auto-reverse if clear', 'If the new evidence clearly shows Ethos fault or a no-fault cause, the decision reverses automatically and recovery stops.'],
    ['Human review', 'Otherwise a reviewer applies the standard guidelines and explains the decision in writing within 10 working days.'],
  ];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Appeal path"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary" onClick={onLog}>Note in activity log</button>
        </>
      }
    >
      <ol className="flex flex-col gap-3 pb-1">
        {steps.map(([t, d], i) => (
          <li key={t} className="grid grid-cols-[1.75rem_1fr] gap-3">
            <span className="num flex h-6 w-6 items-center justify-center rounded-full border border-line bg-sunken text-xs">{i + 1}</span>
            <div>
              <p className="font-semibold">{t}</p>
              <p className="text-muted">{d}</p>
            </div>
          </li>
        ))}
      </ol>
    </Modal>
  );
}
