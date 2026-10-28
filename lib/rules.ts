/**
 * Agent Quality Program rules.
 *
 * Pure functions only: no React, no storage, no randomness. The UI asks this
 * module what happens and never decides an outcome itself.
 */

/* ------------------------------------------------------------------ */
/* Tunable numbers                                                     */
/* ------------------------------------------------------------------ */

export const PROGRAM = {
  /** ₹ per policy, full-year advance. */
  fullAdvance: 10_000,
  /** Reduced advance covers this many months, then quarterly. */
  reducedAdvanceMonths: 3,
  /** Fee added to unearned advance for oversold / ignored warnings. */
  penaltyFeePct: 0.1,
  /** Share of each payout kept to repay debt. */
  normalRecoveryPct: 0.5,
  /** For skill gaps, voluntary training and managers carrying team debt. */
  slowerRecoveryPct: 0.2,
  /** Policies in the rolling window. */
  rollingWindow: 5,
  /** Agent-caused lapses in the window that trigger Training (or Termination after training). */
  trainingTrigger: 3,
  /** Clean policies needed to earn back Good standing. */
  earnBackCleanPolicies: 3,
  /** Share of the team's new agent-caused debt a manager carries. */
  managerTeamDebtShare: 0.5,
} as const;

/** ₹2,500: the 3-month advance. */
export const REDUCED_ADVANCE = (PROGRAM.fullAdvance * PROGRAM.reducedAdvanceMonths) / 12;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type Standing = 'good' | 'watch' | 'training' | 'terminated';
export type LapseCause = 'ethos' | 'nofault' | 'skill' | 'oversold' | 'ignored' | 'inconclusive';
export type EventTag = LapseCause | 'replacement' | 'clean' | 'team';
export type Pace = 'normal' | 'slower';
export type AdvanceBasis = 'full' | 'reduced';

export interface WindowEntry {
  policy: string;
  agentCaused: boolean;
  cause?: LapseCause;
}

export interface HistoryEvent {
  id: string;
  date: string;
  kind: 'lapse' | 'replacement' | 'clean' | 'team-debt';
  policy: string;
  tag: EventTag;
  counts: boolean;
  /** ₹ Ethos absorbed. */
  absorbed: number;
  /** ₹ being recovered from the agent, fee included. */
  recovered: number;
  /** ₹ of `recovered` that is the 10% fee. */
  fee: number;
  pace?: Pace;
  note: string;
}

export interface Agent {
  id: string;
  name: string;
  firstName: string;
  roleTag: string;
  profile: string;
  policies: number;
  standing: Standing;
  /** True while in Training because the agent asked for it. */
  voluntary: boolean;
  /** Training resets the lapse count once only. */
  resetUsed: boolean;
  /** Set when Training was reached with an oversold lapse in the window. */
  finalWarning: boolean;
  /** Clean policies since the last agent-caused lapse (earn-back progress). */
  cleanStreak: number;
  /** Policies counted toward the rolling window, oldest first. */
  window: WindowEntry[];
  history: HistoryEvent[];
  manager?: { team: string; teamSize: number };
  policyPrefix: string;
  nextPolicyNo: number;
}

export interface Evidence {
  transcript: string;
  firstPayment: string;
  /** Check-in confidence score, 0-100. */
  confidence: number;
  confidenceNote?: string;
}

export interface LapseItem {
  policy: string;
  monthsInForce: number;
  basis: AdvanceBasis;
}

export interface ReplacementItem {
  oldPolicy: string;
  newPolicy: string;
  monthsInForce: number;
  basis: AdvanceBasis;
}

interface CaseBase {
  id: string;
  agentId: string;
  date: string;
  title: string;
  summary: string;
  evidence: Evidence;
  simulated?: boolean;
}

export interface LapseCase extends CaseBase {
  kind: 'lapse';
  cause: LapseCause;
  lapses: LapseItem[];
  requestedTraining?: boolean;
  /** Manager cases: the team's new agent-caused debt. */
  teamDebt?: number;
  /** Text of the billing check when Ethos found a bug. */
  billingFinding?: string;
}

