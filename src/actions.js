export function createActions({ getState, setState, commit }){
  return {
    setEditSettlement(settlementId){
      const state = getState();
      state.ui = state.ui || {};
      state.ui.editSettlementId = state.ui.editSettlementId === settlementId ? null : settlementId;
      setState(state);
      commit();
    },
    setEditLog(logId){
      const state = getState();
      state.ui = state.ui || {};
      state.ui.editLogId = state.ui.editLogId === logId ? null : logId;
      setState(state);
      commit();
    }
  };
}
