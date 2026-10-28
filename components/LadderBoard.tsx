'use client';

import { LayoutGroup } from 'framer-motion';
import { STANDING_INFO, type Agent, type Case, type Standing } from '@/lib/rules';
import AgentCard from './AgentCard';
import { STANDING_DOT } from './ui';

const ORDER: Standing[] = ['good', 'watch', 'training', 'terminated'];

export default function LadderBoard({ agents, cases, onOpen }: { agents: Agent[]; cases: Case[]; onOpen: (id: string) => void }) {
  return (
    <LayoutGroup>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ORDER.map((st) => {
          const list = agents.filter((a) => a.standing === st);
          const info = STANDING_INFO[st];
          return (
            <section key={st} aria-label={info.label} className="flex min-w-0 lg:min-h-[180px] flex-col gap-2.5 rounded-2xl bg-sunken/70 p-2.5">
              <header className="relative flex flex-col gap-0.5 px-1.5 pb-1 pt-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${STANDING_DOT[st]}`} aria-hidden />
                  <h3 className="text-sm font-semibold">{info.label}</h3>
                  <span className="group relative">
                    <button
                      type="button"
                      aria-describedby={`tip-${st}`}
                      aria-label={`About ${info.label}`}
                      className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-line bg-surface text-[10px] font-bold text-muted"
                    >
                      i
                    </button>
                    <span
                      role="tooltip"
                      id={`tip-${st}`}
                      className="pointer-events-none absolute left-1/2 top-6 z-30 w-56 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-xs font-normal leading-snug text-bg opacity-0 shadow-lift transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
                    >
                      {info.tip}
                    </span>
                  </span>
                  <span className="num ml-auto rounded-full bg-surface px-2 text-xs text-muted" aria-label={`${list.length} agents`}>
                    {list.length}
                  </span>
                </div>
                <p className="text-xs text-muted">{info.terms}</p>
              </header>
              {list.map((a) => (
                <AgentCard key={a.id} agent={a} pending={cases.filter((c) => c.agentId === a.id).length} onOpen={() => onOpen(a.id)} />
              ))}
              {list.length === 0 && <p className="rounded-xl border border-dashed border-line px-3 py-5 text-center text-xs text-muted">No agents</p>}
            </section>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
