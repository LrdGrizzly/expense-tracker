const APP_VERSION = "1.0.0";
const DB_NAME = "household-expense-tracker";
const DB_VERSION = 1;
const STORE = "kv";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

const GROUPS = [
  { id: "housing", name: "Housing", color: "#2563eb", icon: "H", discretionary: false },
  { id: "utilities", name: "Utilities", color: "#0891b2", icon: "U", discretionary: false },
  { id: "groceries", name: "Groceries", color: "#16a34a", icon: "G", discretionary: false },
  { id: "transport", name: "Transport", color: "#7c3aed", icon: "T", discretionary: false },
  { id: "eating-out", name: "Eating Out", color: "#f97316", icon: "E", discretionary: true },
  { id: "shopping", name: "Shopping", color: "#db2777", icon: "S", discretionary: true },
  { id: "health", name: "Health", color: "#0d9488", icon: "M", discretionary: false },
  { id: "family", name: "Children/Family", color: "#ca8a04", icon: "F", discretionary: false },
  { id: "travel", name: "Travel", color: "#ea580c", icon: "V", discretionary: true },
  { id: "entertainment", name: "Entertainment", color: "#9333ea", icon: "P", discretionary: true },
  { id: "subscriptions", name: "Subscriptions", color: "#475569", icon: "R", discretionary: true },
  { id: "income", name: "Income", color: "#22c55e", icon: "I", discretionary: false },
  { id: "transfers", name: "Transfers", color: "#64748b", icon: "X", discretionary: false },
  { id: "other", name: "Other", color: "#94a3b8", icon: "O", discretionary: true }
];

const CATEGORIES = [
  ["rent", "Rent/Mortgage", "housing"],
  ["insurance-home", "Home Insurance", "housing"],
  ["repairs", "Repairs", "housing"],
  ["electricity", "Electricity", "utilities"],
  ["gas", "Gas", "utilities"],
  ["water", "Water", "utilities"],
  ["internet", "Internet", "utilities"],
  ["mobile-phone", "Mobile Phone", "utilities"],
  ["groceries", "Groceries", "groceries"],
  ["household-goods", "Household Goods", "groceries"],
  ["fuel", "Fuel", "transport"],
  ["public-transport", "Public Transport", "transport"],
  ["parking", "Parking", "transport"],
  ["car-maintenance", "Car Maintenance", "transport"],
  ["restaurants", "Restaurants", "eating-out"],
  ["coffee", "Coffee/Snacks", "eating-out"],
  ["clothing", "Clothing", "shopping"],
  ["general-shopping", "General Shopping", "shopping"],
  ["pharmacy", "Pharmacy", "health"],
  ["doctor", "Doctor", "health"],
  ["school", "School/Childcare", "family"],
  ["family-activities", "Family Activities", "family"],
  ["hotels", "Hotels", "travel"],
  ["flights", "Flights", "travel"],
  ["streaming", "Streaming", "subscriptions"],
  ["software", "Software", "subscriptions"],
  ["games", "Games/Events", "entertainment"],
  ["salary", "Salary", "income"],
  ["refunds", "Refunds", "income"],
  ["transfers", "Transfers", "transfers"],
  ["uncategorised", "Uncategorised", "other"]
].map(([id, name, groupId]) => ({ id, name, groupId, active: true }));

const KEYWORDS = [
  ["rent", "rent"], ["mortgage", "rent"], ["landlord", "rent"],
  ["electric", "electricity"], ["energia", "electricity"], ["power", "electricity"],
  ["gas", "gas"], ["water", "water"], ["internet", "internet"], ["broadband", "internet"],
  ["vodafone", "mobile-phone"], ["tim", "mobile-phone"], ["iliad", "mobile-phone"],
  ["supermarket", "groceries"], ["grocery", "groceries"], ["aldi", "groceries"], ["lidl", "groceries"],
  ["tesco", "groceries"], ["carrefour", "groceries"], ["esselunga", "groceries"], ["conad", "groceries"],
  ["fuel", "fuel"], ["shell", "fuel"], ["eni", "fuel"], ["esso", "fuel"], ["parking", "parking"],
  ["uber", "public-transport"], ["train", "public-transport"], ["metro", "public-transport"],
  ["restaurant", "restaurants"], ["mcdonald", "restaurants"], ["deliveroo", "restaurants"],
  ["just eat", "restaurants"], ["coffee", "coffee"], ["starbucks", "coffee"],
  ["amazon", "general-shopping"], ["zara", "clothing"], ["hm", "clothing"],
  ["pharmacy", "pharmacy"], ["farmacia", "pharmacy"], ["doctor", "doctor"],
  ["netflix", "streaming"], ["spotify", "streaming"], ["disney", "streaming"], ["prime video", "streaming"],
  ["apple.com/bill", "software"], ["google", "software"], ["microsoft", "software"],
  ["salary", "salary"], ["payroll", "salary"], ["refund", "refunds"], ["transfer", "transfers"]
];

const DEFAULT_STATE = {
  version: APP_VERSION,
  deviceId: "",
  activeTab: "dashboard",
  transactions: [],
  categoryGroups: GROUPS,
  categories: CATEGORIES,
  accounts: [
    { id: "main-bank", name: "Main Bank", type: "checking", institution: "", active: true },
    { id: "credit-card", name: "Credit Card", type: "card", institution: "", active: true },
    { id: "cash", name: "Cash", type: "cash", institution: "", active: true }
  ],
  budgets: [],
  csvMappings: [],
  classificationRules: [],
  importBatches: [],
  appliedChangeIds: [],
  pendingChanges: [],
  settings: {
    currency: "EUR",
    locale: "en-GB",
    googleClientId: "",
    autoSyncEnabled: true,
    autoSyncIntervalMinutes: 3,
    rememberSyncPassword: false,
    storedSyncPassword: "",
    lastSyncAt: "",
    lastAutoSyncAt: "",
    lastSyncError: "",
    lastSnapshotAt: "",
    driveFolderId: "",
    changesFolderId: "",
    snapshotsFolderId: ""
  }
};

let db;
let state = structuredClone(DEFAULT_STATE);
let accessToken = "";
let encryptionPassword = "";
let tokenClient = null;
let importPreview = null;
let chartFilter = null;
let isSyncing = false;
let autoSyncTimer = null;
let autoSyncQueued = false;
let lastAutoSyncMs = 0;

const $ = (selector) => document.querySelector(selector);
const app = $("#app");

