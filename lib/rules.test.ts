import { describe, expect, it } from 'vitest';
import { seedAgents, seedCases } from '@/data/seed';
import { notifyMessage } from './messages';
import { effectLines, reviewAction } from './review';
import {
  STAGE_ADVANCE,
  SWITCH_ADVANCE,
  applyOutcome,
  cardStatus,
  evaluateCase,
  strikeCount,
  totals,
  unearnedAdvance,
  upfrontPerPolicy,
  type Agent,
  type Case,
  type LapseCase,
  type LapseCause,
  type SwitchType,
} from './rules';

let n = 0;
function agent(over: Partial<Agent> = {}): Agent {
  return {
    id: 'a',
    name: 'Test Agent',
    firstName: 'Test',
    roleTag: 'Agent',
    profile: '',
    policies: 10,
    standing: 'good',
    voluntary: false,
    resetUsed: false,
    finalWarning: false,
    cleanStreak: 0,
    window: [],
    history: [],
    policyPrefix: 'T',
    nextPolicyNo: 1,
    ...over,
  };
}
const evidence = { transcript: '', firstPayment: '', confidence: 50 };
function lapse(cause: LapseCause, extra: Partial<LapseCase> = {}): Case {
  n++;
  return {
    id: `c${n}`, agentId: 'a', kind: 'lapse', cause, date: 'today', title: '', summary: '', evidence,
    lapses: [{ policy: `T-${n}`, monthsInForce: 4, basis: 'full' }],
    ...extra,
  };
}
function clean(): Case {
  n++;
  return { id: `c${n}`, agentId: 'a', kind: 'clean', policy: `T-${n}`, date: 'today', title: '', summary: '', evidence };
}
function policySwitch(type: SwitchType): Case {
  n++;
  return {
    id: `c${n}`, agentId: 'a', kind: 'switch', date: 'today', title: '', summary: '', evidence,
    items: [{ type, oldPolicy: `T-${n}a`, newPolicy: `T-${n}b`, monthsInForce: 6, basis: 'full' }],
  };
}
function request(): Case {
  n++;
  return { id: `c${n}`, agentId: 'a', kind: 'request', date: 'today', title: '', summary: '', evidence };
}
/** Runs cases in order and returns the final agent. */
function run(a: Agent, ...cases: Case[]): Agent {
  return cases.reduce((acc, c) => applyOutcome(acc, evaluateCase(acc, c)), a);
}

describe('advances', () => {
  it('₹10,000 full, ₹5,000 for Watch and Training, full if training was requested, none when terminated', () => {
    expect(STAGE_ADVANCE).toBe(5000);
    expect(SWITCH_ADVANCE).toBe(2500);
    expect(upfrontPerPolicy({ standing: 'good', voluntary: false }).amount).toBe(10000);
    expect(upfrontPerPolicy({ standing: 'watch', voluntary: false }).amount).toBe(5000);
    expect(upfrontPerPolicy({ standing: 'training', voluntary: false }).amount).toBe(5000);
    expect(upfrontPerPolicy({ standing: 'training', voluntary: true }).amount).toBe(10000);
    expect(upfrontPerPolicy({ standing: 'terminated', voluntary: false }).amount).toBe(0);
  });
  it('unearned advance is the part of each advance not yet earned', () => {
    expect(unearnedAdvance({ monthsInForce: 4, basis: 'full' })).toBe(6667);
    expect(unearnedAdvance({ monthsInForce: 4, basis: 'stage' })).toBe(1667);
    expect(unearnedAdvance({ monthsInForce: 7, basis: 'stage' })).toBe(0);
    expect(unearnedAdvance({ monthsInForce: 4, basis: 'switch' })).toBe(1667);
  });
});

