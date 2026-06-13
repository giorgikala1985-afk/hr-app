// Client-side store for which FinBots are pinned as floating chat widgets.
// Kept in localStorage so it works without backend/DB schema changes.
export const FLOATING_KEY = 'finpilot_floating_bots';
export const FLOATING_EVENT = 'finpilot_floating_changed';

export function loadFloatingIds() {
  try { return JSON.parse(localStorage.getItem(FLOATING_KEY)) || []; } catch { return []; }
}

export function isFloating(id) {
  return !!id && loadFloatingIds().includes(id);
}

export function setFloating(id, on) {
  if (!id) return;
  const ids = loadFloatingIds().filter(x => x !== id);
  if (on) ids.push(id);
  try { localStorage.setItem(FLOATING_KEY, JSON.stringify(ids)); } catch {}
  window.dispatchEvent(new Event(FLOATING_EVENT));
}
