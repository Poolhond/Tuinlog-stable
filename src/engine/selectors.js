import { getSettlementTotals, isSettlementCalculated } from '../compute.js';
import { fmtMoney } from '../utils/format.js';

export function selectSettlementIsCalculated(settlement){
  return isSettlementCalculated(settlement);
}

export function selectSettlementTotals(settlement){
  return getSettlementTotals(settlement || { lines: [] });
}

export function selectSettlementPaymentBadges(settlement){
  const totals = selectSettlementTotals(settlement);
  const calculated = selectSettlementIsCalculated(settlement);
  const invoiceAmount = Number(settlement?.invoiceAmount ?? totals.invoiceTotal ?? 0);
  const cashAmount = Number(settlement?.cashAmount ?? totals.cashTotal ?? 0);

  if (!calculated){
    return { showCash: false, showInvoice: false, cashAmount: 0, invoiceAmount: 0, color: 'none' };
  }

  const invoicePaid = Boolean(settlement?.invoicePaid);
  const cashPaid = Boolean(settlement?.cashPaid);
  const showInvoice = invoiceAmount > 0;
  const showCash = cashAmount > 0;
  const visiblePaidStates = [showInvoice ? invoicePaid : null, showCash ? cashPaid : null].filter((v) => v !== null);
  const allPaid = visiblePaidStates.length > 0 && visiblePaidStates.every(Boolean);

  return {
    showCash,
    showInvoice,
    cashAmount,
    invoiceAmount,
    color: allPaid ? 'green' : 'orange',
    invoiceLabel: fmtMoney(invoiceAmount),
    cashLabel: fmtMoney(cashAmount)
  };
}

export function selectCurrentRoute(state){
  return state?.router?.stack?.[state.router.stack.length - 1] || { view: 'logs' };
}