describe('lapse causes', () => {
  it('1. oversold → Watch, ₹5,000 advance, current pace, no fee, 1 strike', () => {
    const o = evaluateCase(agent(), lapse('oversold'));
    expect(o.to.standing).toBe('watch');
    expect(upfrontPerPolicy(o.to).amount).toBe(5000);
    expect(o.money.pace).toBe('current');
    expect(o.money.ownRecovered).toBe(o.money.unearned);
    expect(o.money.ownRecovered).toBe(6667);
    expect(o.strike).toBe(true);
    expect(o.strikesAfter).toBe(1);
  });
  it('2. skill gap → Watch + training offered (not Training), slower pace, 1 strike', () => {
    const o = evaluateCase(agent(), lapse('skill'));
    expect(o.to.standing).toBe('watch');
    expect(o.trainingOffered).toBe(true);
    expect(o.money.pace).toBe('slower');
    expect(o.strikesAfter).toBe(1);
  });
  it('3. ignored warning signs → identical to oversold', () => {
    const a = evaluateCase(agent(), lapse('ignored'));
    const b = evaluateCase(agent(), lapse('oversold'));
    expect(a.to).toEqual(b.to);
    expect(a.money.pace).toBe(b.money.pace);
    expect(a.money.ownRecovered).toBe(b.money.ownRecovered);
    expect(a.strikesAfter).toBe(b.strikesAfter);
    expect(a.trainingOffered).toBe(false);
  });
  it('4. Ethos fault, acted on warnings and inconclusive → no strike, standing unchanged', () => {
    for (const standing of ['good', 'watch'] as const) {
      for (const cause of ['ethos', 'nofault', 'inconclusive'] as const) {
        const o = evaluateCase(agent({ standing }), lapse(cause));
        expect(o.strike).toBe(false);
        expect(o.to.standing).toBe(standing);
      }
    }
    const ethos = evaluateCase(agent(), lapse('ethos'));
    expect(ethos.billingCheck.bugFound).toBe(true);
    expect(ethos.money.absorbed).toBe(6667);
    expect(evaluateCase(agent(), lapse('nofault')).money.absorbed).toBe(6667);
    const inc = evaluateCase(agent(), lapse('inconclusive'));
    expect(inc.money.absorbed).toBe(0);
    expect(inc.money.ownRecovered).toBe(6667);
    expect(inc.money.pace).toBe('current');
  });
});

describe('movement', () => {
  it('5. 3 strikes within 5 policies → Training; spread over more than 5 → not Training', () => {
    const trained = run(agent(), lapse('skill'), lapse('oversold'), lapse('ignored'));
    expect(trained.standing).toBe('training');
    expect(trained.voluntary).toBe(false);
    expect(trained.resetUsed).toBe(true);
    expect(strikeCount(trained.window)).toBe(0);

    const spread = run(agent(), lapse('skill'), clean(), clean(), clean(), lapse('skill'), clean(), lapse('skill'));
    // Last 5 policies: clean, clean, skill, clean, skill → 2 strikes.
    expect(strikeCount(spread.window)).toBe(2);
    expect(spread.standing).toBe('watch');
  });
  it('6. Watch + 3 clean policies in a row → Good standing; a lapse at clean #2 resets earn-back to 0', () => {
    const watch = run(agent(), lapse('oversold'));
    expect(cardStatus(watch)).toBe('Earn-back 0 of 3');
    const back = run(watch, clean(), clean(), clean());
    expect(back.standing).toBe('good');
    expect(upfrontPerPolicy(back).amount).toBe(10000);

    const interrupted = run(watch, clean(), lapse('skill'));
    expect(interrupted.cleanStreak).toBe(0);
    expect(interrupted.standing).toBe('watch');
    expect(run(interrupted, clean(), clean()).standing).toBe('watch');
    expect(run(interrupted, clean(), clean(), clean()).standing).toBe('good');
  });
  it('7. after training: one more oversold → Termination; 2 skill strikes → not yet; 3 → Termination', () => {
    const oversoldTrained = run(agent(), lapse('oversold'), lapse('oversold'), lapse('oversold'));
    expect(oversoldTrained.finalWarning).toBe(true);
    expect(evaluateCase(oversoldTrained, lapse('oversold')).to.standing).toBe('terminated');

    const skillTrained = run(agent(), lapse('skill'), lapse('skill'), lapse('skill'));
    expect(skillTrained.finalWarning).toBe(false);
    const two = run(skillTrained, lapse('skill'), lapse('skill'));
    expect(two.standing).toBe('training');
    expect(run(two, lapse('skill')).standing).toBe('terminated');
  });
  it('the oversold final warning survives earn-back', () => {
    const trained = run(agent(), lapse('oversold'), lapse('oversold'), lapse('oversold'));
    const restored = run(trained, clean(), clean(), clean());
    expect(restored.standing).toBe('good');
    expect(run(restored, lapse('oversold')).standing).toBe('terminated');
  });
  it('8. training by request → Training, full ₹10,000, slower pace, uses the one reset', () => {
    const watch = run(agent(), lapse('oversold'));
    expect(watch.history[0].pace).toBe('current');
    const o = evaluateCase(watch, request());
    expect(o.to).toEqual({ standing: 'training', voluntary: true });
    expect(upfrontPerPolicy(o.to).amount).toBe(10000);
    expect(o.money.pace).toBe('slower');
    expect(o.resetApplied).toBe(true);
    const after = applyOutcome(watch, o);
    expect(after.resetUsed).toBe(true);
    expect(after.history.filter((e) => e.recovered > 0).every((e) => e.pace === 'slower')).toBe(true);
    expect(cardStatus(after)).toBe('In training (requested)');

    // Asking for training with a lapse works the same way, with no penalty.
    const withLapse = evaluateCase(agent(), lapse('oversold', { requestedTraining: true }));
    expect(withLapse.to).toEqual({ standing: 'training', voluntary: true });
    expect(withLapse.money.pace).toBe('slower');
    expect(withLapse.money.ownRecovered).toBe(withLapse.money.unearned);
  });
  it('9. a second training does not reset the strike count', () => {
    const trained = run(agent(), lapse('skill'), lapse('skill'), lapse('skill'));
    const restored = run(trained, clean(), clean(), clean());
    const again = evaluateCase(restored, request());
    expect(again.resetApplied).toBe(false);
    // And reaching 3 strikes again terminates instead of a second Training.
    const o = evaluateCase(run(restored, lapse('skill'), lapse('skill')), lapse('skill'));
    expect(o.resetApplied).toBe(false);
    expect(o.to.standing).toBe('terminated');
  });
  it('a terminated agent cannot take new cases', () => {
    expect(() => evaluateCase(agent({ standing: 'terminated' }), clean())).toThrow();
  });
});

