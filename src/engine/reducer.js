import { ActionTypes } from './actions.js';
import { routerReducer, initRouterState } from './router.js';

function reduceData(data, action){
  switch (action.type){
    case ActionTypes.ADD_CLIENT:
      return { ...data, customers: [action.payload.customer, ...(data.customers || [])] };
    case ActionTypes.CREATE_SETTLEMENT:
      return { ...data, settlements: [action.payload.settlement, ...(data.settlements || [])] };
    case ActionTypes.LINK_LOG_TO_SETTLEMENT: {
      const { logId, settlementId } = action.payload;
      const settlements = (data.settlements || []).map((settlement)=>{
        const baseLogIds = (settlement.logIds || []).filter((id) => id !== logId);
        if (settlement.id !== settlementId) return { ...settlement, logIds: baseLogIds };
        return { ...settlement, logIds: [...new Set([...baseLogIds, logId])] };
      });
      return { ...data, settlements };
    }
    case ActionTypes.UNLINK_LOG_FROM_SETTLEMENT: {
      const { logId, settlementId } = action.payload;
      return {
        ...data,
        settlements: (data.settlements || []).map((settlement) => settlement.id === settlementId
          ? { ...settlement, logIds: (settlement.logIds || []).filter((id) => id !== logId) }
          : settlement)
      };
    }
    default:
      return data;
  }
}

function reduceUi(ui = {}, action){
  switch (action.type){
    case ActionTypes.EDIT_LOG_TOGGLE:
      return { ...ui, editLogId: ui.editLogId === action.payload.logId ? null : action.payload.logId };
    case ActionTypes.EDIT_SETTLEMENT_TOGGLE:
      return { ...ui, editSettlementId: ui.editSettlementId === action.payload.settlementId ? null : action.payload.settlementId };
    default:
      return ui;
  }
}

export function createRootState(dataState){
  return {
    data: dataState,
    ui: dataState?.ui || {},
    router: initRouterState()
  };
}

export function rootReducer(state, action){
  if (!state) return createRootState(undefined);
  return {
    data: reduceData(state.data, action),
    ui: reduceUi(state.ui, action),
    router: routerReducer(state.router, action)
  };
}
