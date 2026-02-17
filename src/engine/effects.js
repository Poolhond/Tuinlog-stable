import { saveState } from '../state.js';

export function createPersistEffect(){
  return ({ nextState }) => {
    if (!nextState?.data) return;
    saveState(nextState.data);
  };
}

export function createEffects(){
  return [createPersistEffect()];
}
