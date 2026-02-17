/* Tuinlog MVP — 5 boeken + detail sheets
   - Logboek: start/stop/pauze, items toevoegen
   - Afrekenboek: bundel logs, per regel Factuur/Cash dropdown
   - Klanten: detail toont logs + afrekeningen
   - Producten: beheerlijst, gebruikt in logs/afrekeningen
   - Status kleuren: logs afgeleid van afrekening.status
*/

const STORAGE_KEY = "tuinlog_mvp_v1";
const $ = (s) => document.querySelector(s);

const uid = () => Math.random().toString(16).slice(2) + "-" + Math.random().toString(16).slice(2);
const now = () => Date.now();
const todayISO = () => new Date().toISOString().slice(0,10);
const esc = (s) => String(s ?? "")
  .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
  .replaceAll('"',"&quot;").replaceAll("'","&#039;");

function fmtMoney(n){
  const v = Number(n||0);
  return "€" + v.toFixed(2).replace(".", ",");
}
function pad2(n){ return String(n).padStart(2,"0"); }
function fmtClock(ms){
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function durMsToHM(ms){
  const m = Math.max(0, Math.floor(ms/60000));
  const h = Math.floor(m/60);
  const mm = m%60;
  return `${h}u ${pad2(mm)}m`;
}
function calculateDuration(start, end) {
  const [sh, sm] = String(start || "").split(":").map(Number);
  const [eh, em] = String(end || "").split(":").map(Number);

  if (![sh, sm, eh, em].every(Number.isFinite)) return "0u 00m";

  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const diff = Math.max(0, endMin - startMin);

  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;

  return `${hours}u ${minutes.toString().padStart(2, "0")}m`;
}
function getSegmentMinutes(segment){
  const start = fmtTimeInput(segment?.start);
  const end = fmtTimeInput(segment?.end);
  if (!start || !end) return 0;

  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (![sh, sm, eh, em].every(Number.isFinite)) return 0;

  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
}
function formatMinutesAsDuration(totalMinutes){
  const minutes = Math.max(0, Math.floor(Number(totalMinutes) || 0));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}u ${String(m).padStart(2, "0")}m`;
}
function formatDurationCompact(totalMinutes){
  const minutes = Math.max(0, Math.floor(Number(totalMinutes) || 0));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}u${String(m).padStart(2, "0")}m`;
}
function round2(n){ return Math.round((Number(n||0))*100)/100; }
function formatDatePretty(isoDate){
  if (!isoDate) return "";
  const [y, m, d] = String(isoDate).split("-").map(Number);
  if (!y || !m || !d) return String(isoDate);
  const dt = new Date(y, m - 1, d);
  if (!Number.isFinite(dt.getTime())) return String(isoDate);
  const dayNames = ["zo", "ma", "di", "wo", "do", "vr", "za"];
  const monthNames = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  const yy = String(y).slice(-2);
  return `${dayNames[dt.getDay()]} ${d} ${monthNames[m - 1]} ${yy}`;
}
function formatLogDatePretty(isoDate){
  return formatDatePretty(isoDate);
}
function formatMoneyEUR(amount){
  return fmtMoney(amount);
}
function fmtTimeInput(ms){
  if (!Number.isFinite(ms)) return "";
  return fmtClock(ms);
}
function parseLogTimeToMs(isoDate, value){
  if (!value) return null;
  const parsed = new Date(`${isoDate}T${value}:00`).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function confirmDelete(label){
  return confirm(`Zeker verwijderen?\n\n${label}\n\nDit kan niet ongedaan gemaakt worden.`);
}
function confirmAction(label){
  return confirm(label);
}

function ensureModalRoot(){
  let root = document.getElementById("appModalRoot");
  if (root) return root;
  root = document.createElement("div");
  root.id = "appModalRoot";
  document.body.appendChild(root);
  return root;
}

function closeModal(){
  const root = document.getElementById("appModalRoot");
  if (!root) return;
  root.innerHTML = "";
}

function openConfirmModal({ title, message, confirmText = "Bevestigen", cancelText = "Annuleren", danger = false }){
  return new Promise((resolve)=>{
    const root = ensureModalRoot();
    root.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
          <div class="item-title" id="modalTitle">${esc(title || "Bevestigen")}</div>
          <div class="small modal-message">${esc(message || "")}</div>
          <div class="row modal-actions">
            <button class="btn" id="modalCancelBtn">${esc(cancelText)}</button>
            <button class="btn ${danger ? "danger" : "primary"}" id="modalConfirmBtn">${esc(confirmText)}</button>
          </div>
        </div>
      </div>
    `;

    const finish = (value)=>{
      closeModal();
      resolve(value);
    };

    root.querySelector("#modalCancelBtn")?.addEventListener("click", ()=> finish(false));
    root.querySelector("#modalConfirmBtn")?.addEventListener("click", ()=> finish(true));
    root.querySelector(".modal-backdrop")?.addEventListener("click", (e)=>{
      if (e.target.classList.contains("modal-backdrop")) finish(false);
    });
  });
}

function openTextConfirmModal({ title, message, expectedText, confirmText = "Definitief wissen", cancelText = "Annuleren" }){
  return new Promise((resolve)=>{
    const root = ensureModalRoot();
    root.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modalTitleTextConfirm">
          <div class="item-title" id="modalTitleTextConfirm">${esc(title || "Bevestigen")}</div>
          <div class="small modal-message">${esc(message || "")}</div>
          <label for="modalConfirmInput">Typ <span class="mono">${esc(expectedText)}</span> om verder te gaan</label>
          <input id="modalConfirmInput" autocomplete="off" />
          <div class="row modal-actions">
            <button class="btn" id="modalCancelBtn">${esc(cancelText)}</button>
            <button class="btn danger" id="modalConfirmBtn" disabled>${esc(confirmText)}</button>
          </div>
        </div>
      </div>
    `;

    const input = root.querySelector("#modalConfirmInput");
    const confirmBtn = root.querySelector("#modalConfirmBtn");
    const finish = (value)=>{
      closeModal();
      resolve(value);
    };

    input?.addEventListener("input", ()=>{
      const valid = (input.value || "").trim().toUpperCase() === String(expectedText || "").trim().toUpperCase();
      confirmBtn.disabled = !valid;
    });

    root.querySelector("#modalCancelBtn")?.addEventListener("click", ()=> finish(false));
    confirmBtn?.addEventListener("click", ()=> finish(true));
    root.querySelector(".modal-backdrop")?.addEventListener("click", (e)=>{
      if (e.target.classList.contains("modal-backdrop")) finish(false);
    });
  });
}

// ---------- State ----------
function defaultState(){
  return {
    schemaVersion: 1,
    settings: { hourlyRate: 38, vatRate: 0.21 },
    customers: [
      { id: uid(), nickname:"Van de Werf", name:"", address:"Heverlee, Leuven", createdAt: now() },
      { id: uid(), nickname:"Kessel-Lo tuin", name:"", address:"Kessel-Lo, Leuven", createdAt: now() },
    ],
    products: [
      { id: uid(), name:"Werk", unit:"uur", unitPrice:38, vatRate:0.21, defaultBucket:"invoice" },
      { id: uid(), name:"Groen", unit:"keer", unitPrice:38, vatRate:0.21, defaultBucket:"invoice" },
    ],
    logs: [],
    settlements: [],
    activeLogId: null,
    ui: {},
    logbook: {
      statusFilter: "open",
      showFilters: false,
      customerId: "all",
      period: "all",
      groupBy: "date",
      sortDir: "desc"
    }
  };
}

function safeParseState(raw){
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

function migrateState(st){
  if (!st || typeof st !== "object" || Array.isArray(st)) return defaultState();

  let version = Number.isInteger(st.schemaVersion) ? st.schemaVersion : 0;

  while (version < 1){
    switch (version){
      case 0:
        st.schemaVersion = 1;
        version = 1;
        break;
      default:
        st.schemaVersion = 1;
        version = 1;
        break;
    }
  }

  if (!Number.isInteger(st.schemaVersion) || st.schemaVersion < 1) st.schemaVersion = 1;
  return st;
}

function validateAndRepairState(st){
  if (!st || typeof st !== "object" || Array.isArray(st)) return defaultState();

  if (!Array.isArray(st.customers)) st.customers = [];
  if (!Array.isArray(st.logs)) st.logs = [];
  if (!Array.isArray(st.settlements)) st.settlements = [];
  if (!Array.isArray(st.products)) st.products = [];
  if (!st.settings || typeof st.settings !== "object" || Array.isArray(st.settings)) st.settings = {};
  if (!st.ui || typeof st.ui !== "object" || Array.isArray(st.ui)) st.ui = {};

  return st;
}

function ensureUIPreferences(st){
  st.ui = st.ui || {};
  st.logbook = st.logbook || {};

  if (!["open", "paid", "all"].includes(st.logbook.statusFilter)){
    st.logbook.statusFilter = ["open", "paid", "all"].includes(st.ui.logFilter) ? st.ui.logFilter : "open";
  }
  if (!("showFilters" in st.logbook)) st.logbook.showFilters = Boolean(st.ui.showLogFilters);
  if (!("customerId" in st.logbook)) st.logbook.customerId = st.ui.logCustomerId || "all";
  if (!("period" in st.logbook)){
    const legacyMap = { "7d": "week", "30d": "30d", "90d": "month", "all": "all" };
    st.logbook.period = legacyMap[st.ui.logPeriod] || "all";
  }
  if (!["all", "week", "month", "30d"].includes(st.logbook.period)) st.logbook.period = "all";
  if (!["date", "customer", "workTime", "productTotal", "status"].includes(st.logbook.groupBy)) st.logbook.groupBy = "date";
  if (!["desc", "asc"].includes(st.logbook.sortDir)) st.logbook.sortDir = "desc";

  if (!("editLogId" in st.ui)) st.ui.editLogId = null;
  if (!("editSettlementId" in st.ui)) st.ui.editSettlementId = null;
  if (st.ui.settlementEditModes && !st.ui.editSettlementId){
    const activeId = Object.entries(st.ui.settlementEditModes).find(([, isEditing]) => Boolean(isEditing))?.[0] || null;
    st.ui.editSettlementId = activeId;
  }
  delete st.ui.settlementEditModes;
  delete st.ui.logFilter;
  delete st.ui.showLogFilters;
  delete st.ui.logCustomerId;
  delete st.ui.logPeriod;
}

function isSettlementEditing(settlementId){
  return state.ui.editSettlementId === settlementId;
}

function toggleEditSettlement(settlementId){
  actions.setEditSettlement(settlementId);
}

function ensureCoreProducts(st){
  st.products = st.products || [];
  const coreProducts = [
    { name:"Werk", unit:"uur", unitPrice:38, vatRate:0.21, defaultBucket:"invoice" },
    { name:"Groen", unit:"keer", unitPrice:38, vatRate:0.21, defaultBucket:"invoice" },
  ];
  for (const core of coreProducts){
    const exists = st.products.find(p => (p.name||"").trim().toLowerCase() === core.name.toLowerCase());
    if (!exists){
      st.products.push({ id: uid(), ...core });
    }
  }
}

function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw){
    const st = defaultState();
    seedDemoMonths(st, { months: 3, force: false });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
    return st;
  }
  const parsed = safeParseState(raw);
  if (!parsed.ok){
    const st = defaultState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
    return st;
  }
  const st = validateAndRepairState(migrateState(parsed.value));

  // migrations
  if (!st.settings) st.settings = { hourlyRate: 38, vatRate: 0.21 };
  if (!("hourlyRate" in st.settings)) st.settings.hourlyRate = 38;
  if (!("vatRate" in st.settings)) st.settings.vatRate = 0.21;
  if (!st.customers) st.customers = [];
  if (!st.products) st.products = [];
  if (!st.logs) st.logs = [];
  if (!st.settlements) st.settlements = [];
  if (!("activeLogId" in st)) st.activeLogId = null;
  ensureUIPreferences(st);

  for (const c of st.customers){
    if (!("demo" in c)) c.demo = false;
  }
  for (const p of st.products){
    if (!("demo" in p)) p.demo = false;
  }

  ensureCoreProducts(st);

  // settlement status default
  for (const s of st.settlements){
    if (!s.status) s.status = "draft";
    if (!s.lines) s.lines = [];
    if (!s.logIds) s.logIds = [];
    if (!("markedCalculated" in s)) s.markedCalculated = s.status === "calculated";
    if (!("isCalculated" in s)) s.isCalculated = Boolean(s.markedCalculated || s.status === "calculated" || s.status === "paid" || s.calculatedAt);
    if (!("calculatedAt" in s)) s.calculatedAt = s.isCalculated ? (s.createdAt || now()) : null;
    if (!("invoicePaid" in s)) s.invoicePaid = false;
    if (!("cashPaid" in s)) s.cashPaid = false;
    if (!("invoiceAmount" in s)) s.invoiceAmount = 0;
    if (!("cashAmount" in s)) s.cashAmount = 0;
    syncSettlementAmounts(s);
    if (!("demo" in s)) s.demo = false;
  }
  // log fields
  for (const l of st.logs){
    if (!l.segments) l.segments = [];
    if (!l.items) l.items = [];
    if (!l.date) l.date = todayISO();
    if (!("demo" in l)) l.demo = false;
  }

  ensureUIPreferences(st);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(st));

  return st;
}

function saveState(nextState = state){ localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState)); }

const DEMO = {
  firstNames: ["Jan", "Els", "Koen", "Sofie", "Lotte", "Tom", "An", "Pieter", "Nina", "Wim", "Bram", "Fien", "Arne", "Joke", "Raf", "Mira", "Tine", "Milan"],
  lastNames: ["Peeters", "Janssens", "Van den Broeck", "Wouters", "Claes", "Lambrechts", "Maes", "Vermeulen", "Hermans", "Goossens", "De Smet", "Schreurs"],
  streets: ["Naamsesteenweg", "Tiensevest", "Diestsesteenweg", "Tervuursesteenweg", "Geldenaaksebaan", "Kapucijnenvoer", "Ridderstraat", "Brusselsestraat", "Parkstraat", "Molenstraat", "Blandenstraat"],
  zones: ["Heverlee", "Kessel-Lo", "Wilsele", "Herent", "Leuven", "Wijgmaal", "Haasrode", "Bertem"],
  nicknames: ["achtertuin", "voortuin", "haag", "gazons", "border", "moestuin", "terras", "oprit"]
};

function ri(min, max){ return Math.floor(Math.random() * (max - min + 1)) + min; }
function rf(min, max){ return Math.random() * (max - min) + min; }
function pick(arr){ return arr[ri(0, arr.length - 1)]; }
function demoDateISO(daysBack){
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().slice(0,10);
}

function ensureStateSafetyAfterMutations(st){
  const logIds = new Set(st.logs.map(l => l.id));
  for (const s of st.settlements){
    s.logIds = (s.logIds||[]).filter(id => logIds.has(id));
  }
  if (st.activeLogId && !logIds.has(st.activeLogId)) st.activeLogId = null;
  const active = currentView();
  if (active.view === "logDetail" && !logIds.has(active.id)) popView();
  if (active.view === "customerDetail" && !st.customers.some(c => c.id === active.id)) popView();
  if (active.view === "productDetail" && !st.products.some(p => p.id === active.id)) popView();
  if (active.view === "settlementDetail" && !st.settlements.some(x => x.id === active.id)) popView();
}

