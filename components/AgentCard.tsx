'use client';

import { motion } from 'framer-motion';
import { cardStatus, type Agent } from '@/lib/rules';
import { STANDING_DOT } from './ui';

export default function AgentCard({ agent, pending, onOpen }: { agent: Agent; pending: number; onOpen: () => void }) {
  return (
    <motion.button
      type="button"
      layoutId={`card-${agent.id}`}
      layout
      transition={{ type: 'spring', stiffness: 170, damping: 24 }}
      whileHover={{ y: -2 }}
      onClick={onOpen}
      aria-label={`${agent.name}, ${agent.roleTag}. ${cardStatus(agent)}.${pending ? ` ${pending} case to review.` : ''} Open details`}
      className="flex w-full flex-col gap-1 rounded-xl border border-line bg-surface px-3.5 py-3 text-left shadow-card transition-shadow hover:border-accent/50 hover:shadow-lift"
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[15px] font-semibold">{agent.name}</span>
        <span className="shrink-0 rounded border border-line px-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted">{agent.roleTag}</span>
      </span>
      <span className="flex items-center gap-2 text-[13px] text-muted">
        <span className={`h-2 w-2 rounded-full ${STANDING_DOT[agent.standing]}`} aria-hidden />
        {cardStatus(agent)}
      </span>
      {pending > 0 && (
        <span className="flex items-center gap-2 text-[13px] font-medium text-accent">
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          {pending} case{pending > 1 ? 's' : ''} to review
        </span>
      )}
    </motion.button>
  );
}
