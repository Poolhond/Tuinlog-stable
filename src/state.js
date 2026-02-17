export const STORAGE_KEY = "tuinlog_mvp_v1";

const uid = () => Math.random().toString(16).slice(2) + "-" + Math.random().toString(16).slice(2);
const now = () => Date.now();
const todayISO = () => new Date().toISOString().slice(0,10);
const pad2 = (n) => String(n).padStart(2, "0");
const round2 = (n) => Math.round((Number(n||0))*100)/100;

function fmtClock(ms){ const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function fmtTimeInput(ms){ return Number.isFinite(ms) ? fmtClock(ms) : ""; }
function getSegmentMinutes(segment){
  const start = fmtTimeInput(segment?.start);
  const end = fmtTimeInput(segment?.end);
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (![sh, sm, eh, em].every(Number.isFinite)) return 0;
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
}
function syncSettlementAmounts(settlement){
  const lines = settlement?.lines || [];
  const byBucket = (bucket) => lines.filter(l=>l.bucket===bucket).reduce((a,l)=>a+((Number(l.qty)||0)*(Number(l.unitPrice)||0)),0);
  settlement.invoiceAmount = round2(byBucket("invoice"));
  settlement.cashAmount = round2(byBucket("cash"));
}
function ensureUIPreferences(st){
  st.ui = st.ui || {};
  st.logbook = st.logbook || {};
  if (!["open", "paid", "all"].includes(st.logbook.statusFilter)) st.logbook.statusFilter = "open";
  if (!("showFilters" in st.logbook)) st.logbook.showFilters = Boolean(st.ui.showLogFilters);
  if (!("customerId" in st.logbook)) st.logbook.customerId = st.ui.logCustomerId || "all";
  if (!("period" in st.logbook)) st.logbook.period = "all";
  if (!["all", "week", "month", "30d"].includes(st.logbook.period)) st.logbook.period = "all";
  if (!["date", "customer", "workTime", "productTotal", "status"].includes(st.logbook.groupBy)) st.logbook.groupBy = "date";
  if (!["desc", "asc"].includes(st.logbook.sortDir)) st.logbook.sortDir = "desc";
  if (!("editLogId" in st.ui)) st.ui.editLogId = null;
  if (!("editSettlementId" in st.ui)) st.ui.editSettlementId = null;
}
function ensureCoreProducts(st){
  st.products = st.products || [];
  const coreProducts = [
    { name:"Werk", unit:"uur", unitPrice:38, vatRate:0.21, defaultBucket:"invoice" },
    { name:"Groen", unit:"keer", unitPrice:38, vatRate:0.21, defaultBucket:"invoice" },
  ];
  for (const core of coreProducts){
    const exists = st.products.find(p => (p.name||"").trim().toLowerCase() === core.name.toLowerCase());
    if (!exists) st.products.push({ id: uid(), ...core });
  }
}

export function defaultState(){
  return { schemaVersion:1, settings:{ hourlyRate:38, vatRate:0.21 }, customers:[{ id:uid(), nickname:"Van de Werf", name:"", address:"Heverlee, Leuven", createdAt:now() },{ id:uid(), nickname:"Kessel-Lo tuin", name:"", address:"Kessel-Lo, Leuven", createdAt:now() }], products:[{ id:uid(), name:"Werk", unit:"uur", unitPrice:38, vatRate:0.21, defaultBucket:"invoice" },{ id:uid(), name:"Groen", unit:"keer", unitPrice:38, vatRate:0.21, defaultBucket:"invoice" }], logs:[], settlements:[], activeLogId:null, ui:{}, logbook:{ statusFilter:"open", showFilters:false, customerId:"all", period:"all", groupBy:"date", sortDir:"desc" } };
}
export function safeParseState(raw){ try { return { ok:true, value:JSON.parse(raw) }; } catch { return { ok:false }; } }
export function migrateState(st){ if (!st || typeof st !== "object" || Array.isArray(st)) return defaultState(); st.schemaVersion = 1; return st; }
export function validateAndRepairState(st){
  if (!st || typeof st !== "object" || Array.isArray(st)) return defaultState();
  if (!Array.isArray(st.customers)) st.customers = [];
  if (!Array.isArray(st.logs)) st.logs = [];
  if (!Array.isArray(st.settlements)) st.settlements = [];
  if (!Array.isArray(st.products)) st.products = [];
  if (!st.settings || typeof st.settings !== "object" || Array.isArray(st.settings)) st.settings = {};
  if (!st.ui || typeof st.ui !== "object" || Array.isArray(st.ui)) st.ui = {};
  return st;
}
export function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw){ const st = defaultState(); localStorage.setItem(STORAGE_KEY, JSON.stringify(st)); return st; }
  const parsed = safeParseState(raw);
  if (!parsed.ok){ const st = defaultState(); localStorage.setItem(STORAGE_KEY, JSON.stringify(st)); return st; }
  const st = validateAndRepairState(migrateState(parsed.value));
  ensureUIPreferences(st); ensureCoreProducts(st);
  for (const s of st.settlements){ if (!s.lines) s.lines = []; if (!s.logIds) s.logIds = []; syncSettlementAmounts(s); }
  for (const l of st.logs){ if (!l.segments) l.segments = []; if (!l.items) l.items = []; if (!l.date) l.date = todayISO(); }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
  return st;
}
export function saveState(state){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