describe('policy switches', () => {
  it('10. either type → stage unchanged, no strike, new policy ₹2,500, old unearned recovered at current pace', () => {
    for (const type of ['downgrade', 'replacement'] as const) {
      for (const standing of ['good', 'watch', 'training'] as const) {
        const a = agent({ standing, window: [{ policy: 'x', strike: true, cause: 'skill' }], cleanStreak: 1 });
        const o = evaluateCase(a, policySwitch(type));
        expect(o.to.standing).toBe(standing);
        expect(o.strike).toBe(false);
        expect(o.next.window).toEqual(a.window);
        expect(o.next.cleanStreak).toBe(1);
        expect(o.money.ownRecovered).toBe(5000);
        expect(o.money.pace).toBe('current');
        expect(o.events[0].note).toContain('₹2,500');
      }
    }
  });
});

describe('managers', () => {
  it('11. manager oversold lapse → Watch, no fee, 50% team debt share at slower pace', () => {
    const m = agent({ manager: { team: 'Team', teamSize: 5 } });
    const o = evaluateCase(m, lapse('oversold', { teamDebt: 40000 }));
    expect(o.to.standing).toBe('watch');
    expect(o.money.ownRecovered).toBe(o.money.unearned);
    expect(o.money.pace).toBe('current');
    expect(o.money.teamShare).toBe(20000);
    expect(o.events.find((e) => e.kind === 'team-debt')!.pace).toBe('slower');
    expect(o.notes).toContain('Keeps manager role.');
  });
});

