/**
 * Review wording shared by the Effect step, the confirm pop-up and the result
 * card, so every place tells the same story. Pure functions only.
 */
import {
  PROGRAM,
  SWITCH_ADVANCE,
  advanceBasis,
  formatINR,
  standingLabel,
  upfrontPerPolicy,
  type Agent,
  type Case,
  type Outcome,
  type Pace,
  type StandingState,
} from './rules';

/** True when the agent's stage changes (including a move into requested training). */
export function stageChanged(o: Outcome): boolean {
  return o.from.standing !== o.to.standing || o.from.voluntary !== o.to.voluntary;
}

/**
 * Title and button for the review pop-up. "Apply course correction" is used
 * only when the stage changes; otherwise it's "Apply rule" with the rule named.
 */
export function reviewAction(agent: Agent, c: Case, o: Outcome): { title: string; button: string; courseCorrection: boolean } {
  const first = agent.firstName;
  if (stageChanged(o)) return { title: `Apply course correction for ${first}?`, button: 'Apply course correction', courseCorrection: true };
  let title: string;
  if (c.kind === 'switch') title = `Apply policy-switch rule for ${first}?`;
  else if (c.kind === 'clean') title = o.from.standing === 'good' ? `Apply clean-policy rule for ${first}?` : `Apply earn-back rule for ${first}?`;
  else if (c.kind === 'request') title = `Apply training-request rule for ${first}?`;
  else if (c.cause === 'ethos') title = `Confirm Ethos-fault ruling for ${first}?`;
  else if (c.cause === 'nofault') title = `Confirm no-fault ruling for ${first}?`;
  else if (c.cause === 'inconclusive') title = `Confirm inconclusive-evidence ruling for ${first}?`;
  else title = `Apply strike rule for ${first}?`;
  return { title, button: 'Apply rule', courseCorrection: false };
}

const pct = (p: Pace) => (p === 'slower' ? PROGRAM.slowerRecoveryPct : PROGRAM.currentRecoveryPct) * 100;

/** "full year", "6 months" or "no advances": the short form of the advance at a stage. */
function advanceShort(s: StandingState): string {
  const b = advanceBasis(s);
  return b === 'full' ? 'full year' : b === 'stage' ? `${PROGRAM.stageAdvanceMonths} months` : 'no advances';
}

function stageReason(o: Outcome): string {
  switch (o.to.standing) {
    case 'watch':
      return 'first warning';
    case 'training':
      return o.to.voluntary ? '' : `mandatory: ${o.strikesAfter} strikes in ${PROGRAM.rollingWindow} policies`;
    case 'good':
      return `next ${PROGRAM.earnBackCleanPolicies} policies stayed clean`;
    case 'terminated':
      return 'repeat lapses after training';
  }
}

/** The way back to Good standing, or null when there's nothing to earn back. */
export function wayBackLine(agent: Agent, o: Outcome): string | null {
  const k = PROGRAM.earnBackCleanPolicies;
  const remaining = k - o.next.cleanStreak;
  const more = remaining < k ? `${remaining} more clean ${remaining === 1 ? 'policy' : 'policies'} in a row` : `next ${k} policies stay clean`;
  switch (o.to.standing) {
    case 'watch':
      return `Way back: ${more} → Good standing and the full ${formatINR(PROGRAM.fullAdvance)} advance.`;
    case 'training':
      return `Way back: finish training, then ${more} → Good standing.`;
    case 'terminated':
      return 'Appeal: within 30 days, with extra evidence.';
    default:
      return null;
  }
}

