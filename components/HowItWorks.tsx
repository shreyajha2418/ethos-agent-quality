'use client';

import { KEY_RULE, STANDING_INFO, type LapseCause, type Standing } from '@/lib/rules';
import { CauseTag, Modal, StandingBadge } from './ui';

const LADDER: Standing[] = ['good', 'watch', 'training', 'terminated'];

const CAUSES: { c: LapseCause; agent: string; repay: string; strike: string }[] = [
  { c: 'ethos', agent: 'Nothing; Ethos fixes the bug', repay: 'Ethos absorbs', strike: 'No' },
  { c: 'nofault', agent: 'Nothing', repay: 'Ethos absorbs', strike: 'No' },
  { c: 'skill', agent: 'Moved to Watch + offered training', repay: 'Slower pace (20% of each payout)', strike: 'Yes' },
  { c: 'oversold', agent: 'Moved to Watch', repay: 'Current pace (50% of each payout)', strike: 'Yes' },
  { c: 'ignored', agent: 'Moved to Watch', repay: 'Current pace', strike: 'Yes' },
  { c: 'inconclusive', agent: 'Nothing', repay: 'Current pace, as Ethos does today', strike: 'No' },
];

const th = 'px-3 py-2 font-semibold';
const td = 'px-3 py-2 align-top';

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
          Ethos penalises agents only for lapses they cause, and gives risky agents smaller advances until they prove themselves. Every lapse first
          goes through an <strong>Ethos billing and payment check</strong>.
        </p>

        <div>
          <p className="eyebrow mb-1.5">The standing ladder</p>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead className="bg-sunken text-xs text-muted">
                <tr><th className={th}>Standing</th><th className={th}>Who is here</th><th className={th}>Upfront advance per new policy</th><th className={th}>Way up</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {LADDER.map((s) => (
                  <tr key={s}>
                    <td className={td}><StandingBadge s={{ standing: s, voluntary: false }} /></td>
                    <td className={td}>{STANDING_INFO[s].who}</td>
                    <td className={td}>{STANDING_INFO[s].advance}</td>
                    <td className={td}>{STANDING_INFO[s].wayUp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <p className="eyebrow mb-1.5">What happens per lapse</p>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead className="bg-sunken text-xs text-muted">
                <tr><th className={th}>Cause</th><th className={th}>What happens to the agent</th><th className={th}>Repaying the unearned advance</th><th className={th}>Strike?</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {CAUSES.map((r) => (
                  <tr key={r.c}>
                    <td className={td}><CauseTag tag={r.c} long /></td>
                    <td className={td}>{r.agent}</td>
                    <td className={td}>{r.repay}</td>
                    <td className={td}>{r.strike}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 rounded-lg bg-accent/10 px-3 py-2 font-medium text-ink">{KEY_RULE}</p>
        </div>

        <div>
          <p className="eyebrow mb-1.5">Rules</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Movement:</strong> one strike → Watch; 3 strikes in any 5 policies → Training (the strike count resets once); after training, 3 more
              strikes, or one more oversold lapse, → Termination. The next 3 policies in a row staying clean → back to the full advance, and a new lapse
              resets that count. Any agent can ask for training: no penalty, full advance kept, debt repaid at the slower pace.
            </li>
            <li>
              <strong>Policy switches:</strong> moving a struggling customer to a cheaper policy, or a cancel-and-rebuy with the same agent, recovers the
              old policy’s unearned advance at the current pace; the new policy pays only ₹2,500 (3 months), then quarterly. No strike, no change of
              stage. Ignoring a downgrade alert that ends in a lapse counts as “agent ignored warning signs”.
            </li>
            <li>
              <strong>Managers:</strong> own sales follow the same rules. They carry 50% of their team’s new agent-caused debt, repaid at the slower pace,
              and earn a share of the team’s bonus for policies customers keep paying.
            </li>
            <li>
              <strong>Good agents:</strong> bonuses reward policies customers keep paying, never volume.
            </li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
