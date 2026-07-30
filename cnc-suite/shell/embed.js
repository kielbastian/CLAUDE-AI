/* CNC Suite — integracja osadzonej aplikacji z powłoką kart.
   Skrypt uruchamia się w KAŻDEJ z aplikacji (menedżer, generator), ale robi
   cokolwiek tylko wtedy, gdy strona działa w ramce powłoki. Otwarta
   samodzielnie (w przeglądarce albo w oryginalnym .exe) zachowuje się jak
   dotąd — dzięki temu kopie plików pozostają zgodne z oryginałami. */
(function () {
  if (window.top === window.self) return;   // tryb samodzielny — nic nie zmieniamy

  document.documentElement.setAttribute("data-cnc-embedded", "1");

  /* Własny pasek okna aplikacji jest zbędny — okno obsługuje powłoka.
     Ukrywamy go i zdejmujemy rezerwację miejsca (padding/sticky offset). */
  var css =
    ".win-ctrl{display:none!important}" +
    "body{padding-top:0!important}" +
    "header{top:0!important}" +
    ".topbar{top:0!important}";

  var st = document.createElement("style");
  st.id = "cnc-suite-embed";
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  /* Skróty klawiszowe przełączania kart działają też wewnątrz aplikacji. */
  window.addEventListener("keydown", function (e) {
    if (!e.ctrlKey || e.altKey || e.metaKey) return;
    var tab = null;
    if (e.key === "1") tab = "manager";
    else if (e.key === "2") tab = "generator";
    else if (e.key === "3") tab = "kalkulator";
    else if (e.key === "Tab") tab = e.shiftKey ? "prev" : "next";
    if (!tab) return;
    e.preventDefault();
    try { window.top.postMessage({ cncSuite: "switch-tab", tab: tab }, "*"); } catch (err) {}
  });
})();