/** The effect of a case as short plain lines, shown in step 5, the pop-up and the result. */
export function effectLines(agent: Agent, c: Case, o: Outcome): string[] {
  const L: string[] = [];
  const poss = agent.possessive ?? 'their';
  const W = PROGRAM.rollingWindow;
  const f = upfrontPerPolicy(o.from);
  const t = upfrontPerPolicy(o.to);
  const changed = stageChanged(o);

  if (c.kind === 'switch') {
    const n = c.items.length;
    L.push(`Standing: ${standingLabel(o.to)} (unchanged). No strike.`);
    L.push(`Genuinely new sales: ${formatINR(t.amount)} upfront (unchanged).`);
    L.push(
      `Switched ${n === 1 ? 'policy' : 'policies'}: ${formatINR(SWITCH_ADVANCE)} upfront${n > 1 ? ' each' : ''} (3 months), rest paid quarterly as the customer keeps paying. A switch never earns a fresh full advance.`,
    );
    L.push(
      `Unearned part of the ${n === 1 ? 'old advance' : `${n} old advances`} (${formatINR(o.money.ownRecovered)}) recovered at the current pace (${pct('current')}% of each payout). This is recovery, not a penalty.`,
    );
    return L;
  }

  // Stage.
  if (changed) {
    const why = stageReason(o);
    L.push(`${standingLabel(o.from)} → ${standingLabel(o.to)}${why ? ` (${why})` : ''}.`);
  } else {
    L.push(`Standing: ${standingLabel(o.to)} (unchanged).${c.kind === 'lapse' && !o.strike ? ' No strike.' : ''}`);
  }

  // Advance.
  if (o.to.standing === 'terminated') L.push('Upfront per new policy: none.');
  else if (f.amount === t.amount && changed) L.push(`Upfront per new policy: ${formatINR(f.amount)} → ${formatINR(t.amount)} (${o.to.voluntary ? 'no change to advance' : advanceShort(o.to)}).`);
  else if (f.amount === t.amount) L.push(`Upfront per new policy: ${formatINR(t.amount)} (unchanged).`);
  else L.push(`Upfront per new policy: ${formatINR(f.amount)} → ${formatINR(t.amount)} (${advanceShort(o.to)}).`);

  // Repaying.
  if (o.money.absorbed) {
    L.push(`Ethos absorbs ${formatINR(o.money.absorbed)}. Nothing to repay.`);
  } else if (c.kind === 'lapse' && o.money.ownRecovered && o.money.pace) {
    const p = o.money.pace;
    const n = c.lapses.length;
    L.push(
      n > 1
        ? `Repaying: unearned advances on ${poss} ${n} lapsed policies (${formatINR(o.money.ownRecovered)}) at the ${p} pace (${pct(p)}% of each payout).`
        : `Repay the unearned advance on this policy (${formatINR(o.money.ownRecovered)}) at ${pct(p)}% of each payout (${p} pace).`,
    );
  }
  if (o.money.movedToSlower) {
    L.push(`Existing debt (${formatINR(o.money.movedToSlower)}) moves to the slower pace (${pct('slower')}% of each payout).`);
  } else if (c.kind === 'lapse' && o.strike && agent.history.some((e) => e.kind !== 'team-debt' && e.recovered > 0)) {
    L.push('Earlier debts keep their own pace.');
  }
  if (o.money.teamShare) {
    L.push(`Team debt share: ${PROGRAM.managerTeamDebtShare * 100}% = ${formatINR(o.money.teamShare)}, repaid at the slower pace (${pct('slower')}% of each payout).`);
  }

  // Strikes.
  if (c.kind === 'lapse' && o.strike) {
    L.push(
      o.resetApplied
        ? `Strikes: ${o.strikesAfter} of ${W}; reset to 0 after training (${poss} one reset).`
        : `Strikes: ${o.strikesAfter} in the last ${W} policies.`,
    );
  } else if (o.resetApplied) {
    L.push(`Strikes: reset to 0 after training (${poss} one reset).`);
  }
  if (o.trainingOffered) L.push('Training offered.');
  if (o.to.standing === 'training' && o.next.finalWarning && !agent.finalWarning) {
    L.push('Final warning: one more oversold lapse after training means termination.');
  }
  if (o.money.teamShare && o.to.standing !== 'terminated') L.push('Keeps manager role.');

  // Clean policies.
  if (c.kind === 'clean' && !changed) {
    L.push(
      o.to.standing === 'good'
        ? 'Bonus earned on a policy the customer keeps paying.'
        : `Earn-back: ${o.next.cleanStreak} of ${PROGRAM.earnBackCleanPolicies} clean policies in a row.`,
    );
  }

  const back = wayBackLine(agent, o);
  if (back) L.push(back);
  return L;
}

