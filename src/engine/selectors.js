import * as compute from "../compute.js";
import { fmtMoney, fmtClock, formatDurationCompact, round2 } from "../utils/format.js";

export const selectData = (state) => state?.data || state;
export const selectRouter = (state) => state?.router || null;

export const selectSettlementIsCalculated = (settlement) => compute.isSettlementCalculated(settlement);

export function selectSettlementTotals(settlement){
  return compute.getSettlementTotals(settlement || {});
}

export function selectSettlementPaymentBadges(settlement){
  const icons = compute.getSettlementIconPresentation(settlement || {});
  const invoice = icons.find((x) => x.type === "invoice") || { show: false, color: "orange" };
  const cash = icons.find((x) => x.type === "cash") || { show: false, color: "orange" };
  const totals = selectSettlementTotals(settlement || {});
  return {
    showCash: Boolean(cash.show),
    showInvoice: Boolean(invoice.show),
    cashAmount: Number(settlement?.cashAmount ?? totals.cashTotal ?? 0),
    invoiceAmount: Number(settlement?.invoiceAmount ?? totals.invoiceTotal ?? 0),
    cashColor: cash.color,
    invoiceColor: invoice.color
  };
}

export function selectLogWorkMs(log){
  return compute.sumWorkMs(log || {});
}

export function selectLogWorkDurationCompact(log){
  return formatDurationCompact(Math.floor(selectLogWorkMs(log) / 60000));
}

export const selectFmtMoney = (value) => fmtMoney(value);
export const selectFmtClock = (ms) => fmtClock(ms);
export const selectRound2 = (value) => round2(value);
