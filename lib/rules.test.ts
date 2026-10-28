import { describe, expect, it } from 'vitest';
import { seedAgents, seedCases } from '@/data/seed';
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

describe('12. seed cases land as in Part C', () => {
  const agents = seedAgents();
  const cases = seedCases();
  const outcome = (id: string) => evaluateCase(agents[id], cases.find((x) => x.agentId === id)!);

  it('all four start in Good standing with one case each', () => {
    expect(Object.values(agents).every((a) => a.standing === 'good')).toBe(true);
    expect(cases.map((c) => c.agentId).sort()).toEqual(['dana', 'leo', 'marcus', 'priya']);
  });
  it('Priya: Training at her request, full ₹10,000, both lapses at slower pace, uses her one reset', () => {
    const o = outcome('priya');
    expect(o.to).toEqual({ standing: 'training', voluntary: true });
    expect(upfrontPerPolicy(o.to).amount).toBe(10000);
    expect(o.money.pace).toBe('slower');
    expect(o.resetApplied).toBe(true);
    const after = applyOutcome(agents.priya, o);
    const lapses = after.history.filter((e) => e.kind === 'lapse');
    expect(lapses).toHaveLength(2);
    expect(lapses.every((e) => e.pace === 'slower')).toBe(true);
  });
  it('Marcus: Watch, ₹5,000 advances, no fee, ₹20,000 team share at slower pace, keeps role', () => {
    const o = outcome('marcus');
    expect(o.to.standing).toBe('watch');
    expect(upfrontPerPolicy(o.to).amount).toBe(5000);
    expect(o.money.ownRecovered).toBe(5833);
    expect(o.money.teamShare).toBe(20000);
    expect(o.notes).toContain('Keeps manager role.');
  });
  it('Dana: Ethos fault, stays Good standing, no strikes, Ethos absorbs', () => {
    const o = outcome('dana');
    expect(o.billingCheck.bugFound).toBe(true);
    expect(o.to.standing).toBe('good');
    expect(o.events.every((e) => !e.strike)).toBe(true);
    expect(o.money.absorbed).toBe(26667);
    expect(o.money.ownRecovered).toBe(0);
  });
  it('Leo: stays Good standing, policy-switch rule on all 3, new policies ₹2,500', () => {
    const o = outcome('leo');
    expect(o.to.standing).toBe('good');
    expect(o.strike).toBe(false);
    expect(o.events).toHaveLength(3);
    expect(o.events.every((e) => e.note.includes('Policy-switch rule applied') && e.note.includes('₹2,500'))).toBe(true);
    expect(o.money.ownRecovered).toBe(11667);
  });
  it('totals add up after all four are applied', () => {
    const after = Object.values(agents).map((a) => applyOutcome(a, evaluateCase(a, cases.find((x) => x.agentId === a.id)!)));
    const t = totals(after);
    expect(t.absorbed).toBe(26667);
    expect(t.recovering).toBe(9167 + 5000 + 8333 + 5833 + 20000 + 11667);
  });
});