function settlementTotals(settlement){
  return getSettlementTotals(settlement);
}

function seedDemoMonths(st, { months = 3, force = false } = {}){
  const hasDemo = (st.customers||[]).some(c => c.demo) || (st.logs||[]).some(l => l.demo) || (st.settlements||[]).some(s => s.demo);
  if (!force && hasDemo) return false;

  ensureCoreProducts(st);

  const workProduct = st.products.find(p => (p.name||"").trim().toLowerCase() === "werk");
  const greenProduct = st.products.find(p => (p.name||"").trim().toLowerCase() === "groen");
  if (!workProduct || !greenProduct) return false;

  const customerCount = ri(12, 25);
  const logCount = ri(40, 90);
  const settlementCount = ri(15, 35);

  const customers = [];
  for (let i = 0; i < customerCount; i++){
    const fn = pick(DEMO.firstNames);
    const ln = pick(DEMO.lastNames);
    const street = pick(DEMO.streets);
    const zone = pick(DEMO.zones);
    const nr = ri(1, 180);
    const nick = `${ln.split(" ")[0]} ${pick(DEMO.nicknames)}`;
    customers.push({
      id: uid(),
      nickname: nick,
      name: `${fn} ${ln}`,
      address: `${street} ${nr}, ${zone}, Leuven`,
      createdAt: now() - ri(15, 90) * 86400000,
      demo: true
    });
  }

  const logs = [];
  for (let i = 0; i < logCount; i++){
    const customer = pick(customers);
    const daysBack = ri(0, months * 31 - 1);
    const date = demoDateISO(daysBack);
    const startHour = ri(7, 10);
    const startMin = pick([0, 15, 30, 45]);
    const firstDurMin = ri(90, 220);
    const breakMin = Math.random() < 0.35 ? ri(10, 35) : 0;
    const secondDurMin = Math.random() < 0.55 ? ri(60, 180) : 0;

    const start = new Date(`${date}T${pad2(startHour)}:${pad2(startMin)}:00`).getTime();
    const firstEnd = start + firstDurMin * 60000;
    const breakEnd = firstEnd + breakMin * 60000;
    const finalEnd = breakEnd + secondDurMin * 60000;

    const segments = [{ id: uid(), type:"work", start, end: firstEnd }];
    if (breakMin > 0) segments.push({ id: uid(), type:"break", start: firstEnd, end: breakEnd });
    if (secondDurMin > 0) segments.push({ id: uid(), type:"work", start: breakEnd, end: finalEnd });

    const workHours = round2(sumWorkMs({ segments }) / 3600000);
    const greenQty = ri(0, 3);
    const items = [
      { id: uid(), productId: workProduct.id, qty: workHours, unitPrice: 38, note:"" },
      { id: uid(), productId: greenProduct.id, qty: greenQty, unitPrice: 38, note:"" }
    ];

    logs.push({
      id: uid(),
      customerId: customer.id,
      date,
      createdAt: start,
      closedAt: finalEnd,
      note: Math.random() < 0.3 ? pick(["Onderhoud", "Snoeiwerk", "Border opgefrist", "Seizoensbeurt"]) : "",
      segments,
      items,
      demo: true
    });
  }

  logs.sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));

  const settlements = [];
  const logsByCustomer = new Map();
  for (const l of logs){
    if (!logsByCustomer.has(l.customerId)) logsByCustomer.set(l.customerId, []);
    logsByCustomer.get(l.customerId).push(l);
  }
  for (const arr of logsByCustomer.values()) arr.sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));

  const target = Math.min(settlementCount, Math.max(1, logs.length));
  for (let i = 0; i < target; i++){
    const cid = pick([...logsByCustomer.keys()]);
    const pool = logsByCustomer.get(cid).filter(l => !l._used);
    if (!pool.length) continue;
    const take = pool.slice(0, ri(1, Math.min(6, pool.length)));
    take.forEach(l => { l._used = true; });

    const summary = { workQty: 0, greenQty: 0 };
    for (const log of take){
      for (const it of (log.items||[])){
        if (it.productId === workProduct.id) summary.workQty += Number(it.qty)||0;
        if (it.productId === greenProduct.id) summary.greenQty += Number(it.qty)||0;
      }
    }
    summary.workQty = round2(summary.workQty);
    summary.greenQty = round2(summary.greenQty);

    const scenarioPick = Math.random();
    const scenario = scenarioPick < 0.35 ? "invoice" : (scenarioPick < 0.70 ? "cash" : "mixed");
    const lines = [];
    const pushLine = ({ bucket, productId, description, unit, qty, unitPrice, vatRate })=>{
      const nQty = round2(Number(qty)||0);
      if (nQty <= 0) return;
      lines.push({ id: uid(), bucket, productId, description, unit, qty: nQty, unitPrice, vatRate });
    };

    if (scenario === "invoice"){
      pushLine({ bucket:"invoice", productId: workProduct.id, description:"Werk", unit:"uur", qty: summary.workQty, unitPrice:38, vatRate:0.21 });
      pushLine({ bucket:"invoice", productId: greenProduct.id, description:"Groen", unit:"keer", qty: summary.greenQty, unitPrice:38, vatRate:0.21 });
    } else if (scenario === "cash"){
      pushLine({ bucket:"cash", productId: workProduct.id, description:"Werk", unit:"uur", qty: summary.workQty, unitPrice:38, vatRate:0 });
      pushLine({ bucket:"cash", productId: greenProduct.id, description:"Groen", unit:"keer", qty: summary.greenQty, unitPrice:38, vatRate:0 });
    } else {
      const invoiceWorkQty = round2(Math.max(0.5, summary.workQty * rf(0.45, 0.75)));
      const cashWorkQty = round2(Math.max(0.5, summary.workQty - invoiceWorkQty));
      const invoiceGreenQty = Math.floor(summary.greenQty / 2);
      const cashGreenQty = Math.max(0, Math.round(summary.greenQty - invoiceGreenQty));
      pushLine({ bucket:"invoice", productId: workProduct.id, description:"Werk", unit:"uur", qty: invoiceWorkQty, unitPrice:38, vatRate:0.21 });
      pushLine({ bucket:"cash", productId: workProduct.id, description:"Werk", unit:"uur", qty: cashWorkQty, unitPrice:38, vatRate:0 });
      pushLine({ bucket:"invoice", productId: greenProduct.id, description:"Groen", unit:"keer", qty: invoiceGreenQty, unitPrice:38, vatRate:0.21 });
      pushLine({ bucket:"cash", productId: greenProduct.id, description:"Groen", unit:"keer", qty: cashGreenQty, unitPrice:38, vatRate:0 });
    }

    const statusPick = Math.random();
    const status = statusPick < 0.30 ? "draft" : "calculated";
    const temp = {
      id: uid(),
      customerId: cid,
      date: take[take.length - 1].date,
      createdAt: take[take.length - 1].createdAt,
      logIds: take.map(l => l.id),
      lines,
      status,
      invoicePaid: false,
      cashPaid: false,
      demo: true
    };

    const totals = settlementTotals(temp);
    if (statusPick >= 0.70){
      if (totals.invoiceTotal > 0 && totals.cashTotal > 0){
        temp.invoicePaid = true;
        temp.cashPaid = true;
      } else if (totals.invoiceTotal > 0){
        temp.invoicePaid = true;
      } else if (totals.cashTotal > 0){
        temp.cashPaid = true;
      }
    } else {
      temp.invoicePaid = totals.invoiceTotal > 0 ? Math.random() < 0.5 : false;
      temp.cashPaid = totals.cashTotal > 0 ? Math.random() < 0.5 : false;
    }

    const paid = isSettlementPaid(temp);
    if (paid) temp.status = "calculated";

    settlements.push(temp);
  }

  for (const l of logs) delete l._used;

  st.customers = [...customers, ...st.customers];
  st.logs = [...logs.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)), ...st.logs];
  st.settlements = [...settlements.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)), ...st.settlements];
  return true;
}

function clearDemoData(st){
  const removedLogIds = new Set((st.logs||[]).filter(l => l.demo).map(l => l.id));
  st.customers = (st.customers||[]).filter(c => !c.demo);
  st.logs = (st.logs||[]).filter(l => !l.demo);
  st.settlements = (st.settlements||[])
    .filter(s => !s.demo)
    .map(s => ({ ...s, logIds: (s.logIds||[]).filter(id => !removedLogIds.has(id)) }));
  ensureStateSafetyAfterMutations(st);
}

let state = loadState();

// ---------- Computations ----------
function sumWorkMs(log){
  let t=0;
  for (const s of (log.segments||[])){
    if (s.type !== "work") continue;
    const end = s.end ?? now();
    t += Math.max(0, end - s.start);
  }
  return t;
}
function sumBreakMs(log){
  let t=0;
  for (const s of (log.segments||[])){
    if (s.type !== "break") continue;
    const end = s.end ?? now();
    t += Math.max(0, end - s.start);
  }
  return t;
}
function sumItemsAmount(log){
  return round2((log.items||[]).reduce((acc,it)=> acc + (Number(it.qty)||0)*(Number(it.unitPrice)||0), 0));
}
function getStartTime(log){
  const firstWorkSegment = (log.segments || [])
    .filter(segment => segment?.type === "work" && Number.isFinite(segment.start))
    .sort((a, b) => a.start - b.start)[0];
  const startMs = firstWorkSegment?.start ?? log.startAt ?? log.startedAt ?? null;
  return Number.isFinite(startMs) ? fmtClock(startMs) : "—";
}
function getTotalWorkDuration(log){
  const totalWorkMinutes = Math.floor(sumWorkMs(log) / 60000);
  const compact = formatDurationCompact(totalWorkMinutes);
  return compact.endsWith("m") ? compact.slice(0, -1) : compact;
}
function countExtraProducts(log){
  const workProductIds = new Set(
    (state.products || [])
      .filter(product => ["werk", "werk (uur)", "arbeid"].includes((product.name || "").trim().toLowerCase()))
      .map(product => product.id)
  );

  return (log.items || []).reduce((count, item) => {
    const product = getProduct(item.productId);
    const productName = (product?.name || "").trim().toLowerCase();
    const isWork = workProductIds.has(item.productId) || ["werk", "werk (uur)", "arbeid"].includes(productName);
    return isWork ? count : count + 1;
  }, 0);
}
function getCustomer(id){ return state.customers.find(c => c.id === id) || null; }
function cname(id){ const c=getCustomer(id); return c ? (c.nickname || c.name || "Klant") : "Klant"; }
function getProduct(id){ return state.products.find(p => p.id === id) || null; }
function pname(id){ const p=getProduct(id); return p ? p.name : "Product"; }

function currentOpenSegment(log){
  return (log.segments||[]).find(s => s.end == null) || null;
}
function closeOpenSegment(log){
  const seg = currentOpenSegment(log);
  if (seg) seg.end = now();
}
function openSegment(log, type){
  log.segments = log.segments || [];
  log.segments.push({ id: uid(), type, start: now(), end: null });
}

// ---------- Status helpers ----------
function statusClassFromStatus(s){
  if (s === "linked" || s === "draft") return "status-linked";
  if (s === "calculated") return "status-calculated";
  if (s === "paid") return "status-paid";
  return "";
}
function getLogVisualState(log){
  const state = logStatus(log.id);
  if (state === "paid") return { state: "paid", color: "#00a05a" };
  if (state === "calculated") return { state: "calculated", color: "#ff8c00" };
  if (state === "linked") return { state: "linked", color: "#ffcc00" };
  return { state: "free", color: "#93a0b5" };
}
function getSettlementTotals(settlement){
  const invoiceTotals = bucketTotals(settlement.lines, "invoice");
  const cashTotals = bucketTotals(settlement.lines, "cash");
  return {
    invoiceSubtotal: invoiceTotals.subtotal,
    invoiceVat: invoiceTotals.vat,
    invoiceTotal: invoiceTotals.total,
    cashSubtotal: cashTotals.subtotal,
    cashTotal: cashTotals.subtotal
  };
}
function isSettlementCalculated(settlement){
  return Boolean(
    settlement?.isCalculated ||
    settlement?.markedCalculated ||
    settlement?.status === "calculated" ||
    settlement?.status === "paid" ||
    settlement?.calculatedAt
  );
}
function getSettlementAmounts(settlement){
  const totals = getSettlementTotals(settlement || {});
  return {
    invoice: Number(settlement?.invoiceAmount ?? totals.invoiceTotal ?? 0),
    cash: Number(settlement?.cashAmount ?? totals.cashTotal ?? 0)
  };
}
function getSettlementPaymentFlags(settlement){
  return {
    invoicePaid: Boolean(settlement?.invoicePaid),
    cashPaid: Boolean(settlement?.cashPaid)
  };
}
function getSettlementIconPresentation(settlement){
  const calculated = isSettlementCalculated(settlement);
  const amounts = getSettlementAmounts(settlement);
  const flags = getSettlementPaymentFlags(settlement);

  const icons = [
    {
      type: "invoice",
      show: calculated && amounts.invoice > 0,
      color: flags.invoicePaid ? "green" : "orange"
    },
    {
      type: "cash",
      show: calculated && amounts.cash > 0,
      color: flags.cashPaid ? "green" : "orange"
    }
  ];

  /*
    Sanity examples:
    - not calculated -> [] (no icons shown because both show=false)
    - calculated + invoice>0 + cash=0 -> [invoice icon]
    - calculated + invoice>0 + cash>0 -> [invoice + cash]
    - paid=true -> green, paid=false -> orange
  */
  return icons;
}
function getLogPresentation(log, sourceState){
  const settlement = (sourceState?.settlements || []).find(s => (s.logIds || []).includes(log?.id));
  if (!settlement) return { state: "free" };

  const icons = getSettlementIconPresentation(settlement);
  const visibleIcons = icons.filter(icon => icon.show);
  const allVisiblePaid = visibleIcons.length > 0 && visibleIcons.every(icon => icon.color === "green");

  if (allVisiblePaid) return { state: "paid", settlement };
  if (isSettlementCalculated(settlement)) return { state: "calculated", settlement };
  return { state: "linked", settlement };
}
function getSettlementVisualState(settlement){
  if (!settlement) return { state: "open", accentClass: "card-accent--open", navClass: "nav--linked" };
  const iconPresentation = getSettlementIconPresentation(settlement);
  const visibleIcons = iconPresentation.filter(icon => icon.show);
  const isPaid = visibleIcons.length > 0 && visibleIcons.every(icon => icon.color === "green");
  if (isPaid){
    return { state: "paid", accentClass: "card-accent--paid", navClass: "nav--paid" };
  }
  if (isSettlementCalculated(settlement)){
    return { state: "calculated", accentClass: "card-accent--calculated", navClass: "nav--calculated" };
  }
  return { state: "draft", accentClass: "card-accent--open", navClass: "nav--linked" };
}
function isSettlementPaid(settlement){
  return getSettlementVisualState(settlement).state === "paid";
}
function settlementColorClass(settlement){
  return getSettlementVisualState(settlement).accentClass;
}
function settlementForLog(logId){
  return state.settlements.find(a => (a.logIds||[]).includes(logId)) || null;
}
function settlementVisualState(settlement){
  const visual = getSettlementVisualState(settlement);
  if (visual.state === "paid") return "paid";
  if (visual.state === "calculated") return "calculated";
  return "linked";
}
function logStatus(logId){
  const log = state.logs.find(item => item.id === logId);
  return getLogPresentation(log, state).state;
}
function isLogLinkedElsewhere(logId, currentSettlementId){
  return state.settlements.some(s =>
    s.id !== currentSettlementId &&
    (s.logIds || []).includes(logId)
  );
}
function getWorkLogStatus(logId){
  return logStatus(logId);
}
function renderLogCard(log){
  const st = getWorkLogStatus(log.id);
  const cls = statusClassFromStatus(st);
  const startTime = getStartTime(log);
  const workDuration = getTotalWorkDuration(log);
  const extraProducts = countExtraProducts(log);
  const extraLabel = extraProducts > 0 ? `<span>+${extraProducts}</span>` : "";
  const amount = sumItemsAmount(log);

  return `
    <div class="item ${cls}" data-open-log="${log.id}">
      <div class="item-main">
        <div class="item-title">${esc(cname(log.customerId))}</div>
        <div class="meta-text" style="margin-top:2px;">
          <span>${esc(formatLogDatePretty(log.date))}</span> · <span>Start ${esc(startTime)}</span> · <span>${esc(workDuration)}</span>${extraLabel ? ` · ${extraLabel}` : ""}
        </div>
      </div>
      ${amount > 0 ? `<div class="amount-prominent">${fmtMoney(amount)}</div>` : ""}
    </div>
  `;
}

