export function createDOM(){
  return {
    byId: (id) => document.getElementById(id),
    query: (sel) => document.querySelector(sel),
    queryAll: (sel) => Array.from(document.querySelectorAll(sel))
  };
}

export function setHTML(el, html){
  if (el) el.innerHTML = html;
}

export function setText(el, text){
  if (el) el.textContent = text;
}

export function toggleClass(el, cls, on){
  if (el) el.classList.toggle(cls, Boolean(on));
}
