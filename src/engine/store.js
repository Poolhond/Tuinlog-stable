export function createStore({ reducer, preloadedState, effects = [] }){
  let state = preloadedState;
  const listeners = new Set();

  function getState(){ return state; }

  function subscribe(listener){
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function dispatch(action){
    const prevState = state;
    state = reducer(state, action);
    for (const effect of effects){
      effect({ prevState, nextState: state, action, dispatch, getState });
    }
    for (const listener of listeners) listener();
    return action;
  }

  return { getState, dispatch, subscribe };
}
