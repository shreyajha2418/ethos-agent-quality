/**
 * Agent Quality Program rules.
 *
 * Pure functions only: no React, no storage, no randomness. The UI asks this
 * module what happens and never decides an outcome itself.
 *
 * Key rule: the stage sets the size of future advances; the cause sets how
 * fast the agent repays.
 */

/* ------------------------------------------------------------------ */
/* Tunable numbers                                                     */
/* ------------------------------------------------------------------ */

export const PROGRAM = {
  /** ₹ per policy, full-year advance (Good standing, or Training by request). */
  fullAdvance: 10_000,
  /** Watch and Training advance covers this many months. */
  stageAdvanceMonths: 6,
  /** A policy switch pays this many months, then quarterly. */
  switchAdvanceMonths: 3,
  /** Share of each payout kept to repay debt at the current pace. */
  currentRecoveryPct: 0.5,
  /** Slower pace: skill gaps, training by request, managers carrying team debt. */
  slowerRecoveryPct: 0.2,
  /** Policies in the rolling window. */
  rollingWindow: 5,
  /** Strikes in the window that trigger Training (or Termination after training). */
  trainingTrigger: 3,
  /** Consecutive clean policies needed to earn back Good standing. */
  earnBackCleanPolicies: 3,
  /** Share of the team's new agent-caused debt a manager carries. */
  managerTeamDebtShare: 0.5,
} as const;

/** ₹5,000: the 6-month advance on Watch and Training. */
export const STAGE_ADVANCE = (PROGRAM.fullAdvance * PROGRAM.stageAdvanceMonths) / 12;
/** ₹2,500: the 3-month advance on a switched policy. */
export const SWITCH_ADVANCE = (PROGRAM.fullAdvance * PROGRAM.switchAdvanceMonths) / 12;

export const KEY_RULE = 'The stage sets the size of future advances. The cause sets how fast the agent repays.';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type Standing = 'good' | 'watch' | 'training' | 'terminated';
export type LapseCause = 'ethos' | 'nofault' | 'skill' | 'oversold' | 'ignored' | 'inconclusive';
export type EventTag = LapseCause | 'switch' | 'clean' | 'team' | 'request';
export type Pace = 'current' | 'slower';
/** Which advance a policy was paid: full year, the 6-month stage advance, or the 3-month switch advance. */
export type AdvanceBasis = 'full' | 'stage' | 'switch';
export type SwitchType = 'downgrade' | 'replacement';

export interface WindowEntry {
  policy: string;
  strike: boolean;
  cause?: LapseCause;
}

export interface HistoryEvent {
  id: string;
  date: string;
  kind: 'lapse' | 'switch' | 'clean' | 'team-debt' | 'request';
  policy: string;
  tag: EventTag;
  strike: boolean;
  /** ₹ Ethos absorbed. */
  absorbed: number;
  /** ₹ of unearned advance being recovered from the agent. */
  recovered: number;
  pace?: Pace;
  note: string;
}