function uid(prefix = "id") {
  const part = crypto.getRandomValues(new Uint32Array(2));
  return `${prefix}-${Date.now().toString(36)}-${part[0].toString(36)}${part[1].toString(36)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(date = new Date()) {
  const value = typeof date === "string" ? new Date(`${date}T12:00:00`) : date;
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function money(value) {
  return new Intl.NumberFormat(state.settings.locale || "en-GB", {
    style: "currency",
    currency: state.settings.currency || "EUR"
  }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbGet(key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbSet(key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function saveState() {
  await dbSet("state", state);
}

function ensureDefaults(loaded) {
  const merged = structuredClone(DEFAULT_STATE);
  Object.assign(merged, loaded || {});
  merged.settings = { ...DEFAULT_STATE.settings, ...(loaded?.settings || {}) };
  merged.deviceId ||= uid("device");
  merged.categoryGroups = loaded?.categoryGroups?.length ? loaded.categoryGroups : GROUPS;
  merged.categories = loaded?.categories?.length ? loaded.categories : CATEGORIES;
  if (merged.settings.rememberSyncPassword && merged.settings.storedSyncPassword) {
    encryptionPassword = merged.settings.storedSyncPassword;
  }
  return merged;
}

function groupForCategory(categoryId) {
  const category = state.categories.find((item) => item.id === categoryId) || state.categories.find((item) => item.id === "uncategorised");
  return state.categoryGroups.find((item) => item.id === category?.groupId) || state.categoryGroups.find((item) => item.id === "other");
}

function categoryName(categoryId) {
  return state.categories.find((item) => item.id === categoryId)?.name || "Uncategorised";
}

function accountName(accountId) {
  return state.accounts.find((item) => item.id === accountId)?.name || "No account";
}

function transactionAmount(tx) {
  const amount = Math.abs(Number(tx.amount || 0));
  return tx.direction === "income" ? amount : -amount;
}

function expenseValue(tx) {
  return tx.direction === "expense" && !tx.deletedAt ? Math.abs(Number(tx.amount || 0)) : 0;
}

function monthTransactions(key = monthKey()) {
  return state.transactions.filter((tx) => !tx.deletedAt && tx.date?.startsWith(key));
}

function applyOperation(op) {
  if (op.type === "upsertTransaction") {
    const index = state.transactions.findIndex((item) => item.id === op.record.id);
    if (index >= 0) {
      const current = state.transactions[index];
      if ((op.record.updatedAt || "") >= (current.updatedAt || "")) state.transactions[index] = { ...current, ...op.record };
    } else {
      state.transactions.push(op.record);
    }
  }
  if (op.type === "softDeleteTransaction") {
    const item = state.transactions.find((tx) => tx.id === op.id);
    if (item) item.deletedAt = op.deletedAt;
  }
  if (op.type === "upsertBudget") {
    const index = state.budgets.findIndex((item) => item.id === op.record.id);
    if (index >= 0) state.budgets[index] = op.record;
    else state.budgets.push(op.record);
  }
  if (op.type === "upsertRule") {
    const index = state.classificationRules.findIndex((item) => item.id === op.record.id);
    if (index >= 0) state.classificationRules[index] = op.record;
    else state.classificationRules.push(op.record);
  }
  if (op.type === "upsertCsvMapping") {
    const index = state.csvMappings.findIndex((item) => item.id === op.record.id);
    if (index >= 0) state.csvMappings[index] = op.record;
    else state.csvMappings.push(op.record);
  }
  if (op.type === "upsertImportBatch") {
    const index = state.importBatches.findIndex((item) => item.id === op.record.id);
    if (index >= 0) state.importBatches[index] = op.record;
    else state.importBatches.push(op.record);
  }
}

async function recordChange(operations, source = "local") {
  const change = {
    id: uid("change"),
    deviceId: state.deviceId,
    createdAt: new Date().toISOString(),
    source,
    operations
  };
  for (const op of operations) applyOperation(op);
  state.appliedChangeIds.push(change.id);
  state.pendingChanges.push(change);
  await saveState();
  render();
  scheduleAutoSync(`change:${source}`);
}

function mergeChanges(changes) {
  let count = 0;
  const applied = new Set(state.appliedChangeIds);
  for (const change of changes.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (!change?.id || applied.has(change.id)) continue;
    for (const op of change.operations || []) applyOperation(op);
    state.appliedChangeIds.push(change.id);
    applied.add(change.id);
    count += 1;
  }
  return count;
}

function parseNumber(value) {
  const cleaned = String(value ?? "").replace(/\s/g, "").replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  if (hasComma && hasDot) return Number(cleaned.replace(/\./g, "").replace(",", "."));
  if (hasComma) return Number(cleaned.replace(",", "."));
  return Number(cleaned);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  const headers = rows.shift()?.map((value) => value.trim()) || [];
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header || `Column ${index + 1}`, values[index] || ""])));
}

function fingerprint(tx) {
  return normalizeText(`${tx.date}|${tx.amount}|${tx.direction}|${tx.merchant}|${tx.rawDescription}|${tx.accountId}`);
}

function suggestCategory(description, amount = 0, accountId = "") {
  const text = normalizeText(`${description} ${accountId}`);
  let best = { categoryId: "uncategorised", confidence: 0.2, reason: "No strong match" };
  for (const rule of state.classificationRules.filter((item) => item.active !== false)) {
    if (text.includes(normalizeText(rule.pattern))) {
      const confidence = Math.min(0.98, Number(rule.confidenceWeight || 0.7));
      if (confidence > best.confidence) best = { categoryId: rule.categoryId, confidence, reason: `Learned rule: ${rule.pattern}` };
    }
  }
  for (const [keyword, categoryId] of KEYWORDS) {
    if (text.includes(keyword) && best.confidence < 0.72) {
      best = { categoryId, confidence: 0.72, reason: `Keyword: ${keyword}` };
    }
  }
  if (amount > 0 && /salary|payroll|wage/.test(text)) best = { categoryId: "salary", confidence: 0.86, reason: "Income keyword" };
  return best;
}

function createRuleFromCorrection(merchant, rawDescription, categoryId) {
  const pattern = normalizeText(merchant || rawDescription).split(" ").slice(0, 4).join(" ");
  if (!pattern || pattern.length < 3) return null;
  const existing = state.classificationRules.find((rule) => normalizeText(rule.pattern) === pattern && rule.categoryId === categoryId);
  if (existing) return null;
  return {
    id: uid("rule"),
    pattern,
    matchField: "description",
    categoryId,
    confidenceWeight: 0.9,
    createdFromCorrection: true,
    active: true
  };
}

function deriveMetrics() {
  const currentMonth = monthKey();
  const current = monthTransactions(currentMonth);
  const prevDate = new Date(`${currentMonth}-15T12:00:00`);
  prevDate.setMonth(prevDate.getMonth() - 1);
  const previous = monthTransactions(monthKey(prevDate));
  const spend = current.reduce((sum, tx) => sum + expenseValue(tx), 0);
  const income = current.filter((tx) => tx.direction === "income").reduce((sum, tx) => sum + Math.abs(Number(tx.amount || 0)), 0);
  const budget = state.budgets.filter((item) => item.month === currentMonth).reduce((sum, item) => sum + Number(item.limitAmount || 0), 0);
  const prevSpend = previous.reduce((sum, tx) => sum + expenseValue(tx), 0);
  return { currentMonth, current, previous, spend, income, budget, prevSpend, cashflow: income - spend };
}

function groupSpend(transactions) {
  const map = new Map();
  for (const tx of transactions) {
    const value = expenseValue(tx);
    if (!value) continue;
    const group = groupForCategory(tx.categoryId);
    map.set(group.id, (map.get(group.id) || 0) + value);
  }
  return [...map.entries()]
    .map(([groupId, value]) => ({ ...state.categoryGroups.find((group) => group.id === groupId), value }))
    .sort((a, b) => b.value - a.value);
}

function merchantSpend(transactions) {
  const map = new Map();
  for (const tx of transactions) {
    const value = expenseValue(tx);
    if (!value) continue;
    const key = tx.merchant || tx.rawDescription || "Unknown merchant";
    map.set(key, (map.get(key) || 0) + value);
  }
  return [...map.entries()].map(([merchant, value]) => ({ merchant, value })).sort((a, b) => b.value - a.value);
}

function monthlySeries(months = 6) {
  const keys = [];
  const date = new Date();
  date.setDate(15);
  for (let i = months - 1; i >= 0; i -= 1) {
    const copy = new Date(date);
    copy.setMonth(date.getMonth() - i);
    keys.push(monthKey(copy));
  }
  return keys.map((key) => {
    const transactions = monthTransactions(key);
    return { month: key, spend: transactions.reduce((sum, tx) => sum + expenseValue(tx), 0), groups: groupSpend(transactions) };
  });
}

function buildInsights() {
  const metrics = deriveMetrics();
  const groups = groupSpend(metrics.current);
  const previousGroups = new Map(groupSpend(metrics.previous).map((item) => [item.id, item.value]));
  const insights = [];
  if (metrics.budget && metrics.spend > metrics.budget * 0.85) {
    insights.push({ tone: "#dc2626", title: "Budget pressure", body: `${money(metrics.spend)} spent against ${money(metrics.budget)} this month.` });
  }
  for (const group of groups.slice(0, 5)) {
    const previous = previousGroups.get(group.id) || 0;
    if (previous > 0 && group.value > previous * 1.25) {
      insights.push({ tone: group.color, title: `${group.name} is rising`, body: `${money(group.value)} this month versus ${money(previous)} last month.` });
    }
  }
  const discretionary = groups.filter((group) => group.discretionary).reduce((sum, group) => sum + group.value, 0);
  if (discretionary > metrics.spend * 0.25 && discretionary > 0) {
    insights.push({ tone: "#f97316", title: "Discretionary spend is high", body: `${money(discretionary)} is in flexible categories you can cut first.` });
  }
  const merchants = merchantSpend(metrics.current);
  if (merchants[0]) {
    insights.push({ tone: "#2563eb", title: "Top merchant", body: `${merchants[0].merchant} accounts for ${money(merchants[0].value)} this month.` });
  }
  const recurring = recurringExpenses();
  if (recurring.length) {
    insights.push({ tone: "#475569", title: "Recurring costs detected", body: `${recurring.length} merchants look recurring. Review subscriptions before cutting essentials.` });
  }
  return insights.length ? insights : [{ tone: "#16a34a", title: "No obvious pressure yet", body: "Import more statement history to improve cutback recommendations." }];
}

function recurringExpenses() {
  const byMerchant = new Map();
  for (const tx of state.transactions.filter((item) => !item.deletedAt && item.direction === "expense")) {
    const key = normalizeText(tx.merchant || tx.rawDescription);
    if (!key) continue;
    if (!byMerchant.has(key)) byMerchant.set(key, []);
    byMerchant.get(key).push(tx);
  }
  return [...byMerchant.entries()]
    .map(([key, rows]) => ({ merchant: rows[0].merchant || key, count: rows.length, avg: rows.reduce((sum, tx) => sum + expenseValue(tx), 0) / rows.length }))
    .filter((item) => item.count >= 3)
    .sort((a, b) => b.avg - a.avg);
}

function donutChart(data, size = 220) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (!total) return `<div class="subtle">No spending data yet.</div>`;
  const radius = 78;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const circles = data.map((item) => {
    const length = (item.value / total) * circumference;
    const circle = `<circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="${item.color}" stroke-width="28" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${size / 2} ${size / 2})" data-filter="${item.id}" class="chart-segment"/>`;
    offset += length;
    return circle;
  }).join("");
  return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Category spending donut">
    <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="28"/>
    ${circles}
    <text x="50%" y="47%" text-anchor="middle" font-size="18" font-weight="800" fill="#111827">${money(total)}</text>
    <text x="50%" y="58%" text-anchor="middle" font-size="11" fill="#64748b">spent</text>
  </svg>`;
}

function stackedBars(series) {
  const width = 640;
  const height = 250;
  const max = Math.max(1, ...series.map((item) => item.spend));
  const gap = 20;
  const barWidth = (width - gap * (series.length + 1)) / series.length;
  const bars = series.map((month, index) => {
    let y = 200;
    const x = gap + index * (barWidth + gap);
    const rects = month.groups.map((group) => {
      const h = Math.max(2, (group.value / max) * 170);
      y -= h;
      return `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" fill="${group.color}" rx="3" data-filter="${group.id}" class="chart-segment"/>`;
    }).join("");
    return `${rects}<text x="${x + barWidth / 2}" y="226" text-anchor="middle" font-size="11" fill="#64748b">${month.month.slice(5)}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Stacked monthly spend">
    <line x1="12" y1="200" x2="${width - 12}" y2="200" stroke="#dbe3ee"/>
    ${bars}
  </svg>`;
}

