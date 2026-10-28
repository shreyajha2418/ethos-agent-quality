import {
  CAUSE_INFO,
  PROGRAM,
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
  ethos: 'Our billing system charged on the wrong date, which caused the lapse. This was our error, not yours.',
  nofault: 'The customer ran out of money, and you acted on every warning we sent. This was not your fault.',
  skill: 'The call notes and first-payment check show the customer’s needs and budget weren’t fully assessed before the sale. We treat this as a skill gap, not misconduct.',
  oversold: 'The call record shows the customer was sold more cover than they said they could afford.',
  ignored: 'The customer ran out of money, and the missed-payment warnings we sent you weren’t followed up.',
  inconclusive: 'The evidence didn’t clearly show what caused the lapse, so nothing is added to your record.',
};

function wayBack(to: StandingState, finalWarning: boolean): string {
  const k = PROGRAM.earnBackCleanPolicies;
  switch (to.standing) {
    case 'good':
      return 'Nothing to do. You keep the full-year advance on every new policy.';
    case 'watch':
      return `Sell ${k} clean policies in a row (no lapse you caused) and you return to Good standing and the full ${formatINR(PROGRAM.fullAdvance)} advance.`;
    case 'training':
      return to.voluntary
        ? `Finish the training. Your full advance stays in place. ${k} clean policies afterwards return you to Good standing.`
        : `Complete the training, then sell ${k} clean policies in a row to return to Good standing and the full advance.${finalWarning ? ' Please note: one more oversold lapse would end your contract.' : ''}`;
    case 'terminated':
      return 'Your agent contract ends. Remaining recovery continues from payouts still due. You can appeal within 30 days with extra evidence.';
  }
}

/** Plain, respectful message to the agent about an applied outcome. */
export function notifyMessage(agent: Agent, c: Case, o: Outcome): string {
  const L: string[] = [`Hi ${agent.firstName},`, ''];
  const moved = o.from.standing !== o.to.standing || o.from.voluntary !== o.to.voluntary;
  const standingLine = moved
    ? `Your standing: ${standingLabel(o.from)} → ${standingLabel(o.to)}.`
    : `Your standing stays ${standingLabel(o.to)}.`;
  const up = upfrontPerPolicy(o.to);

  if (c.kind === 'replacement') {
    L.push(`What happened: ${c.items.length} customers cancelled and bought a new policy from you (${c.items.map((i) => `${i.oldPolicy} → ${i.newPolicy}`).join(', ')}).`, '');
    L.push('Why: a replacement isn’t a lapse, so your standing and record don’t change.', '');
    L.push('What changes:');
    L.push(`• The unearned part of the old advances (${formatINR(o.money.ownRecovered)}) is recovered at ${paceLabel('normal')}.`);
    L.push('• The new policies pay ₹2,500 for 3 months, then quarterly.');
  } else if (c.kind === 'clean') {
    L.push(`What happened: ${c.policy} is in force with no lapse. Thank you.`, '');
    L.push('What changes:');
    L.push(`• ${standingLine}`);
    L.push(`• Upfront advance on new policies: ${formatINR(up.amount)} (${up.detail.toLowerCase()}).`);
  } else {
    const pols = c.lapses.map((l) => l.policy).join(', ');
    L.push(`What happened: ${pols} lapsed. We checked our own billing and payment systems first and ${o.billingCheck.bugFound ? 'found an error on our side' : 'found no errors'}.`, '');
    L.push(`Why: ${WHY[c.cause]}`, '');
    L.push('What changes:');
    L.push(`• ${standingLine}`);
    L.push(`• Upfront advance on new policies: ${formatINR(up.amount)} (${up.detail.toLowerCase()}).`);
    if (o.money.absorbed) L.push(`• Ethos absorbs ${formatINR(o.money.absorbed)}. Nothing is recovered from you.`);
    else if (o.money.ownRecovered && o.money.pace)
      L.push(`• ${formatINR(o.money.ownRecovered)} of unearned advance${o.money.fee ? ' (including a 10% fee)' : ''} is recovered at ${paceLabel(o.money.pace)}.`);
    if (o.money.teamShare)
      L.push(`• Your share of the team’s new agent-caused debt is ${formatINR(o.money.teamShare)}, recovered at ${paceLabel('slower')}.${o.to.standing !== 'terminated' ? ' You keep your manager role.' : ''}`);
    if (o.resetApplied) L.push('• Your lapse count resets after training. This happens once.');
    L.push(`• ${o.counts ? 'This counts on your record.' : 'Nothing is added to your record.'}`);
  }

  L.push('', `How to get back to the full advance: ${wayBack(o.to, o.next.finalWarning)}`);
  L.push('', 'If you think we got this wrong, you can appeal with extra evidence from your agent portal.', '', 'Ethos Agent Quality team');
  return L.join('\n');
}

export function causeLabel(tag: keyof typeof CAUSE_INFO) {
  return CAUSE_INFO[tag].label;
}
