export function initRouterState(){
  return { activeTab: "logs", stack: [{ view: "logs" }] };
}

export function getCurrentRoute(routerState){
  return routerState?.stack?.[routerState.stack.length - 1] || { view: "logs" };
}

export function canGoBack(routerState){
  return (routerState?.stack?.length || 0) > 1;
}

export function routerReducer(state = initRouterState(), action){
  switch (action?.type){
    case "NAV_SET_TAB": {
      const tab = action.payload?.tab || "logs";
      return { activeTab: tab, stack: [{ view: tab }] };
    }
    case "NAV_PUSH": {
      const route = action.payload?.route;
      if (!route || typeof route !== "object") return state;
      return { ...state, stack: [...state.stack, route] };
    }
    case "NAV_BACK": {
      if (state.stack.length <= 1) return state;
      return { ...state, stack: state.stack.slice(0, -1) };
    }
    case "NAV_REPLACE": {
      const route = action.payload?.route;
      if (!route || typeof route !== "object") return state;
      const next = state.stack.slice();
      next[next.length - 1] = route;
      return { ...state, stack: next };
    }
    default:
      return state;
  }
}
