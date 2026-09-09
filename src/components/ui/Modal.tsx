import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { Button, cx, IconButton } from '@/components/ui/primitives';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open, onClose, title, description, children, footer, size = 'md', initialFocus,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  initialFocus?: React.RefObject<HTMLElement>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const trap = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter((n) => n.offsetParent !== null || n === document.activeElement);
    if (nodes.length === 0) { e.preventDefault(); return; }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', trap, true);
    const t = window.setTimeout(() => {
      const target = initialFocus?.current
        ?? panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)
        ?? panelRef.current;
      target?.focus();
    }, 20);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', trap, true);
      window.clearTimeout(t);
      restoreRef.current?.focus?.();
    };
  }, [open, trap, initialFocus]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-[#1B2430]/45 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(
          'relative flex max-h-[92vh] w-full flex-col overflow-hidden bg-surface shadow-pop animate-scale-in',
          'rounded-t-2xl sm:rounded-card',
          widths,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-tight text-indigo">{title}</h2>
            {description ? <div className="mt-1 text-[13px] leading-relaxed text-ink-muted">{description}</div> : null}
          </div>
          <IconButton label="Close dialog" icon={X} onClick={onClose} className="-mr-1.5 -mt-1" />
        </div>
        {children ? <div className="rw-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div> : null}
        {footer ? (
          <div className="flex flex-col-reverse gap-2 border-t border-line bg-canvas px-5 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/**
 * The confirmation every state-changing action goes through. The primary button
 * stays disabled until the input is valid — nothing here saves on blur.
 */
export function ConfirmDialog({
  open, onClose, onConfirm, title, description, confirmLabel = 'Confirm',
  tone = 'primary', disabled, children, busyLabel,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  tone?: 'primary' | 'danger';
  disabled?: boolean;
  children?: React.ReactNode;
  busyLabel?: string;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={disabled}
          >
            {busyLabel ?? confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

/** Deleting names what will be lost, and asks again. */
export function DeleteDialog({
  open, onClose, onConfirm, title, whatIsLost, confirmLabel = 'Delete',
}: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; whatIsLost: React.ReactNode; confirmLabel?: string;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Keep it</Button>
          <Button variant="danger" onClick={onConfirm} icon={AlertTriangle}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="rounded-lg border border-danger/20 bg-danger-bg p-4 text-[13px] leading-relaxed text-danger">
        <p className="font-semibold">This cannot be undone. You will lose:</p>
        <div className="mt-2">{whatIsLost}</div>
      </div>
    </Modal>
  );
}
