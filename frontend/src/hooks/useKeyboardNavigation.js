import { useEffect, useRef } from 'react';

const selector = 'input:not([type="hidden"]), select, textarea, button, a[href], [tabindex="0"]';
const visible = element => !element.matches(':disabled') && element.getAttribute('aria-disabled') !== 'true' && element.getClientRects().length > 0;
const controls = root => [...root.querySelectorAll(selector)].filter(visible);
const focus = element => { element?.focus(); element?.scrollIntoView({ block: 'nearest' }); };

export default function useKeyboardNavigation() {
  useEffect(() => {
    function prepareRows() {
      document.querySelectorAll('tbody tr:not([tabindex])').forEach(row => {
        row.tabIndex = 0;
        row.classList.add('focus-visible:outline', 'focus-visible:outline-2', 'focus-visible:outline-red-500');
      });
    }
    prepareRows();
    const observer = new MutationObserver(prepareRows);
    observer.observe(document.body, { childList: true, subtree: true });
    function handle(event) {
      if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const dialog = target.closest('[role="dialog"]');
      // Keep the counter and inventory's existing navigation.
      if (!dialog && ['/sales', '/admin'].includes(window.location.pathname) && !event.altKey) return;
      const root = dialog || document.querySelector('main') || document.body;
      if (event.altKey && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
        const items = controls(root);
        const current = items.indexOf(target);
        const next = current + (event.key === 'ArrowDown' ? 1 : -1);
        event.preventDefault(); focus(items[Math.max(0, Math.min(items.length - 1, next))]); return;
      }
      if (event.altKey) return;
      const list = target.closest('[role="listbox"]') || (target.tagName === 'INPUT' ? document.getElementById(target.getAttribute('aria-controls')) || target.parentElement.querySelector('[role="listbox"]') : null);
      if (list && ['ArrowDown', 'ArrowUp', 'Escape'].includes(event.key)) {
        const options = controls(list);
        if (event.key === 'Escape') { event.preventDefault(); focus(list.parentElement.querySelector('input')); return; }
        if (!options.length) return;
        const index = options.indexOf(target);
        const next = index < 0 ? (event.key === 'ArrowDown' ? 0 : options.length - 1) : Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
        event.preventDefault(); focus(options[next]); return;
      }
      const row = target.closest('tbody tr');
      if (row && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(event.key) && !target.matches('input,textarea,select') && !target.isContentEditable) {
        const rows = [...row.parentElement.querySelectorAll('tr')].filter(visible);
        const index = rows.indexOf(row);
        if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
          const nextRow = rows[Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))];
          const column = controls(row).indexOf(target);
          const actions = controls(nextRow);
          if (!actions.length) nextRow.tabIndex = 0;
          event.preventDefault(); focus(actions[Math.max(0, Math.min(actions.length - 1, column))] || nextRow);
        } else if (event.key === 'Enter' && target === row) {
          event.preventDefault(); focus(controls(row)[0]);
        } else if (event.key !== 'Enter') {
          const actions = controls(row);
          const index = actions.indexOf(target);
          event.preventDefault(); focus(actions[Math.max(0, Math.min(actions.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)))]);
        }
        return;
      }
      if (event.key === 'Enter' && target.tagName === 'INPUT' && !['checkbox', 'radio', 'submit', 'button'].includes(target.type)) {
        const form = target.closest('form');
        if (!form) return;
        const fields = controls(form).filter(element => element.matches('input:not([type="checkbox"]):not([type="radio"]),select,textarea'));
        const next = fields[fields.indexOf(target) + 1];
        if (next) { event.preventDefault(); focus(next); }
      }
    }
    window.addEventListener('keydown', handle);
    return () => { observer.disconnect(); window.removeEventListener('keydown', handle); };
  }, []);
}

export function useDialogKeyboard(ref, onClose, busy = false) {
  const latest = useRef({ onClose, busy });
  latest.current = { onClose, busy };
  useEffect(() => {
    const previous = document.activeElement;
    const panel = ref.current;
    if (!panel) return;
    focus(controls(panel)[0]);
    function handle(event) {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation();
        if (!latest.current.busy) latest.current.onClose?.();
      }
      if (event.key === 'Tab') {
        const items = controls(panel);
        const first = items[0]; const last = items[items.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    }
    panel.addEventListener('keydown', handle);
    return () => { panel.removeEventListener('keydown', handle); if (previous?.isConnected) previous.focus(); };
  }, [ref]);
}