function statusLabelNL(s){
  if (s === "draft") return "draft";
  if (s === "calculated") return "berekend";
  if (s === "paid") return "betaald";
  return s || "";
}

// ---------- Lines & totals ----------
function lineAmount(line){ return round2((Number(line.qty)||0) * (Number(line.unitPrice)||0)); }
function lineVat(line){
  const r = Number(line.vatRate ?? state.settings.vatRate ?? 0.21);
  const bucket = line.bucket || "invoice";
  if (bucket === "cash") return 0;
  return round2(lineAmount(line) * r);
}
function bucketTotals(lines, bucket){
  const arr = (lines||[]).filter(l => (l.bucket||"invoice") === bucket);
  const subtotal = round2(arr.reduce((a,l)=> a + lineAmount(l), 0));
  const vat = round2(arr.reduce((a,l)=> a + lineVat(l), 0));
  const total = round2(subtotal + vat);
  return { subtotal, vat, total };
}

function settlementPaymentState(settlement){
  const invoiceTotals = bucketTotals(settlement.lines, "invoice");
  const cashTotals = bucketTotals(settlement.lines, "cash");
  const { invoiceTotal, cashTotal } = getSettlementTotals(settlement);
  const hasInvoice = invoiceTotal > 0;
  const hasCash = cashTotal > 0;
  const isPaid = getSettlementVisualState(settlement).state === "paid";
  return { invoiceTotals, cashTotals, invoiceTotal, cashTotal, hasInvoice, hasCash, isPaid };
}

function syncSettlementStatus(settlement){
  if (!settlement) return;
  settlement.isCalculated = isSettlementCalculated(settlement);
  const iconPresentation = getSettlementIconPresentation(settlement).filter(icon => icon.show);
  const isPaid = iconPresentation.length > 0 && iconPresentation.every(icon => icon.color === "green");
  if (isPaid && settlement.isCalculated){
    settlement.status = "paid";
  } else {
    settlement.status = settlement.isCalculated ? "calculated" : "draft";
  }
  syncSettlementAmounts(settlement);
}

function computeSettlementFromLogsInState(sourceState, customerId, logIds){
  let workMs = 0;
  const itemMap = new Map(); // productId -> {qty, unitPrice}
  for (const id of logIds){
    const log = sourceState.logs.find(l => l.id === id);
    if (!log) continue;
    workMs += sumWorkMs(log);
    for (const it of (log.items||[])){
      const key = it.productId || "free";
      if (!itemMap.has(key)) itemMap.set(key, { qty:0, unitPrice: Number(it.unitPrice)||0 });
      const cur = itemMap.get(key);
      cur.qty += Number(it.qty)||0;
      cur.unitPrice = Number(it.unitPrice)||cur.unitPrice;
    }
  }
  const hours = round2(workMs / 3600000);

  // build lines: labour + grouped items
  const lines = [];
  const labourProduct = sourceState.products.find(p => {
    const n = (p.name||"").toLowerCase();
    return n === "werk" || n === "arbeid";
  });
  if (hours > 0){
    lines.push({
      id: uid(),
      productId: labourProduct?.id || null,
      description: labourProduct?.name || "Werk",
      unit: labourProduct?.unit || "uur",
      qty: hours,
      unitPrice: Number(sourceState.settings.hourlyRate||38),
      vatRate: labourProduct?.vatRate ?? 0.21,
      bucket: "invoice"
    });
  }
  for (const [productId, v] of itemMap.entries()){
    const prod = sourceState.products.find(p => p.id === productId);
    lines.push({
      id: uid(),
      productId,
      description: prod?.name || "Product",
      unit: prod?.unit || "keer",
      qty: round2(v.qty),
      unitPrice: round2(v.unitPrice),
      vatRate: prod?.vatRate ?? 0.21,
      bucket: (prod?.defaultBucket || "invoice")
    });
  }

  return { workMs, hours, lines };
}

function computeSettlementFromLogs(customerId, logIds){
  return computeSettlementFromLogsInState(state, customerId, logIds);
}

// ---------- UI state ----------
const ui = {
  navStack: [{ view: "logs" }],
  transition: null,
  logDetailSegmentEditId: null,
  activeLogQuickAdd: {
    open: false,
    productId: null,
    qty: "1"
  }
};

// Guardrail: keep state mutations inside actions + commit.
function commit(){
  state = validateAndRepairState(state);
  saveState(state);
  render();
}

const actions = {
  startLog(customerId){
    if (!customerId || state.activeLogId) return null;
    const log = {
      id: uid(), customerId, date: todayISO(), createdAt: now(), closedAt: null,
      note: "", segments: [], items: []
    };
    openSegment(log, "work");
    state.logs.unshift(log);
    state.activeLogId = log.id;
    commit();
    return log;
  },
  pauseLog(logId){
    const log = state.logs.find(l => l.id === logId);
    if (!log) return;
    const seg = currentOpenSegment(log);
    if (!seg) openSegment(log, "work");
    else if (seg.type === "work"){ closeOpenSegment(log); openSegment(log, "break"); }
    else { closeOpenSegment(log); openSegment(log, "work"); }
    commit();
  },
  stopLog(logId){
    const log = state.logs.find(l => l.id === logId);
    if (!log) return;
    closeOpenSegment(log);
    log.closedAt = now();
    state.activeLogId = null;
    ui.activeLogQuickAdd.open = false;
    commit();
  },
  editLog(logId, updater){
    const log = state.logs.find(l => l.id === logId);
    if (!log || typeof updater !== "function") return;
    updater(log);
    commit();
  },
  deleteLog(logId){
    state.logs = state.logs.filter(x => x.id !== logId);
    if (state.activeLogId === logId) state.activeLogId = null;
    for (const s of state.settlements){
      s.logIds = (s.logIds || []).filter(id => id !== logId);
    }
    commit();
  },
  createSettlement(customerId = state.customers[0]?.id || ""){
    const s = {
      id: uid(), customerId, date: todayISO(), createdAt: now(), logIds: [], lines: [],
      status: "draft", markedCalculated: false, isCalculated: false, calculatedAt: null,
      invoiceAmount: 0, cashAmount: 0, invoicePaid: false, cashPaid: false
    };
    state.settlements.unshift(s);
    commit();
    return s;
  },
  linkLogToSettlement(logId, settlementId){
    for (const s of state.settlements){ s.logIds = (s.logIds || []).filter(x => x !== logId); }
    if (settlementId === "none") return commit();
    if (settlementId === "new"){
      const log = state.logs.find(l => l.id === logId);
      if (!log) return;
      const s = {
        id: uid(), customerId: log.customerId, date: todayISO(), createdAt: now(), logIds: [logId], lines: [],
        status: "draft", markedCalculated: false, isCalculated: false, calculatedAt: null,
        invoiceAmount: 0, cashAmount: 0, invoicePaid: false, cashPaid: false
      };
      s.lines = computeSettlementFromLogs(s.customerId, s.logIds).lines;
      state.settlements.unshift(s);
      commit();
      return s;
    }
    const s = state.settlements.find(x => x.id === settlementId);
    if (!s) return commit();
    s.logIds = Array.from(new Set([...(s.logIds || []), logId]));
    const prev = new Map((s.lines || []).map(li => [li.productId + "|" + li.description, li.bucket]));
    s.lines = computeSettlementFromLogs(s.customerId, s.logIds).lines.map(li => ({ ...li, bucket: prev.get(li.productId + "|" + li.description) || li.bucket }));
    commit();
    return s;
  },
  calculateSettlement(settlementId){
    const settlement = state.settlements.find(x => x.id === settlementId);
    if (!settlement) return;
    calculateSettlement(settlement);
    commit();
  },
  setInvoicePaid(settlementId, paid){
    const s = state.settlements.find(x => x.id === settlementId);
    if (!s) return;
    s.invoicePaid = Boolean(paid);
    syncSettlementStatus(s);
    commit();
  },
  setCashPaid(settlementId, paid){
    const s = state.settlements.find(x => x.id === settlementId);
    if (!s) return;
    s.cashPaid = Boolean(paid);
    syncSettlementStatus(s);
    commit();
  },
  deleteSettlement(settlementId){
    state.settlements = state.settlements.filter(x => x.id !== settlementId);
    if (state.ui.editSettlementId === settlementId) state.ui.editSettlementId = null;
    commit();
  },
  editSettlement(settlementId, updater){
    const settlement = state.settlements.find(x => x.id === settlementId);
    if (!settlement || typeof updater !== "function") return;
    updater(settlement);
    commit();
  },
  addProduct(product){ state.products.unshift(product); commit(); return product; },
  updateSettings(hourlyRate, vatRate){
    state.settings.hourlyRate = round2(hourlyRate);
    state.settings.vatRate = round2(vatRate);
    commit();
  },
  setEditLog(logId){
    state.ui.editLogId = state.ui.editLogId === logId ? null : logId;
    if (state.ui.editLogId !== logId) ui.logDetailSegmentEditId = null;
    commit();
  },
  setEditSettlement(settlementId){
    state.ui.editSettlementId = state.ui.editSettlementId === settlementId ? null : settlementId;
    commit();
  },
  setLogbook(partial){ state.logbook = { ...(state.logbook || {}), ...partial }; commit(); },
  addCustomer(customer){ state.customers.unshift(customer); commit(); return customer; },
  updateCustomer(customerId, patch){
    const c = state.customers.find(x => x.id === customerId);
    if (!c) return;
    Object.assign(c, patch);
    commit();
  },
  deleteCustomer(customerId){ state.customers = state.customers.filter(x => x.id !== customerId); commit(); },
  updateProduct(productId, patch){
    const p = state.products.find(x => x.id === productId);
    if (!p) return;
    Object.assign(p, patch);
    commit();
  },
  deleteProduct(productId){ state.products = state.products.filter(x => x.id !== productId); commit(); },
  setBackupFeedback(type, text){
    state.ui = state.ui || {};
    state.ui.backupFeedback = { type, text };
    commit();
  }
};

function toggleEditLog(logId){
  actions.setEditLog(logId);
}

function preferredWorkProduct(){
  return state.products.find(p => (p.name||"").trim().toLowerCase() === "werk") || state.products[0] || null;
}

function addProductToLog(logId, productId, qty, unitPrice){
  const log = state.logs.find(l => l.id === logId);
  if (!log) return false;
  const product = state.products.find(p => p.id === productId) || preferredWorkProduct();
  if (!product) return false;

  const parsedQty = Number(String(qty ?? "").replace(",", "."));
  if (!Number.isFinite(parsedQty) || parsedQty <= 0) return false;

  const priceSource = unitPrice ?? product.unitPrice ?? 0;
  const parsedUnitPrice = Number(String(priceSource).replace(",", "."));
  const safeUnitPrice = Number.isFinite(parsedUnitPrice) ? parsedUnitPrice : 0;

  log.items = log.items || [];
  log.items.push({
    id: uid(),
    productId: product.id,
    qty: parsedQty,
    unitPrice: safeUnitPrice,
    note: ""
  });
  return true;
}

function currentView(){
  return ui.navStack[ui.navStack.length - 1] || { view: "logs" };
}

function updateTabs(){
  const key = ui.navStack[0]?.view || "logs";
  $("#tab-logs").classList.toggle("hidden", key !== "logs");
  $("#tab-settlements").classList.toggle("hidden", key !== "settlements");
  $("#tab-meer").classList.toggle("hidden", key !== "meer");

  $("#nav-logs").classList.toggle("active", key === "logs");
  $("#nav-settlements").classList.toggle("active", key === "settlements");
  $("#nav-meer").classList.toggle("active", key === "meer");

  $("#nav-logs").setAttribute("aria-selected", String(key === "logs"));
  $("#nav-settlements").setAttribute("aria-selected", String(key === "settlements"));
  $("#nav-meer").setAttribute("aria-selected", String(key === "meer"));
}

function viewTitle(viewState){
  const view = viewState?.view;
  if (view === "logs") return "Werk";
  if (view === "settlements") return "Geld";
  if (view === "meer") return "Meer";
  if (view === "customers") return "Klanten";
  if (view === "products") return "Producten";
  if (view === "settings") return "Instellingen";
  if (view === "logDetail"){
    const l = state.logs.find(x => x.id === viewState.id);
    return l ? `${cname(l.customerId)} · ${l.date}` : "Werklog";
  }
  if (view === "settlementDetail"){
    const s = state.settlements.find(x => x.id === viewState.id);
    return s ? `${cname(s.customerId)}${s.date ? ` · ${s.date}` : ""}` : "Afrekening";
  }
  if (view === "settlementLogOverview") return "Afrekening log-overzicht";
  if (view === "customerDetail"){
    const c = state.customers.find(x => x.id === viewState.id);
    return c ? (c.nickname || c.name || "Klant") : "Klant";
  }
  if (view === "productDetail"){
    const p = state.products.find(x => x.id === viewState.id);
    return p ? (p.name || "Product") : "Product";
  }
  if (view === "newLog") return "Nieuwe werklog";
  return "Tuinlog";
}

