'use client';

import { useStore } from '@/lib/store';
import { SlideOver } from './ui';

export default function ActivityLog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const log = useStore((s) => s.log);
  return (
    <SlideOver open={open} onClose={onClose} labelledBy="log-title" width="max-w-sm" dim={false}>
      <div className="sticky top-0 flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <h2 id="log-title" className="text-base font-semibold">
          Activity log <span className="num text-xs font-normal text-muted">({log.length})</span>
        </h2>
        <button type="button" onClick={onClose} aria-label="Close activity log" className="rounded px-1.5 text-xl leading-none text-muted hover:text-ink">×</button>
      </div>
      <ol className="flex flex-col px-4 py-2">
        {log.map((l, i) => (
          <li key={l.id} className="grid grid-cols-[2rem_1fr] gap-2 border-b border-line py-2 text-[13px] last:border-0">
            <span className="num text-xs text-muted">{String(i + 1).padStart(2, '0')}</span>
            <span>{l.text}</span>
          </li>
        ))}
      </ol>
    </SlideOver>
  );
}
