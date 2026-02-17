export function pad2(n){ return String(n).padStart(2,"0"); }
export function round2(n){ return Math.round((Number(n||0))*100)/100; }
export function fmtMoney(n){ const v = Number(n||0); return "€" + v.toFixed(2).replace(".", ","); }
export function fmtClock(ms){ const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
export function formatDurationCompact(totalMinutes){ const minutes=Math.max(0, Math.floor(Number(totalMinutes)||0)); const h=Math.floor(minutes/60); const m=minutes%60; return `${h}u${String(m).padStart(2,"0")}m`; }
