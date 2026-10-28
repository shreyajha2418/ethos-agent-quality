import {
  PROGRAM,
  SWITCH_ADVANCE,
  SWITCH_LABEL,
  formatINR,
  upfrontPerPolicy,
  type Agent,
  type Case,
  type LapseCause,
  type Outcome,
} from './rules';
import { stageChanged } from './review';

/** Why the policy lapsed, finishing the sentence "…lapsed because …". */
const BECAUSE: Record<LapseCause, string> = {
  ethos: 'of an error in our billing system: we charged on the wrong date. This was our mistake, not yours, and we’ve fixed it.',
  nofault: 'the customer couldn’t keep paying, even though you acted on the warning signs. This wasn’t your fault.',
  skill: 'the cover didn’t fit the customer’s needs.',
  oversold: 'the plan cost more than the customer told you they could afford.',
  ignored: 'the customer couldn’t keep paying, and the warning signs we sent you (including the alert to move them to a cheaper policy) weren’t followed up.',
  inconclusive: 'of something the evidence couldn’t pin down, so it doesn’t count against you.',
};

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const ORDINALS = ['', 'first', 'second', 'third', 'fourth', 'fifth'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const word = (n: number) => NUMBER_WORDS[n] ?? String(n);
const pct = (slower: boolean) => (slower ? PROGRAM.slowerRecoveryPct : PROGRAM.currentRecoveryPct) * 100;
const k = PROGRAM.earnBackCleanPolicies;
const full = formatINR(PROGRAM.fullAdvance);

function advanceSentence(o: Outcome): string {
  const up = upfrontPerPolicy(o.to);
  if (o.to.standing === 'terminated') return 'No further advances will be paid.';
  if (up.amount === PROGRAM.fullAdvance) return `You keep your full ${full} advance on new policies.`;
  const same = upfrontPerPolicy(o.from).amount === up.amount;
  return same
    ? `Your advance stays at ${formatINR(up.amount)} (${PROGRAM.stageAdvanceMonths} months) per new policy`
    : `Your advance on new policies is now ${formatINR(up.amount)} (${PROGRAM.stageAdvanceMonths} months) until your next ${k} policies stay active`;
}

function wayBack(o: Outcome): string {
  switch (o.to.standing) {
    case 'watch':
      return `Keep your next ${k} policies active and you’re back in Good standing with the full ${full} advance.`;
    case 'training':
      if (o.to.voluntary) {
        return o.resetApplied
          ? `After training, your strikes reset, and once your next ${k} policies stay active, you’re back in Good standing.`
          : `After training, once your next ${k} policies stay active, you’re back in Good standing.`;
      }
      return `Finish training and keep your next ${k} policies active, and you’re back in Good standing with the full ${full} advance.`;
    case 'terminated':
      return 'You can appeal within 30 days with extra evidence.';
    default:
      return '';
  }
}

/** Short, plain, respectful message: what happened, why, what changes, how to get back. */
export function notifyMessage(agent: Agent, c: Case, o: Outcome): string {
  const S: string[] = [];

  if (c.kind === 'switch') {
    const n = c.items.length;
    const types = new Set(c.items.map((i) => SWITCH_LABEL[i.type].toLowerCase()));
    S.push(
      `${n === 1 ? 'One of your customers' : `${cap(word(n))} of your customers`} switched to a ${[...types].join(' or ')} policy with you (${c.items.map((i) => `${i.oldPolicy} → ${i.newPolicy}`).join(', ')}).`,
    );
    S.push('A switch isn’t a lapse, so there’s no strike and your standing doesn’t change.');
    S.push(
      `Switched policies pay ${formatINR(SWITCH_ADVANCE)} upfront each (3 months), with the rest paid quarterly as the customer keeps paying; a switch never earns a fresh full advance. Your genuinely new sales still pay ${formatINR(upfrontPerPolicy(o.to).amount)} upfront.`,
    );
    S.push(
      `The unearned part of the ${n === 1 ? 'old advance' : `${n} old advances`} (${formatINR(o.money.ownRecovered)}) will be recovered at ${pct(false)}% of each payout. This is recovery, not a penalty.`,
    );
  } else if (c.kind === 'clean') {
    S.push(`${c.policy} is active and your customer keeps paying. Thank you.`);
    if (o.to.standing === 'good' && stageChanged(o)) S.push(`Your last ${k} policies all stayed active, so you’re back in Good standing with the full ${full} advance.`);
    else if (o.to.standing === 'good') S.push('You’ve earned the bonus for a policy the customer keeps paying.');
    else S.push(`That’s ${o.next.cleanStreak} of ${k} in a row. ${wayBack(o)}`);
  } else if (c.kind === 'request') {
    S.push('You asked for training, so we’ve enrolled you.');
    S.push(`There’s no penalty: ${advanceSentence(o).charAt(0).toLowerCase()}${advanceSentence(o).slice(1)}`);
    if (o.money.movedToSlower) S.push(`Any debt you’re repaying (${formatINR(o.money.movedToSlower)}) is now recovered slowly, at ${pct(true)}% of each payout.`);
    S.push(wayBack(o));
  } else {
    const n = c.lapses.length;
    const voluntary = o.to.standing === 'training' && o.to.voluntary && stageChanged(o);
    if (voluntary) S.push('You asked for training, so we’ve enrolled you.');
    const lapseSubject = n === 1 ? `Your latest policy (${c.lapses[0].policy})` : `${cap(word(n))} of your recent policies`;
    S.push(`${lapseSubject} lapsed because ${BECAUSE[c.cause]}`);

    if (stageChanged(o) && !voluntary) {
      if (o.to.standing === 'watch') S.push('This is your first warning, so you’re moving to Watch.');
      else if (o.to.standing === 'training')
        S.push(`That’s your ${ORDINALS[o.strikesAfter] ?? `${o.strikesAfter}th`} lapse in your last ${PROGRAM.rollingWindow} policies, so you’re moving to Training.`);
      else if (o.to.standing === 'terminated') S.push('Because this follows your training, your agent contract ends.');
    } else if (!stageChanged(o) && o.strike) {
      S.push('You stay in Training, and your count of clean policies starts again.');
    } else if (!o.strike) {
      S.push('It isn’t a strike, and your standing doesn’t change.');
    }

    // Advance and repayment.
    const adv = advanceSentence(o);
    const slower = o.money.pace === 'slower';
    const amount = formatINR(o.money.ownRecovered);
    const repay = n === 1 ? `the unearned part of this advance (${amount})` : `the unearned part of the lapsed advances (${amount})`;
    if (o.money.absorbed) {
      S.push(`${adv.endsWith('.') ? adv : `${adv}.`} Ethos covers the ${formatINR(o.money.absorbed)}; you repay nothing.`);
    } else if (o.money.ownRecovered) {
      if (adv.endsWith('.')) {
        S.push(adv);
        S.push(`${cap(repay)} will be recovered ${slower ? 'slowly, ' : ''}at ${pct(slower)}% of each payout.`);
      } else {
        S.push(`${adv}, and ${repay} will be recovered ${slower ? 'slowly, ' : ''}at ${pct(slower)}% of each payout.`);
      }
    } else {
      S.push(adv.endsWith('.') ? adv : `${adv}.`);
    }
    if (o.money.teamShare) {
      S.push(`As a manager, you also carry ${formatINR(o.money.teamShare)} of your team’s new agent-caused debt, recovered slowly at ${pct(true)}% of each payout.${o.to.standing !== 'terminated' ? ' You keep your manager role.' : ''}`);
    }
    if (o.trainingOffered) S.push('We’d also like to offer you training on assessing customer needs; just reply to accept.');
    // `agent` is the agent after the change, so check the transition, not the flag.
    if (o.to.standing === 'training' && stageChanged(o) && o.next.finalWarning) {
      S.push('This is your last chance: one more oversold lapse after training would end your contract.');
    }
    const back = wayBack(o);
    if (back) S.push(back);
  }

  return [
    `Hi ${agent.firstName},`,
    '',
    S.filter(Boolean).join(' '),
    '',
    'If you think we got this wrong, you can appeal with extra evidence from your agent portal.',
    '',
    'Ethos Agent Quality team',
  ].join('\n');
}
