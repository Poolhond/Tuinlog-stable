import { navigateBack, navigatePush, setActiveTab } from "../engine/actions.js";

export function bindEvents({ dom, store }){
  dom.byId("nav-logs")?.addEventListener("click", () => store.dispatch(setActiveTab("logs")));
  dom.byId("nav-settlements")?.addEventListener("click", () => store.dispatch(setActiveTab("settlements")));
  dom.byId("nav-meer")?.addEventListener("click", () => {
    const state = store.getState();
    if ((state?.router?.stack?.length || 0) > 1) store.dispatch(navigateBack());
    else store.dispatch(setActiveTab("meer"));
  });
  dom.byId("btnBack")?.addEventListener("click", () => store.dispatch(navigateBack()));

  return {
    navigatePush: (route) => store.dispatch(navigatePush(route)),
    navigateBack: () => store.dispatch(navigateBack()),
    setActiveTab: (tab) => store.dispatch(setActiveTab(tab))
  };
}
