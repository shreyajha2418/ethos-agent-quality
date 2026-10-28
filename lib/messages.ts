import {
  PROGRAM,
  SWITCH_ADVANCE,
  SWITCH_LABEL,
  formatINR,
  paceLabel,
  standingLabel,
  upfrontPerPolicy,
  type Agent,
  type Case,
  type LapseCause,
  type Outcome,
  type StandingState,
} from './rules';

const WHY: Record<LapseCause, string> = {
  ethos: 'Our billing system charged on the wrong date, which caused the lapse. This was our error, not yours, and we have fixed it.',
  nofault: 'The customer couldn’t pay, and you acted on the warning signs. This was not your fault.',
  skill: 'The call notes and first-payment check show the customer’s needs and budget weren’t fully assessed before the sale. We see this as a skill gap, not misconduct.',
  oversold: 'The call record shows the customer was sold more cover than they said they could afford.',
  ignored: 'The customer couldn’t pay, and the warning signs we sent you (including the alert to move them to a cheaper policy) weren’t followed up.',
  inconclusive: 'The evidence didn’t clearly show what caused the lapse, so it isn’t a strike.',
};

function wayBack(to: StandingState, finalWarning: boolean): string {
  const k = PROGRAM.earnBackCleanPolicies;
  switch (to.standing) {
    case 'good':
      return 'Nothing to do. You keep the full advance on every new policy.';
    case 'watch':
      return `Your next ${k} policies staying clean returns you to the full advance of ${formatINR(PROGRAM.fullAdvance)}.`;
    case 'training':
      return to.voluntary
        ? `Complete the training. You keep the full advance throughout, and your next ${k} policies staying clean returns you to Good standing.`
        : `Complete the training, then your next ${k} policies staying clean returns you to the full advance.${finalWarning ? ' Please note: one more oversold lapse would end your contract.' : ''}`;
    case 'terminated':
      return 'Your agent contract ends. Remaining repayments continue from payouts still due. You can appeal within 30 days with extra evidence.';
  }
}

/** Plain, respectful message to the agent: what happened, why, what changes, how to get back. */
export function notifyMessage(agent: Agent, c: Case, o: Outcome): string {
  const L: string[] = [`Hi ${agent.firstName},`, ''];
  const moved = o.from.standing !== o.to.standing || o.from.voluntary !== o.to.voluntary;
  const up = upfrontPerPolicy(o.to);
  const standingLine = moved
    ? `Your stage: ${standingLabel(o.from)} → ${standingLabel(o.to)}.`
    : `Your stage stays ${standingLabel(o.to)}.`;
  const advanceLine = `Advance on new policies: ${formatINR(up.amount)}, ${up.detail.charAt(0).toLowerCase()}${up.detail.slice(1)}.`;

  if (c.kind === 'switch') {
    L.push(`What happened: ${c.items.length === 1 ? 'a customer' : `${c.items.length} customers`} switched policy with you (${c.items.map((i) => `${SWITCH_LABEL[i.type].toLowerCase()}: ${i.oldPolicy} → ${i.newPolicy}`).join(', ')}).`, '');
    L.push('Why: a policy switch isn’t a lapse, so it isn’t a strike and your stage doesn’t change.', '');
    L.push('What changes:');
    L.push(`• The unearned part of the old advance${c.items.length > 1 ? 's' : ''} (${formatINR(o.money.ownRecovered)}) is repaid at ${paceLabel('current')}.`);
    L.push(`• Each new policy pays a 3-month advance of ${formatINR(SWITCH_ADVANCE)}, then quarterly.`);
    L.push(`• ${advanceLine.replace('new policies', 'your other new policies')}`);
  } else if (c.kind === 'clean') {
    L.push(`What happened: ${c.policy} is in force and the customer keeps paying. Thank you.`, '');
    L.push('What changes:');
    L.push(`• ${standingLine}`);
    L.push(`• ${advanceLine}`);
  } else if (c.kind === 'request') {
    L.push('What happened: you asked for training, and we’ve enrolled you.', '');
    L.push('What changes:');
    L.push(`• ${standingLine}`);
    L.push(`• ${advanceLine} There is no penalty for asking.`);
    if (o.money.movedToSlower) L.push(`• Any debt you’re repaying moves to ${paceLabel('slower')}.`);
    if (o.resetApplied) L.push('• Your strike count resets after training. This happens once.');
  } else {
    const pols = c.lapses.map((l) => l.policy).join(', ');
    L.push(`What happened: ${pols} lapsed. We checked our own billing and payment systems first and ${o.billingCheck.bugFound ? 'found an error on our side' : 'found no errors'}.`, '');
    L.push(`Why: ${WHY[c.cause]}`, '');
    L.push('What changes:');
    L.push(`• ${standingLine}`);
    L.push(`• ${advanceLine}`);
    if (o.money.absorbed) L.push(`• Ethos absorbs ${formatINR(o.money.absorbed)}. You repay nothing.`);
    else if (o.money.ownRecovered && o.money.pace) L.push(`• You repay the unearned advance of ${formatINR(o.money.ownRecovered)} at ${paceLabel(o.money.pace)}.`);
    if (o.money.movedToSlower) L.push('• Your other repayments move to the slower pace too.');
    if (o.money.teamShare)
      L.push(`• Your share of the team’s new agent-caused debt is ${formatINR(o.money.teamShare)}, repaid at ${paceLabel('slower')}.${o.to.standing !== 'terminated' ? ' You keep your manager role.' : ''}`);
    if (o.trainingOffered) L.push('• We’d like to offer you training on assessing customer needs. Just reply to accept.');
    if (o.resetApplied) L.push('• Your strike count resets after training. This happens once.');
    L.push(`• ${o.strike ? 'This counts as a strike on your record.' : 'This is not a strike.'}`);
  }

  L.push('', `How to get back to the full advance: ${wayBack(o.to, o.next.finalWarning)}`);
  L.push('', 'If you think we got this wrong, you can appeal with extra evidence from your agent portal.', '', 'Ethos Agent Quality team');
  return L.join('\n');
}
