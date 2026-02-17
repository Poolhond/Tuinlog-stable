export function createStore({ reducer, preloadedState, effects }){
  let state = preloadedState;
  const listeners = new Set();

  const getState = () => state;
  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const dispatch = (action) => {
    const prevState = state;
    state = reducer(state, action);
    if (effects) effects(prevState, state, action);
    for (const listener of listeners) listener(state, prevState, action);
    return action;
  };

  return { getState, subscribe, dispatch };
}
