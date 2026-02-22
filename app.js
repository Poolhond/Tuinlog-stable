(function () {
  function showStartupError(err) {
    const message = err && err.message ? err.message : String(err || "Onbekende fout");
    document.body.innerHTML = `<div style="padding:40px;color:white;">Fout bij opstarten: ${message}<br><button onclick="location.reload()">Herlaad</button></div>`;
  }

  window.addEventListener("error", function (event) {
    showStartupError(event.error || new Error(event.message || "Onbekende fout"));
  });

  window.addEventListener("unhandledrejection", function (event) {
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason || "Onbekende fout"));
    showStartupError(reason);
  });

  var script = document.createElement("script");
  script.type = "module";
  script.src = "./src/app.js";
  script.onerror = function () {
    showStartupError(new Error("Kan app.js niet laden"));
  };
  document.head.appendChild(script);
})();
