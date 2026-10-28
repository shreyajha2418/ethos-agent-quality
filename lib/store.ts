'use client';

import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { DEMO_TODAY, SAMPLE_EVIDENCE, seedAgents, seedCases } from '@/data/seed';
import {
  CAUSE_INFO,
  advanceBasis,
  applyOutcome,
  evaluateCase,
  standingLabel,
  type Agent,
  type Case,
  type LapseCause,
  type Outcome,
} from './rules';

export interface LogEntry {
  id: number;
  text: string;
}

interface AppState {
  agents: Record<string, Agent>;
  cases: Case[];
  log: LogEntry[];
  seq: number;
  /** Applies a pending case and returns its outcome. */
  applyCase: (caseId: string) => Outcome | null;
  addTryCase: (agentId: string, kind: 'lapse' | 'clean' | 'replacement', cause?: LapseCause, requestedTraining?: boolean) => string | null;
  setCause: (caseId: string, cause: LapseCause) => void;
  addLog: (text: string) => void;
  reset: () => void;
}

function seedState() {
  return {
    agents: seedAgents(),
    cases: seedCases(),
    log: [{ id: 1, text: 'Demo loaded with 4 incoming cases.' }],
    seq: 2,
  };
}

/** localStorage that never throws (private windows, blocked storage). */
const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
  removeItem: (k) => {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...seedState(),

      applyCase: (caseId) => {
        const { cases, agents, log, seq } = get();
        const c = cases.find((x) => x.id === caseId);
        if (!c) return null;
        const a = agents[c.agentId];
        const o = evaluateCase(a, c);
        const next = applyOutcome(a, o);
        const lines: string[] = [];
        if (c.kind === 'replacement') {
          c.items.forEach((i) => lines.push(`Replacement rule applied for ${a.firstName}: ${i.oldPolicy} → ${i.newPolicy}`));
        }
        const moved = o.from.standing !== o.to.standing || o.from.voluntary !== o.to.voluntary;
        const why = CAUSE_INFO[o.tag].label;
        lines.push(
          moved
            ? `${a.firstName} moved ${standingLabel(o.from)} → ${standingLabel(o.to)} (${why})`
            : `${a.firstName} stays in ${standingLabel(o.to)} (${why})`,
        );
        set({
          agents: { ...agents, [a.id]: next },
          cases: cases.filter((x) => x.id !== caseId),
          log: log.concat(lines.map((text, i) => ({ id: seq + i, text }))),
          seq: seq + lines.length,
        });
        return o;
      },

      addTryCase: (agentId, kind, cause = 'skill', requestedTraining = false) => {
        const { agents, cases, seq, log } = get();
        const a = agents[agentId];
        if (!a || a.standing === 'terminated') return null;
        const basis = advanceBasis(a);
        if (basis === 'none') return null;
        let no = a.nextPolicyNo;
        const pol = () => `${a.policyPrefix}-${String(no++).padStart(4, '0')}`;
        const id = `try-${seq}`;
        let c: Case;
        let text: string;
        if (kind === 'lapse') {
          const p = pol();
          c = {
            id, agentId, kind, cause, requestedTraining, date: DEMO_TODAY, simulated: true,
            title: `New lapse on ${p}`,
            summary: `${p} lapsed in month 4.${requestedTraining ? ` ${a.firstName} asked for training.` : ''}`,
            lapses: [{ policy: p, monthsInForce: 4, basis }],
            evidence: SAMPLE_EVIDENCE[cause],
          };
          text = `Try it: lapse added for ${a.firstName} on ${p} (${CAUSE_INFO[cause].label})`;
        } else if (kind === 'clean') {
          const p = pol();
          c = {
            id, agentId, kind, policy: p, date: DEMO_TODAY, simulated: true,
            title: `Clean policy ${p}`, summary: `${p} is in force with premiums paid.`,
            evidence: SAMPLE_EVIDENCE.clean,
          };
          text = `Try it: clean policy added for ${a.firstName} (${p})`;
        } else {
          const oldP = pol();
          const newP = pol();
          c = {
            id, agentId, kind, date: DEMO_TODAY, simulated: true,
            title: `Replacement ${oldP} → ${newP}`, summary: `A customer cancelled ${oldP} and bought ${newP} from ${a.firstName}.`,
            items: [{ oldPolicy: oldP, newPolicy: newP, monthsInForce: 6, basis }],
            evidence: SAMPLE_EVIDENCE.replacement,
          };
          text = `Try it: replacement added for ${a.firstName} (${oldP} → ${newP})`;
        }
        set({
          agents: { ...agents, [agentId]: { ...a, nextPolicyNo: no } },
          cases: cases.concat(c),
          log: log.concat({ id: seq, text }),
          seq: seq + 1,
        });
        return id;
      },

      setCause: (caseId, cause) => {
        const { cases, agents, log, seq } = get();
        const c = cases.find((x) => x.id === caseId);
        if (!c || c.kind !== 'lapse' || c.cause === cause) return;
        set({
          cases: cases.map((x) => (x.id === caseId ? { ...c, cause } : x)),
          log: log.concat({
            id: seq,
            text: `Cause for ${agents[c.agentId].firstName}’s case changed: ${CAUSE_INFO[c.cause].label} → ${CAUSE_INFO[cause].label}`,
          }),
          seq: seq + 1,
        });
      },

      addLog: (text) => set((s) => ({ log: s.log.concat({ id: s.seq, text }), seq: s.seq + 1 })),

      reset: () => set(seedState()),
    }),
    {
      name: 'ethos-agent-quality-v1',
      storage: createJSONStorage(() => safeStorage),
      skipHydration: true,
      partialize: (s) => ({ agents: s.agents, cases: s.cases, log: s.log, seq: s.seq }),
    },
  ),
);
