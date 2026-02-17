export function createNav(){
  const navStack = [{ view:"logs" }];
  const currentView = () => navStack[navStack.length - 1] || { view:"logs" };
  const pushView = (viewState) => { navStack.push(viewState); };
  const popView = () => { if (navStack.length > 1) navStack.pop(); };
  return { navStack, currentView, pushView, popView };
}
