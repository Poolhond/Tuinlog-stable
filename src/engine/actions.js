export const ActionTypes = {
  HYDRATE_DATA: "HYDRATE_DATA",
  REPLACE_DATA: "REPLACE_DATA",
  START_LOG: "START_LOG",
  STOP_LOG: "STOP_LOG",
  CREATE_SETTLEMENT: "CREATE_SETTLEMENT",
  CALCULATE_SETTLEMENT: "CALCULATE_SETTLEMENT",
  MARK_SETTLEMENT_PAID: "MARK_SETTLEMENT_PAID",
  LINK_LOG_TO_SETTLEMENT: "LINK_LOG_TO_SETTLEMENT",
  UNLINK_LOG_FROM_SETTLEMENT: "UNLINK_LOG_FROM_SETTLEMENT",
  NAV_SET_TAB: "NAV_SET_TAB",
  NAV_PUSH: "NAV_PUSH",
  NAV_BACK: "NAV_BACK"
};

export const hydrateData = (data) => ({ type: ActionTypes.HYDRATE_DATA, payload: { data } });
export const replaceData = (data) => ({ type: ActionTypes.REPLACE_DATA, payload: { data } });

export const startLog = ({ customerId, now, date }) => ({ type: ActionTypes.START_LOG, payload: { customerId, now, date } });
export const stopLog = ({ logId, now }) => ({ type: ActionTypes.STOP_LOG, payload: { logId, now } });
export const createSettlement = ({ customerId, now, date }) => ({ type: ActionTypes.CREATE_SETTLEMENT, payload: { customerId, now, date } });
export const calculateSettlement = ({ settlementId, now }) => ({ type: ActionTypes.CALCULATE_SETTLEMENT, payload: { settlementId, now } });
export const markSettlementPaid = ({ settlementId, bucket, paid }) => ({ type: ActionTypes.MARK_SETTLEMENT_PAID, payload: { settlementId, bucket, paid } });
export const linkLogToSettlement = ({ logId, settlementId }) => ({ type: ActionTypes.LINK_LOG_TO_SETTLEMENT, payload: { logId, settlementId } });
export const unlinkLogFromSettlement = ({ logId, settlementId }) => ({ type: ActionTypes.UNLINK_LOG_FROM_SETTLEMENT, payload: { logId, settlementId } });

export const setActiveTab = (tab) => ({ type: ActionTypes.NAV_SET_TAB, payload: { tab } });
export const navigatePush = (route) => ({ type: ActionTypes.NAV_PUSH, payload: { route } });
export const navigateBack = () => ({ type: ActionTypes.NAV_BACK });