describe('seed cases', () => {
  const agents = seedAgents();
  const cases = seedCases();
  const caseFor = (id: string) => cases.find((x) => x.agentId === id)!;
  const outcome = (id: string) => evaluateCase(agents[id], caseFor(id));

  it('five agents, one incoming case each; Rohan starts on Watch, the rest in Good standing', () => {
    expect(cases.map((c) => c.agentId).sort()).toEqual(['dana', 'leo', 'marcus', 'priya', 'rohan']);
    for (const id of ['priya', 'marcus', 'dana', 'leo']) expect(agents[id].standing).toBe('good');
    expect(agents.rohan.standing).toBe('watch');
  });

  it('Priya: 0 → 2 strikes, asked for training → Training (requested), ₹10,000, slower pace, reset used', () => {
    expect(strikeCount(agents.priya.window)).toBe(0);
    expect(agents.priya.history).toHaveLength(0);
    const o = outcome('priya');
    expect(o.strikesAfter).toBe(2);
    expect(o.to).toEqual({ standing: 'training', voluntary: true });
    expect(upfrontPerPolicy(o.to).amount).toBe(10000);
    expect(o.money.pace).toBe('slower');
    expect(o.resetApplied).toBe(true);
    const after = applyOutcome(agents.priya, o);
    expect(after.resetUsed).toBe(true);
    expect(strikeCount(after.window)).toBe(0);
    const lapses = after.history.filter((e) => e.kind === 'lapse');
    expect(lapses).toHaveLength(2);
    // Pop-up, Effect step and result card share effectLines; the notification must match.
    const lines = effectLines(agents.priya, caseFor('priya'), o).join('\n');
    const msg = notifyMessage(after, caseFor('priya'), o);
    expect(lines).toContain('Repaying: unearned advances on her 2 lapsed policies (₹17,500) at the slower pace (20% of each payout).');
    expect(msg).toContain('The unearned advances on your 2 lapsed policies (₹17,500) will be recovered slowly, at 20% of each payout.');
    expect(lines + msg).not.toContain('8,333');
    expect(lapses.every((e) => e.strike && e.pace === 'slower')).toBe(true);
  });

  it('Marcus: strike → 3 clean (Good standing) → oversold → Watch with 2 strikes in window', () => {
    const m = agents.marcus;
    expect(m.history.map((e) => e.kind)).toEqual(['lapse', 'clean', 'clean', 'clean']);
    expect(m.history[3].note).toContain('Earned back to Good standing after 3 clean policies.');
    expect(strikeCount(m.window)).toBe(1);
    const o = outcome('marcus');
    expect(o.to.standing).toBe('watch');
    expect(o.strikesAfter).toBe(2);
    expect(upfrontPerPolicy(o.to).amount).toBe(5000);
    expect(o.money.ownRecovered).toBe(5833);
    expect(o.money.pace).toBe('current');
    expect(o.money.teamShare).toBe(20000);
    expect(o.notes).toContain('Keeps manager role.');
  });

  it('Dana: Ethos fault, stays Good standing, no strikes, Ethos absorbs', () => {
    const o = outcome('dana');
    expect(o.billingCheck.bugFound).toBe(true);
    expect(o.to.standing).toBe('good');
    expect(o.events.every((e) => !e.strike)).toBe(true);
    expect(o.money.absorbed).toBe(26667);
  });

  it('Leo: switches keep Good standing, no strike, ₹2,500 on switched policies, ₹10,000 on new sales', () => {
    const o = outcome('leo');
    expect(o.to.standing).toBe('good');
    expect(o.strike).toBe(false);
    expect(o.events).toHaveLength(3);
    expect(o.events.every((e) => e.note.includes('Policy-switch rule applied') && e.note.includes('₹2,500'))).toBe(true);
    expect(upfrontPerPolicy(o.to).amount).toBe(10000);
    expect(o.money.ownRecovered).toBe(11667);
    const lines = effectLines(agents.leo, caseFor('leo'), o);
    expect(lines).toEqual([
      'Standing: Good standing (unchanged). No strike.',
      'Genuinely new sales: ₹10,000 upfront (unchanged).',
      'Switched policies: ₹2,500 upfront each (3 months), rest paid quarterly as the customer keeps paying. A switch never earns a fresh full advance.',
      'Unearned part of the 3 old advances (₹11,667) recovered at the current pace (50% of each payout). This is recovery, not a penalty.',
    ]);
    const msg = notifyMessage(applyOutcome(agents.leo, o), caseFor('leo'), o);
    expect(msg).not.toMatch(/new policies pay ₹2,500/i);
    expect(msg).toContain('Switched policies pay ₹2,500');
  });

  it('Rohan: Watch with 2 strikes → oversold → Training (mandatory), ₹5,000, current pace, final warning', () => {
    const r = agents.rohan;
    expect(strikeCount(r.window)).toBe(2);
    expect(cardStatus(r)).toBe('Earn-back 1 of 3');
    expect(upfrontPerPolicy(r).amount).toBe(5000);
    const o = outcome('rohan');
    expect(o.strikesAfter).toBe(3);
    expect(o.to).toEqual({ standing: 'training', voluntary: false });
    expect(upfrontPerPolicy(o.to).amount).toBe(5000);
    expect(o.money.pace).toBe('current');
    expect(o.resetApplied).toBe(true);
    expect(o.next.finalWarning).toBe(true);
    const trained = applyOutcome(r, o);
    const msg = notifyMessage(trained, caseFor('rohan'), o);
    expect(msg).toContain('That’s your third lapse in your last 5 policies, so you’re moving to Training.');
    expect(msg).toContain('This is your last chance: one more oversold lapse after training would end your contract.');
    // Earlier debts keep their own pace.
    expect(trained.history.find((e) => e.policy === 'R-0001')!.pace).toBe('current');
    expect(trained.history.find((e) => e.policy === 'R-0003')!.pace).toBe('slower');
    // One more oversold lapse → Termination.
    expect(run(trained, lapse('oversold')).standing).toBe('terminated');
    // Or 3 clean after training → Good standing.
    expect(run(trained, clean(), clean(), clean()).standing).toBe('good');
  });

  it('totals add up after all five are applied', () => {
    const after = Object.values(agents).map((a) => applyOutcome(a, evaluateCase(a, caseFor(a.id))));
    const t = totals(after);
    expect(t.absorbed).toBe(26667);
    // Priya 9,167 + 8,333; Marcus 5,000 + 5,833 + 20,000; Leo 11,667; Rohan 7,500 + 3,333 + 3,333.
    expect(t.recovering).toBe(17500 + 5000 + 5833 + 20000 + 11667 + 7500 + 3333 + 3333);
  });
});

