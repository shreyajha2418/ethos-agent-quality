import type { Agent, Case } from '@/lib/rules';

/** Today's date in the demo. */
export const DEMO_TODAY = '28 Oct 2026';

export function seedAgents(): Record<string, Agent> {
  return {
    priya: {
      id: 'priya',
      name: 'Priya Raman',
      firstName: 'Priya',
      roleTag: 'New agent',
      profile: '6 weeks with Ethos',
      policies: 3,
      standing: 'good',
      voluntary: false,
      resetUsed: false,
      finalWarning: false,
      cleanStreak: 0,
      window: [
        { policy: 'P-1041', strike: false },
        { policy: 'P-1042', strike: true, cause: 'skill' },
      ],
      history: [
        {
          id: 'seed:P-1042',
          date: '07 Oct 2026',
          kind: 'lapse',
          policy: 'P-1042',
          tag: 'skill',
          strike: true,
          absorbed: 0,
          recovered: 9167,
          pace: 'slower',
          note: 'Lapsed in month 1.',
        },
      ],
      policyPrefix: 'P',
      nextPolicyNo: 1044,
    },
    marcus: {
      id: 'marcus',
      name: 'Marcus Okafor',
      firstName: 'Marcus',
      roleTag: 'Manager',
      profile: 'Summit team manager · 14 agents',
      policies: 58,
      standing: 'good',
      voluntary: false,
      resetUsed: false,
      finalWarning: false,
      cleanStreak: 0,
      window: [
        { policy: 'M-0412', strike: true, cause: 'oversold' },
        { policy: 'M-0455', strike: false },
        { policy: 'M-0501', strike: false },
        { policy: 'M-0546', strike: false },
      ],
      history: [
        {
          id: 'seed:M-0412',
          date: '14 Jun 2026',
          kind: 'lapse',
          policy: 'M-0412',
          tag: 'oversold',
          strike: true,
          absorbed: 0,
          recovered: 5000,
          pace: 'current',
          note: 'Own sale. Lapsed in month 6; earned back when the next 3 policies stayed clean.',
        },
      ],
      manager: { team: 'Summit team', teamSize: 14 },
      policyPrefix: 'M',
      nextPolicyNo: 590,
    },
    dana: {
      id: 'dana',
      name: 'Dana Whitfield',
      firstName: 'Dana',
      roleTag: 'Veteran',
      profile: '2 years · solid record',
      policies: 124,
      standing: 'good',
      voluntary: false,
      resetUsed: false,
      finalWarning: false,
      cleanStreak: 0,
      window: ['D-2190', 'D-2201', 'D-2213', 'D-2220', 'D-2228'].map((policy) => ({ policy, strike: false })),
      history: [],
      policyPrefix: 'D',
      nextPolicyNo: 2270,
    },
    leo: {
      id: 'leo',
      name: 'Leo Fernandes',
      firstName: 'Leo',
      roleTag: 'High volume',
      profile: 'Highest-volume agent',
      policies: 231,
      standing: 'good',
      voluntary: false,
      resetUsed: false,
      finalWarning: false,
      cleanStreak: 0,
      window: ['L-3380', 'L-3383', 'L-3385', 'L-3387', 'L-3388'].map((policy) => ({ policy, strike: false })),
      history: [],
      policyPrefix: 'L',
      nextPolicyNo: 3410,
    },
  };
}

