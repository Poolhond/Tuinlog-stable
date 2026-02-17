import * as engineActions from '../engine/actions.js';

export function bindEvents({ dom, store }){
  dom.topbarBack?.addEventListener('click', () => {
    store.dispatch(engineActions.navigateBack());
  });

  dom.tabs?.querySelectorAll?.('[data-tab]')?.forEach((tabButton) => {
    tabButton.addEventListener('click', () => {
      store.dispatch(engineActions.setActiveTab({ tab: tabButton.getAttribute('data-tab') }));
    });
  });
}