export interface ReplacementCase extends CaseBase {
  kind: 'replacement';
  items: ReplacementItem[];
}

export interface CleanCase extends CaseBase {
  kind: 'clean';
  policy: string;
}

export type Case = LapseCase | ReplacementCase | CleanCase;

export interface StandingState {
  standing: Standing;
  voluntary: boolean;
}

export interface Outcome {
  caseId: string;
  agentId: string;
  tag: EventTag;
  from: StandingState;
  to: StandingState;
  billingCheck: { bugFound: boolean; label: string; text: string };
  /** The rule applied, in one plain sentence. */
  rule: string;
  /** Short extra facts shown under the effect. */
  notes: string[];
  counts: boolean;
  /** Agent-caused lapses in the rolling window after this case. */
  windowCountAfter: number;
  resetApplied: boolean;
  money: {
    unearned: number;
    fee: number;
    /** Recovered from the agent's own sales, fee included. */
    ownRecovered: number;
    absorbed: number;
    teamShare: number;
    pace: Pace | null;
  };
  /** Fields of the agent after applying. */
  next: Pick<Agent, 'standing' | 'voluntary' | 'resetUsed' | 'finalWarning' | 'cleanStreak' | 'window' | 'policies'>;
  events: HistoryEvent[];
}

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

export const STANDING_INFO: Record<Standing, { label: string; terms: string; tip: string }> = {
  good: {
    label: 'Good standing',
    terms: '₹10,000 full year + clean-policy bonus',
    tip: 'Clean record: the full-year advance on every new policy, plus the clean-policy bonus.',
  },
  watch: {
    label: 'Watch',
    terms: '₹2,500 (3 months), then quarterly',
    tip: 'Any agent-caused lapse lands here; 3 clean policies earn back Good standing.',
  },
  training: {
    label: 'Training',
    terms: '₹2,500, then quarterly (voluntary: ₹10,000)',
    tip: '3 agent-caused lapses in a rolling 5 policies, or the agent asks; the lapse count resets once.',
  },
  terminated: {
    label: 'Termination',
    terms: 'No advance',
    tip: 'Repeat lapses after training: 3 more agent-caused lapses, or one more oversold lapse.',
  },
};

export const CAUSE_INFO: Record<EventTag, { label: string; long: string }> = {
  ethos: { label: 'Ethos fault', long: 'Ethos fault (billing bug, wrong charge date)' },
  nofault: { label: 'No fault', long: 'Customer ran out of money, agent acted on warnings' },
  skill: { label: 'Skill gap', long: 'Needs not assessed (skill gap)' },
  oversold: { label: 'Oversold', long: 'Oversold coverage' },
  ignored: { label: 'Warnings ignored', long: 'Customer ran out of money, agent ignored warnings' },
  inconclusive: { label: 'Inconclusive', long: 'Inconclusive evidence' },
  replacement: { label: 'Replacement', long: 'Customer cancelled and rebought from the same agent' },
  clean: { label: 'Clean policy', long: 'Policy in force, no lapse' },
  team: { label: 'Team debt', long: 'Share of the team’s new agent-caused debt' },
};

export const LAPSE_CAUSES: LapseCause[] = ['ethos', 'nofault', 'skill', 'oversold', 'ignored', 'inconclusive'];

export function standingLabel(s: StandingState): string {
  return STANDING_INFO[s.standing].label + (s.standing === 'training' && s.voluntary ? ' (voluntary)' : '');
}

export function paceLabel(p: Pace): string {
  return p === 'slower'
    ? `${PROGRAM.slowerRecoveryPct * 100}% of each payout (slower pace)`
    : `${PROGRAM.normalRecoveryPct * 100}% of each payout (normal pace)`;
}

