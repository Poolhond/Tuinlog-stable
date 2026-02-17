import { ActionTypes } from "./actions.js";
import { initRouterState, routerReducer } from "./router.js";

export function initAppState(data){
  return {
    data,
    ui: {},
    router: initRouterState()
  };
}

function dataReducer(data, action){
  switch (action?.type){
    case ActionTypes.HYDRATE_DATA:
    case ActionTypes.REPLACE_DATA:
      return action.payload?.data ?? data;
    default:
      return data;
  }
}

export function rootReducer(state, action){
  const base = state || initAppState(action?.payload?.data || null);
  return {
    ...base,
    data: dataReducer(base.data, action),
    router: routerReducer(base.router, action)
  };
}
