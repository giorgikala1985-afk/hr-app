// Writes a row into the same per-tenant localStorage keys Orders.js's
// useLocalOrders hook uses, so quick-add modals (FloatingQuickAdd) show up
// in both the Orders.js tab lists and the Journal page exactly like an order
// created from the Orders page itself.
export function addLocalOrder(key, userId, row, createdBy) {
  const nsKey = `${key}_${userId || 'anon'}`;
  let existing = [];
  try { existing = JSON.parse(localStorage.getItem(nsKey)) || []; } catch {}
  const next = [{ id: Date.now(), createdAt: new Date().toISOString(), createdBy: createdBy || 'Unknown', ...row }, ...existing];
  localStorage.setItem(nsKey, JSON.stringify(next));
}
