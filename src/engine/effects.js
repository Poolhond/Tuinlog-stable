import { saveState } from "../state.js";

export function createEffects(){
  return (prevState, nextState) => {
    if (!prevState || !nextState) return;
    if (prevState.data !== nextState.data && nextState.data){
      saveState(nextState.data);
    }
  };
}
