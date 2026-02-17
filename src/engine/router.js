export function initRouterState(){
  return { activeTab: 'logs', stack: [{ view: 'logs' }] };
}

export function getCurrentRoute(routerState){
  return routerState?.stack?.[routerState.stack.length - 1] || { view: 'logs' };
}

export function canGoBack(routerState){
  return (routerState?.stack?.length || 0) > 1;
}

export function routerReducer(state = initRouterState(), action){
  switch (action.type){
    case 'NAV/SET_ACTIVE_TAB': {
      const tab = action.payload?.tab || 'logs';
      return { ...state, activeTab: tab, stack: [{ view: tab }] };
    }
    case 'NAV/PUSH': {
      const route = action.payload?.route;
      if (!route) return state;
      return { ...state, stack: [...(state.stack || [{ view: state.activeTab || 'logs' }]), route] };
    }
    case 'NAV/BACK': {
      const stack = state.stack || [{ view: state.activeTab || 'logs' }];
      if (stack.length <= 1) return state;
      return { ...state, stack: stack.slice(0, -1) };
    }
    default:
      return state;
  }
}
