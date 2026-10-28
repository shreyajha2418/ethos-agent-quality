import { describe, expect, it } from 'vitest';
import { seedAgents, seedCases } from '@/data/seed';
import {
  PROGRAM,
  REDUCED_ADVANCE,
  applyOutcome,
  cardStatus,
  evaluateCase,
  totals,
  unearnedAdvance,
  upfrontPerPolicy,
  windowCount,
  type Agent,
  type Case,
  type LapseCause,
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
function lapse(cause: LapseCause, extra: Partial<Extract<Case, { kind: 'lapse' }>> = {}): Case {
  n++;
  return {
    id: `c${n}`,
    agentId: 'a',
    kind: 'lapse',
    cause,
    date: 'today',
    title: '',
    summary: '',
    lapses: [{ policy: `T-${n}`, monthsInForce: 4, basis: 'full' }],
    evidence: { transcript: '', firstPayment: '', confidence: 50 },
    ...extra,
  };
}
function clean(): Case {
  n++;
  return { id: `c${n}`, agentId: 'a', kind: 'clean', policy: `T-${n}`, date: 'today', title: '', summary: '', evidence: { transcript: '', firstPayment: '', confidence: 90 } };
}
/** Runs cases in order and returns the final agent. */
function run(a: Agent, ...cases: Case[]): Agent {
  return cases.reduce((acc, c) => applyOutcome(acc, evaluateCase(acc, c)), a);
}

describe('money helpers', () => {
  it('unearned full advance is the months not yet earned out of 12', () => {
    expect(unearnedAdvance({ monthsInForce: 4, basis: 'full' })).toBe(6667);
    expect(unearnedAdvance({ monthsInForce: 12, basis: 'full' })).toBe(0);
  });
  it('unearned reduced advance is the unearned part of the current quarter', () => {
    expect(REDUCED_ADVANCE).toBe(2500);
    expect(unearnedAdvance({ monthsInForce: 4, basis: 'reduced' })).toBe(1667);
  });
  it('upfront cash follows standing', () => {
    expect(upfrontPerPolicy({ standing: 'good', voluntary: false }).amount).toBe(10000);
    expect(upfrontPerPolicy({ standing: 'watch', voluntary: false }).amount).toBe(2500);
    expect(upfrontPerPolicy({ standing: 'training', voluntary: false }).amount).toBe(2500);
    expect(upfrontPerPolicy({ standing: 'training', voluntary: true }).amount).toBe(10000);
    expect(upfrontPerPolicy({ standing: 'terminated', voluntary: false }).amount).toBe(0);
  });
});

describe('lapse causes', () => {
  it('Ethos fault: no consequence, Ethos absorbs, does not count', () => {
    const o = evaluateCase(agent(), lapse('ethos'));
    expect(o.billingCheck.bugFound).toBe(true);
    expect(o.to.standing).toBe('good');
    expect(o.counts).toBe(false);
    expect(o.money.absorbed).toBe(6667);
    expect(o.money.ownRecovered).toBe(0);
  });
  it('No fault (agent acted on warnings): no consequence, Ethos absorbs, does not count', () => {
    const o = evaluateCase(agent(), lapse('nofault'));
    expect(o.to.standing).toBe('good');
    expect(o.counts).toBe(false);
    expect(o.money.absorbed).toBe(6667);
  });
  it('Inconclusive: no move, recovered as today with no fee, does not count', () => {
    const o = evaluateCase(agent(), lapse('inconclusive'));
    expect(o.to.standing).toBe('good');
    expect(o.counts).toBe(false);
    expect(o.money.absorbed).toBe(0);
    expect(o.money.fee).toBe(0);
    expect(o.money.ownRecovered).toBe(6667);
    expect(o.money.pace).toBe('normal');
  });
  it('Skill gap: Watch, slower pace, no fee, counts', () => {
    const o = evaluateCase(agent(), lapse('skill'));
    expect(o.to.standing).toBe('watch');
    expect(o.counts).toBe(true);
    expect(o.money.fee).toBe(0);
    expect(o.money.pace).toBe('slower');
    expect(o.windowCountAfter).toBe(1);
  });
  it('Oversold: Watch, unearned + 10% at normal pace, counts', () => {
    const o = evaluateCase(agent(), lapse('oversold'));
    expect(o.to.standing).toBe('watch');
    expect(o.money.fee).toBe(667);
    expect(o.money.ownRecovered).toBe(7334);
    expect(o.money.pace).toBe('normal');
    expect(o.counts).toBe(true);
  });
  it('Ignored warnings: Watch, unearned + 10% at normal pace, counts', () => {
    const o = evaluateCase(agent(), lapse('ignored'));
    expect(o.to.standing).toBe('watch');
    expect(o.money.fee).toBe(667);
    expect(o.money.pace).toBe('normal');
    expect(o.counts).toBe(true);
  });
  it('non-agent-caused lapses never move the ladder, even many at once', () => {
    const a = run(agent(), lapse('ethos'), lapse('ethos'), lapse('nofault'), lapse('inconclusive'));
    expect(a.standing).toBe('good');
    expect(windowCount(a.window)).toBe(0);
  });
});

describe('movement', () => {
  it('any agent-caused lapse → at least Watch', () => {
    expect(run(agent(), lapse('skill')).standing).toBe('watch');
    expect(run(agent(), lapse('ignored')).standing).toBe('watch');
  });
  it('3 agent-caused lapses in a rolling 5 → Training, and the count resets', () => {
    const a = run(agent(), lapse('skill'), lapse('skill'), lapse('skill'));
    expect(a.standing).toBe('training');
    expect(a.voluntary).toBe(false);
    expect(a.resetUsed).toBe(true);
    expect(windowCount(a.window)).toBe(0);
  });
  it('the window rolls: a lapse older than 5 policies drops out', () => {
    const a = run(agent(), lapse('skill'), lapse('skill'), clean(), clean(), clean(), clean(), lapse('skill'));
    // Window is [clean, clean, clean, clean, skill]: only 1 counts.
    expect(windowCount(a.window)).toBe(1);
    expect(a.standing).toBe('watch');
  });
  it('after training (skill path): 3 more agent-caused lapses → Termination', () => {
    const trained = run(agent(), lapse('skill'), lapse('skill'), lapse('skill'));
    const twoMore = run(trained, lapse('skill'), lapse('skill'));
    expect(twoMore.standing).toBe('training');
    expect(run(twoMore, lapse('skill')).standing).toBe('terminated');
  });
  it('after training (oversold path): one more oversold lapse → Termination', () => {
    const trained = run(agent(), lapse('oversold'), lapse('oversold'), lapse('oversold'));
    expect(trained.standing).toBe('training');
    expect(trained.finalWarning).toBe(true);
    const o = evaluateCase(trained, lapse('oversold'));
    expect(o.to.standing).toBe('terminated');
  });
  it('the oversold final warning survives earn-back', () => {
    const trained = run(agent(), lapse('oversold'), lapse('oversold'), lapse('oversold'));
    const restored = run(trained, clean(), clean(), clean());
    expect(restored.standing).toBe('good');
    expect(run(restored, lapse('oversold')).standing).toBe('terminated');
  });
  it('a skill-path trainee is not terminated by a single oversold lapse', () => {
    const trained = run(agent(), lapse('skill'), lapse('skill'), lapse('skill'));
    expect(trained.finalWarning).toBe(false);
    expect(run(trained, lapse('oversold')).standing).toBe('training');
  });
  it('earn-back: 3 clean policies on Watch → Good standing', () => {
    const watch = run(agent(), lapse('skill'));
    const two = run(watch, clean(), clean());
    expect(two.standing).toBe('watch');
    expect(two.cleanStreak).toBe(2);
    expect(cardStatus(two)).toBe('Earn-back 2 of 3');
    const three = run(two, clean());
    expect(three.standing).toBe('good');
    expect(cardStatus(three)).toBe('Full advance');
  });
  it('an agent-caused lapse restarts earn-back progress', () => {
    const a = run(agent(), lapse('skill'), clean(), clean(), lapse('skill'));
    expect(a.cleanStreak).toBe(0);
    expect(a.standing).toBe('watch');
  });
  it('training resets the lapse count once only', () => {
    const trained = run(agent(), lapse('skill'), lapse('skill'), lapse('skill'));
    expect(trained.resetUsed).toBe(true);
    const restored = run(trained, clean(), clean(), clean());
    // Reaching 3 again does not give a second Training and reset: it terminates.
    const o = evaluateCase(run(restored, lapse('skill'), lapse('skill')), lapse('skill'));
    expect(o.resetApplied).toBe(false);
    expect(o.to.standing).toBe('terminated');
  });
  it('voluntary training: no penalty, full advance kept, slower recovery, count resets once', () => {
    const o = evaluateCase(agent(), lapse('oversold', { requestedTraining: true }));
    expect(o.to).toEqual({ standing: 'training', voluntary: true });
    expect(o.money.fee).toBe(0);
    expect(o.money.pace).toBe('slower');
    expect(o.resetApplied).toBe(true);
    expect(upfrontPerPolicy(o.to).amount).toBe(PROGRAM.fullAdvance);
  });
  it('voluntary training after a reset was used does not reset again', () => {
    const o = evaluateCase(agent({ resetUsed: true }), lapse('skill', { requestedTraining: true }));
    expect(o.to.voluntary).toBe(true);
    expect(o.resetApplied).toBe(false);
  });
  it('a terminated agent cannot take new cases', () => {
    expect(() => evaluateCase(agent({ standing: 'terminated' }), clean())).toThrow();
  });
});

describe('replacements', () => {
  const repl: Case = {
    id: 'r1', agentId: 'a', kind: 'replacement', date: 'today', title: '', summary: '',
    items: [{ oldPolicy: 'T-1', newPolicy: 'T-2', monthsInForce: 6, basis: 'full' }],
    evidence: { transcript: '', firstPayment: '', confidence: 80 },
  };
  it('is not a lapse: standing and lapse record do not change', () => {
    for (const standing of ['good', 'watch', 'training'] as const) {
      const a = agent({ standing, window: [{ policy: 'x', agentCaused: true, cause: 'skill' }], cleanStreak: 1 });
      const o = evaluateCase(a, repl);
      expect(o.to.standing).toBe(standing);
      expect(o.counts).toBe(false);
      expect(o.next.window).toEqual(a.window);
      expect(o.next.cleanStreak).toBe(1);
    }
  });
  it('recovers the old unearned advance; the new policy is on the reduced advance', () => {
    const o = evaluateCase(agent(), repl);
    expect(o.money.ownRecovered).toBe(5000);
    expect(o.events[0].note).toContain('Replacement rule applied');
    expect(o.events[0].note).toContain('₹2,500');
  });
});

describe('managers', () => {
  it('own sales follow the same rules; carry 50% of team debt at slower pace; keep role', () => {
    const m = agent({ manager: { team: 'Team', teamSize: 5 } });
    const o = evaluateCase(m, lapse('oversold', { teamDebt: 40000 }));
    expect(o.to.standing).toBe('watch');
    expect(o.money.teamShare).toBe(20000);
    const teamEvent = o.events.find((e) => e.kind === 'team-debt')!;
    expect(teamEvent.pace).toBe('slower');
    expect(o.notes).toContain('Keeps manager role.');
  });
});

describe('seed cases land as expected', () => {
  const agents = seedAgents();
  const cases = seedCases();
  const outcome = (id: string) => {
    const c = cases.find((x) => x.agentId === id)!;
    return evaluateCase(agents[id], c);
  };

  it('Priya: Training (voluntary), full advance, slower recovery, count resets once', () => {
    expect(agents.priya.standing).toBe('good');
    expect(windowCount(agents.priya.window)).toBe(1);
    const o = outcome('priya');
    expect(o.to).toEqual({ standing: 'training', voluntary: true });
    expect(upfrontPerPolicy(o.to).amount).toBe(10000);
    expect(o.money.pace).toBe('slower');
    expect(o.money.ownRecovered).toBe(8333);
    expect(o.notes).toContain('Lapse count resets after training (once).');
  });
  it('Marcus: Watch, unearned + 10% at normal pace, ₹2,500 advances, ₹20,000 team share, keeps role', () => {
    const o = outcome('marcus');
    expect(o.to.standing).toBe('watch');
    expect(o.money.fee).toBe(583);
    expect(o.money.ownRecovered).toBe(6416);
    expect(o.money.pace).toBe('normal');
    expect(upfrontPerPolicy(o.to).amount).toBe(2500);
    expect(o.money.teamShare).toBe(20000);
    expect(o.notes).toContain('Keeps manager role.');
  });
  it('Dana: Ethos fault, stays Good standing, nothing counts, Ethos absorbs', () => {
    const o = outcome('dana');
    expect(o.billingCheck.bugFound).toBe(true);
    expect(o.to.standing).toBe('good');
    expect(o.events.every((e) => !e.counts)).toBe(true);
    expect(o.money.absorbed).toBe(26667);
    expect(o.money.ownRecovered).toBe(0);
  });
  it('Leo: stays Good standing, replacement rule applied to all 3', () => {
    const o = outcome('leo');
    expect(o.to.standing).toBe('good');
    expect(o.events).toHaveLength(3);
    expect(o.events.every((e) => e.note.startsWith('Replacement rule applied'))).toBe(true);
    expect(o.money.ownRecovered).toBe(11667);
  });
  it('totals add up after all four are applied', () => {
    const after = Object.values(agents).map((a) => {
      const c = cases.find((x) => x.agentId === a.id)!;
      return applyOutcome(a, evaluateCase(a, c));
    });
    const t = totals(after);
    expect(t.absorbed).toBe(26667);
    expect(t.recovering).toBe(9167 + 5500 + 8333 + 6416 + 20000 + 11667);
  });
});
