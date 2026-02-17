import { getCurrentRoute, canGoBack } from '../engine/router.js';

export function renderTabs(){
  // Intentionally a no-op placeholder: legacy UI rendering still runs in src/app.js.
}

export function renderTopbar(state){
  return {
    route: getCurrentRoute(state.router),
    canGoBack: canGoBack(state.router)
  };
}

export function renderList(){
  // Intentionally a no-op placeholder: legacy UI rendering still runs in src/app.js.
}

export function renderDetail(){
  // Intentionally a no-op placeholder: legacy UI rendering still runs in src/app.js.
}

export function renderApp(state){
  renderTabs(state);
  renderTopbar(state);
  renderList(state);
  renderDetail(state);
}