function lineChart(series) {
  const width = 640;
  const height = 240;
  const max = Math.max(1, ...series.map((item) => item.spend));
  const points = series.map((item, index) => {
    const x = 24 + index * ((width - 48) / Math.max(1, series.length - 1));
    const y = 190 - (item.spend / max) * 150;
    return `${x},${y}`;
  }).join(" ");
  const dots = series.map((item, index) => {
    const x = 24 + index * ((width - 48) / Math.max(1, series.length - 1));
    const y = 190 - (item.spend / max) * 150;
    return `<circle cx="${x}" cy="${y}" r="5" fill="#2563eb"/><text x="${x}" y="218" text-anchor="middle" font-size="11" fill="#64748b">${item.month.slice(5)}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Spending trend">
    <line x1="20" y1="190" x2="${width - 20}" y2="190" stroke="#dbe3ee"/>
    <polyline points="${points}" fill="none" stroke="#2563eb" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}
  </svg>`;
}

function barList(items, labelKey = "name", limit = 8) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return items.slice(0, limit).map((item) => `
    <div class="stack">
      <div style="display:flex;justify-content:space-between;gap:10px">
        <strong>${escapeHtml(item[labelKey])}</strong><span>${money(item.value)}</span>
      </div>
      <div class="progress"><span style="width:${Math.min(100, (item.value / max) * 100)}%;background:${item.color || "#2563eb"}"></span></div>
    </div>
  `).join("");
}

function renderShell(content) {
  const nav = [
    ["dashboard", "D", "Dashboard"],
    ["transactions", "$", "Transactions"],
    ["import", "I", "Import"],
    ["budgets", "B", "Budgets"],
    ["insights", "A", "Analytics"],
    ["sync", "S", "Sync"]
  ];
  app.innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">$</div>
          <div><strong>Household Ledger</strong><span>Encrypted Drive sync</span></div>
        </div>
        <nav class="nav">${nav.map(([id, icon, label]) => `<button data-tab="${id}" class="${state.activeTab === id ? "active" : ""}" title="${label}"><span class="icon">${icon}</span>${label}</button>`).join("")}</nav>
        <div class="sidebar-status">
          <strong>${state.pendingChanges.length}</strong> pending change${state.pendingChanges.length === 1 ? "" : "s"}<br>
          Last sync: ${state.settings.lastSyncAt ? new Date(state.settings.lastSyncAt).toLocaleString() : "never"}<br>
          Device: ${escapeHtml(state.deviceId.slice(-8))}
        </div>
      </aside>
      <main class="main">${content}</main>
      <button class="mobile-fab" data-tab="transactions" title="Add transaction">+</button>
    </div>
  `;
}

function pageHeader(title, subtitle, actions = "") {
  return `<div class="topbar"><div><h1>${title}</h1><p>${subtitle}</p></div><div class="actions">${actions}</div></div>`;
}

function renderDashboard() {
  const metrics = deriveMetrics();
  const groups = groupSpend(metrics.current);
  const series = monthlySeries();
  const insights = buildInsights();
  renderShell(`
    ${pageHeader("Household dashboard", "A colour-coded view of this month's spending pressure.", `<button class="button primary" data-tab="transactions">Add transaction</button><button class="button" data-tab="import">Import CSV</button>`)}
    <section class="grid cols-4">
      <div class="panel metric ${metrics.budget && metrics.spend > metrics.budget ? "bad" : ""}"><span>Month spend</span><strong>${money(metrics.spend)}</strong><small>${metrics.currentMonth}</small></div>
      <div class="panel metric"><span>Budget</span><strong>${metrics.budget ? money(metrics.budget) : "Not set"}</strong><small>${metrics.budget ? `${Math.round((metrics.spend / metrics.budget) * 100)}% used` : "Add budgets"}</small></div>
      <div class="panel metric ${metrics.cashflow >= 0 ? "good" : "bad"}"><span>Cashflow</span><strong>${money(metrics.cashflow)}</strong><small>Income minus expenses</small></div>
      <div class="panel metric ${metrics.spend > metrics.prevSpend ? "warn" : "good"}"><span>Vs last month</span><strong>${metrics.prevSpend ? `${Math.round(((metrics.spend - metrics.prevSpend) / metrics.prevSpend) * 100)}%` : "New"}</strong><small>${metrics.prevSpend ? `${money(metrics.prevSpend)} last month` : "Need history"}</small></div>
    </section>
    <section class="grid cols-2" style="margin-top:14px">
      <div class="panel">
        <div class="panel-head"><div><h2>Category mix</h2><span>Click a colour to filter transactions</span></div></div>
        <div class="panel-body"><div class="chart">${donutChart(groups)}</div><div class="legend">${groups.map((g) => `<span class="chip"><span class="dot" style="background:${g.color}"></span>${escapeHtml(g.name)}</span>`).join("")}</div></div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>Where to cut back</h2><span>Rules-based household insights</span></div></div>
        <div class="panel-body insight-list">${insights.map((item) => `<div class="insight" style="border-left-color:${item.tone}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.body)}</span></div>`).join("")}</div>
      </div>
    </section>
    <section class="grid cols-2" style="margin-top:14px">
      <div class="panel"><div class="panel-head"><h2>Monthly spending</h2></div><div class="panel-body chart">${stackedBars(series)}</div></div>
      <div class="panel"><div class="panel-head"><h2>Top merchants</h2></div><div class="panel-body">${barList(merchantSpend(metrics.current), "merchant") || `<span class="subtle">No merchant data yet.</span>`}</div></div>
    </section>
  `);
}

function renderTransactions() {
  const txs = [...state.transactions].filter((tx) => !tx.deletedAt);
  const filtered = chartFilter ? txs.filter((tx) => groupForCategory(tx.categoryId).id === chartFilter) : txs;
  filtered.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  renderShell(`
    ${pageHeader("Transactions", chartFilter ? `Filtered by ${state.categoryGroups.find((g) => g.id === chartFilter)?.name}` : "Quick capture on mobile, full review on desktop.", `<button class="button" data-action="clear-filter" ${chartFilter ? "" : "disabled"}>Clear filter</button>`)}
    <section class="panel">
      <div class="panel-head"><h2>Add transaction</h2><span>Manual entries sync as append-only changes</span></div>
      <div class="panel-body">
        <form id="transaction-form" class="form-grid">
          <div class="field"><label>Date</label><input name="date" type="date" value="${today()}" required></div>
          <div class="field"><label>Amount</label><input name="amount" type="number" step="0.01" min="0" required></div>
          <div class="field"><label>Direction</label><select name="direction"><option value="expense">Expense</option><option value="income">Income</option></select></div>
          <div class="field"><label>Account</label><select name="accountId">${state.accounts.map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("")}</select></div>
          <div class="field"><label>Merchant</label><input name="merchant" placeholder="Merchant or payee" required></div>
          <div class="field"><label>Category</label><select name="categoryId">${categoryOptions()}</select></div>
          <div class="field"><label>Payer label</label><input name="payerLabel" placeholder="Optional"></div>
          <div class="field"><label>Notes</label><input name="notes" placeholder="Optional"></div>
          <button class="button primary" type="submit">Save transaction</button>
        </form>
      </div>
    </section>
    <section class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>Ledger</h2><span>${filtered.length} transaction${filtered.length === 1 ? "" : "s"}</span></div>
      <div class="table-wrap">${transactionTable(filtered)}</div>
    </section>
  `);
}

function categoryOptions(selected = "uncategorised") {
  return state.categoryGroups.map((group) => {
    const categories = state.categories.filter((category) => category.groupId === group.id && category.active);
    if (!categories.length) return "";
    return `<optgroup label="${escapeHtml(group.name)}">${categories.map((category) => `<option value="${category.id}" ${category.id === selected ? "selected" : ""}>${escapeHtml(category.name)}</option>`).join("")}</optgroup>`;
  }).join("");
}

function transactionTable(rows) {
  if (!rows.length) return `<div class="panel-body subtle">No transactions yet. Add one manually or import a CSV statement.</div>`;
  return `<table>
    <thead><tr><th>Date</th><th>Merchant</th><th>Category</th><th>Account</th><th>Status</th><th>Amount</th><th></th></tr></thead>
    <tbody>${rows.map((tx) => {
      const group = groupForCategory(tx.categoryId);
      return `<tr>
        <td>${escapeHtml(tx.date)}</td>
        <td><strong>${escapeHtml(tx.merchant || tx.rawDescription)}</strong><br><span class="subtle">${escapeHtml(tx.source || "")}</span></td>
        <td><span class="chip"><span class="dot" style="background:${group.color}"></span>${escapeHtml(categoryName(tx.categoryId))}</span></td>
        <td>${escapeHtml(accountName(tx.accountId))}</td>
        <td>${escapeHtml(tx.status || "reviewed")}</td>
        <td class="${tx.direction === "income" ? "amount-income" : "amount-expense"}">${money(transactionAmount(tx))}</td>
        <td><button class="button" data-action="delete-transaction" data-id="${tx.id}">Delete</button></td>
      </tr>`;
    }).join("")}</tbody>
  </table>`;
}

function renderImport() {
  const previewHtml = importPreview ? renderImportPreview() : `<div class="dropzone"><input id="csv-file" type="file" accept=".csv,text/csv"><p class="subtle">Choose a bank/card CSV statement. Data stays in this browser until you approve the import.</p></div>`;
  renderShell(`
    ${pageHeader("CSV import", "Desktop workflow for bank statements, mapping, categorisation, and duplicate review.")}
    <section class="grid cols-2">
      <div class="panel">
        <div class="panel-head"><h2>Statement file</h2><span>CSV only in v1</span></div>
        <div class="panel-body">${previewHtml}</div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Saved mappings</h2><span>${state.csvMappings.length} template${state.csvMappings.length === 1 ? "" : "s"}</span></div>
        <div class="panel-body stack">${state.csvMappings.map((mapping) => `<div class="insight"><strong>${escapeHtml(mapping.name)}</strong><span>${escapeHtml(Object.values(mapping.columns).join(", "))}</span></div>`).join("") || `<span class="subtle">Mappings are saved after a successful import.</span>`}</div>
      </div>
    </section>
  `);
}

function renderImportPreview() {
  const headers = importPreview.headers;
  const mapping = importPreview.mapping;
  const selector = (name, value) => `<select data-map="${name}"><option value="">Ignore</option>${headers.map((header) => `<option value="${escapeHtml(header)}" ${value === header ? "selected" : ""}>${escapeHtml(header)}</option>`).join("")}</select>`;
  const rows = importPreview.rows.slice(0, 50).map((row, index) => {
    const tx = mapCsvRow(row, mapping);
    const suggestion = suggestCategory(`${tx.merchant} ${tx.rawDescription}`, tx.amount, tx.accountId);
    tx.categoryId = importPreview.categories[index] || suggestion.categoryId;
    const group = groupForCategory(tx.categoryId);
    const duplicate = state.transactions.some((existing) => existing.fingerprint === fingerprint(tx));
    return `<tr>
      <td>${escapeHtml(tx.date)}</td>
      <td>${escapeHtml(tx.merchant || tx.rawDescription)}</td>
      <td><select data-import-category="${index}">${categoryOptions(tx.categoryId)}</select><br><span class="subtle">${Math.round(suggestion.confidence * 100)}% ${escapeHtml(suggestion.reason)}</span></td>
      <td><span class="chip"><span class="dot" style="background:${group.color}"></span>${escapeHtml(group.name)}</span></td>
      <td class="${tx.direction === "income" ? "amount-income" : "amount-expense"}">${money(transactionAmount(tx))}</td>
      <td>${duplicate ? `<span class="chip">Duplicate</span>` : `<span class="subtle">New</span>`}</td>
    </tr>`;
  }).join("");
  return `
    <div class="stack">
      <div class="form-grid">
        <div class="field"><label>Mapping name</label><input id="mapping-name" value="${escapeHtml(importPreview.mappingName)}"></div>
        <div class="field"><label>Date</label>${selector("date", mapping.date)}</div>
        <div class="field"><label>Merchant</label>${selector("merchant", mapping.merchant)}</div>
        <div class="field"><label>Description</label>${selector("description", mapping.description)}</div>
        <div class="field"><label>Amount</label>${selector("amount", mapping.amount)}</div>
        <div class="field"><label>Debit</label>${selector("debit", mapping.debit)}</div>
        <div class="field"><label>Credit</label>${selector("credit", mapping.credit)}</div>
        <div class="field"><label>Account</label><select id="import-account">${state.accounts.map((a) => `<option value="${a.id}" ${a.id === importPreview.accountId ? "selected" : ""}>${escapeHtml(a.name)}</option>`).join("")}</select></div>
      </div>
      <div class="actions"><button class="button" data-action="cancel-import">Cancel</button><button class="button primary" data-action="approve-import">Approve import</button></div>
      <div class="table-wrap"><table><thead><tr><th>Date</th><th>Merchant</th><th>Suggested category</th><th>Group</th><th>Amount</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>`;
}

function guessMapping(headers) {
  const find = (...terms) => headers.find((header) => terms.some((term) => normalizeText(header).includes(term))) || "";
  return {
    date: find("date", "posted", "booking"),
    merchant: find("merchant", "payee", "beneficiary", "name"),
    description: find("description", "details", "memo", "narrative"),
    amount: find("amount", "value"),
    debit: find("debit", "withdrawal", "out"),
    credit: find("credit", "deposit", "in")
  };
}

function mapCsvRow(row, mapping) {
  const debit = parseNumber(row[mapping.debit]);
  const credit = parseNumber(row[mapping.credit]);
  const rawAmount = mapping.amount ? parseNumber(row[mapping.amount]) : credit || -Math.abs(debit);
  const amount = credit || debit || Math.abs(rawAmount);
  const direction = credit > 0 || rawAmount > 0 ? "income" : "expense";
  const rawDescription = row[mapping.description] || row[mapping.merchant] || "";
  const merchant = row[mapping.merchant] || rawDescription.split(" ").slice(0, 5).join(" ");
  return {
    date: normalDate(row[mapping.date]),
    amount: Math.abs(amount),
    direction,
    merchant: merchant.trim(),
    rawDescription,
    accountId: importPreview?.accountId || state.accounts[0]?.id,
    source: "bank_import",
    status: "reviewed"
  };
}

function normalDate(value) {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parts = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (parts) {
    const year = parts[3].length === 2 ? `20${parts[3]}` : parts[3];
    return `${year}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? today() : parsed.toISOString().slice(0, 10);
}

function renderBudgets() {
  const currentMonth = monthKey();
  const metrics = deriveMetrics();
  const groups = groupSpend(metrics.current);
  renderShell(`
    ${pageHeader("Budgets", "Set category-group limits and track household pressure.")}
    <section class="panel">
      <div class="panel-head"><h2>Add budget</h2><span>${currentMonth}</span></div>
      <div class="panel-body">
        <form id="budget-form" class="form-grid">
          <div class="field"><label>Month</label><input name="month" type="month" value="${currentMonth}" required></div>
          <div class="field"><label>Group</label><select name="groupId">${state.categoryGroups.filter((g) => g.id !== "income").map((g) => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join("")}</select></div>
          <div class="field"><label>Limit</label><input name="limitAmount" type="number" min="0" step="0.01" required></div>
          <button class="button primary" type="submit">Save budget</button>
        </form>
      </div>
    </section>
    <section class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>Budget pressure</h2></div>
      <div class="panel-body stack">${state.budgets.filter((b) => b.month === currentMonth).map((budget) => {
        const group = state.categoryGroups.find((g) => g.id === budget.groupId);
        const spent = groups.find((g) => g.id === budget.groupId)?.value || 0;
        const pct = Math.min(100, (spent / Number(budget.limitAmount || 1)) * 100);
        return `<div><div style="display:flex;justify-content:space-between;gap:10px"><strong><span class="dot" style="background:${group?.color}"></span> ${escapeHtml(group?.name)}</strong><span>${money(spent)} / ${money(budget.limitAmount)}</span></div><div class="progress"><span style="width:${pct}%;background:${group?.color || "#2563eb"}"></span></div></div>`;
      }).join("") || `<span class="subtle">No budgets for this month yet.</span>`}</div>
    </section>
  `);
}

function renderInsights() {
  const series = monthlySeries(8);
  const metrics = deriveMetrics();
  const groups = groupSpend(metrics.current);
  const recurring = recurringExpenses();
  renderShell(`
    ${pageHeader("Analytics", "Charts and drilldowns for understanding where money goes.")}
    <section class="grid cols-2">
      <div class="panel"><div class="panel-head"><h2>Spend trend</h2></div><div class="panel-body chart">${lineChart(series)}</div></div>
      <div class="panel"><div class="panel-head"><h2>Category groups</h2></div><div class="panel-body">${barList(groups)}</div></div>
      <div class="panel"><div class="panel-head"><h2>Recurring expenses</h2></div><div class="panel-body">${recurring.slice(0, 8).map((item) => `<div class="insight"><strong>${escapeHtml(item.merchant)}</strong><span>${item.count} charges, average ${money(item.avg)}</span></div>`).join("") || `<span class="subtle">No recurring expenses detected yet.</span>`}</div></div>
      <div class="panel"><div class="panel-head"><h2>Cutback signals</h2></div><div class="panel-body insight-list">${buildInsights().map((item) => `<div class="insight" style="border-left-color:${item.tone}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.body)}</span></div>`).join("")}</div></div>
    </section>
  `);
}

function renderSync() {
  renderShell(`
    ${pageHeader("Encrypted Drive sync", "Google Drive is the encrypted canonical store; devices keep local caches.", `<button class="button primary" data-action="sync-drive">Sync now</button><button class="button" data-action="create-snapshot">Snapshot</button>`)}
    <section class="panel">
      <div class="panel-head"><h2>Connection</h2><span>OAuth uses the Drive API and the drive.file scope</span></div>
      <form id="sync-settings-form" class="panel-body stack">
        <div class="notice">Financial records are encrypted before upload. Google Drive stores encrypted change and snapshot files, not readable ledger data.</div>
        <div class="form-grid">
          <div class="field"><label>Google OAuth client ID</label><input id="google-client-id" autocomplete="username" value="${escapeHtml(state.settings.googleClientId)}" placeholder="Paste web client ID"></div>
          <div class="field"><label>Encryption password</label><input id="encryption-password" type="password" autocomplete="current-password" value="${escapeHtml(encryptionPassword)}" placeholder="Required for sync"></div>
          <div class="field"><label>Currency</label><input id="currency" value="${escapeHtml(state.settings.currency)}"></div>
          <div class="field"><label>Locale</label><input id="locale" value="${escapeHtml(state.settings.locale)}"></div>
          <div class="field"><label>Auto-sync interval</label><input id="auto-sync-interval" type="number" min="1" max="60" step="1" value="${escapeHtml(state.settings.autoSyncIntervalMinutes || 3)}"></div>
          <label class="field"><span>Automatic foreground sync</span><span class="chip"><input id="auto-sync-enabled" type="checkbox" ${state.settings.autoSyncEnabled ? "checked" : ""}> Enabled</span></label>
          <label class="field"><span>Silent after reopening</span><span class="chip"><input id="remember-sync-password" type="checkbox" ${state.settings.rememberSyncPassword ? "checked" : ""}> Remember password on this device</span></label>
        </div>
        <div class="notice">Automatic sync runs when the app opens, comes back into focus, reconnects, after edits/imports, and every few minutes while open. iOS and Google OAuth can still stop true background or permanent silent sync.</div>
        <div class="actions"><button type="button" class="button" data-action="save-settings">Save settings</button><button type="button" class="button" data-action="export-local-snapshot">Download encrypted snapshot</button><label class="button">Import encrypted file<input id="encrypted-import" type="file" accept=".expense-snapshot,.expense-change,application/json" hidden></label></div>
      </form>
    </section>
    <section class="sync-state" style="margin-top:14px">
      <div><strong>${state.pendingChanges.length}</strong><br><span class="subtle">Pending local changes</span></div>
      <div><strong>${state.appliedChangeIds.length}</strong><br><span class="subtle">Applied change batches</span></div>
      <div><strong>${state.transactions.filter((tx) => !tx.deletedAt).length}</strong><br><span class="subtle">Active transactions</span></div>
      <div><strong>${state.settings.lastAutoSyncAt ? new Date(state.settings.lastAutoSyncAt).toLocaleTimeString() : "Never"}</strong><br><span class="subtle">Last automatic sync</span></div>
      <div><strong>${navigator.onLine ? "Online" : "Offline"}</strong><br><span class="subtle">Network state</span></div>
      <div><strong>${state.settings.lastSyncError ? "Needs attention" : "OK"}</strong><br><span class="subtle">${escapeHtml(state.settings.lastSyncError || "No sync error")}</span></div>
    </section>
  `);
}

function render() {
  if (state.activeTab === "dashboard") renderDashboard();
  if (state.activeTab === "transactions") renderTransactions();
  if (state.activeTab === "import") renderImport();
  if (state.activeTab === "budgets") renderBudgets();
  if (state.activeTab === "insights") renderInsights();
  if (state.activeTab === "sync") renderSync();
}

async function addTransaction(form) {
  const data = Object.fromEntries(new FormData(form));
  const suggestion = suggestCategory(`${data.merchant} ${data.notes}`, data.amount, data.accountId);
  const categoryId = data.categoryId || suggestion.categoryId;
  const record = {
    id: uid("tx"),
    date: data.date,
    amount: Math.abs(Number(data.amount)),
    direction: data.direction,
    merchant: data.merchant.trim(),
    rawDescription: data.notes || data.merchant,
    categoryId,
    accountId: data.accountId,
    payerLabel: data.payerLabel,
    notes: data.notes,
    source: "manual",
    status: "provisional",
    fingerprint: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  record.fingerprint = fingerprint(record);
  await recordChange([{ type: "upsertTransaction", record }], "manual-entry");
}

async function approveImport() {
  if (!importPreview) return;
  const mappingName = $("#mapping-name")?.value.trim() || importPreview.mappingName || "Bank CSV";
  importPreview.mappingName = mappingName;
  const mappingRecord = {
    id: importPreview.mappingId || uid("mapping"),
    name: mappingName,
    columns: importPreview.mapping,
    accountId: importPreview.accountId,
    createdAt: new Date().toISOString()
  };
  const batchId = uid("batch");
  const operations = [{ type: "upsertCsvMapping", record: mappingRecord }];
  let acceptedCount = 0;
  importPreview.rows.forEach((row, index) => {
    const tx = mapCsvRow(row, importPreview.mapping);
    const suggestion = suggestCategory(`${tx.merchant} ${tx.rawDescription}`, tx.amount, tx.accountId);
    tx.categoryId = importPreview.categories[index] || suggestion.categoryId;
    tx.id = uid("tx");
    tx.importBatchId = batchId;
    tx.fingerprint = fingerprint(tx);
    tx.createdAt = new Date().toISOString();
    tx.updatedAt = tx.createdAt;
    if (state.transactions.some((existing) => existing.fingerprint === tx.fingerprint)) return;
    operations.push({ type: "upsertTransaction", record: tx });
    acceptedCount += 1;
    const rule = createRuleFromCorrection(tx.merchant, tx.rawDescription, tx.categoryId);
    if (rule) operations.push({ type: "upsertRule", record: rule });
  });
  operations.push({
    type: "upsertImportBatch",
    record: {
      id: batchId,
      sourceFileName: importPreview.fileName,
      accountId: importPreview.accountId,
      importedAt: new Date().toISOString(),
      rowCount: importPreview.rows.length,
      acceptedCount
    }
  });
  importPreview = null;
  await recordChange(operations, "csv-import");
}

async function encryptJson(payload, password) {
  if (!password) throw new Error("Encryption password is required.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return JSON.stringify({
    format: "household-expense-tracker-encrypted",
    version: APP_VERSION,
    kdf: "PBKDF2-SHA256",
    iterations: 250000,
    salt: b64(salt),
    iv: b64(iv),
    data: b64(new Uint8Array(cipher))
  });
}

async function decryptJson(text, password) {
  const envelope = JSON.parse(text);
  if (envelope.format !== "household-expense-tracker-encrypted") throw new Error("Unsupported encrypted file.");
  const salt = fromB64(envelope.salt);
  const iv = fromB64(envelope.iv);
  const data = fromB64(envelope.data);
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: envelope.iterations || 250000, hash: "SHA-256" }, keyMaterial, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.parse(new TextDecoder().decode(plain));
}

function b64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function fromB64(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function exportLocalSnapshot(download = true) {
  const snapshotState = {
    ...state,
    activeTab: "dashboard",
    pendingChanges: [],
    settings: {
      ...state.settings,
      storedSyncPassword: ""
    }
  };
  const payload = {
    type: "snapshot",
    createdAt: new Date().toISOString(),
    state: snapshotState
  };
  const encrypted = await encryptJson(payload, encryptionPassword);
  if (download) downloadText(`snapshot-${payload.createdAt.replace(/[:.]/g, "-")}.expense-snapshot`, encrypted);
  return encrypted;
}

function downloadText(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function importEncryptedFile(file) {
  const payload = await decryptJson(await file.text(), encryptionPassword);
  if (payload.type === "snapshot") {
    state = ensureDefaults(payload.state);
    await saveState();
  } else if (payload.type === "change-batch") {
    mergeChanges(payload.changes || []);
    await saveState();
  } else {
    throw new Error("Unknown encrypted payload type.");
  }
  render();
}

async function ensureGis() {
  if (window.google?.accounts?.oauth2) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Could not load Google Identity Services."));
    document.head.appendChild(script);
  });
}

async function getAccessToken({ interactive = true } = {}) {
  if (!state.settings.googleClientId) throw new Error("Add a Google OAuth client ID first.");
  await ensureGis();
  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: state.settings.googleClientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error) reject(new Error(response.error));
        else {
          accessToken = response.access_token;
          resolve(accessToken);
        }
      }
    });
    tokenClient.requestAccessToken({ prompt: accessToken ? "" : interactive ? "consent" : "" });
  });
}

async function driveRequest(path, options = {}, authOptions = {}) {
  const token = accessToken || await getAccessToken(authOptions);
  const { _retried, ...fetchOptions } = options;
  const response = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    ...fetchOptions,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(fetchOptions.headers || {})
    }
  });
  if (response.status === 401 && !_retried) {
    accessToken = "";
    return driveRequest(path, { ...fetchOptions, _retried: true }, authOptions);
  }
  if (!response.ok) throw new Error(await response.text());
  return response.headers.get("content-type")?.includes("application/json") ? response.json() : response.text();
}

async function driveUpload(name, parentId, content, mime = "application/json", authOptions = {}) {
  const token = accessToken || await getAccessToken(authOptions);
  const boundary = `expense_${Date.now()}`;
  const metadata = { name, parents: parentId ? [parentId] : undefined, mimeType: mime };
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n${content}\r\n--${boundary}--`;
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body
  });
  if (response.status === 401) {
    accessToken = "";
    const freshToken = await getAccessToken(authOptions);
    const retry = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime", {
      method: "POST",
      headers: { Authorization: `Bearer ${freshToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
      body
    });
    if (!retry.ok) throw new Error(await retry.text());
    return retry.json();
  }
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function driveCreateFolder(name, parentId = "", authOptions = {}) {
  const metadata = {
    name,
    mimeType: "application/vnd.google-apps.folder",
    parents: parentId ? [parentId] : undefined
  };
  return driveRequest("files?fields=id,name", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata)
  }, authOptions);
}

async function findFiles(query, authOptions = {}) {
  const params = new URLSearchParams({ q: `${query} and trashed=false`, fields: "files(id,name,mimeType,createdTime,parents)" });
  const result = await driveRequest(`files?${params.toString()}`, {}, authOptions);
  return result.files || [];
}

async function ensureDriveFolder(name, parentId = "", authOptions = {}) {
  const parentQuery = parentId ? ` and '${parentId}' in parents` : "";
  const existing = await findFiles(`name='${name.replaceAll("'", "\\'")}' and mimeType='application/vnd.google-apps.folder'${parentQuery}`, authOptions);
  if (existing[0]) return existing[0].id;
  const created = await driveCreateFolder(name, parentId, authOptions);
  return created.id;
}

async function syncDrive({ silent = false, interactiveAuth = true, reason = "manual" } = {}) {
  if (!encryptionPassword) throw new Error("Enter the encryption password first.");
  if (isSyncing) {
    autoSyncQueued = true;
    return { merged: 0, uploaded: 0, skipped: true };
  }
  isSyncing = true;
  const authOptions = { interactive: interactiveAuth };
  try {
  await getAccessToken(authOptions);
  const rootId = await ensureDriveFolder("Expense Tracker", "", authOptions);
  const changesId = await ensureDriveFolder("changes", rootId, authOptions);
  const snapshotsId = await ensureDriveFolder("snapshots", rootId, authOptions);
  const deviceFolderId = await ensureDriveFolder(state.deviceId, changesId, authOptions);
  Object.assign(state.settings, { driveFolderId: rootId, changesFolderId: changesId, snapshotsFolderId: snapshotsId });

  const deviceFolders = await findFiles(`'${changesId}' in parents and mimeType='application/vnd.google-apps.folder'`, authOptions);
  const fileLists = await Promise.all(deviceFolders.map((folder) => findFiles(`'${folder.id}' in parents`, authOptions)));
  const allChangeFiles = fileLists.flat();
  const downloaded = [];
  for (const file of allChangeFiles.filter((item) => item.name.endsWith(".expense-change"))) {
    const text = await driveRequest(`files/${file.id}?alt=media`, {}, authOptions);
    const payload = await decryptJson(text, encryptionPassword);
    downloaded.push(...(payload.changes || []));
  }
  const merged = mergeChanges(downloaded);
  const pending = [...state.pendingChanges];
  if (pending.length) {
    const encrypted = await encryptJson({ type: "change-batch", createdAt: new Date().toISOString(), changes: pending }, encryptionPassword);
    await driveUpload(`${new Date().toISOString().replace(/[:.]/g, "-")}-${state.deviceId}.expense-change`, deviceFolderId, encrypted, "application/json", authOptions);
    state.pendingChanges = [];
  }
  const manifest = JSON.stringify({ version: APP_VERSION, updatedAt: new Date().toISOString(), deviceId: state.deviceId, appliedChanges: state.appliedChangeIds.length });
  await driveUpload("manifest.json", rootId, manifest, "application/json", authOptions);
  state.settings.lastSyncAt = new Date().toISOString();
  state.settings.lastSyncError = "";
  if (reason !== "manual") state.settings.lastAutoSyncAt = state.settings.lastSyncAt;
  await saveState();
  render();
  if (!silent) alert(`Sync complete. Merged ${merged} change batch${merged === 1 ? "" : "es"} and uploaded ${pending.length}.`);
  return { merged, uploaded: pending.length, skipped: false };
  } finally {
    isSyncing = false;
    if (autoSyncQueued) {
      autoSyncQueued = false;
      setTimeout(() => runAutoSync("queued"), 1000);
    }
  }
}

async function createDriveSnapshot() {
  if (!encryptionPassword) throw new Error("Enter the encryption password first.");
  await getAccessToken({ interactive: true });
  const rootId = state.settings.driveFolderId || await ensureDriveFolder("Expense Tracker");
  const snapshotsId = state.settings.snapshotsFolderId || await ensureDriveFolder("snapshots", rootId);
  const encrypted = await exportLocalSnapshot(false);
  await driveUpload(`${new Date().toISOString().replace(/[:.]/g, "-")}.expense-snapshot`, snapshotsId, encrypted);
  state.settings.lastSnapshotAt = new Date().toISOString();
  await saveState();
  render();
}

function autoSyncReady() {
  return Boolean(
    state.settings.autoSyncEnabled &&
    state.settings.googleClientId &&
    encryptionPassword &&
    navigator.onLine
  );
}

function scheduleAutoSync(reason = "scheduled") {
  if (!autoSyncReady()) return;
  setTimeout(() => runAutoSync(reason), 1200);
}

async function runAutoSync(reason = "auto") {
  if (!autoSyncReady()) return;
  if (isSyncing) {
    autoSyncQueued = true;
    return;
  }
  const intervalMs = Math.max(60000, Number(state.settings.autoSyncIntervalMinutes || 3) * 60000);
  const hasPending = state.pendingChanges.length > 0;
  const nowMs = Date.now();
  if (!hasPending && nowMs - lastAutoSyncMs < intervalMs) return;
  if (hasPending && nowMs - lastAutoSyncMs < 15000) return;
  lastAutoSyncMs = nowMs;
  try {
    await syncDrive({ silent: true, interactiveAuth: false, reason });
  } catch (error) {
    state.settings.lastSyncError = error.message || String(error);
    await saveState();
    if (state.activeTab === "sync") render();
  }
}

function startAutoSync() {
  if (autoSyncTimer) clearInterval(autoSyncTimer);
  autoSyncTimer = setInterval(() => runAutoSync("interval"), 60000);
}

document.addEventListener("click", async (event) => {
  const tab = event.target.closest("[data-tab]")?.dataset.tab;
  if (tab) {
    state.activeTab = tab;
    await saveState();
    render();
    return;
  }
  const action = event.target.closest("[data-action]")?.dataset.action;
  const id = event.target.closest("[data-id]")?.dataset.id;
  try {
    if (action === "clear-filter") {
      chartFilter = null;
      render();
    }
    if (action === "delete-transaction" && id) {
      await recordChange([{ type: "softDeleteTransaction", id, deletedAt: new Date().toISOString() }], "manual-delete");
    }
    if (action === "cancel-import") {
      importPreview = null;
      render();
    }
    if (action === "approve-import") await approveImport();
    if (action === "save-settings") {
      state.settings.googleClientId = $("#google-client-id")?.value.trim() || "";
      state.settings.currency = ($("#currency")?.value.trim() || "EUR").toUpperCase();
      state.settings.locale = $("#locale")?.value.trim() || "en-GB";
      encryptionPassword = $("#encryption-password")?.value || "";
      state.settings.autoSyncEnabled = Boolean($("#auto-sync-enabled")?.checked);
      state.settings.autoSyncIntervalMinutes = Math.max(1, Math.min(60, Number($("#auto-sync-interval")?.value || 3)));
      state.settings.rememberSyncPassword = Boolean($("#remember-sync-password")?.checked);
      state.settings.storedSyncPassword = state.settings.rememberSyncPassword ? encryptionPassword : "";
      await saveState();
      startAutoSync();
      render();
      scheduleAutoSync("settings-saved");
    }
    if (action === "sync-drive") await syncDrive({ silent: false, interactiveAuth: true, reason: "manual" });
    if (action === "create-snapshot") await createDriveSnapshot();
    if (action === "export-local-snapshot") {
      encryptionPassword = $("#encryption-password")?.value || encryptionPassword;
      await exportLocalSnapshot(true);
    }
  } catch (error) {
    alert(error.message || String(error));
  }
});

document.addEventListener("click", (event) => {
  const segment = event.target.closest(".chart-segment");
  if (!segment) return;
  chartFilter = segment.dataset.filter;
  state.activeTab = "transactions";
  saveState().then(render);
});

document.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    if (event.target.id === "transaction-form") await addTransaction(event.target);
    if (event.target.id === "budget-form") {
      const data = Object.fromEntries(new FormData(event.target));
      const record = { id: uid("budget"), month: data.month, groupId: data.groupId, limitAmount: Number(data.limitAmount), updatedAt: new Date().toISOString() };
      await recordChange([{ type: "upsertBudget", record }], "budget");
    }
  } catch (error) {
    alert(error.message || String(error));
  }
});

document.addEventListener("change", async (event) => {
  try {
    if (event.target.id === "csv-file") {
      const file = event.target.files[0];
      if (!file) return;
      const rows = parseCsv(await file.text());
      const headers = Object.keys(rows[0] || {});
      const saved = state.csvMappings[0];
      importPreview = {
        fileName: file.name,
        rows,
        headers,
        mappingName: saved?.name || file.name.replace(/\.csv$/i, ""),
        mappingId: saved?.id,
        mapping: saved?.columns || guessMapping(headers),
        accountId: saved?.accountId || state.accounts[0]?.id,
        categories: {}
      };
      render();
    }
    if (event.target.dataset.map && importPreview) {
      importPreview.mapping[event.target.dataset.map] = event.target.value;
      render();
    }
    if (event.target.dataset.importCategory && importPreview) {
      importPreview.categories[Number(event.target.dataset.importCategory)] = event.target.value;
    }
    if (event.target.id === "import-account" && importPreview) {
      importPreview.accountId = event.target.value;
      render();
    }
    if (event.target.id === "encrypted-import") {
      encryptionPassword = $("#encryption-password")?.value || encryptionPassword;
      await importEncryptedFile(event.target.files[0]);
    }
  } catch (error) {
    alert(error.message || String(error));
  }
});

async function seedDemoData() {
  if (state.transactions.length) return;
  const operations = [];
  const merchants = [
    ["Esselunga", "groceries", 88], ["Netflix", "streaming", 15], ["Shell Fuel", "fuel", 62],
    ["Amazon", "general-shopping", 74], ["Restaurant Roma", "restaurants", 56], ["Vodafone", "mobile-phone", 28],
    ["Electric Utility", "electricity", 120], ["Spotify", "streaming", 11], ["Pharmacy", "pharmacy", 24]
  ];
  for (let m = 0; m < 5; m += 1) {
    for (const [merchant, categoryId, base] of merchants) {
      const date = new Date();
      date.setMonth(date.getMonth() - m);
      date.setDate(3 + Math.floor(Math.random() * 24));
      const amount = Math.round((base + Math.random() * 35) * 100) / 100;
      const record = {
        id: uid("tx"),
        date: date.toISOString().slice(0, 10),
        amount,
        direction: "expense",
        merchant,
        rawDescription: merchant,
        categoryId,
        accountId: m % 2 ? "credit-card" : "main-bank",
        source: "demo",
        status: "reviewed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      record.fingerprint = fingerprint(record);
      operations.push({ type: "upsertTransaction", record });
    }
  }
  for (const group of GROUPS.filter((g) => !["income", "transfers", "other"].includes(g.id))) {
    operations.push({ type: "upsertBudget", record: { id: uid("budget"), month: monthKey(), groupId: group.id, limitAmount: group.discretionary ? 180 : 450, updatedAt: new Date().toISOString() } });
  }
  await recordChange(operations, "demo-seed");
}

async function init() {
  db = await openDb();
  state = ensureDefaults(await dbGet("state"));
  await saveState();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
  render();
  startAutoSync();
  scheduleAutoSync("startup");
  window.addEventListener("online", () => scheduleAutoSync("online"));
  window.addEventListener("focus", () => scheduleAutoSync("focus"));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleAutoSync("visible");
  });
  window.seedDemoData = seedDemoData;
}

init().catch((error) => {
  app.innerHTML = `<main class="main"><div class="notice">${escapeHtml(error.message || String(error))}</div></main>`;
});