export function seedCases(): Case[] {
  return [
    {
      id: 'case-priya',
      agentId: 'priya',
      kind: 'lapse',
      cause: 'skill',
      requestedTraining: true,
      date: '24 Oct 2026',
      title: '2nd lapse in 6 weeks',
      summary: 'P-1043 lapsed after 2 missed premiums. Priya has asked for training.',
      lapses: [{ policy: 'P-1043', monthsInForce: 2, basis: 'full' }],
      evidence: {
        transcript: 'Agent: “This gives your family ₹1 crore of cover.” Customer: “Is the monthly amount okay for us?” Agent: “Most families manage fine.”',
        firstPayment: 'Can you comfortably pay ₹2,850 a month? “I think so, we’ll see.”',
        confidence: 54,
      },
    },
    {
      id: 'case-marcus',
      agentId: 'marcus',
      kind: 'lapse',
      cause: 'oversold',
      teamDebt: 40_000,
      date: '22 Oct 2026',
      title: 'Another lapse on his own sale',
      summary: 'M-0587 lapsed in month 5. Summit team has ₹40,000 of new agent-caused debt.',
      lapses: [{ policy: 'M-0587', monthsInForce: 5, basis: 'full' }],
      evidence: {
        transcript: 'Agent: “Take the ₹2 crore plan, the smaller one won’t protect you.” Customer: “That’s more than we budgeted.”',
        firstPayment: '“It’s stretching us, but he said it was necessary.”',
        confidence: 31,
      },
    },
    {
      id: 'case-dana',
      agentId: 'dana',
      kind: 'lapse',
      cause: 'ethos',
      date: '25 Oct 2026',
      title: '4 lapses in the same 3 weeks',
      summary: 'D-2231, D-2240, D-2252 and D-2266 lapsed between 3 and 24 Oct.',
      billingFinding:
        'Charge date set to the 1st instead of the customer’s chosen 15th on 212 policies, 3–24 Oct. All 4 of Dana’s lapses fall in that window.',
      lapses: [
        { policy: 'D-2231', monthsInForce: 3, basis: 'full' },
        { policy: 'D-2240', monthsInForce: 4, basis: 'full' },
        { policy: 'D-2252', monthsInForce: 4, basis: 'full' },
        { policy: 'D-2266', monthsInForce: 5, basis: 'full' },
      ],
      evidence: {
        transcript: 'Billing log: “scheduled_charge_day = 1 (expected 15)” on all 4 policies; payments bounced before payday.',
        firstPayment: 'All 4 customers: “Yes, comfortably.”',
        confidence: 89,
        confidenceNote: 'average of 4',
      },
    },
    {
      id: 'case-leo',
      agentId: 'leo',
      kind: 'switch',
      date: '26 Oct 2026',
      title: '3 policy switches, no lapses',
      summary: '3 customers cancelled and bought replacement policies from Leo.',
      items: [
        { type: 'replacement', oldPolicy: 'L-3108', newPolicy: 'L-3390', monthsInForce: 6, basis: 'full' },
        { type: 'replacement', oldPolicy: 'L-3121', newPolicy: 'L-3394', monthsInForce: 7, basis: 'full' },
        { type: 'replacement', oldPolicy: 'L-3155', newPolicy: 'L-3402', monthsInForce: 9, basis: 'full' },
      ],
      evidence: {
        transcript: 'Customer: “I want a 30-year term instead.” Agent: “I can set that up; your current policy will be cancelled.”',
        firstPayment: 'All 3 new policies: “Yes, comfortably.”',
        confidence: 82,
        confidenceNote: 'average of 3',
      },
    },
  ];
}

/** Sample evidence for cases created from "Try it". */
export const SAMPLE_EVIDENCE: Record<string, Case['evidence']> = {
  ethos: {
    transcript: 'Billing log: charge date moved from the 15th to the 1st without the customer’s consent.',
    firstPayment: '“Yes, comfortably.”',
    confidence: 86,
  },
  nofault: {
    transcript: 'Agent called the customer on day 2 and day 9 after missed-payment alerts and offered lower cover.',
    firstPayment: '“Yes, comfortably” at sale; customer later lost their job.',
    confidence: 80,
  },
  skill: {
    transcript: 'Customer: “Will the premium fit with the school fees?” Agent: “It should be fine.”',
    firstPayment: '“Probably, if nothing changes.”',
    confidence: 52,
  },
  oversold: {
    transcript: 'Agent: “Go for the ₹2 crore plan, anything less is risky.” Customer: “That’s above what we planned.”',
    firstPayment: '“It’s more than we wanted, but the agent insisted.”',
    confidence: 34,
  },
  ignored: {
    transcript: 'System: check-in confidence dropped to 28; downgrade alert sent to the agent on day 3 and day 10. No follow-up logged.',
    firstPayment: '“Yes, comfortably” at sale.',
    confidence: 28,
  },
  inconclusive: {
    transcript: 'Call recording unavailable (customer opted out). Agent notes are brief.',
    firstPayment: '“I think so.”',
    confidence: 60,
  },
  replacement: {
    transcript: 'Customer: “I’d like a longer term instead.” Agent: “I can set that up; your current policy will be cancelled.”',
    firstPayment: '“Yes, comfortably” on the new policy.',
    confidence: 83,
  },
  downgrade: {
    transcript: 'System: check-in confidence fell to 35, downgrade alert sent. Agent called the customer the same day and moved them to a cheaper plan.',
    firstPayment: '“Yes, this one fits our budget.”',
    confidence: 35,
    confidenceNote: 'before the switch',
  },
  request: {
    transcript: 'Agent: “I’d like help with how I assess customers’ needs before I recommend cover.”',
    firstPayment: 'Not applicable: no policy involved.',
    confidence: 0,
  },
  clean: {
    transcript: 'Agent asked about income, dependants and monthly budget before recommending cover.',
    firstPayment: '“Yes, comfortably.”',
    confidence: 90,
  },
};
