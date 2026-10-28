'use client';

import { PROGRAM, STANDING_INFO, type LapseCause, type Standing } from '@/lib/rules';
import { CauseTag, Modal, StandingBadge } from './ui';

const LADDER: { s: Standing; meaning: string }[] = [
  { s: 'good', meaning: 'Clean record' },
  { s: 'watch', meaning: 'Had an agent-caused lapse' },
  { s: 'training', meaning: '3 agent-caused lapses in a rolling 5 policies, or voluntary' },
  { s: 'terminated', meaning: 'Repeat lapses after training' },
];

const CAUSES: { c: LapseCause; consequence: string; money: string; counts: string }[] = [
  { c: 'ethos', consequence: 'None', money: 'Ethos absorbs', counts: 'No' },
  { c: 'nofault', consequence: 'None', money: 'Ethos absorbs', counts: 'No' },
  { c: 'inconclusive', consequence: 'None', money: 'Unearned advance recovered as today', counts: 'No' },
  { c: 'skill', consequence: 'Watch + training', money: 'Unearned advance at slower pace (20% of each payout)', counts: 'Yes' },
  { c: 'oversold', consequence: 'Watch', money: 'Unearned advance + 10%, normal pace (50% of each payout)', counts: 'Yes' },
  { c: 'ignored', consequence: 'Watch', money: 'Unearned advance + 10%, normal pace', counts: 'Yes' },
];

export default function HowItWorks({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="How the program works"
      wide
      footer={<button type="button" className="btn btn-primary" onClick={onClose} data-autofocus>Got it</button>}
    >
      <div className="flex flex-col gap-4 pb-2">
        <p>
          Every lapse starts the same way: <strong>Ethos checks its own billing and payment systems first.</strong> The cause then decides the
          consequence, and an agent’s pay follows their standing.
        </p>

        <div>
          <p className="eyebrow mb-1.5">Standing ladder</p>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[520px] text-left text-[13px]">
              <thead className="bg-sunken text-xs text-muted">
                <tr><th className="px-3 py-2 font-semibold">Standing</th><th className="px-3 py-2 font-semibold">Meaning</th><th className="px-3 py-2 font-semibold">Upfront advance per new policy</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {LADDER.map((r) => (
                  <tr key={r.s}>
                    <td className="px-3 py-2"><StandingBadge s={{ standing: r.s, voluntary: false }} /></td>
                    <td className="px-3 py-2">{r.meaning}</td>
                    <td className="px-3 py-2">{STANDING_INFO[r.s].terms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <p className="eyebrow mb-1.5">Lapse causes</p>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead className="bg-sunken text-xs text-muted">
                <tr><th className="px-3 py-2 font-semibold">Cause</th><th className="px-3 py-2 font-semibold">Consequence</th><th className="px-3 py-2 font-semibold">Money</th><th className="px-3 py-2 font-semibold">Counts</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {CAUSES.map((r) => (
                  <tr key={r.c}>
                    <td className="px-3 py-2"><CauseTag tag={r.c} long /></td>
                    <td className="px-3 py-2">{r.consequence}</td>
                    <td className="px-3 py-2">{r.money}</td>
                    <td className="px-3 py-2">{r.counts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <p className="eyebrow mb-1.5">Movement</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Any agent-caused lapse → at least Watch.</li>
            <li>{PROGRAM.trainingTrigger} agent-caused lapses in any rolling {PROGRAM.rollingWindow} policies → Training. Training resets the lapse count once only.</li>
            <li>After training: {PROGRAM.trainingTrigger} more agent-caused lapses in a window → Termination. After training for overselling, one more oversold lapse → Termination.</li>
            <li>Earn-back: {PROGRAM.earnBackCleanPolicies} clean policies on Watch → Good standing.</li>
            <li>Voluntary training: no money penalty, full advance kept, slower recovery.</li>
            <li>Replacements (cancel and rebuy from the same agent) aren’t lapses. The old policy’s unearned advance is recovered; the new policy pays ₹2,500, then quarterly.</li>
            <li>Managers carry 50% of their team’s new agent-caused debt, share the team’s clean-policy bonus, and repay at the slower pace.</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