describe('review pop-up wording', () => {
  const agents = seedAgents();
  const cases = seedCases();
  const action = (id: string) => {
    const c = cases.find((x) => x.agentId === id)!;
    return reviewAction(agents[id], c, evaluateCase(agents[id], c));
  };
  it('"Apply course correction" only when the stage changes', () => {
    expect(action('priya')).toMatchObject({ title: 'Apply course correction for Priya?', button: 'Apply course correction' });
    expect(action('marcus').button).toBe('Apply course correction');
    expect(action('rohan')).toMatchObject({ title: 'Apply course correction for Rohan?', button: 'Apply course correction' });
  });
  it('"Apply rule" with the rule named when the stage does not change', () => {
    expect(action('leo')).toMatchObject({ title: 'Apply policy-switch rule for Leo?', button: 'Apply rule' });
    expect(action('dana')).toMatchObject({ title: 'Confirm Ethos-fault ruling for Dana?', button: 'Apply rule' });
    const watch = run(agent(), lapse('oversold'));
    expect(reviewAction(watch, clean(), evaluateCase(watch, clean())).button).toBe('Apply rule');
  });
  it('Priya and Rohan effect lines match the brief', () => {
    const p = cases.find((x) => x.agentId === 'priya')!;
    const pl = effectLines(agents.priya, p, evaluateCase(agents.priya, p));
    expect(pl).toContain('Upfront per new policy: ₹10,000 → ₹10,000 (no change to advance).');
    expect(pl).toContain('Repaying: unearned advances on her 2 lapsed policies (₹17,500) at the slower pace (20% of each payout).');
    expect(pl).toContain('Strikes: 2 of 5; reset to 0 after training (her one reset).');
    expect(pl).toContain('Way back: finish training, then next 3 policies stay clean → Good standing.');
    const r = cases.find((x) => x.agentId === 'rohan')!;
    const rl = effectLines(agents.rohan, r, evaluateCase(agents.rohan, r));
    expect(rl).toContain('Watch → Training (mandatory: 3 strikes in 5 policies).');
    expect(rl).toContain('Upfront per new policy: ₹5,000 → ₹5,000 (6 months).');
    expect(rl).toContain('Repay the unearned advance on this policy (₹3,333) at 50% of each payout (current pace).');
    expect(rl).toContain('Final warning: one more oversold lapse after training means termination.');
    expect(rl).toContain('Way back: finish training, then next 3 policies stay clean → Good standing.');
  });
});
