import { getCurrentRoute, canGoBack } from "../engine/router.js";

export function createRender({ renderImpl }){
  return {
    renderApp(state){
      return renderImpl(state?.data || state);
    },
    renderTabs(state){
      const router = state?.router;
      return { activeTab: router?.activeTab || "logs", canGoBack: canGoBack(router) };
    },
    renderTopbar(state){
      return { route: getCurrentRoute(state?.router) };
    },
    renderList(){},
    renderDetail(){}
  };
}