export interface Agent {
  id: string;
  name: string;
  firstName: string;
  roleTag: string;
  profile: string;
  /** Possessive pronoun for review text ("her one reset"); defaults to "their". */
  possessive?: string;
  policies: number;
  standing: Standing;
  /** True while in Training because the agent asked for it. */
  voluntary: boolean;
  /** Training resets the strike count once only. */
  resetUsed: boolean;
  /** Set when Training was reached with an oversold lapse in the window. */
  finalWarning: boolean;
  /** Clean policies in a row since the last strike (earn-back progress). */
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

export interface SwitchItem {
  type: SwitchType;
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

export interface SwitchCase extends CaseBase {
  kind: 'switch';
  items: SwitchItem[];
}

export interface CleanCase extends CaseBase {
  kind: 'clean';
  policy: string;
}

/** The agent asks for training without a new lapse. */
export interface TrainingRequestCase extends CaseBase {
  kind: 'request';
}

export type Case = LapseCase | SwitchCase | CleanCase | TrainingRequestCase;

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
  strike: boolean;
  /** Skill gap: training is offered alongside Watch. */
  trainingOffered: boolean;
  /** Strikes in the rolling window after this case. */
  strikesAfter: number;
  resetApplied: boolean;
  money: {
    unearned: number;
    /** Recovered from the agent's own sales. */
    ownRecovered: number;
    absorbed: number;
    teamShare: number;
    pace: Pace | null;
    /** Existing debt moved to the slower pace (training by request). */
    movedToSlower: number;
  };
  /** Fields of the agent after applying. */
  next: Pick<Agent, 'standing' | 'voluntary' | 'resetUsed' | 'finalWarning' | 'cleanStreak' | 'window' | 'policies'>;
  events: HistoryEvent[];
}

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

export const STANDING_INFO: Record<
  Standing,
  { label: string; stage: string; who: string; terms: string; advance: string; wayUp: string; tip: string }
> = {
  good: {
    label: 'Good standing',
    stage: '',
    who: 'Clean record',
    terms: 'Full advance + bonus on policies customers keep paying',
    advance: 'Full year: ₹10,000, plus a bonus for policies customers keep paying',
    wayUp: 'Stay clean',
    tip: 'Clean record: the full ₹10,000 advance, plus a bonus for policies customers keep paying.',
  },
  watch: {
    label: 'Watch',
    stage: 'First warning',
    who: 'First warning: one oversold, skill-gap or ignored-warning lapse',
    terms: 'First warning · 6-month advance until the next 3 policies stay clean',
    advance: '6 months: ₹5,000, until the next 3 policies stay clean',
    wayUp: 'Next 3 policies stay clean',
    tip: 'First warning: one strike lands here. ₹5,000 advances until the next 3 policies in a row stay clean.',
  },
  training: {
    label: 'Training',
    stage: 'Last chance',
    who: 'Last chance: 3 strikes in any 5 policies, or by request',
    terms: 'Last chance · 6-month advance (full if requested)',
    advance: '6 months: ₹5,000 (full ₹10,000 if the agent asked for training)',
    wayUp: 'Complete training, then next 3 policies stay clean',
    tip: 'Last chance: 3 strikes in any 5 policies, or by request. The strike count resets once. Requested training keeps the full advance.',
  },
  terminated: {
    label: 'Termination',
    stage: '',
    who: 'Repeat lapses after training',
    terms: 'No advances',
    advance: 'None',
    wayUp: 'None',
    tip: 'Repeat strikes after training: 3 more, or one more oversold lapse.',
  },
};

export const CAUSE_INFO: Record<EventTag, { label: string; long: string }> = {
  ethos: { label: 'Ethos fault', long: 'Ethos fault (wrong charge date, bug)' },
  nofault: { label: 'No fault', long: 'Customer couldn’t pay; agent acted on warning signs' },
  skill: { label: 'Skill gap', long: 'Customer needs not assessed (skill gap)' },
  oversold: { label: 'Oversold', long: 'Oversold coverage' },
  ignored: { label: 'Warnings ignored', long: 'Customer couldn’t pay; agent ignored warning signs' },
  inconclusive: { label: 'Inconclusive', long: 'Inconclusive evidence' },
  switch: { label: 'Policy switch', long: 'Customer moved to a cheaper or replacement policy with the same agent' },
  clean: { label: 'Clean policy', long: 'Policy in force, customer keeps paying' },
  team: { label: 'Team debt', long: 'Share of the team’s new agent-caused debt' },
  request: { label: 'Training request', long: 'Agent asked for training' },
};

export const SWITCH_LABEL: Record<SwitchType, string> = {
  downgrade: 'Cheaper policy',
  replacement: 'Replacement',
};

export const LAPSE_CAUSES: LapseCause[] = ['ethos', 'nofault', 'inconclusive', 'skill', 'oversold', 'ignored'];

export function standingLabel(s: StandingState): string {
  return STANDING_INFO[s.standing].label + (s.standing === 'training' && s.voluntary ? ' (requested)' : '');
}

export function paceLabel(p: Pace): string {
  return p === 'slower'
    ? `${PROGRAM.slowerRecoveryPct * 100}% of each payout (slower pace)`
    : `${PROGRAM.currentRecoveryPct * 100}% of each payout (current pace)`;
}

export function formatINR(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

/* ------------------------------------------------------------------ */
/* Cause table                                                         */
/* ------------------------------------------------------------------ */

interface CauseRule {
  strike: boolean;
  /** Ethos pays: nothing recovered from the agent. */
  ethosAbsorbs: boolean;
  pace: Pace;
}

export const CAUSE_RULES: Record<LapseCause, CauseRule> = {
  ethos: { strike: false, ethosAbsorbs: true, pace: 'current' },
  nofault: { strike: false, ethosAbsorbs: true, pace: 'current' },
  inconclusive: { strike: false, ethosAbsorbs: false, pace: 'current' },
  skill: { strike: true, ethosAbsorbs: false, pace: 'slower' },
  oversold: { strike: true, ethosAbsorbs: false, pace: 'current' },
  ignored: { strike: true, ethosAbsorbs: false, pace: 'current' },
};

/* ------------------------------------------------------------------ */
/* Money and standing helpers                                          */
/* ------------------------------------------------------------------ */

/** Advance a new policy gets at this standing. */
export function advanceBasis(s: StandingState): AdvanceBasis | 'none' {
  if (s.standing === 'terminated') return 'none';
  if (s.standing === 'good') return 'full';
  if (s.standing === 'training' && s.voluntary) return 'full';
  return 'stage';
}

/** Upfront cash per new policy at this standing. */
export function upfrontPerPolicy(s: StandingState): { amount: number; detail: string } {
  const basis = advanceBasis(s);
  if (basis === 'none') return { amount: 0, detail: 'No advances' };
  if (basis === 'full') {
    return {
      amount: PROGRAM.fullAdvance,
      detail: s.standing === 'training' ? 'Full year (training requested)' : 'Full year + bonus on policies kept',
    };
  }
  return { amount: STAGE_ADVANCE, detail: '6 months, until the next 3 policies stay clean' };
}

/**
 * The part of an advance not yet earned when a policy stops paying.
 * Each advance is earned month by month over the months it covers;
 * the switch advance is paid quarterly, so it is earned over each quarter.
 */
export function unearnedAdvance(item: { monthsInForce: number; basis: AdvanceBasis }): number {
  const m = Math.max(0, Math.min(12, Math.floor(item.monthsInForce)));
  if (item.basis === 'full') return Math.round((PROGRAM.fullAdvance * (12 - m)) / 12);
  if (item.basis === 'stage') {
    const months = PROGRAM.stageAdvanceMonths;
    return Math.round((STAGE_ADVANCE * Math.max(0, months - m)) / months);
  }
  const q = PROGRAM.switchAdvanceMonths;
  return Math.round((SWITCH_ADVANCE * (q - (m % q))) / q);
}

/** Strikes among the last `rollingWindow` policies. */
export function strikeCount(window: WindowEntry[]): number {
  return window.slice(-PROGRAM.rollingWindow).filter((e) => e.strike).length;
}

/** The one-line status shown on an agent card. */
export function cardStatus(a: Pick<Agent, 'standing' | 'voluntary' | 'cleanStreak'>): string {
  switch (a.standing) {
    case 'good':
      return 'Full advance';
    case 'watch':
      return `Earn-back ${Math.min(a.cleanStreak, PROGRAM.earnBackCleanPolicies)} of ${PROGRAM.earnBackCleanPolicies}`;
    case 'training':
      return a.voluntary ? 'In training (requested)' : 'In training';
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

/** Debt from the agent's own sales (not team debt) that is still on the current pace. */
function ownDebtAtCurrentPace(agent: Agent): number {
  return agent.history
    .filter((e) => e.kind !== 'team-debt' && e.recovered > 0 && e.pace === 'current')
    .reduce((s, e) => s + e.recovered, 0);
}

/* ------------------------------------------------------------------ */
/* The engine                                                          */
/* ------------------------------------------------------------------ */

export function evaluateCase(agent: Agent, c: Case): Outcome {
  if (agent.standing === 'terminated') {
    throw new Error(`${agent.name} is terminated; no new cases can be reviewed.`);
  }
  switch (c.kind) {
    case 'switch':
      return evaluateSwitch(agent, c);
    case 'clean':
      return evaluateClean(agent, c);
    case 'request':
      return evaluateRequest(agent, c);
    default:
      return evaluateLapse(agent, c);
  }
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
    strike: false,
    trainingOffered: false,
    strikesAfter: strikeCount(agent.window),
    resetApplied: false,
    money: { unearned: 0, ownRecovered: 0, absorbed: 0, teamShare: 0, pace: null, movedToSlower: 0 },
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

/** Training by request: full advance kept, existing debt moves to the slower pace, uses the one reset. */
function grantRequestedTraining(agent: Agent, o: Outcome) {
  setTo(o, 'training', true);
  o.next.cleanStreak = 0;
  o.money.movedToSlower = ownDebtAtCurrentPace(agent);
  if (!agent.resetUsed) {
    o.resetApplied = true;
    o.next.resetUsed = true;
    o.next.window = [];
    o.notes.push('Strike count resets after training (this is the one reset).');
  } else {
    o.notes.push('The strike count was already reset once, so it does not reset again.');
  }
  if (o.money.movedToSlower) o.notes.push(`Existing debt of ${formatINR(o.money.movedToSlower)} moves to the slower pace.`);
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
          text: c.billingFinding ?? 'A charge-date error affected this policy during the lapse window. Ethos fixes the bug.',
        }
      : {
          bugFound: false,
          label: 'No bug',
          text: 'Charge dates, billing and payment processing were normal for this policy.',
        };

  const unearned = c.lapses.reduce((s, l) => s + unearnedAdvance(l), 0);
  o.money.unearned = unearned;
  o.strike = rule.strike;

  const windowAfterLapse = o.next.window.concat(c.lapses.map((l) => ({ policy: l.policy, strike: rule.strike, cause: c.cause })));
  o.next.window = windowAfterLapse;
  let pace: Pace = rule.pace;

  if (!rule.strike) {
    o.strikesAfter = strikeCount(windowAfterLapse);
    if (c.cause === 'inconclusive') {
      o.rule = `The evidence is inconclusive, so there is no strike and no change of stage; ${first} repays the unearned advance at the current pace, as Ethos does today.`;
    } else if (c.cause === 'ethos') {
      o.rule = `An Ethos billing error caused the lapse, so nothing happens to ${first}: no strike, Ethos fixes the bug and absorbs the cost.`;
    } else {
      o.rule = `The customer couldn’t pay and ${first} acted on the warning signs, so nothing happens: no strike, and Ethos absorbs the cost.`;
    }
  } else {
    const n = strikeCount(windowAfterLapse);
    o.strikesAfter = n;
    o.next.cleanStreak = 0;

    if (c.cause === 'oversold' && agent.finalWarning) {
      setTo(o, 'terminated', false);
      o.rule = `${first} was trained after overselling, which was the final warning, so one more oversold lapse means Termination.`;
    } else if (n >= PROGRAM.trainingTrigger && agent.resetUsed) {
      setTo(o, 'terminated', false);
      o.rule = `After training, ${first} has ${n} strikes in the last ${PROGRAM.rollingWindow} policies, which means Termination.`;
    } else if (n >= PROGRAM.trainingTrigger) {
      setTo(o, 'training', false);
      o.next.finalWarning = windowAfterLapse.slice(-PROGRAM.rollingWindow).some((e) => e.strike && e.cause === 'oversold');
      o.resetApplied = true;
      o.next.resetUsed = true;
      o.next.window = [];
      o.rule = `${first} has ${n} strikes in the last ${PROGRAM.rollingWindow} policies: last chance, so they move to Training and the strike count resets once.`;
      o.notes.push('Strike count resets after training (this is the one reset).');
      if (o.next.finalWarning) o.notes.push('Final warning: one more oversold lapse after training means Termination.');
    } else if (c.requestedTraining && agent.standing !== 'training') {
      grantRequestedTraining(agent, o);
      pace = 'slower';
      o.rule = `This lapse is a strike, and because ${first} asked for training they move to Training at their request: no penalty, full advance kept, debt repaid at the slower pace.`;
    } else if (agent.standing === 'training') {
      if (agent.voluntary) pace = 'slower';
      o.rule = `This lapse is a strike; ${first} stays in Training and the earn-back count goes back to 0.`;
    } else {
      setTo(o, 'watch', false);
      o.trainingOffered = c.cause === 'skill';
      o.rule =
        c.cause === 'skill'
          ? `Needs not assessed is a skill gap: a strike, so ${first} moves to Watch, is offered training, and repays at the slower pace.`
          : `${CAUSE_INFO[c.cause].long} is a strike, so ${first} moves to Watch and repays at the current pace.`;
      if (o.trainingOffered) o.notes.push('Training offered.');
    }
  }

  // Money: the cause sets the repayment pace.
  if (rule.ethosAbsorbs) {
    o.money.absorbed = unearned;
  } else {
    o.money.pace = pace;
    o.money.ownRecovered = unearned;
  }

  for (const l of c.lapses) {
    const u = unearnedAdvance(l);
    o.events.push({
      id: `${c.id}:${l.policy}`,
      date: c.date,
      kind: 'lapse',
      policy: l.policy,
      tag: c.cause,
      strike: rule.strike,
      absorbed: rule.ethosAbsorbs ? u : 0,
      recovered: rule.ethosAbsorbs ? 0 : u,
      pace: rule.ethosAbsorbs ? undefined : pace,
      note: `Lapsed in month ${l.monthsInForce}.`,
    });
  }

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
      strike: false,
      absorbed: 0,
      recovered: share,
      pace: 'slower',
      note: `${PROGRAM.managerTeamDebtShare * 100}% of ${formatINR(c.teamDebt)} new agent-caused team debt.`,
    });
    o.notes.push(`Team debt share: ${PROGRAM.managerTeamDebtShare * 100}% = ${formatINR(share)}, repaid at the slower pace.`);
    if (o.to.standing !== 'terminated') o.notes.push('Keeps manager role.');
  }

  return o;
}

function evaluateSwitch(agent: Agent, c: SwitchCase): Outcome {
  const o = baseOutcome(agent, c, 'switch');
  const n = c.items.length;
  const first = agent.firstName;
  const downgrades = c.items.filter((i) => i.type === 'downgrade').length;
  o.billingCheck = {
    bugFound: false,
    label: 'Not a lapse',
    text: downgrades
      ? `Billing and payments were normal. Low check-in confidence triggered a downgrade alert, and ${first} moved the customer to a cheaper policy.`
      : `Billing and payments were normal. ${n === 1 ? 'The customer' : `${n} customers`} cancelled and bought a new policy from ${first}.`,
  };
  o.rule = `A policy switch is not a strike and does not change ${first}’s stage: the old policy’s unearned advance is recovered at the current pace, and the switched policy pays only ${formatINR(SWITCH_ADVANCE)} (3 months), then quarterly.`;
  for (const it of c.items) {
    const u = unearnedAdvance(it);
    o.money.unearned += u;
    o.events.push({
      id: `${c.id}:${it.oldPolicy}`,
      date: c.date,
      kind: 'switch',
      policy: `${it.oldPolicy} → ${it.newPolicy}`,
      tag: 'switch',
      strike: false,
      absorbed: 0,
      recovered: u,
      pace: 'current',
      note: `${SWITCH_LABEL[it.type]}. Policy-switch rule applied: ${formatINR(u)} unearned on ${it.oldPolicy} recovered at the current pace (recovery, not a penalty); switched policy ${it.newPolicy} pays ${formatINR(SWITCH_ADVANCE)} upfront (3 months), rest paid quarterly as the customer keeps paying.`,
    });
  }
  o.money.ownRecovered = o.money.unearned;
  o.money.pace = 'current';
  o.next.policies = agent.policies + n;
  o.notes.push('No strike; stage unchanged.');
  o.notes.push(`Switched ${n === 1 ? 'policy pays' : 'policies pay'} ${formatINR(SWITCH_ADVANCE)} (3 months), then quarterly. A switch never earns a fresh full advance.`);
  return o;
}

function evaluateClean(agent: Agent, c: CleanCase): Outcome {
  const o = baseOutcome(agent, c, 'clean');
  const first = agent.firstName;
  o.billingCheck = { bugFound: false, label: 'No lapse', text: 'Premiums are paid and the policy is in force.' };
  o.next.window = agent.window.concat({ policy: c.policy, strike: false });
  o.next.policies = agent.policies + 1;
  o.strikesAfter = strikeCount(o.next.window);

  const target = PROGRAM.earnBackCleanPolicies;
  if (agent.standing === 'watch' || agent.standing === 'training') {
    const streak = agent.cleanStreak + 1;
    if (streak >= target) {
      setTo(o, 'good', false);
      o.next.cleanStreak = 0;
      o.rule =
        agent.standing === 'training'
          ? `${first} has completed training and the next ${target} policies stayed clean, which earns back Good standing and the full advance.`
          : `${first}’s next ${target} policies stayed clean in a row, which earns back Good standing and the full advance.`;
      if (agent.resetUsed) o.notes.push('The strike-count reset stays used; post-training rules still apply.');
    } else {
      o.next.cleanStreak = streak;
      o.rule = `A clean policy moves ${first} one step closer to the full advance: ${streak} of the next ${target} policies clean.`;
    }
  } else {
    o.rule = `A clean policy in Good standing earns the bonus for policies customers keep paying${agent.manager ? ', and adds to the team bonus share' : ''}.`;
  }

  o.events.push({
    id: `${c.id}:${c.policy}`,
    date: c.date,
    kind: 'clean',
    policy: c.policy,
    tag: 'clean',
    strike: false,
    absorbed: 0,
    recovered: 0,
    note: agent.standing === 'good' ? 'Bonus earned: customer keeps paying.' : `Earn-back ${Math.min(agent.cleanStreak + 1, target)} of ${target}.`,
  });
  return o;
}

function evaluateRequest(agent: Agent, c: TrainingRequestCase): Outcome {
  const o = baseOutcome(agent, c, 'request');
  const first = agent.firstName;
  if (agent.standing === 'training') throw new Error(`${agent.name} is already in Training.`);
  o.billingCheck = { bugFound: false, label: 'No lapse', text: 'No lapse involved; this is a request from the agent.' };
  grantRequestedTraining(agent, o);
  o.money.pace = 'slower';
  o.rule = `Any agent can ask for training; ${first} moves to Training at their request with no penalty, keeps the full advance, and repays any debt at the slower pace.`;
  o.events.push({
    id: `${c.id}:request`,
    date: c.date,
    kind: 'request',
    policy: 'Training',
    tag: 'request',
    strike: false,
    absorbed: 0,
    recovered: 0,
    note: 'Agent asked for training.',
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
  const history = o.money.movedToSlower
    ? agent.history.map((e) => (e.kind !== 'team-debt' && e.recovered > 0 && e.pace === 'current' ? { ...e, pace: 'slower' as const } : e))
    : agent.history;
  return {
    ...agent,
    ...o.next,
    window: o.next.window.slice(),
    history: history.concat(o.events),
  };
}
