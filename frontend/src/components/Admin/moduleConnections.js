// The "Connections" view's data model — unlike moduleMap.js (a strict
// navigation hierarchy), this is a real graph: nodes can connect to ANY other
// node, not just a parent/child. Add a future connection by adding one node
// (if it's new) and one edge — { source, target, label? } — no layout math
// required beyond picking a `col`/`row` for a brand new node (see COLS below).
//
// Columns read left-to-right as a rough data-flow order:
//   0 Channels (where a user/bot triggers something)
//   1 Shared brain (the one thing all three bot channels run through)
//   2 Actions (what gets triggered)
//   3 Entities (what gets written to the database)
//   4 Downstream (what later reads/displays/uses that data)
export const CONNECTION_COLS = [0, 300, 620, 940, 1260];

export const CONNECTION_NODES = [
  // Column 0 — Channels
  { id: 'ch-orders', label: 'Orders Page (web)', type: 'channel', col: 0, row: 0 },
  { id: 'ch-quickadd', label: 'Quick-Add Modal (+)', type: 'channel', col: 0, row: 1 },
  { id: 'ch-finbot-web', label: 'FinBot Web Chat', type: 'channel', col: 0, row: 2 },
  { id: 'ch-telegram', label: 'Telegram Bot', type: 'channel', col: 0, row: 3 },
  { id: 'ch-whatsapp', label: 'WhatsApp Bot', type: 'channel', col: 0, row: 4 },

  // Column 1 — shared brain
  { id: 'brain-finbot', label: 'FinBot Chat Brain\n(finbotChat.js)', type: 'brain', col: 1, row: 2 },

  // Column 2 — Actions
  { id: 'act-hire', label: 'Hire', type: 'action', col: 2, row: 0 },
  { id: 'act-fire', label: 'Fire', type: 'action', col: 2, row: 1 },
  { id: 'act-promote', label: 'Promote', type: 'action', col: 2, row: 2 },
  { id: 'act-adjust', label: 'Adjust\n(Bonus/Deduction)', type: 'action', col: 2, row: 3 },
  { id: 'act-transfer', label: 'Transfer', type: 'action', col: 2, row: 4 },
  { id: 'act-advance', label: 'Advance Payment\n(web only)', type: 'action', col: 2, row: 5 },

  // Column 3 — Entities (what gets written)
  { id: 'ent-employees', label: 'Employees\n(table)', type: 'entity', col: 3, row: 0 },
  { id: 'ent-salary-changes', label: 'Salary Changes\n(table)', type: 'entity', col: 3, row: 1 },
  { id: 'ent-units', label: 'Employee Units\n(bonus/deduction/OT)', type: 'entity', col: 3, row: 2.5 },
  { id: 'ent-transfers', label: 'Accounting Transfers\n(table)', type: 'entity', col: 3, row: 4 },
  { id: 'ent-order-log', label: 'Order Log\n(bot-only events)', type: 'entity', col: 3, row: 5.3 },
  { id: 'ent-bookkeeping', label: 'Bookkeeping Entries\n(auto-post)', type: 'entity', col: 3, row: 6.4 },

  // Column 4 — Downstream consumers
  { id: 'down-journal', label: 'Journal Page', type: 'downstream', col: 4, row: 0.5 },
  { id: 'down-payroll', label: 'Salary Accrual\n(Payroll)', type: 'downstream', col: 4, row: 2.2 },
  { id: 'down-tbc', label: 'TBC Banking\n(salary payments)', type: 'downstream', col: 4, row: 3.3 },
  { id: 'down-notifications', label: 'Notifications', type: 'downstream', col: 4, row: 4.4 },
];

export const CONNECTION_EDGES = [
  // Channels → Actions (direct, web-side)
  { source: 'ch-orders', target: 'act-hire' },
  { source: 'ch-orders', target: 'act-fire' },
  { source: 'ch-orders', target: 'act-promote' },
  { source: 'ch-orders', target: 'act-adjust' },
  { source: 'ch-orders', target: 'act-transfer' },
  { source: 'ch-orders', target: 'act-advance' },
  { source: 'ch-quickadd', target: 'act-hire' },
  { source: 'ch-quickadd', target: 'act-fire' },
  { source: 'ch-quickadd', target: 'act-promote' },
  { source: 'ch-quickadd', target: 'act-adjust' },
  { source: 'ch-quickadd', target: 'act-transfer' },

  // Bot channels → shared brain → Actions
  { source: 'ch-finbot-web', target: 'brain-finbot' },
  { source: 'ch-telegram', target: 'brain-finbot' },
  { source: 'ch-whatsapp', target: 'brain-finbot' },
  { source: 'brain-finbot', target: 'act-hire', label: 'suggests' },
  { source: 'brain-finbot', target: 'act-fire', label: 'suggests' },
  { source: 'brain-finbot', target: 'act-promote', label: 'suggests' },
  { source: 'brain-finbot', target: 'act-adjust', label: 'suggests' },
  { source: 'brain-finbot', target: 'act-transfer', label: 'suggests' },

  // Actions → Entities (what each action writes)
  { source: 'act-hire', target: 'ent-employees', label: 'creates' },
  { source: 'act-hire', target: 'ent-bookkeeping', label: 'auto-posts' },
  { source: 'act-fire', target: 'ent-employees', label: 'sets end_date' },
  { source: 'act-promote', target: 'ent-employees', label: 'updates position' },
  { source: 'act-promote', target: 'ent-salary-changes', label: 'creates' },
  { source: 'act-adjust', target: 'ent-units', label: 'creates' },
  { source: 'act-advance', target: 'ent-units', label: 'creates (looped)' },
  { source: 'act-advance', target: 'ent-transfers', label: 'creates payout' },
  { source: 'act-transfer', target: 'ent-transfers', label: 'creates' },

  // Bot-only visibility bridge
  { source: 'act-hire', target: 'ent-order-log', label: 'bot channel only' },
  { source: 'act-fire', target: 'ent-order-log', label: 'bot channel only' },
  { source: 'act-promote', target: 'ent-order-log', label: 'bot channel only' },

  // Entities → Downstream
  { source: 'ent-order-log', target: 'down-journal' },
  { source: 'ent-units', target: 'down-journal', label: 'Adjustment rows' },
  { source: 'ent-employees', target: 'down-payroll' },
  { source: 'ent-units', target: 'down-payroll', label: 'net salary +/-' },
  { source: 'down-payroll', target: 'down-tbc', label: 'salary batch' },
  { source: 'ent-transfers', target: 'down-notifications', label: 'notifies approvers' },
];
