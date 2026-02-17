export function round2(n){ return Math.round((Number(n||0))*100)/100; }
export function fmtMoney(n){ const v = Number(n||0); return "€" + v.toFixed(2).replace(".", ","); }
export function pad2(n){ return String(n).padStart(2,"0"); }
export function fmtClock(ms){ const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
export function formatDurationCompact(totalMinutes){ const minutes=Math.max(0, Math.floor(Number(totalMinutes)||0)); const h=Math.floor(minutes/60); const m=minutes%60; return `${h}u${String(m).padStart(2,"0")}m`; }
export function sumWorkMs(log){ let t=0; for (const s of (log.segments||[])){ if (s.type !== "work") continue; const end = s.end ?? Date.now(); t += Math.max(0, end - s.start); } return t; }
export function lineAmount(line){ return round2((Number(line.qty)||0) * (Number(line.unitPrice)||0)); }
export function lineVat(line){ return round2(lineAmount(line) * (Number(line.vatRate)||0)); }
export function bucketTotals(lines, bucket){
  const filtered=(lines||[]).filter(l=>l.bucket===bucket);
  const subtotal = round2(filtered.reduce((a,l)=>a+lineAmount(l),0));
  const vat = bucket === "invoice" ? round2(filtered.reduce((a,l)=>a+lineVat(l),0)) : 0;
  return { subtotal, vat, total: round2(subtotal + vat) };
}
export function getSettlementTotals(settlement){ const invoiceTotals=bucketTotals(settlement.lines,"invoice"); const cashTotals=bucketTotals(settlement.lines,"cash"); return { invoiceSubtotal:invoiceTotals.subtotal, invoiceVat:invoiceTotals.vat, invoiceTotal:invoiceTotals.total, cashSubtotal:cashTotals.subtotal, cashTotal:cashTotals.subtotal }; }
export function isSettlementCalculated(settlement){ return Boolean(settlement?.isCalculated || settlement?.markedCalculated || settlement?.status === "calculated" || settlement?.status === "paid" || settlement?.calculatedAt); }
export function getSettlementIconPresentation(settlement){
  const calculated=isSettlementCalculated(settlement);
  const totals=getSettlementTotals(settlement||{});
  const invoiceAmount=Number(settlement?.invoiceAmount ?? totals.invoiceTotal ?? 0);
  const cashAmount=Number(settlement?.cashAmount ?? totals.cashTotal ?? 0);
  return [
    { type:"invoice", show: calculated && invoiceAmount > 0, color: settlement?.invoicePaid ? "green" : "orange" },
    { type:"cash", show: calculated && cashAmount > 0, color: settlement?.cashPaid ? "green" : "orange" }
  ];
}
