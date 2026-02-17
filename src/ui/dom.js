export function getDOM(){
  return {
    app: document.getElementById('app'),
    topbarBack: document.getElementById('topbarBack'),
    tabs: document.getElementById('tabs'),
    list: document.getElementById('list'),
    sheet: document.getElementById('sheet')
  };
}

export function setHTML(el, html){ if (el) el.innerHTML = html; }
export function setText(el, text){ if (el) el.textContent = text ?? ''; }
export function toggleClass(el, className, enabled){ if (el) el.classList.toggle(className, Boolean(enabled)); }
