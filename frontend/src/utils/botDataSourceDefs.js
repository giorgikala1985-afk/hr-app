// Same set + labels as FinBotsPage.js's DATA_SOURCE_DEFS (the web FinBots
// per-bot data-source picker) — used by the Telegram/WhatsApp settings pages'
// "what can the bot see" control center so wording stays consistent across
// every place a Finpilot chat channel's data access is configured.
export const BOT_DATA_SOURCE_DEFS = [
  { key: 'employees', label: 'Employees', desc: 'Names, positions, salaries, start dates', color: '#3b82f6' },
  { key: 'salaries', label: 'Salary Changes', desc: 'Salary history and changes per employee', color: '#479c73' },
  { key: 'bonuses', label: 'Bonuses', desc: 'Bonus payments and dates', color: '#f59e0b' },
  { key: 'insurance', label: 'Insurance', desc: 'Insurance records and amounts', color: '#8b5cf6' },
  { key: 'fitpass', label: 'FitPass / Gym', desc: 'Gym membership records', color: '#ec4899' },
  { key: 'accounting', label: 'Finances', desc: 'Purchase and expense records', color: '#06b6d4' },
  { key: 'sales', label: 'Sales Database', desc: 'Sales revenue and transaction records', color: '#14b8a6' },
  { key: 'stock', label: 'Stock / Inventory', desc: 'Read inventory, movements, and stock prices', color: '#d946ef' },
  { key: 'holidays', label: 'Holidays', desc: 'Public holiday calendar', color: '#f97316' },
  { key: 'coagents', label: 'Coagents Database', desc: 'Coagent and client contact information and details', color: '#6366f1' },
];