function renderTopbar(){
  const active = currentView();
  const topbar = document.querySelector(".topbar");
  const subtitleEl = $("#topbarSubtitle");
  const btnNew = $("#btnNewLog");
  topbar.classList.remove("nav--free", "nav--linked", "nav--calculated", "nav--paid");
  subtitleEl.classList.add("hidden");
  subtitleEl.textContent = "";
  btnNew.classList.remove("topbar-edit");

  if (active.view === "logDetail"){
    const log = state.logs.find(x => x.id === active.id);
    if (log){
      const visual = getLogVisualState(log);
      topbar.classList.add(`nav--${visual.state}`);
      $("#topbarTitle").textContent = cname(log.customerId);
      subtitleEl.textContent = formatLogDatePretty(log.date);
      subtitleEl.classList.remove("hidden");
    } else {
      $("#topbarTitle").textContent = viewTitle(active);
    }
  } else if (active.view === "settlementDetail"){
    const settlement = state.settlements.find(x => x.id === active.id);
    if (settlement){
      const visual = getSettlementVisualState(settlement);
      topbar.classList.add(visual.navClass);
      $("#topbarTitle").textContent = cname(settlement.customerId);
      subtitleEl.textContent = formatDatePretty(settlement.date);
      subtitleEl.classList.remove("hidden");
    } else {
      $("#topbarTitle").textContent = viewTitle(active);
    }
  } else {
    $("#topbarTitle").textContent = viewTitle(active);
  }

  const root = ui.navStack[0]?.view || "logs";
  const showBack = ui.navStack.length > 1;
  const isSettlementDetail = active.view === "settlementDetail";
  const settlement = isSettlementDetail ? state.settlements.find(x => x.id === active.id) : null;
  const isEdit = settlement ? isSettlementEditing(settlement.id) : false;

  $("#btnBack").classList.toggle("hidden", !showBack);

  if (isSettlementDetail && settlement){
    btnNew.classList.remove("hidden");
    btnNew.classList.add("topbar-edit");
    btnNew.innerHTML = isEdit
      ? `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5L19 7" stroke-linecap="round" stroke-linejoin="round"></path></svg><span id="btnTopbarActionLabel">Gereed</span>`
      : `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21l3.5-.8L19 7.7a1.8 1.8 0 0 0 0-2.5l-.2-.2a1.8 1.8 0 0 0-2.5 0L3.8 17.5z"></path><path d="M14 5l5 5"></path></svg><span id="btnTopbarActionLabel">Bewerk</span>`;
    btnNew.setAttribute("aria-label", isEdit ? "Gereed" : "Bewerk");
    btnNew.setAttribute("title", isEdit ? "Gereed" : "Bewerk");
    return;
  }

  btnNew.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  btnNew.classList.toggle("hidden", showBack);
  btnNew.setAttribute("aria-label", "Nieuwe werklog");
  btnNew.setAttribute("title", "Nieuwe werklog");
}

function setTab(key){
  ui.navStack = [{ view: key }];
  ui.transition = null;
  render();
}

function pushView(viewState){
  ui.transition = "push";
  ui.navStack.push(viewState);
  render();
}

function popView(){
  if (ui.navStack.length <= 1) return;
  ui.transition = "pop";
  ui.navStack.pop();
  render();
}

$("#nav-logs").addEventListener("click", ()=>setTab("logs"));
$("#nav-settlements").addEventListener("click", ()=>setTab("settlements"));
$("#nav-meer").addEventListener("click", ()=>setTab("meer"));

$("#btnBack").addEventListener("click", popView);
$("#btnNewLog").onclick = ()=>{
  const active = currentView();
  if (active.view === "settlementDetail"){
    const settlement = state.settlements.find(x => x.id === active.id);
    if (!settlement) return;
    toggleEditSettlement(settlement.id);
    return;
  }
  if (ui.navStack.length > 1) return;
  pushView({ view: "newLog" });
};

function createSettlement(){
  return actions.createSettlement();
}

function startWorkLog(customerId){
  if (!customerId) return;
  if (state.activeLogId){
    alert("Er is al een actieve werklog.");
    return;
  }
  const log = actions.startLog(customerId);
  if (!log) return;
  if (ui.navStack.length > 1) popView();
}

function openSheet(type, id){
  const map = {
    "log": "logDetail",
    "customer": "customerDetail",
    "product": "productDetail",
    "settlement": "settlementDetail",
    "new-log": "newLog"
  };
  const view = map[type];
  if (!view) return;
  pushView(id ? { view, id } : { view });
}
function closeSheet(){
  popView();
}

// ---------- Render ----------
function render(){
  const root = ui.navStack[0]?.view || "logs";
  updateTabs();
  if (root === "logs") renderLogs();
  if (root === "settlements") renderSettlements();
  if (root === "meer") renderMeer();

  renderTopbar();

  const detailPage = $("#detailPage");
  const rootPage = $("#rootPage");
  if (ui.navStack.length > 1){
    detailPage.classList.remove("hidden");
    renderSheet();
    if (ui.transition === "push"){
      detailPage.className = "page enter";
      rootPage.className = "page active";
      requestAnimationFrame(()=>{
        detailPage.className = "page active";
        rootPage.className = "page exitLeft";
      });
    } else {
      detailPage.className = "page active";
      rootPage.className = "page exitLeft";
    }
  } else {
    if (ui.transition === "pop" && !detailPage.classList.contains("hidden")){
      detailPage.className = "page active";
      rootPage.className = "page exitLeft";
      requestAnimationFrame(()=>{
        detailPage.className = "page enter";
        rootPage.className = "page active";
      });
      setTimeout(()=>{
        detailPage.className = "page hidden";
        detailPage.innerHTML = '<div class="page-inner"><div class="detail-head"><div id="sheetTitle" class="hidden"></div><div class="sheet-actions" id="sheetActions"></div></div><div class="sheet-body" id="sheetBody"></div></div>';
      }, 280);
    } else {
      detailPage.className = "page hidden";
      rootPage.className = "page active";
    }
  }
  ui.transition = null;
}

function getLogbookPeriodStart(period){
  const current = new Date();
  if (period === "week"){
    const d = new Date(current);
    const offset = (d.getDay() + 6) % 7;
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() - offset);
    return d.getTime();
  }
  if (period === "month"){
    return new Date(current.getFullYear(), current.getMonth(), 1).getTime();
  }
  if (period === "30d"){
    return now() - (30 * 86400000);
  }
  return null;
}

function logStatusBucket(status){
  if (status === "paid") return "paid";
  if (status === "calculated") return "calculated";
  return "open";
}

function logStatusLabel(status){
  const bucket = logStatusBucket(status);
  if (bucket === "paid") return "Betaald";
  if (bucket === "calculated") return "Berekend";
  return "Open";
}

function compareByDirection(a, b, dir){
  return dir === "asc" ? (a > b ? 1 : a < b ? -1 : 0) : (a < b ? 1 : a > b ? -1 : 0);
}

function applyFiltersAndSort(logs){
  const cfg = state.logbook || {};
  const statusFilter = cfg.statusFilter || "open";
  const customerId = cfg.customerId || "all";
  const period = cfg.period || "all";
  const groupBy = cfg.groupBy || "date";
  const sortDir = cfg.sortDir || "desc";
  const minTimestamp = getLogbookPeriodStart(period);

  const filtered = logs.filter(log => {
    const status = getWorkLogStatus(log.id);
    const isPaid = status === "paid";
    if (statusFilter === "open" && isPaid) return false;
    if (statusFilter === "paid" && !isPaid) return false;
    if (customerId !== "all" && log.customerId !== customerId) return false;

    if (minTimestamp != null){
      const ts = log.createdAt || new Date(`${log.date}T00:00:00`).getTime();
      if (Number.isFinite(ts) && ts < minTimestamp) return false;
    }
    return true;
  });

  const decorated = filtered.map(log => ({
    log,
    status: getWorkLogStatus(log.id),
    customer: cname(log.customerId),
    dateValue: log.createdAt || new Date(`${log.date}T00:00:00`).getTime() || 0,
    workTimeValue: sumWorkMs(log),
    productValue: sumItemsAmount(log)
  }));

  decorated.sort((a,b) => {
    if (groupBy === "customer"){
      const byCustomer = compareByDirection(a.customer.localeCompare(b.customer, "nl"), 0, sortDir);
      if (byCustomer !== 0) return byCustomer;
      return compareByDirection(a.dateValue, b.dateValue, "desc");
    }
    if (groupBy === "workTime"){
      const byWork = compareByDirection(a.workTimeValue, b.workTimeValue, sortDir);
      if (byWork !== 0) return byWork;
      return compareByDirection(a.dateValue, b.dateValue, "desc");
    }
    if (groupBy === "productTotal"){
      const byProduct = compareByDirection(a.productValue, b.productValue, sortDir);
      if (byProduct !== 0) return byProduct;
      return compareByDirection(a.dateValue, b.dateValue, "desc");
    }
    if (groupBy === "status"){
      const order = { open: 0, calculated: 1, paid: 2 };
      const byStatus = compareByDirection(order[logStatusBucket(a.status)] ?? 0, order[logStatusBucket(b.status)] ?? 0, sortDir);
      if (byStatus !== 0) return byStatus;
      return compareByDirection(a.dateValue, b.dateValue, "desc");
    }
    return compareByDirection(a.dateValue, b.dateValue, sortDir);
  });

  if (groupBy === "workTime" || groupBy === "productTotal"){
    return [{ header: "", logs: decorated.map(x => x.log) }];
  }

  const grouped = new Map();
  for (const item of decorated){
    let key = "all";
    let header = "";
    if (groupBy === "date"){
      key = item.log.date;
      header = formatLogDatePretty(item.log.date);
    } else if (groupBy === "customer"){
      key = item.log.customerId || "unknown";
      header = item.customer;
    } else if (groupBy === "status"){
      key = logStatusBucket(item.status);
      header = logStatusLabel(item.status);
    }

    if (!grouped.has(key)) grouped.set(key, { header, logs: [] });
    grouped.get(key).logs.push(item.log);
  }
  return [...grouped.values()];
}

function renderLogs(){
  const el = $("#tab-logs");
  const active = state.activeLogId ? state.logs.find(l => l.id === state.activeLogId) : null;
  const logbook = state.logbook || {};
  const statusFilter = logbook.statusFilter || "open";
  const showFilters = Boolean(logbook.showFilters);
  const customerId = logbook.customerId || "all";
  const period = logbook.period || "all";
  const groupBy = logbook.groupBy || "date";
  const sortDir = logbook.sortDir || "desc";

  // Timer-first: idle or active state
  let timerBlock = "";
  if (active){
    const isPaused = currentOpenSegment(active)?.type === "break";
    timerBlock = `
      <div class="timer-active">
        <div class="timer-active-customer">${esc(cname(active.customerId))}</div>
        <div class="timer-active-elapsed">${durMsToHM(sumWorkMs(active))}</div>
        <div class="timer-active-meta">${isPaused ? "Pauze" : "Actief"} · gestart ${fmtClock(active.createdAt)}</div>
        <div class="timer-active-actions">
          <button class="timer-action-btn pause-btn ${isPaused ? "is-paused" : ""}" id="btnPause" title="${isPaused ? "Hervat werk" : "Pauze"}" aria-label="${isPaused ? "Hervat werk" : "Pauze"}">
            ${isPaused
              ? `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6l10 6-10 6z" stroke-linejoin="round"/></svg>`
              : `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 5v14M16 5v14" stroke-linecap="round"/></svg>`}
          </button>
          <button class="timer-action-btn stop-btn" id="btnStop" title="Stop" aria-label="Stop werklog">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>
          </button>
        </div>
      </div>
    `;
  } else {
    // Idle state: big tap target + recent customers
    const recentCustomerIds = [...new Set(
      state.logs
        .filter(l => l.customerId)
        .sort((a,b) => (b.createdAt||0) - (a.createdAt||0))
        .map(l => l.customerId)
    )].slice(0, 6);
    const recentChips = recentCustomerIds
      .map(cid => {
        const c = getCustomer(cid);
        if (!c) return "";
        return `<button class="recent-customer-chip" data-start-customer="${esc(cid)}">${esc(c.nickname || c.name || "Klant")}</button>`;
      }).filter(Boolean).join("");

    timerBlock = `
      <div class="timer-idle">
        <button class="timer-idle-cta" id="btnTimerStart">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6l10 6-10 6z" stroke-linejoin="round"/></svg>
          <span class="timer-idle-label">Tik om te beginnen</span>
        </button>
        ${recentChips ? `<div class="timer-idle-sub">of kies een klant:</div><div class="recent-customers">${recentChips}</div>` : `<div class="timer-idle-sub">Maak eerst een klant aan via Meer</div>`}
      </div>
    `;
  }

  const sections = applyFiltersAndSort([...state.logs]);
  const list = sections.some(section => section.logs.length)
    ? sections.map(section => `
      ${section.header ? `<div class="log-group-header">${esc(section.header)}</div>` : ""}
      ${section.logs.map(renderLogCard).join("")}
    `).join("")
    : `<div class="meta-text" style="padding:8px 4px;">Geen logs voor deze filter.</div>`;

  const customerOptions = [`<option value="all">Alle klanten</option>`, ...state.customers
    .slice()
    .sort((a,b)=>(a.nickname||a.name||"").localeCompare(b.nickname||b.name||""))
    .map(c => `<option value="${esc(c.id)}" ${customerId === c.id ? "selected" : ""}>${esc(c.nickname||c.name||"Klant")}</option>`)
  ].join("");

  const groupOptions = [
    { value: "date", label: "Datum" },
    { value: "customer", label: "Klant" },
    { value: "workTime", label: "Werktijd" },
    { value: "productTotal", label: "Producten €" },
    { value: "status", label: "Status" }
  ].map(opt => `<option value="${opt.value}" ${groupBy === opt.value ? "selected" : ""}>${opt.label}</option>`).join("");

  el.innerHTML = `<div class="stack">${timerBlock}<div class="logs-section-header"><span class="logs-section-title">Alle logs</span><div class="log-toolbar"><div class="category-wrap"><div class="category-pill"><select id="logGroupBy" aria-label="Categorie">${groupOptions}</select><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 10l5 5 5-5" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div><button class="icon-toggle icon-toggle-neutral" id="btnLogSortDir" aria-label="Sorteerrichting" title="Sorteerrichting" style="width:34px;height:34px;min-height:34px;">${sortDir === "desc" ? `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 5v14M8 9l4-4 4 4" stroke-linecap="round" stroke-linejoin="round"/></svg>` : `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 5v14M8 15l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>`}</button><button class="btn btn-filters ${showFilters ? "is-active" : ""}" id="btnToggleLogFilters" aria-expanded="${showFilters}" style="min-height:34px;padding:5px 8px;"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:16px;height:16px;"><path d="M4 6h16M7 12h10M10 18h4" stroke-linecap="round"/></svg></button></div></div>${showFilters ? `<div class="log-filter-row"><div class="log-chip"><label>Status</label><div class="segmented" role="group" aria-label="Status filter"><button class="seg-btn ${statusFilter === "open" ? "is-active" : ""}" data-log-status="open">Open</button><button class="seg-btn ${statusFilter === "paid" ? "is-active" : ""}" data-log-status="paid">Betaald</button><button class="seg-btn ${statusFilter === "all" ? "is-active" : ""}" data-log-status="all">Alles</button></div></div><div class="log-chip"><label for="logCustomerFilter">Klant</label><select id="logCustomerFilter">${customerOptions}</select></div><div class="log-chip"><label for="logPeriodFilter">Periode</label><select id="logPeriodFilter"><option value="all" ${period === "all" ? "selected" : ""}>Alles</option><option value="week" ${period === "week" ? "selected" : ""}>Deze week</option><option value="month" ${period === "month" ? "selected" : ""}>Deze maand</option><option value="30d" ${period === "30d" ? "selected" : ""}>Laatste 30 dagen</option></select></div><div class="log-chip log-chip-reset"><button class="btn" id="btnResetLogFilters">Reset filters</button></div></div>` : ""}<div class="flat-list">${list}</div></div>`;

  // Timer-first actions
  if (active){
    $("#btnPause")?.addEventListener("click", ()=>{
      const seg = currentOpenSegment(active);
      if (!seg) openSegment(active,"work");
      else if (seg.type === "work"){ closeOpenSegment(active); openSegment(active,"break"); }
      else { closeOpenSegment(active); openSegment(active,"work"); }

      actions.pauseLog(active.id);
    });
    $("#btnStop")?.addEventListener("click", ()=>{
      actions.stopLog(active.id);
    });
    // Tap timer block to open active log detail
    $(".timer-active")?.addEventListener("click", (e)=>{
      if (e.target.closest("button")) return;
      openSheet("log", active.id);
    });
  } else {
    // Idle state: tap to start with newLog sheet
    $("#btnTimerStart")?.addEventListener("click", ()=>{
      if (state.customers.length === 0){
        alert("Maak eerst een klant aan via het Meer-scherm.");
        return;
      }
      pushView({ view: "newLog" });
    });
    // Recent customer chips: start work directly
    el.querySelectorAll("[data-start-customer]").forEach(chip=>{
      chip.addEventListener("click", ()=>{
        const cid = chip.getAttribute("data-start-customer");
        if (cid) startWorkLog(cid);
      });
    });
  }

  el.querySelectorAll("[data-open-log]").forEach(x=>{
    x.addEventListener("click", ()=> openSheet("log", x.getAttribute("data-open-log")));
  });
  $("#btnToggleLogFilters")?.addEventListener("click", ()=>{

    actions.setLogbook({ showFilters: !state.logbook.showFilters });
    renderLogs();
  });
  $("#logGroupBy")?.addEventListener("change", ()=>{

    actions.setLogbook({ groupBy: $("#logGroupBy").value || "date" });
    renderLogs();
  });
  $("#btnLogSortDir")?.addEventListener("click", ()=>{

    actions.setLogbook({ sortDir: state.logbook.sortDir === "asc" ? "desc" : "asc" });
    renderLogs();
  });
  el.querySelectorAll("[data-log-status]").forEach(btn=>{
    btn.addEventListener("click", ()=>{

      actions.setLogbook({ statusFilter: btn.getAttribute("data-log-status") || "open" });
      renderLogs();
    });
  });
  $("#logCustomerFilter")?.addEventListener("change", ()=>{

    actions.setLogbook({ customerId: $("#logCustomerFilter").value || "all" });
    renderLogs();
  });
  $("#logPeriodFilter")?.addEventListener("change", ()=>{

    actions.setLogbook({ period: $("#logPeriodFilter").value || "all" });
    renderLogs();
  });
  $("#btnResetLogFilters")?.addEventListener("click", ()=>{

    actions.setLogbook({ statusFilter: "open", customerId: "all", period: "all" });
    renderLogs();
  });
}

