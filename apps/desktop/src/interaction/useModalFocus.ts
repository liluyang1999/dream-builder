import { type RefObject, useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface ModalFocusOptions {
  open: boolean;
  dialogRef: RefObject<HTMLElement | null>;
  initialFocusRef: RefObject<HTMLElement | null>;
  onEscape?(): void;
  onQuestionMark?(): void;
}

/**
 * Keep keyboard focus inside an ARIA modal, restore the invoking control, and
 * route close keys to the modal instead of the global game shortcuts.
 */
export function useModalFocus({
  open,
  dialogRef,
  initialFocusRef,
  onEscape,
  onQuestionMark,
}: ModalFocusOptions): void {
  const escapeRef = useRef(onEscape);
  const questionMarkRef = useRef(onQuestionMark);
  escapeRef.current = onEscape;
  questionMarkRef.current = onQuestionMark;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    initialFocusRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog) return;

      if (event.key === 'Tab') {
        trapTabKey(event, dialog);
        return;
      }
      if (event.key === 'Escape' && escapeRef.current) {
        event.preventDefault();
        escapeRef.current();
        return;
      }
      if (
        (event.key === '?' || event.key === '/') &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        questionMarkRef.current
      ) {
        event.preventDefault();
        questionMarkRef.current();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open, dialogRef, initialFocusRef]);
}

function trapTabKey(event: KeyboardEvent, dialog: HTMLElement): void {
  const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true',
  );
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable.at(-1);
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !dialog.contains(active))) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
    event.preventDefault();
    first?.focus();
  }
}
