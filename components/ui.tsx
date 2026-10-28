'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { CAUSE_INFO, standingLabel, type EventTag, type StandingState } from '@/lib/rules';

/** Tailwind class for each cause colour (kept literal so Tailwind can see them). */
export const CAUSE_COLOR: Record<EventTag, { dot: string; chip: string }> = {
  ethos: { dot: 'bg-c-ethos', chip: 'bg-c-ethos/10 border-c-ethos/40' },
  nofault: { dot: 'bg-c-nofault', chip: 'bg-c-nofault/10 border-c-nofault/40' },
  skill: { dot: 'bg-c-skill', chip: 'bg-c-skill/10 border-c-skill/40' },
  oversold: { dot: 'bg-c-oversold', chip: 'bg-c-oversold/10 border-c-oversold/40' },
  ignored: { dot: 'bg-c-ignored', chip: 'bg-c-ignored/10 border-c-ignored/40' },
  inconclusive: { dot: 'bg-c-inconclusive', chip: 'bg-c-inconclusive/10 border-c-inconclusive/40' },
  replacement: { dot: 'bg-c-replacement', chip: 'bg-c-replacement/10 border-c-replacement/40' },
  clean: { dot: 'bg-c-clean', chip: 'bg-c-clean/10 border-c-clean/40' },
  team: { dot: 'bg-c-team', chip: 'bg-c-team/10 border-c-team/40' },
};

export const STANDING_COLOR = {
  good: 'text-good border-good/40 bg-good/10',
  watch: 'text-watch border-watch/40 bg-watch/10',
  training: 'text-training border-training/40 bg-training/10',
  terminated: 'text-terminated border-terminated/40 bg-terminated/10',
} as const;

export const STANDING_DOT = {
  good: 'bg-good',
  watch: 'bg-watch',
  training: 'bg-training',
  terminated: 'bg-terminated',
} as const;

export function CauseTag({ tag, long = false }: { tag: EventTag; long?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium text-ink ${CAUSE_COLOR[tag].chip}`}>
      <span className={`h-2 w-2 rounded-full ${CAUSE_COLOR[tag].dot}`} aria-hidden />
      {long ? CAUSE_INFO[tag].long : CAUSE_INFO[tag].label}
    </span>
  );
}

export function StandingBadge({ s }: { s: StandingState }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold ${STANDING_COLOR[s.standing]}`}>
      {standingLabel(s)}
    </span>
  );
}

/** Collapsible panel section. */
export function Disclosure({ title, meta, children, defaultOpen = false }: { title: string; meta?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="rounded-xl border border-line bg-surface">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-[15px] font-semibold"
        >
          <span className="flex items-center gap-2">
            {title}
            {meta && <span className="text-xs font-normal text-muted">{meta}</span>}
          </span>
          <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}>
            <path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-line px-4 py-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function useFocusTrap(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () =>
      Array.from(el?.querySelectorAll<HTMLElement>('button, select, input, textarea, [tabindex="0"]') ?? []).filter((x) => !x.hasAttribute('disabled'));
    const first = el?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0];
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Nested dialogs (a modal inside the panel) handle their own keys.
      e.stopPropagation();
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    el?.addEventListener('keydown', onKey);
    return () => {
      el?.removeEventListener('keydown', onKey);
      if (prev && document.contains(prev)) prev.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return ref;
}

export function Modal({ open, onClose, title, children, footer, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useFocusTrap(open, onClose);
  const titleId = useId();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={`flex max-h-[calc(100%-1rem)] w-full flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
          >
            <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-4">
              <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
              <button type="button" onClick={onClose} aria-label="Close" className="rounded px-1.5 text-xl leading-none text-muted hover:text-ink">×</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">{children}</div>
            {footer && <div className="flex flex-wrap justify-end gap-2 px-5 pb-5 pt-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function SlideOver({ open, onClose, labelledBy, children, width = 'max-w-[520px]', dim = true }: { open: boolean; onClose: () => void; labelledBy: string; children: ReactNode; width?: string; dim?: boolean }) {
  const ref = useFocusTrap(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            className={`fixed inset-0 z-40 ${dim ? 'bg-black/25' : 'bg-black/10'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            key="panel"
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className={`fixed inset-y-0 right-0 z-50 flex w-full ${width} flex-col overflow-y-auto bg-bg shadow-2xl`}
          >
            {children}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