function _attachSettingsHandlers(){
  const setBackupFeedback = (type, text)=>{
    state.ui = state.ui || {};
    state.ui.backupFeedback = { type, text };
    const feedbackEl = $("#backupFeedback");
    if (!feedbackEl) return;
    feedbackEl.textContent = text || "";
    feedbackEl.classList.remove("is-error", "is-success");
    if (text){
      feedbackEl.classList.add(type === "error" ? "is-error" : "is-success");
    }
  };

  const parseBackupFile = (file)=> new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=> resolve(String(reader.result || ""));
    reader.onerror = ()=> reject(new Error("Bestand kon niet worden gelezen."));
    reader.readAsText(file);
  });

  const validateBackupPayload = (payload)=>{
    if (!payload || typeof payload !== "object") return "Ongeldige backup: JSON-object ontbreekt.";
    if (payload.version !== STORAGE_KEY) return "Ongeldige backup-versie. Alleen backups van TuinLog MVP v1 zijn toegestaan.";
    if (!payload.data || typeof payload.data !== "object") return "Ongeldige backup: data-object ontbreekt.";
    const required = ["customers", "logs", "settlements", "settings"];
    const missing = required.filter((key)=> !(key in payload.data));
    if (missing.length) return `Ongeldige backup: ontbrekende velden (${missing.join(", ")}).`;
    return "";
  };

  $("#saveSettings").onclick = ()=>{
    const hourly = Number(String($("#settingHourly").value).replace(",", ".") || "0");
    const vatPct = Number(String($("#settingVat").value).replace(",", ".") || "0");

    actions.updateSettings(hourly, vatPct / 100);
    alert("Instellingen opgeslagen.");
  };

  $("#fillDemoBtn").onclick = ()=>{
    if (!confirmAction("Demo data toevoegen voor 3 maanden?")) return;
    const changed = seedDemoMonths(state, { months: 3, force: false });
    if (changed){

      commit();
    } else {
      alert("Demo data bestaat al. Wis eerst demo data om opnieuw te seeden.");
    }
  };

  $("#clearDemoBtn").onclick = ()=>{
    const demoRecordCount = state.customers.filter(c => c.demo).length + state.logs.filter(l => l.demo).length + state.settlements.filter(s => s.demo).length;
    if (!demoRecordCount){
      alert("Geen demo data om te wissen.");
      return;
    }
    if (!confirmAction("Alle demo records wissen? Echte data blijft behouden.")) return;
    clearDemoData(state);
    closeSheet();

    commit();
  };

  $("#resetAllBtn").onclick = ()=>{
    if (!confirmAction("Reset alles? Dit wist alle lokale data.")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  };

  $("#backupExportBtn").onclick = ()=>{
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw){
        setBackupFeedback("error", "Er is geen lokale data gevonden om te exporteren.");
        return;
      }
      const parsed = JSON.parse(raw);
      const payload = {
        exportedAt: new Date().toISOString(),
        version: STORAGE_KEY,
        data: parsed,
      };
      const today = new Date().toISOString().slice(0,10);
      const filename = `tuinlog-backup-${today}.json`;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setBackupFeedback("success", `Backup opgeslagen als ${filename}.`);
    } catch {
      setBackupFeedback("error", "Backup exporteren is mislukt. Controleer of je data geldig is.");
    }
  };

  $("#backupImportBtn").onclick = ()=>{
    $("#backupImportInput")?.click();
  };

  $("#backupImportInput").onchange = async (event)=>{
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await parseBackupFile(file);
      let payload = null;
      try {
        payload = JSON.parse(text);
      } catch {
        setBackupFeedback("error", "Import mislukt: bestand bevat geen geldige JSON.");
        event.target.value = "";
        return;
      }

      const validationError = validateBackupPayload(payload);
      if (validationError){
        setBackupFeedback("error", validationError);
        event.target.value = "";
        return;
      }

      const exportedAt = payload.exportedAt || "onbekende datum";
      const confirmed = await openConfirmModal({
        title: "Backup herstellen",
        message: `Weet je zeker dat je alle huidige data wilt vervangen door de backup van ${exportedAt}?`,
        confirmText: "Herstellen",
        cancelText: "Annuleren",
      });
      if (!confirmed){
        setBackupFeedback("error", "Herstel geannuleerd.");
        event.target.value = "";
        return;
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.data));
      location.reload();
    } catch {
      setBackupFeedback("error", "Import mislukt: kon het backup-bestand niet verwerken.");
    } finally {
      event.target.value = "";
    }
  };

  $("#backupWipeBtn").onclick = async ()=>{
    const firstConfirm = await openConfirmModal({
      title: "Alles wissen",
      message: "Weet je zeker dat je alle data permanent wilt wissen? Dit kan niet ongedaan gemaakt worden.",
      confirmText: "Verder",
      cancelText: "Annuleren",
      danger: true,
    });
    if (!firstConfirm){
      setBackupFeedback("error", "Wissen geannuleerd.");
      return;
    }

    const secondConfirm = await openTextConfirmModal({
      title: "Laatste bevestiging",
      message: "Dit verwijdert alle lokale data definitief.",
      expectedText: "WISSEN",
      confirmText: "Definitief wissen",
      cancelText: "Annuleren",
    });
    if (!secondConfirm){
      setBackupFeedback("error", "Wissen geannuleerd.");
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  };
}

function renderSettlements(){
  const el = $("#tab-settlements");
  const list = [...state.settlements].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).map(s=>{
    const pay = settlementPaymentState(s);
    const visual = getSettlementVisualState(s);
    const linkedLogs = (s.logIds||[])
      .map(id => state.logs.find(l => l.id === id))
      .filter(Boolean);
    const totalMinutes = Math.floor(linkedLogs.reduce((acc, log) => acc + sumWorkMs(log), 0) / 60000);
    const grand = round2(pay.invoiceTotal + pay.cashTotal);

    return `
      <div class="item ${visual.accentClass}" data-open-settlement="${s.id}">
        <div class="item-main">
          <div class="item-title">${esc(cname(s.customerId))}</div>
          <div class="meta-text" style="margin-top:2px;">
            ${esc(formatDatePretty(s.date))} · ${(s.logIds||[]).length} logs · ${formatDurationCompact(totalMinutes)}
          </div>
        </div>
        <div class="amount-prominent">${formatMoneyEUR(grand)}</div>
      </div>
    `;
  }).join("");

  el.innerHTML = `
    <div class="stack">
      <div class="geld-header">
        <span class="geld-header-title">Afrekeningen</span>
        <button class="btn-new-settlement" id="btnNewSettlement">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
          Nieuwe afrekening
        </button>
      </div>
      <div class="flat-list">${list || `<div class="meta-text" style="padding:8px 4px;">Nog geen afrekeningen.</div>`}</div>
    </div>
  `;

  $("#btnNewSettlement")?.addEventListener("click", ()=>{
    const s = createSettlement();
    openSheet("settlement", s.id);
  });

  el.querySelectorAll("[data-open-settlement]").forEach(x=>{
    x.addEventListener("click", ()=> openSheet("settlement", x.getAttribute("data-open-settlement")));
  });
}

