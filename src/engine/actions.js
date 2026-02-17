export const ActionTypes = {
  START_LOG: 'LOG/START',
  STOP_LOG: 'LOG/STOP',
  PAUSE_LOG: 'LOG/PAUSE',
  ADD_CLIENT: 'CUSTOMER/ADD',
  SELECT_CLIENT: 'CUSTOMER/SELECT',
  CREATE_SETTLEMENT: 'SETTLEMENT/CREATE',
  CALCULATE_SETTLEMENT: 'SETTLEMENT/CALCULATE',
  MARK_PAID: 'SETTLEMENT/MARK_PAID',
  LINK_LOG_TO_SETTLEMENT: 'SETTLEMENT/LINK_LOG',
  UNLINK_LOG_FROM_SETTLEMENT: 'SETTLEMENT/UNLINK_LOG',
  EDIT_LOG_TOGGLE: 'UI/EDIT_LOG_TOGGLE',
  EDIT_SETTLEMENT_TOGGLE: 'UI/EDIT_SETTLEMENT_TOGGLE',
  NAVIGATE_PUSH: 'NAV/PUSH',
  NAVIGATE_BACK: 'NAV/BACK',
  SET_ACTIVE_TAB: 'NAV/SET_ACTIVE_TAB'
};

export const startLog = ({ id, customerId, createdAt, date }) => ({ type: ActionTypes.START_LOG, payload: { id, customerId, createdAt, date } });
export const stopLog = ({ logId, closedAt }) => ({ type: ActionTypes.STOP_LOG, payload: { logId, closedAt } });
export const pauseLog = ({ logId, at }) => ({ type: ActionTypes.PAUSE_LOG, payload: { logId, at } });
export const addClient = ({ customer }) => ({ type: ActionTypes.ADD_CLIENT, payload: { customer } });
export const selectClient = ({ customerId }) => ({ type: ActionTypes.SELECT_CLIENT, payload: { customerId } });
export const createSettlement = ({ settlement }) => ({ type: ActionTypes.CREATE_SETTLEMENT, payload: { settlement } });
export const calculateSettlement = ({ settlementId, calculatedAt }) => ({ type: ActionTypes.CALCULATE_SETTLEMENT, payload: { settlementId, calculatedAt } });
export const markPaid = ({ settlementId, bucket, paid }) => ({ type: ActionTypes.MARK_PAID, payload: { settlementId, bucket, paid } });
export const linkLogToSettlement = ({ logId, settlementId }) => ({ type: ActionTypes.LINK_LOG_TO_SETTLEMENT, payload: { logId, settlementId } });
export const unlinkLogFromSettlement = ({ logId, settlementId }) => ({ type: ActionTypes.UNLINK_LOG_FROM_SETTLEMENT, payload: { logId, settlementId } });
export const setEditLog = ({ logId }) => ({ type: ActionTypes.EDIT_LOG_TOGGLE, payload: { logId } });
export const setEditSettlement = ({ settlementId }) => ({ type: ActionTypes.EDIT_SETTLEMENT_TOGGLE, payload: { settlementId } });
export const navigatePush = ({ route }) => ({ type: ActionTypes.NAVIGATE_PUSH, payload: { route } });
export const navigateBack = () => ({ type: ActionTypes.NAVIGATE_BACK });
export const setActiveTab = ({ tab }) => ({ type: ActionTypes.SET_ACTIVE_TAB, payload: { tab } });