export function formatINR(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

/* ------------------------------------------------------------------ */
/* Cause table                                                         */
/* ------------------------------------------------------------------ */

interface CauseRule {
  agentCaused: boolean;
  /** Ethos pays: nothing recovered from the agent. */
  ethosAbsorbs: boolean;
  fee: boolean;
  pace: Pace;
}

export const CAUSE_RULES: Record<LapseCause, CauseRule> = {
  ethos: { agentCaused: false, ethosAbsorbs: true, fee: false, pace: 'normal' },
  nofault: { agentCaused: false, ethosAbsorbs: true, fee: false, pace: 'normal' },
  inconclusive: { agentCaused: false, ethosAbsorbs: false, fee: false, pace: 'normal' },
  skill: { agentCaused: true, ethosAbsorbs: false, fee: false, pace: 'slower' },
  oversold: { agentCaused: true, ethosAbsorbs: false, fee: true, pace: 'normal' },
  ignored: { agentCaused: true, ethosAbsorbs: false, fee: true, pace: 'normal' },
};

/* ------------------------------------------------------------------ */
/* Money and standing helpers                                          */
/* ------------------------------------------------------------------ */

/** Advance basis a new policy gets at this standing. */
export function advanceBasis(s: StandingState): AdvanceBasis | 'none' {
  if (s.standing === 'terminated') return 'none';
  if (s.standing === 'good') return 'full';
  if (s.standing === 'training' && s.voluntary) return 'full';
  return 'reduced';
}

/** Upfront cash per new policy at this standing. */
export function upfrontPerPolicy(s: StandingState): { amount: number; detail: string } {
  const basis = advanceBasis(s);
  if (basis === 'none') return { amount: 0, detail: 'No advance' };
  if (basis === 'full') {
    return {
      amount: PROGRAM.fullAdvance,
      detail: s.standing === 'training' ? 'Full year (voluntary training)' : 'Full year + clean-policy bonus',
    };
  }
  return { amount: REDUCED_ADVANCE, detail: '3 months, then quarterly' };
}

/**
 * The part of an advance not yet earned when a policy stops paying.
 * Full advance: earned month by month over 12 months.
 * Reduced advance: each quarterly advance is earned over its 3 months.
 */
export function unearnedAdvance(item: { monthsInForce: number; basis: AdvanceBasis }): number {
  const m = Math.max(0, Math.min(12, Math.floor(item.monthsInForce)));
  if (item.basis === 'full') return Math.round((PROGRAM.fullAdvance * (12 - m)) / 12);
  const q = PROGRAM.reducedAdvanceMonths;
  const earnedInQuarter = m % q;
  return Math.round((REDUCED_ADVANCE * (q - earnedInQuarter)) / q);
}

/** Agent-caused lapses among the last `rollingWindow` policies. */
export function windowCount(window: WindowEntry[]): number {
  return window.slice(-PROGRAM.rollingWindow).filter((e) => e.agentCaused).length;
}

/** The one-line status shown on an agent card. */
export function cardStatus(a: Pick<Agent, 'standing' | 'voluntary' | 'cleanStreak'>): string {
  switch (a.standing) {
    case 'good':
      return 'Full advance';
    case 'watch':
      return `Earn-back ${Math.min(a.cleanStreak, PROGRAM.earnBackCleanPolicies)} of ${PROGRAM.earnBackCleanPolicies}`;
    case 'training':
      return a.voluntary ? 'In training · voluntary' : 'In training';
    case 'terminated':
      return 'Terminated';
  }
}

/** Program-wide money totals across all agents. */
export function totals(agents: Agent[]): { absorbed: number; recovering: number } {
  let absorbed = 0;
  let recovering = 0;
  for (const a of agents) {
    for (const e of a.history) {
      absorbed += e.absorbed;
      recovering += e.recovered;
    }
  }
  return { absorbed, recovering };
}

/* ------------------------------------------------------------------ */
/* The engine                                                          */
/* ------------------------------------------------------------------ */

export function evaluateCase(agent: Agent, c: Case): Outcome {
  if (agent.standing === 'terminated') {
    throw new Error(`${agent.name} is terminated; no new cases can be reviewed.`);
  }
  if (c.kind === 'replacement') return evaluateReplacement(agent, c);
  if (c.kind === 'clean') return evaluateClean(agent, c);
  return evaluateLapse(agent, c);
}

function baseOutcome(agent: Agent, c: Case, tag: EventTag): Outcome {
  const from = { standing: agent.standing, voluntary: agent.voluntary };
  return {
    caseId: c.id,
    agentId: agent.id,
    tag,
    from,
    to: { ...from },
    billingCheck: { bugFound: false, label: 'No bug', text: '' },
    rule: '',
    notes: [],
    counts: false,
    windowCountAfter: windowCount(agent.window),
    resetApplied: false,
    money: { unearned: 0, fee: 0, ownRecovered: 0, absorbed: 0, teamShare: 0, pace: null },
    next: {
      standing: agent.standing,
      voluntary: agent.voluntary,
      resetUsed: agent.resetUsed,
      finalWarning: agent.finalWarning,
      cleanStreak: agent.cleanStreak,
      window: agent.window.slice(),
      policies: agent.policies,
    },
    events: [],
  };
}

function evaluateLapse(agent: Agent, c: LapseCase): Outcome {
  const o = baseOutcome(agent, c, c.cause);
  const rule = CAUSE_RULES[c.cause];
  const first = agent.firstName;

  // Step 1: Ethos checks its own systems first.
  o.billingCheck =
    c.cause === 'ethos'
      ? {
          bugFound: true,
          label: 'Bug found',
          text: c.billingFinding ?? 'A charge-date error affected this policy during the lapse window.',
        }
      : {
          bugFound: false,
          label: 'No bug',
          text: 'Charge dates, billing and payment processing were normal for this policy.',
        };

  const unearned = c.lapses.reduce((s, l) => s + unearnedAdvance(l), 0);
  o.money.unearned = unearned;
  o.counts = rule.agentCaused;

  // Movement (only agent-caused lapses move the ladder).
  const windowAfterLapse = o.next.window.concat(
    c.lapses.map((l) => ({ policy: l.policy, agentCaused: rule.agentCaused, cause: c.cause })),
  );
  o.next.window = windowAfterLapse;
  let voluntaryGranted = false;

  if (!rule.agentCaused) {
    o.windowCountAfter = windowCount(windowAfterLapse);
    if (c.cause === 'inconclusive') {
      o.rule = `The evidence is inconclusive, so nothing counts on ${first}’s record and the unearned advance is recovered as usual, with no fee.`;
    } else if (c.cause === 'ethos') {
      o.rule = `The lapse was caused by an Ethos billing error, so ${first} faces no consequence, nothing counts on the record and Ethos absorbs the cost.`;
    } else {
      o.rule = `The customer ran out of money and ${first} acted on the warnings, so there is no consequence, nothing counts and Ethos absorbs the cost.`;
    }
  } else {
    const n = windowCount(windowAfterLapse);
    o.windowCountAfter = n;
    o.next.cleanStreak = 0;
    const causeText = CAUSE_INFO[c.cause].long.toLowerCase();

    if (c.cause === 'oversold' && agent.finalWarning) {
      setTo(o, 'terminated', false);
      o.rule = `${first} already went through training for overselling, which was the final warning, so one more oversold lapse means Termination.`;
    } else if (n >= PROGRAM.trainingTrigger && agent.resetUsed) {
      setTo(o, 'terminated', false);
      o.rule = `After training, ${first} has ${n} agent-caused lapses in the last ${PROGRAM.rollingWindow} policies, which means Termination.`;
    } else if (n >= PROGRAM.trainingTrigger) {
      setTo(o, 'training', false);
      o.next.finalWarning = windowAfterLapse
        .slice(-PROGRAM.rollingWindow)
        .some((e) => e.agentCaused && e.cause === 'oversold');
      o.resetApplied = true;
      o.rule = `${first} has ${n} agent-caused lapses in the last ${PROGRAM.rollingWindow} policies, which moves them to Training and resets the lapse count once.`;
      if (o.next.finalWarning) o.notes.push('Final warning: one more oversold lapse after training means Termination.');
    } else if (c.requestedTraining && agent.standing !== 'training') {
      setTo(o, 'training', true);
      voluntaryGranted = true;
      o.resetApplied = !agent.resetUsed;
      o.rule = `This lapse (${causeText}) counts on the record, and because ${first} asked for training they move to voluntary training: no money penalty, full advance kept, slower recovery.`;
    } else if (agent.standing === 'training') {
      o.rule = `This lapse (${causeText}) counts on the record; ${first} stays in Training and the earn-back count restarts.`;
    } else {
      setTo(o, 'watch', false);
      o.rule =
        c.cause === 'skill'
          ? `Needs not assessed is a skill gap: it counts on the record, so ${first} moves to Watch with training and repays the unearned advance at the slower pace.`
          : `${CAUSE_INFO[c.cause].long} counts on the record, so ${first} moves to Watch and repays the unearned advance plus ${PROGRAM.penaltyFeePct * 100}% at the normal pace.`;
      if (c.cause === 'skill') o.notes.push('Skills coaching assigned alongside Watch.');
    }

    if (o.resetApplied) {
      o.next.resetUsed = true;
      o.next.window = [];
      o.notes.push('Lapse count resets after training (once).');
    } else if (voluntaryGranted && agent.resetUsed) {
      o.notes.push('The lapse count was already reset once, so it does not reset again.');
    }
  }

  // Money.
  if (rule.ethosAbsorbs) {
    o.money.absorbed = unearned;
  } else {
    const feeApplies = rule.fee && !voluntaryGranted;
    const pace: Pace = voluntaryGranted ? 'slower' : rule.pace;
    o.money.pace = pace;
    o.money.fee = feeApplies ? Math.round(unearned * PROGRAM.penaltyFeePct) : 0;
    o.money.ownRecovered = unearned + o.money.fee;
  }

  for (const l of c.lapses) {
    const u = unearnedAdvance(l);
    const fee = o.money.fee ? Math.round(u * PROGRAM.penaltyFeePct) : 0;
    o.events.push({
      id: `${c.id}:${l.policy}`,
      date: c.date,
      kind: 'lapse',
      policy: l.policy,
      tag: c.cause,
      counts: rule.agentCaused,
      absorbed: rule.ethosAbsorbs ? u : 0,
      recovered: rule.ethosAbsorbs ? 0 : u + fee,
      fee,
      pace: rule.ethosAbsorbs ? undefined : o.money.pace ?? undefined,
      note: `Lapsed in month ${l.monthsInForce}.`,
    });
  }
  // Keep the fee total equal to the sum of per-policy fees.
  o.money.fee = o.events.reduce((s, e) => s + e.fee, 0);
  if (!rule.ethosAbsorbs) o.money.ownRecovered = unearned + o.money.fee;

  // Managers carry half the team's new agent-caused debt, at the slower pace.
  if (agent.manager && c.teamDebt) {
    const share = Math.round(c.teamDebt * PROGRAM.managerTeamDebtShare);
    o.money.teamShare = share;
    o.events.push({
      id: `${c.id}:team`,
      date: c.date,
      kind: 'team-debt',
      policy: agent.manager.team,
      tag: 'team',
      counts: false,
      absorbed: 0,
      recovered: share,
      fee: 0,
      pace: 'slower',
      note: `${PROGRAM.managerTeamDebtShare * 100}% of ${formatINR(c.teamDebt)} new agent-caused team debt.`,
    });
    o.notes.push(`Team debt share: ${PROGRAM.managerTeamDebtShare * 100}% = ${formatINR(share)}, slower pace.`);
    if (o.to.standing !== 'terminated') o.notes.push('Keeps manager role.');
  }

  return o;
}

function evaluateReplacement(agent: Agent, c: ReplacementCase): Outcome {
  const o = baseOutcome(agent, c, 'replacement');
  const n = c.items.length;
  o.billingCheck = {
    bugFound: false,
    label: 'Not a lapse',
    text: `Billing and payments were normal. ${n === 1 ? 'The customer' : `${n} customers`} cancelled and bought a new policy from ${agent.firstName}.`,
  };
  o.rule = `A cancel-and-rebuy from the same agent is not a lapse, so ${agent.firstName}’s standing does not change; the old policy’s unearned advance is recovered and the new policy pays ${formatINR(REDUCED_ADVANCE)}, then quarterly.`;
  for (const it of c.items) {
    const u = unearnedAdvance(it);
    o.money.unearned += u;
    o.events.push({
      id: `${c.id}:${it.oldPolicy}`,
      date: c.date,
      kind: 'replacement',
      policy: `${it.oldPolicy} → ${it.newPolicy}`,
      tag: 'replacement',
      counts: false,
      absorbed: 0,
      recovered: u,
      fee: 0,
      pace: 'normal',
      note: `Replacement rule applied: ${formatINR(u)} unearned on ${it.oldPolicy} recovered; ${it.newPolicy} on ${formatINR(REDUCED_ADVANCE)}, then quarterly.`,
    });
  }
  o.money.ownRecovered = o.money.unearned;
  o.money.pace = 'normal';
  o.next.policies = agent.policies + n;
  o.notes.push('Lapse record unchanged.');
  o.notes.push(`New ${n === 1 ? 'policy pays' : 'policies pay'} ${formatINR(REDUCED_ADVANCE)}, then quarterly.`);
  return o;
}

function evaluateClean(agent: Agent, c: CleanCase): Outcome {
  const o = baseOutcome(agent, c, 'clean');
  const first = agent.firstName;
  o.billingCheck = { bugFound: false, label: 'No lapse', text: 'Premiums are paid and the policy is in force.' };
  o.next.window = agent.window.concat({ policy: c.policy, agentCaused: false });
  o.next.policies = agent.policies + 1;
  o.windowCountAfter = windowCount(o.next.window);

  const target = PROGRAM.earnBackCleanPolicies;
  if (agent.standing === 'watch' || agent.standing === 'training') {
    const streak = agent.cleanStreak + 1;
    if (streak >= target) {
      setTo(o, 'good', false);
      o.next.cleanStreak = 0;
      o.rule = `${first} now has ${target} clean policies in a row, which earns back Good standing and the full advance.`;
      if (agent.resetUsed) o.notes.push('The lapse-count reset stays used; post-training rules still apply.');
    } else {
      o.next.cleanStreak = streak;
      o.rule = `A clean policy moves ${first} one step closer to Good standing: ${streak} of ${target} clean policies.`;
    }
  } else {
    o.rule = `A clean policy in Good standing earns the clean-policy bonus${agent.manager ? ' and adds to the team bonus share' : ''}.`;
  }

  o.events.push({
    id: `${c.id}:${c.policy}`,
    date: c.date,
    kind: 'clean',
    policy: c.policy,
    tag: 'clean',
    counts: false,
    absorbed: 0,
    recovered: 0,
    fee: 0,
    note:
      agent.standing === 'good'
        ? 'Clean-policy bonus earned.'
        : `Earn-back ${Math.min(agent.cleanStreak + 1, target)} of ${target}.`,
  });
  return o;
}

function setTo(o: Outcome, standing: Standing, voluntary: boolean) {
  o.to = { standing, voluntary };
  o.next.standing = standing;
  o.next.voluntary = voluntary;
}

/** Returns the agent with the outcome applied. Does not mutate. */
export function applyOutcome(agent: Agent, o: Outcome): Agent {
  return {
    ...agent,
    ...o.next,
    window: o.next.window.slice(),
    history: agent.history.concat(o.events),
  };
}