// ---------- Meer tab ----------
function renderMeer(){
  const el = $("#tab-meer");
  const chevron = `<svg class="meer-item-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  el.innerHTML = `
    <div class="stack">
      <div class="meer-list">
        <button class="meer-item" data-meer="customers">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke-linecap="round"/><path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/></svg>
          <span class="meer-item-label">Klanten</span>
          ${chevron}
        </button>
        <button class="meer-item" data-meer="products">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 8l-8-4-8 4 8 4 8-4Z" stroke-linejoin="round"/><path d="M4 8v8l8 4 8-4V8" stroke-linejoin="round"/><path d="M12 12v8" stroke-linecap="round"/></svg>
          <span class="meer-item-label">Producten</span>
          ${chevron}
        </button>
        <button class="meer-item" data-meer="settings">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="M4 13.2v-2.4l2.1-.8c.2-.5.4-1 .7-1.5L6 6.4l1.7-1.7 2.1.8c.5-.3 1-.5 1.5-.7L12 2.7h2.4l.8 2.1c.5.2 1 .4 1.5.7l2.1-.8L20.5 6.4l-.8 2.1c.3.5.5 1 .7 1.5l2.1.8v2.4l-2.1.8c-.2.5-.4 1-.7 1.5l.8 2.1-1.7 1.7-2.1-.8c-.5.3-1 .5-1.5.7l-.8 2.1H12l-.8-2.1c-.5-.2-1-.4-1.5-.7l-2.1.8L6 17.6l.8-2.1c-.3-.5-.5-1-.7-1.5L4 13.2Z" stroke-linejoin="round"/></svg>
          <span class="meer-item-label">Instellingen</span>
          ${chevron}
        </button>
      </div>
    </div>
  `;

  el.querySelectorAll("[data-meer]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const target = btn.getAttribute("data-meer");
      if (target === "customers"){
        pushView({ view: "customers" });
      } else if (target === "products"){
        pushView({ view: "products" });
      } else if (target === "settings"){
        pushView({ view: "settings" });
      }
    });
  });
}

// ---------- Sheet rendering ----------
function renderSheet(){
  const active = currentView();
  const actions = $("#sheetActions");
  const body = $("#sheetBody");
  if (!actions || !body) return;
  actions.innerHTML = "";
  body.innerHTML = "";

  if (active.view === "customerDetail") renderCustomerSheet(active.id);
  if (active.view === "productDetail") renderProductSheet(active.id);
  if (active.view === "logDetail") renderLogSheet(active.id);
  if (active.view === "settlementDetail") renderSettlementSheet(active.id);
  if (active.view === "settlementLogOverview") renderSettlementLogOverviewSheet(active.id);
  if (active.view === "newLog") renderNewLogSheet();
  if (active.view === "customers") renderCustomersSheet();
  if (active.view === "products") renderProductsSheet();
  if (active.view === "settings") renderSettingsSheet();
}

function renderCustomersSheet(){
  const body = $("#sheetBody");
  const list = state.customers.map(c => `
    <div class="item" data-open-customer="${c.id}">
      <div class="item-main">
        <div class="item-title">${esc(c.nickname||c.name||"Klant")}</div>
        <div class="meta-text">${esc(c.address||"")}</div>
      </div>
    </div>
  `).join("");

  body.innerHTML = `
    <div class="stack">
      <div class="geld-header">
        <span class="geld-header-title">Klanten</span>
        <button class="btn" id="btnNewCustomer">Nieuwe klant</button>
      </div>
      <div class="flat-list">${list || `<div class="meta-text" style="padding:8px 4px;">Nog geen klanten.</div>`}</div>
    </div>
  `;

  body.querySelector("#btnNewCustomer")?.addEventListener("click", ()=>{
    const c = actions.addCustomer({ id: uid(), nickname:"", name:"", address:"", createdAt: now() });
    openSheet("customer", c.id);
  });

  body.querySelectorAll("[data-open-customer]").forEach(x=>{
    x.addEventListener("click", ()=> openSheet("customer", x.getAttribute("data-open-customer")));
  });
}

function renderProductsSheet(){
  const body = $("#sheetBody");
  const list = state.products.map(p => `
    <div class="item" data-open-product="${p.id}">
      <div class="item-main">
        <div class="item-title">${esc(p.name)}</div>
        <div class="meta-text">${esc(p.unit)} · ${fmtMoney(p.unitPrice)} · btw ${(Number(p.vatRate||0)*100).toFixed(0)}%</div>
      </div>
      <div class="amount-prominent">${fmtMoney(p.unitPrice)}</div>
    </div>
  `).join("");

  body.innerHTML = `
    <div class="stack">
      <div class="geld-header">
        <span class="geld-header-title">Producten</span>
        <button class="btn" id="btnNewProduct">Nieuw product</button>
      </div>
      <div class="flat-list">${list || `<div class="meta-text" style="padding:8px 4px;">Nog geen producten.</div>`}</div>
    </div>
  `;

  body.querySelector("#btnNewProduct")?.addEventListener("click", ()=>{
    const p = actions.addProduct({ id: uid(), name:"", unit:"keer", unitPrice:0, vatRate:0.21, defaultBucket:"invoice" });
    openSheet("product", p.id);
  });

  body.querySelectorAll("[data-open-product]").forEach(x=>{
    x.addEventListener("click", ()=> openSheet("product", x.getAttribute("data-open-product")));
  });
}

function renderSettingsSheet(){
  const body = $("#sheetBody");
  const demoCounts = {
    customers: state.customers.filter(c => c.demo).length,
    logs: state.logs.filter(l => l.demo).length,
    settlements: state.settlements.filter(a => a.demo).length,
  };

  body.innerHTML = `
    <div class="stack">
      <div class="card stack">
        <div class="item-title">Algemeen</div>
        <div class="row">
          <div style="flex:1; min-width:170px;">
            <label>Uurtarief</label>
            <input id="settingHourly" inputmode="decimal" value="${esc(String(state.settings.hourlyRate ?? 38))}" />
          </div>
          <div style="flex:1; min-width:170px;">
            <label>BTW %</label>
            <input id="settingVat" inputmode="decimal" value="${esc(String(round2(Number(state.settings.vatRate || 0) * 100)))}" />
          </div>
        </div>
        <button class="btn primary" id="saveSettings">Opslaan</button>
      </div>

      <div class="card stack">
        <div class="item-title">Demo data</div>
        <div class="meta-text">Demo records: klanten ${demoCounts.customers} · logs ${demoCounts.logs} · afrekeningen ${demoCounts.settlements}</div>
        <button class="btn" id="fillDemoBtn">Vul demo data (3 maanden)</button>
        <button class="btn danger" id="clearDemoBtn">Wis demo data</button>
      </div>

      <div class="card stack">
        <div class="item-title">Geavanceerd</div>
        <button class="btn danger" id="resetAllBtn">Reset alles</button>
      </div>

      <div class="card stack">
        <div class="item-title">Backup & Herstel</div>
        <div class="meta-text">Maak een reservekopie van je volledige lokale data of herstel een eerdere backup.</div>
        <div class="row">
          <button class="btn primary" id="backupExportBtn">Backup downloaden</button>
          <button class="btn" id="backupImportBtn">Backup importeren</button>
          <input id="backupImportInput" type="file" accept=".json,application/json" class="hidden" />
        </div>
        <button class="btn danger" id="backupWipeBtn">Alles wissen</button>
        <div class="meta-text" style="color:rgba(255,77,77,.92);">Let op: hiermee verwijder je alle klanten, werklogs en facturen permanent.</div>
        <div class="meta-text backup-feedback ${state.ui?.backupFeedback?.type === "error" ? "is-error" : "is-success"}" id="backupFeedback">${esc(state.ui?.backupFeedback?.text || "")}</div>
      </div>
    </div>
  `;

  // Re-attach settings event handlers
  _attachSettingsHandlers();
}

function renderNewLogSheet(){
  const active = state.activeLogId ? state.logs.find(l => l.id === state.activeLogId) : null;
  const customerOptions = state.customers.map(c => `<option value="${c.id}">${esc(c.nickname||c.name||"Klant")}</option>`).join("");

  $("#sheetTitle").textContent = "Nieuwe werklog";
  $("#sheetBody").innerHTML = `
    <div class="stack">
      ${active ? `
      <div class="card stack">
        <div class="item-title">Actieve werklog</div>
        <div class="small mono">${esc(cname(active.customerId))} • gestart ${fmtClock(active.createdAt)}</div>
        <button class="btn" id="btnOpenActiveFromNew">Open actieve werklog</button>
      </div>
      ` : ""}
      <div class="card stack">
        <div>
          <label>Klant</label>
          <select id="startCustomer">${customerOptions || `<option value="">(Geen klanten)</option>`}</select>
        </div>
        <button class="btn primary" id="btnStartFromSheet" ${(state.customers.length && !active) ? "" : "disabled"}>Start werk</button>
        ${state.customers.length ? "" : `<div class="small">Maak eerst een klant aan.</div>`}
      </div>
    </div>
  `;

  $("#btnStartFromSheet")?.addEventListener("click", ()=>{
    const cid = $("#startCustomer")?.value;
    startWorkLog(cid);
  });
  $("#btnOpenActiveFromNew")?.addEventListener("click", ()=>{
    if (!active) return;
    openSheet("log", active.id);
  });
}

function renderCustomerSheet(id){
  const c = getCustomer(id);
  if (!c){ closeSheet(); return; }
  $("#sheetTitle").textContent = "Klant";

  const logs = state.logs.filter(l => l.customerId === c.id).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const settlements = state.settlements.filter(s => s.customerId === c.id).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));

  $("#sheetActions").innerHTML = `
    <button class="btn danger" id="delCustomer">Verwijder</button>
  `;

  $("#sheetBody").innerHTML = `
    <div class="stack">
      <div class="card stack">
        <div class="item-title">Bewerken</div>
        <div class="row">
          <div style="flex:1; min-width:220px;">
            <label>Bijnaam</label>
            <input id="cNick" value="${esc(c.nickname||"")}" />
          </div>
          <div style="flex:1; min-width:220px;">
            <label>Naam</label>
            <input id="cName" value="${esc(c.name||"")}" />
          </div>
        </div>
        <div>
          <label>Adres</label>
          <input id="cAddr" value="${esc(c.address||"")}" />
        </div>
        <button class="btn primary" id="saveCustomer">Opslaan</button>
      </div>

      <div class="card stack">
        <div class="item-title">Werklogs</div>
        <div class="list">
          ${logs.slice(0,20).map(l=>{
            const cls = statusClassFromStatus(getWorkLogStatus(l.id));
            return `
              <div class="item ${cls}" data-open-log="${l.id}">
                <div class="item-main">
                  <div class="item-title">${esc(l.date)}</div>
                  <div class="item-sub mono">Werk ${durMsToHM(sumWorkMs(l))} • Producten ${fmtMoney(sumItemsAmount(l))}</div>
                </div>
                <div class="item-right"><span class="badge">open</span></div>
              </div>
            `;
          }).join("") || `<div class="small">Geen logs.</div>`}
        </div>
      </div>

      <div class="card stack">
        <div class="item-title">Afrekeningen</div>
        <div class="list">
          ${settlements.slice(0,20).map(s=>{
            const cls = settlementColorClass(s);
            const totInv = bucketTotals(s.lines,"invoice");
            const totCash = bucketTotals(s.lines,"cash");
            const grand = round2(totInv.total + totCash.subtotal);
            return `
              <div class="item ${cls}" data-open-settlement="${s.id}">
                <div class="item-main">
                  <div class="item-title">${esc(formatDatePretty(s.date))}</div>
                  <div class="item-sub mono tabular">logs ${(s.logIds||[]).length} • totaal ${formatMoneyEUR(grand)}</div>
                </div>
              </div>
            `;
          }).join("") || `<div class="small">Geen afrekeningen.</div>`}
        </div>
      </div>
    </div>
  `;

  $("#saveCustomer").onclick = ()=>{
    actions.updateCustomer(c.id, {
      nickname: ($("#cNick").value||"").trim(),
      name: ($("#cName").value||"").trim(),
      address: ($("#cAddr").value||"").trim()
    });
    alert("Opgeslagen.");
  };

  $("#delCustomer").onclick = ()=>{
    const hasLogs = state.logs.some(l => l.customerId === c.id);
    const hasSet = state.settlements.some(s => s.customerId === c.id);
    if (hasLogs || hasSet){ alert("Kan niet verwijderen: klant heeft logs/afrekeningen."); return; }
    if (!confirmDelete(`Klant: ${c.nickname||c.name||""}`)) return;
    actions.deleteCustomer(c.id);
    closeSheet();
  };

  $("#sheetBody").querySelectorAll("[data-open-log]").forEach(x=>{
    x.addEventListener("click", ()=> openSheet("log", x.getAttribute("data-open-log")));
  });
  $("#sheetBody").querySelectorAll("[data-open-settlement]").forEach(x=>{
    x.addEventListener("click", ()=> openSheet("settlement", x.getAttribute("data-open-settlement")));
  });
}

function renderProductSheet(id){
  const p = getProduct(id);
  if (!p){ closeSheet(); return; }
  $("#sheetTitle").textContent = "Product";
  $("#sheetActions").innerHTML = `<button class="btn danger" id="delProduct">Verwijder</button>`;

  const usedInLogs = state.logs.filter(l => (l.items||[]).some(it => it.productId === p.id)).slice(0,10);
  const usedInSet = state.settlements.filter(s => (s.lines||[]).some(li => li.productId === p.id)).slice(0,10);

  $("#sheetBody").innerHTML = `
    <div class="stack">
      <div class="card stack">
        <div class="item-title">Bewerken</div>
        <div class="row">
          <div style="flex:2; min-width:220px;">
            <label>Naam</label>
            <input id="pName" value="${esc(p.name||"")}" />
          </div>
          <div style="flex:1; min-width:140px;">
            <label>Eenheid</label>
            <input id="pUnit" value="${esc(p.unit||"keer")}" />
          </div>
        </div>
        <div class="row">
          <div style="flex:1; min-width:160px;">
            <label>Prijs per eenheid</label>
            <input id="pPrice" inputmode="decimal" value="${esc(String(p.unitPrice ?? 0))}" />
          </div>
          <div style="flex:1; min-width:160px;">
            <label>BTW (bv 0.21)</label>
            <input id="pVat" inputmode="decimal" value="${esc(String(p.vatRate ?? 0.21))}" />
          </div>
          <div style="flex:1; min-width:160px;">
            <label>Default</label>
            <select id="pBucket">
              <option value="invoice" ${p.defaultBucket==="invoice"?"selected":""}>factuur</option>
              <option value="cash" ${p.defaultBucket==="cash"?"selected":""}>cash</option>
            </select>
          </div>
        </div>
        <button class="btn primary" id="saveProduct">Opslaan</button>
      </div>

      <div class="card stack">
        <div class="item-title">Gebruikt in logs (recent)</div>
        <div class="list">
          ${usedInLogs.map(l=>`
            <div class="item" data-open-log="${l.id}">
              <div class="item-main">
                <div class="item-title">${esc(cname(l.customerId))}</div>
                <div class="item-sub mono">${esc(l.date)} • ${durMsToHM(sumWorkMs(l))}</div>
              </div>
              <div class="item-right"><span class="badge">open</span></div>
            </div>
          `).join("") || `<div class="small">Nog niet gebruikt.</div>`}
        </div>
      </div>

      <div class="card stack">
        <div class="item-title">Gebruikt in afrekeningen (recent)</div>
        <div class="list">
          ${usedInSet.map(s=>`
            <div class="item" data-open-settlement="${s.id}">
              <div class="item-main">
                <div class="item-title">${esc(cname(s.customerId))}</div>
                <div class="item-sub mono">${esc(s.date)} • ${statusLabelNL(s.status)}</div>
              </div>
              <div class="item-right"><span class="badge">open</span></div>
            </div>
          `).join("") || `<div class="small">Nog niet gebruikt.</div>`}
        </div>
      </div>
    </div>
  `;

  $("#saveProduct").onclick = ()=>{
    actions.updateProduct(p.id, {
      name: ($("#pName").value||"").trim(),
      unit: ($("#pUnit").value||"").trim() || "keer",
      unitPrice: Number(String($("#pPrice").value).replace(",", ".") || "0"),
      vatRate: Number(String($("#pVat").value).replace(",", ".") || "0.21"),
      defaultBucket: $("#pBucket").value
    });
    alert("Opgeslagen.");
  };

  $("#delProduct").onclick = ()=>{
    const used = state.logs.some(l => (l.items||[]).some(it => it.productId === p.id))
      || state.settlements.some(s => (s.lines||[]).some(li => li.productId === p.id));
    if (used){ alert("Kan niet verwijderen: product is gebruikt."); return; }
    if (!confirmDelete(`Product: ${p.name}`)) return;
    actions.deleteProduct(p.id);
    closeSheet();
  };

  $("#sheetBody").querySelectorAll("[data-open-log]").forEach(x=>{
    x.addEventListener("click", ()=> openSheet("log", x.getAttribute("data-open-log")));
  });
  $("#sheetBody").querySelectorAll("[data-open-settlement]").forEach(x=>{
    x.addEventListener("click", ()=> openSheet("settlement", x.getAttribute("data-open-settlement")));
  });
}

function renderLogSheet(id){
  const log = state.logs.find(l => l.id === id);
  if (!log){ closeSheet(); return; }
  $("#sheetTitle").textContent = "Werklog";
  const af = settlementForLog(log.id);
  const locked = false;
  $("#sheetActions").innerHTML = "";

  const settlementOptions = buildSettlementSelectOptions(log.customerId, af?.id);

  const visual = getLogVisualState(log);
  const statusPillClass = visual.state === "paid" ? "pill-paid" : visual.state === "calculated" ? "pill-calc" : visual.state === "linked" ? "pill-open" : "pill-neutral";
  const statusLabel = visual.state === "free" ? "vrij" : visual.state === "linked" ? "gekoppeld" : visual.state === "calculated" ? "berekend" : "betaald";
  const isEditing = state.ui.editLogId === log.id;

  function renderSegments(currentLog, editing){
    const segments = currentLog.segments || [];
    const totalWorkMinutes = segments
      .filter(s => s.type === "work")
      .reduce((sum, s) => sum + getSegmentMinutes(s), 0);
    const totalBreakMinutes = segments
      .filter(s => s.type === "break")
      .reduce((sum, s) => sum + getSegmentMinutes(s), 0);

    return `
      <section class="compact-section stack">
        <div class="row space">
          <div>
            <div class="item-title">Totale werktijd</div>
            <div class="small mono muted">Werk ${formatMinutesAsDuration(totalWorkMinutes)} • Pauze ${formatMinutesAsDuration(totalBreakMinutes)}</div>
          </div>
          <div class="rowtight">
            <button class="iconbtn iconbtn-sm" id="toggleEditLog" type="button" title="${editing ? "Klaar" : "Bewerk"}" aria-label="${editing ? "Klaar" : "Bewerk"}">
              ${editing
                ? `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M5 12l5 5 9-9" stroke-linecap="round" stroke-linejoin="round"/></svg>`
                : `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 20h9" stroke-linecap="round"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" stroke-linejoin="round"/></svg>`}
            </button>
            ${editing ? `<button class="btn" id="addSegment" type="button">+ segment</button>` : ""}
          </div>
        </div>
        <div class="compact-lines">
          ${segments.map(s=>{
            const start = s.start ? fmtClock(s.start) : "…";
            const end = s.end ? fmtClock(s.end) : "…";
            const segmentDuration = calculateDuration(start, end);
            if (!editing){
              return `<div class="segment-row segment-row-static mono"><div class="segment-row-main"><span>${s.type === "break" ? "Pauze" : "Werk"} ${start}–${end}</span><span class="segment-duration">${segmentDuration}</span></div></div>`;
            }
            const isOpen = ui.logDetailSegmentEditId === s.id;
            return `
              <div class="segment-row ${isOpen ? "is-open" : ""}">
                <button class="segment-row-btn mono" type="button" data-toggle-segment="${s.id}">
                  <span class="segment-row-main"><span>${s.type === "break" ? "Pauze" : "Werk"} ${start}–${end}</span><span class="segment-duration">${segmentDuration}</span></span>
                </button>
                ${isOpen ? `
                  <div class="segment-editor" data-segment-editor="${s.id}">
                    <div class="segment-grid">
                      <label>Start<input type="time" value="${esc(fmtTimeInput(s.start))}" data-edit-segment="${s.id}" data-field="start" /></label>
                      <label>Einde<input type="time" value="${esc(fmtTimeInput(s.end))}" data-edit-segment="${s.id}" data-field="end" /></label>
                      <label>Type
                        <select data-edit-segment="${s.id}" data-field="type">
                          <option value="work" ${s.type === "work" ? "selected" : ""}>work</option>
                          <option value="break" ${s.type === "break" ? "selected" : ""}>break</option>
                        </select>
                      </label>
                    </div>
                    <button class="iconbtn iconbtn-sm danger" type="button" data-del-segment="${s.id}" title="Verwijder segment" aria-label="Verwijder segment">
                      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3 6h18" stroke-linecap="round"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6" stroke-linecap="round"/></svg>
                    </button>
                  </div>
                ` : ""}
              </div>
            `;
          }).join("") || `<div class="small">Geen segmenten.</div>`}
        </div>
      </section>
    `;
  }

  $("#sheetBody").innerHTML = `
    <div class="stack log-detail-compact">
      <section class="compact-section compact-row">
        <label>Afrekening</label>
        <select id="logSettlement" ${locked ? "disabled" : ""}>
          ${settlementOptions}
        </select>
      </section>

      ${renderSegments(log, isEditing)}

      <section class="compact-section stack">
        <div class="row space">
          <div class="item-title">Producten</div>
          <span class="small mono">Totaal ${fmtMoney(sumItemsAmount(log))}</span>
        </div>
        <div class="log-lines-wrap">
          ${renderLogItems(log)}
        </div>
      </section>

      <section class="compact-section">
        <label>Notitie</label>
        <input id="logNote" value="${esc(log.note||"")}" />
      </section>

      <section class="compact-section log-detail-footer-actions">
        <span class="pill ${statusPillClass}">${statusLabel}</span>
        <button class="btn danger" id="delLog">Verwijder</button>
      </section>
    </div>
  `;

  // wire (autosave)
  $("#logNote").addEventListener("change", ()=>{
    actions.editLog(log.id, (draft)=>{
      draft.note = ($("#logNote").value||"").trim();
    });
  });

  $("#toggleEditLog")?.addEventListener("click", ()=> toggleEditLog(log.id));

  $("#addSegment")?.addEventListener("click", ()=>{
    const segId = uid();
    actions.editLog(log.id, (draft)=>{
      draft.segments = draft.segments || [];
      draft.segments.push({ id: segId, type: "work", start: null, end: null });
    });
    ui.logDetailSegmentEditId = segId;
    renderSheet();
  });

  $("#sheetBody").querySelectorAll("[data-toggle-segment]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const segmentId = btn.getAttribute("data-toggle-segment");
      ui.logDetailSegmentEditId = ui.logDetailSegmentEditId === segmentId ? null : segmentId;
      renderSheet();
    });
  });

  $("#sheetBody").querySelectorAll("[data-edit-segment]").forEach(inp=>{
    inp.addEventListener("change", ()=>{
      const segmentId = inp.getAttribute("data-edit-segment");
      const field = inp.getAttribute("data-field");
      const seg = (log.segments||[]).find(x => x.id === segmentId);
      if (!seg) return;

      if (field === "type"){
        if (!["work", "break"].includes(inp.value)){
          alert('Type moet "work" of "break" zijn.');
          renderSheet();
          return;
        }
      }

      if (field === "start" || field === "end"){
        const nextStart = field === "start" ? parseLogTimeToMs(log.date, inp.value) : seg.start;
        const nextEnd = field === "end" ? parseLogTimeToMs(log.date, inp.value) : seg.end;
        if (nextStart == null || nextEnd == null || !(nextEnd > nextStart)){
          alert("Segment ongeldig: einde moet later zijn dan start.");
          renderSheet();
          return;
        }
      }

      actions.editLog(log.id, (draft)=>{
        const target = (draft.segments||[]).find(x => x.id === segmentId);
        if (!target) return;
        if (field === "type") target.type = inp.value;
        if (field === "start" || field === "end"){
          target.start = field === "start" ? parseLogTimeToMs(draft.date, inp.value) : target.start;
          target.end = field === "end" ? parseLogTimeToMs(draft.date, inp.value) : target.end;
        }
      });
      renderSheet();
    });
  });

  $("#sheetBody").querySelectorAll("[data-del-segment]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const segmentId = btn.getAttribute("data-del-segment");
      if (!confirmDelete("Segment verwijderen")) return;
      actions.editLog(log.id, (draft)=>{
        draft.segments = (draft.segments||[]).filter(s => s.id !== segmentId);
      });
      if (ui.logDetailSegmentEditId === segmentId) ui.logDetailSegmentEditId = null;
      renderSheet();
    });
  });

  $("#sheetBody").querySelectorAll("[data-del-log-item]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const itemId = btn.getAttribute("data-del-log-item");
      if (!confirmDelete("Item verwijderen")) return;
      actions.editLog(log.id, (draft)=>{
        draft.items = (draft.items||[]).filter(it => it.id !== itemId);
      });
      renderSheet();
    });
  });

  $("#sheetBody").querySelectorAll("[data-edit-log-item]").forEach(inp=>{
    inp.addEventListener("change", ()=>{
      const itemId = inp.getAttribute("data-edit-log-item");
      const field = inp.getAttribute("data-field");
      const it = (log.items||[]).find(x => x.id === itemId);
      if (!it) return;
      actions.editLog(log.id, (draft)=>{
        const target = (draft.items||[]).find(x => x.id === itemId);
        if (!target) return;
        if (field === "qty") target.qty = inp.value === "" ? null : Number(String(inp.value).replace(",", ".") || "0");
        if (field === "unitPrice") target.unitPrice = inp.value === "" ? null : Number(String(inp.value).replace(",", ".") || "0");
        if (field === "productId"){
          target.productId = inp.value;
          const p = getProduct(inp.value);
          if (p && (target.unitPrice == null || target.unitPrice === 0)) target.unitPrice = Number(p.unitPrice||0);
        }
      });
      renderSheet();
    });
  });

  $("#addProductItem").addEventListener("click", ()=>{
    const workProduct = state.products.find(p => (p.name||"").trim().toLowerCase() === "werk") || state.products[0] || null;
    if (!workProduct) return;
    actions.editLog(log.id, (draft)=>{
      draft.items = draft.items || [];
      draft.items.push({ id: uid(), productId: workProduct.id, qty: null, unitPrice: Number(workProduct.unitPrice||0), note:"" });
    });
    renderSheet();
  });

  $("#logSettlement").onchange = ()=>{
    if (locked) return;
    const v = $("#logSettlement").value;
    actions.linkLogToSettlement(log.id, v);
    renderSheet();
  };

  $("#delLog").onclick = ()=>{
    if (state.activeLogId === log.id){ alert("Stop eerst je actieve log."); return; }
    if (af){ alert("Ontkoppel eerst van afrekening (of verwijder afrekening)."); return; }
    if (!confirmDelete(`Werklog ${log.date} — ${cname(log.customerId)}`)) return;
    actions.deleteLog(log.id);
    closeSheet();
  };
}

function renderLogItems(log){
  const productOptions = state.products
    .map(p => `<option value="${p.id}">${esc(p.name)}${p.unit ? ` (${esc(p.unit)})` : ""}</option>`)
    .join("");

  const rows = (log.items||[]).map(it=>{
    const productId = it.productId || state.products[0]?.id || "";
    const qtyValue = it.qty == null ? "" : String(it.qty);
    const unitPriceValue = it.unitPrice == null ? "" : String(it.unitPrice);
    return `
      <div class="log-item-row">
        <div class="log-item-row-top">
          <select class="settlement-cell-input" data-edit-log-item="${it.id}" data-field="productId">
            ${productOptions.replace(`value="${productId}"`, `value="${productId}" selected`)}
          </select>
          <button class="iconbtn settlement-trash" data-del-log-item="${it.id}" title="Verwijder">
            <svg class="icon" viewBox="0 0 24 24"><path d="M3 6h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 6V4h8v2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 6l1 16h10l1-16" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="log-item-row-bottom">
          <div class="log-item-cell">
            <label>qty</label>
            <input class="settlement-cell-input num" data-edit-log-item="${it.id}" data-field="qty" inputmode="decimal" value="${esc(qtyValue)}" />
          </div>
          <div class="log-item-cell">
            <label>€/eenheid</label>
            <input class="settlement-cell-input num" data-edit-log-item="${it.id}" data-field="unitPrice" inputmode="decimal" value="${esc(unitPriceValue)}" />
          </div>
          <div class="log-item-total num mono">${fmtMoney((Number(it.qty)||0)*(Number(it.unitPrice)||0))}</div>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="log-items-list">
      ${rows || `<div class="small">Nog geen producten.</div>`}
      <button class="btn" id="addProductItem" type="button">+ Product</button>
    </div>
  `;
}

function buildSettlementSelectOptions(customerId, currentSettlementId){
  const options = [];
  options.push(`<option value="none"${!currentSettlementId?" selected":""}>Niet gekoppeld</option>`);
  const list = state.settlements
    .filter(s => s.customerId === customerId)
    .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  for (const s of list){
    const label = `${s.date} — ${statusLabelNL(s.status)} — logs ${(s.logIds||[]).length}`;
    options.push(`<option value="${s.id}" ${s.id===currentSettlementId?"selected":""}>${esc(label)}</option>`);
  }
  options.push(`<option value="new">+ Nieuwe afrekening aanmaken…</option>`);
  return options.join("");
}

function settlementLogbookSummary(s){
  const linkedLogs = (s.logIds||[])
    .map(id => state.logs.find(l => l.id === id))
    .filter(Boolean);
  const totalWorkMs = linkedLogs.reduce((acc, log) => acc + sumWorkMs(log), 0);
  const totalProductCosts = round2(linkedLogs.reduce((acc, log) => acc + sumItemsAmount(log), 0));
  const hourly = Number(state.settings.hourlyRate||0);
  const totalLogPrice = round2((totalWorkMs / 3600000) * hourly + totalProductCosts);
  return { linkedCount: linkedLogs.length, totalWorkMs, totalProductCosts, totalLogPrice };
}

function syncSettlementAmounts(settlement){
  if (!settlement) return;
  const totals = getSettlementTotals(settlement);
  settlement.invoiceAmount = totals.invoiceTotal;
  settlement.cashAmount = totals.cashTotal;
}

function renderSettlementStatusIcons(settlement){
  const isCalculated = isSettlementCalculated(settlement);
  if (!isCalculated){
    return `
      <button class="status-icon-chip status-icon-calc is-open" id="toggleCalculated" type="button" aria-label="Bereken afrekening">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="4" y="3" width="16" height="18" rx="2"></rect><path d="M8 7h8M8 12h3M13 12h3M8 16h8" stroke-linecap="round"></path></svg>
      </button>
    `;
  }

  const iconPresentation = getSettlementIconPresentation(settlement);
  const chips = [];
  const invoiceIcon = iconPresentation.find(icon => icon.type === "invoice");
  if (invoiceIcon?.show){
    chips.push(`
      <button class="status-icon-chip ${invoiceIcon.color === "green" ? "is-paid" : "is-open"}" id="toggleInvoicePaid" type="button" aria-pressed="${settlement.invoicePaid ? "true" : "false"}" aria-label="Factuur ${settlement.invoicePaid ? "betaald" : "open"}">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="2.5" y="5.5" width="19" height="13" rx="2.5"></rect><path d="M2.5 10h19" stroke-linecap="round"></path><path d="M7 14.5h4" stroke-linecap="round"></path></svg>
      </button>
    `);
  }
  const cashIcon = iconPresentation.find(icon => icon.type === "cash");
  if (cashIcon?.show){
    chips.push(`
      <button class="status-icon-chip ${cashIcon.color === "green" ? "is-paid" : "is-open"}" id="toggleCashPaid" type="button" aria-pressed="${settlement.cashPaid ? "true" : "false"}" aria-label="Cash ${settlement.cashPaid ? "betaald" : "open"}">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="8.5" cy="12" r="3.5"></circle><circle cx="15.5" cy="12" r="3.5"></circle><path d="M12 8.5v7" stroke-linecap="round"></path></svg>
      </button>
    `);
  }
  return chips.join("");
}

function calculateSettlement(settlement){
  if (!settlement) return;
  const computed = computeSettlementFromLogs(settlement.customerId, settlement.logIds || []);
  const previousBucket = new Map((settlement.lines || []).map(li => [li.productId + "|" + li.description, li.bucket]));
  settlement.lines = computed.lines.map(li => ({ ...li, bucket: previousBucket.get(li.productId + "|" + li.description) || li.bucket }));
  ensureDefaultSettlementLines(settlement);
  settlement.markedCalculated = true;
  settlement.isCalculated = true;
  settlement.calculatedAt = now();
  syncSettlementStatus(settlement);
  syncSettlementAmounts(settlement);
}

function renderSettlementLogOverviewSheet(settlementId){
  const settlement = state.settlements.find(x => x.id === settlementId);
  if (!settlement){ closeSheet(); return; }

  const linkedLogs = (settlement.logIds || [])
    .map(id => state.logs.find(l => l.id === id))
    .filter(Boolean)
    .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));

  const totalWorkMinutes = linkedLogs.reduce((acc, log) => acc + Math.floor(sumWorkMs(log) / 60000), 0);
  const totalProductCost = round2(linkedLogs.reduce((acc, log) => acc + sumItemsAmount(log), 0));
  const totalAmount = round2(totalProductCost + ((totalWorkMinutes / 60) * Number(state.settings.hourlyRate || 0)));

  $('#sheetActions').innerHTML = '';
  $('#sheetBody').innerHTML = `
    <div class="stack settlement-overview">
      ${linkedLogs.map(log=>{
        const workMinutes = Math.floor(sumWorkMs(log) / 60000);
        const itemRows = (log.items || []).map(item=>{
          const qty = round2(Number(item.qty) || 0);
          const unitPrice = round2(Number(item.unitPrice) || 0);
          return `<div class="overview-item-row"><span>${esc(pname(item.productId))}</span><span>${qty} × ${formatMoneyEUR(unitPrice)}</span><span>${formatMoneyEUR(qty * unitPrice)}</span></div>`;
        }).join('') || `<div class="small">Geen producten</div>`;

        return `
          <div class="card stack compact-card">
            <div class="settlement-log-cols mono tabular">
              <span class="log-col-date">${esc(formatDatePretty(log.date))}</span>
              <span class="log-col-time">${formatDurationCompact(workMinutes)}</span>
              <span class="log-col-price">${formatMoneyEUR(sumItemsAmount(log))}</span>
              <span class="log-col-products">${countExtraProducts(log)}</span>
            </div>
            <div class="overview-item-list">${itemRows}</div>
          </div>
        `;
      }).join('') || `<div class="card compact-card"><div class="small">Geen gekoppelde logs.</div></div>`}

      <div class="card stack compact-card">
        <h2>Totalen</h2>
        <div class="overview-totals-grid mono tabular">
          <span>Totaal werktijd</span><strong>${formatMinutesAsDuration(totalWorkMinutes)}</strong>
          <span>Totaal producten</span><strong>${formatMoneyEUR(totalProductCost)}</strong>
          <span>Totaal</span><strong>${formatMoneyEUR(totalAmount)}</strong>
        </div>
      </div>
    </div>
  `;
}

function renderSettlementSheet(id){
  const s = state.settlements.find(x => x.id === id);
  if (!s){ closeSheet(); return; }
  if (!("invoicePaid" in s)) s.invoicePaid = false;
  if (!("cashPaid" in s)) s.cashPaid = false;
  if (!("markedCalculated" in s)) s.markedCalculated = s.status === "calculated";
  if (!("isCalculated" in s)) s.isCalculated = isSettlementCalculated(s);
  if (!("calculatedAt" in s)) s.calculatedAt = s.isCalculated ? (s.createdAt || now()) : null;
  ensureDefaultSettlementLines(s);
  syncSettlementStatus(s);

  const isEdit = isSettlementEditing(s.id);
  const customerOptions = state.customers.map(c => `<option value="${c.id}" ${c.id===s.customerId?"selected":""}>${esc(c.nickname||c.name||"Klant")}</option>`).join('');
  const availableLogs = state.logs
    .filter(l => l.customerId === s.customerId)
    .filter(log => {
      const isInThisSettlement = (s.logIds || []).includes(log.id);
      const linkedElsewhere = isLogLinkedElsewhere(log.id, s.id);
      return isInThisSettlement || !linkedElsewhere;
    })
    .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));

  const pay = settlementPaymentState(s);
  const visual = getSettlementVisualState(s);
  const summary = settlementLogbookSummary(s);

  $('#sheetActions').innerHTML = '';

  $('#sheetBody').innerHTML = `
    <div class="stack settlement-detail ${visual.accentClass}">
      <div class="card stack compact-card">
        <div class="settlement-status-bar" role="group" aria-label="Afrekening status acties">
          ${renderSettlementStatusIcons(s)}
        </div>
      </div>

      <div class="card stack compact-card">
        <div class="row space"><h2>Gekoppelde logs</h2>${isEdit ? `<button class="btn" id="btnRecalc">Herbereken uit logs</button>` : ""}</div>
        <div class="list" id="sLogs">
          ${availableLogs.slice(0,30).map(l=>{
            const checked = (s.logIds||[]).includes(l.id);
            const rowMeta = `
              <div class="item-sub settlement-log-cols mono tabular">
                <span class="log-col-date">${esc(formatDatePretty(l.date))}</span>
                <span class="log-col-time">${formatDurationCompact(Math.floor(sumWorkMs(l)/60000))}</span>
                <span class="log-col-price">${formatMoneyEUR(sumItemsAmount(l))}</span>
                <span class="log-col-products">${countExtraProducts(l)}</span>
              </div>`;
            if (isEdit){
              return `<label class="item item-compact"><div class="item-main">${rowMeta}</div><div class="item-right"><input type="checkbox" data-logpick="${l.id}" ${checked ? "checked" : ""}/></div></label>`;
            }
            if (!checked) return "";
            return `<button class="item item-compact item-row-button" type="button" role="button" data-open-linked-log="${l.id}"><div class="item-main">${rowMeta}</div></button>`;
          }).join('') || `<div class="small">Geen gekoppelde logs.</div>`}
        </div>
      </div>

      <div class="card stack compact-card">
        <h2>Logboek totaal</h2>
        ${isEdit ? `<div class="settlement-totals-row mono tabular"><span class="totals-time">${formatDurationCompact(Math.floor(summary.totalWorkMs/60000))}</span><span class="totals-price">${formatMoneyEUR(summary.totalLogPrice)}</span><span class="totals-products">${summary.linkedCount}</span></div>` : `<button class="settlement-totals-row settlement-totals-button mono tabular" id="openSettlementOverview" type="button"><span class="totals-time">${formatDurationCompact(Math.floor(summary.totalWorkMs/60000))}</span><span class="totals-price">${formatMoneyEUR(summary.totalLogPrice)}</span><span class="totals-products">${summary.linkedCount}</span></button>`}
      </div>

      <div class="card stack compact-card">
        <div class="row space"><h2>Factuur</h2><div class="mono tabular">${formatMoneyEUR(pay.invoiceTotal)}</div></div>
        ${renderLinesTable(s, 'invoice', { readOnly: !isEdit })}
        ${isEdit ? `<button class="btn" id="addInvoiceLine">+ regel</button>` : ""}
      </div>

      <div class="card stack compact-card">
        <div class="row space"><h2>Cash</h2><div class="mono tabular">${formatMoneyEUR(pay.cashTotal)}</div></div>
        ${renderLinesTable(s, 'cash', { readOnly: !isEdit })}
        ${isEdit ? `<button class="btn" id="addCashLine">+ regel</button>` : ""}
      </div>

      <div class="card stack compact-card">
        <h2>Notitie</h2>
        ${isEdit ? `<textarea id="sNote" rows="3">${esc(s.note||"")}</textarea>` : `<div class="small">${esc(s.note||"—")}</div>`}
      </div>

      ${isEdit ? `
      <div class="card stack compact-card">
        <h2>Acties</h2>
        <div class="compact-row"><label>Klant</label><div><select id="sCustomer">${customerOptions}</select></div></div>
        <div class="compact-row"><label>Datum</label><div><input id="sDate" type="date" value="${esc(s.date||todayISO())}" /></div></div>
        <button class="btn danger" id="delSettlement">Verwijder</button>
      </div>` : ""}
    </div>
  `;

  $('#toggleCalculated')?.addEventListener('click', ()=>{
    actions.calculateSettlement(s.id);
    renderSheet();
  });
  $('#toggleInvoicePaid')?.addEventListener('click', ()=>{
    actions.setInvoicePaid(s.id, !s.invoicePaid);
    renderSheet();
  });
  $('#toggleCashPaid')?.addEventListener('click', ()=>{
    actions.setCashPaid(s.id, !s.cashPaid);
    renderSheet();
  });

  if (!isEdit){
    $('#sheetBody').querySelectorAll('[data-open-linked-log]').forEach(btn=>{
      btn.addEventListener('click', ()=> openSheet('log', btn.getAttribute('data-open-linked-log')));
    });
    $('#openSettlementOverview')?.addEventListener('click', ()=>{
      pushView({ view: 'settlementLogOverview', id: s.id });
    });
  }

  if (isEdit){
    $('#delSettlement')?.addEventListener('click', ()=>{
      if (!confirmDelete(`Afrekening ${formatDatePretty(s.date)} — ${cname(s.customerId)}`)) return;
      actions.deleteSettlement(s.id);
      closeSheet();
    });

    $('#sCustomer')?.addEventListener('change', ()=>{
      actions.editSettlement(s.id, (draft)=>{
        draft.customerId = $('#sCustomer').value;
        draft.logIds = [];
      });
      renderSheet();
    });
    $('#sDate')?.addEventListener('change', ()=>{
      actions.editSettlement(s.id, (draft)=>{
        draft.date = ($('#sDate').value||'').trim() || todayISO();
      });
      renderSheet();
    });
    $('#sNote')?.addEventListener('change', ()=>{
      actions.editSettlement(s.id, (draft)=>{
        draft.note = ($('#sNote').value || '').trim();
      });
    });

    $('#sheetBody').querySelectorAll('[data-logpick]').forEach(cb=>{
      cb.addEventListener('change', ()=>{
        const logId = cb.getAttribute('data-logpick');
        const other = settlementForLog(logId);
        if (other && other.id !== s.id){
          alert('Deze log zit al in een andere afrekening. Open die afrekening of ontkoppel eerst.');
          cb.checked = false;
          return;
        }
        actions.editSettlement(s.id, (draft)=>{
          if (cb.checked) draft.logIds = Array.from(new Set([...(draft.logIds||[]), logId]));
          else draft.logIds = (draft.logIds||[]).filter(x => x !== logId);
        });
        renderSheet();
      });
    });

    $('#btnRecalc')?.addEventListener('click', ()=>{
      actions.calculateSettlement(s.id);
      renderSheet();
    });

    $('#sheetBody').querySelectorAll('[data-line-qty]').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        const line = s.lines.find(x=>x.id===inp.getAttribute('data-line-qty'));
        if (!line) return;
        actions.editSettlement(s.id, (draft)=>{
          const target = draft.lines.find(x=>x.id===inp.getAttribute('data-line-qty'));
          if (target) target.qty = Number(String(inp.value).replace(',', '.')||'0');
        });
        renderSheet();
      });
    });
    $('#sheetBody').querySelectorAll('[data-line-price]').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        const line = s.lines.find(x=>x.id===inp.getAttribute('data-line-price'));
        if (!line) return;
        actions.editSettlement(s.id, (draft)=>{
          const target = draft.lines.find(x=>x.id===inp.getAttribute('data-line-price'));
          if (target) target.unitPrice = Number(String(inp.value).replace(',', '.')||'0');
        });
        renderSheet();
      });
    });
    $('#sheetBody').querySelectorAll('[data-line-del]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const lineId = btn.getAttribute('data-line-del');
        if (!confirmDelete('Regel verwijderen')) return;
        actions.editSettlement(s.id, (draft)=>{
          draft.lines = (draft.lines||[]).filter(x=>x.id!==lineId);
        });
        renderSheet();
      });
    });
    $('#sheetBody').querySelectorAll('[data-line-product]').forEach(sel=>{
      sel.addEventListener('change', ()=>{
        const line = s.lines.find(x=>x.id===sel.getAttribute('data-line-product'));
        if (!line) return;
        const productId = sel.value || null;
        const product = productId ? getProduct(productId) : null;
        actions.editSettlement(s.id, (draft)=>{
          const target = draft.lines.find(x=>x.id===sel.getAttribute('data-line-product'));
          if (!target) return;
          target.productId = productId;
          if (product){
            target.name = product.name;
            target.description = product.name;
            target.unitPrice = Number(product.unitPrice || 0);
            if ((target.bucket || 'invoice') === 'invoice') target.vatRate = Number(product.vatRate ?? 0.21);
          }
        });
        renderSheet();
      });
    });

    $('#addInvoiceLine')?.addEventListener('click', ()=>{
      actions.editSettlement(s.id, (draft)=> addSettlementLine(draft, 'invoice'));
      renderSheet();
    });
    $('#addCashLine')?.addEventListener('click', ()=>{
      actions.editSettlement(s.id, (draft)=> addSettlementLine(draft, 'cash'));
      renderSheet();
    });

  }
}

function renderLinesTable(settlement, bucket, { readOnly = false } = {}){
  const lines = (settlement.lines||[]).filter(l => (l.bucket||'invoice')===bucket);
  const totals = settlementTotals(settlement);
  const footer = bucket === 'invoice'
    ? `
      <div class="settlement-lines-footer mono tabular">
        <div>Subtotaal</div><div></div><div></div><div class="num">${formatMoneyEUR(totals.invoiceSubtotal)}</div><div></div>
        <div>BTW 21%</div><div></div><div></div><div class="num">${formatMoneyEUR(totals.invoiceVat)}</div><div></div>
        <div>Totaal</div><div></div><div></div><div class="num">${formatMoneyEUR(totals.invoiceTotal)}</div><div></div>
      </div>
    `
    : `
      <div class="settlement-lines-footer mono tabular">
        <div>Totaal</div><div></div><div></div><div class="num">${formatMoneyEUR(totals.cashTotal)}</div><div></div>
      </div>
    `;

  return `
    <div class="settlement-lines-table">
      <div class="settlement-lines-grid settlement-lines-head mono">
        <div>Product</div><div>Aantal</div><div>€/eenheid</div><div class="num">Totaal</div><div></div>
      </div>
      ${(lines.map(l=>{
        const rowTotal = lineAmount(l);
        const productValue = l.productId || '';
        return `
          <div class="settlement-lines-grid settlement-lines-row">
            <div>
              ${readOnly
                ? `<div class="settlement-cell-readonly">${esc((getProduct(productValue)?.name) || l.name || l.description || '—')}</div>`
                : `<select class="settlement-cell-input" data-line-product="${l.id}"><option value="">Kies product</option>${state.products.map(p=>`<option value="${p.id}" ${p.id===productValue?"selected":""}>${esc(p.name)}${p.unit ? ` (${esc(p.unit)})` : ''}</option>`).join('')}</select>`}
            </div>
            <div>${readOnly ? `<div class="settlement-cell-readonly mono tabular">${esc((l.qty ?? '') === '' ? '—' : String(l.qty))}</div>` : `<input class="settlement-cell-input mono tabular" data-line-qty="${l.id}" inputmode="decimal" value="${esc((l.qty ?? '') === 0 ? '' : String(l.qty ?? ''))}" />`}</div>
            <div>${readOnly ? `<div class="settlement-cell-readonly mono tabular">${formatMoneyEUR(Number(l.unitPrice)||0)}</div>` : `<input class="settlement-cell-input mono tabular" data-line-price="${l.id}" inputmode="decimal" value="${esc((l.unitPrice ?? '') === 0 ? '' : String(l.unitPrice ?? ''))}" />`}</div>
            <div class="num mono tabular">${formatMoneyEUR(rowTotal)}</div>
            <div>${readOnly ? '' : `<button class="iconbtn settlement-trash" data-line-del="${l.id}" title="Verwijder"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18" stroke-linecap="round"/><path d="M8 6V4h8v2"/><path d="M6 6l1 16h10l1-16"/><path d="M10 11v6M14 11v6" stroke-linecap="round"/></svg></button>`}</div>
          </div>
        `;
      }).join('')) || `<div class="small">Geen regels</div>`}
      ${footer}
    </div>
  `;
}

function addSettlementLine(settlement, bucket){
  settlement.lines = settlement.lines || [];
  settlement.lines.push({
    id: uid(),
    productId: null,
    name: '',
    qty: '',
    unitPrice: '',
    vatRate: bucket === 'invoice' ? 0.21 : 0,
    bucket
  });
}

function ensureDefaultSettlementLines(settlement){
  settlement.lines = settlement.lines || [];
  const ensureForBucket = bucket=>{
    ["Werk", "Groen"].forEach(productName=>{
      const product = (state.products||[]).find(p => (p.name||'').toLowerCase() === productName.toLowerCase()) || null;
      const hasLine = settlement.lines.some(line => {
        const sameBucket = (line.bucket||'invoice') === bucket;
        if (!sameBucket) return false;
        if (product && line.productId) return line.productId === product.id;
        const label = String(line.name || line.description || pname(line.productId) || '').toLowerCase();
        return label === productName.toLowerCase();
      });
      if (hasLine) return;
      settlement.lines.push({
        id: uid(),
        productId: product?.id || null,
        name: product?.name || productName,
        description: product?.name || productName,
        qty: '',
        unitPrice: product ? Number(product.unitPrice || 0) : '',
        vatRate: bucket === 'invoice' ? Number(product?.vatRate ?? 0.21) : 0,
        bucket
      });
    });
  };
  ensureForBucket('invoice');
  ensureForBucket('cash');
}


function shouldBlockIOSGestures(){
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const isIOSDevice = /iPhone|iPad|iPod/.test(ua) || (/Mac/.test(platform) && maxTouchPoints > 1);
  if (!isIOSDevice) return false;
  const isSafariLike = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone === true;
  return isSafariLike || isStandalone;
}

function installIOSNoZoomGuards(){
  if (!shouldBlockIOSGestures()) return;
  const blockGesture = (event) => event.preventDefault();
  ["gesturestart", "gesturechange", "gestureend"].forEach((type)=>{
    document.addEventListener(type, blockGesture, { passive: false });
  });
}

// ---------- PWA register ----------
if ("serviceWorker" in navigator){
  window.addEventListener("load", async ()=>{
    try { await navigator.serviceWorker.register("./sw.js"); } catch {}
  });
}

// init
installIOSNoZoomGuards();
setTab("logs");
render();

// Timer tick: update active timer display every 15 seconds
setInterval(()=>{
  if (state.activeLogId && ui.navStack[0]?.view === "logs" && ui.navStack.length === 1){
    const elapsedEl = document.querySelector(".timer-active-elapsed");
    const metaEl = document.querySelector(".timer-active-meta");
    if (elapsedEl){
      const active = state.logs.find(l => l.id === state.activeLogId);
      if (active){
        elapsedEl.textContent = durMsToHM(sumWorkMs(active));
        const isPaused = currentOpenSegment(active)?.type === "break";
        if (metaEl) metaEl.textContent = `${isPaused ? "Pauze" : "Actief"} · gestart ${fmtClock(active.createdAt)}`;
      }
    }
  }
}, 15000);
