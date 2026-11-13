// P4sim project page: theme toggle, copy buttons, code tabs, example filters.
(function () {
  "use strict";

  // ---- theme toggle (auto by default; a click stores an explicit choice) ----
  var root = document.documentElement;
  var toggle = document.getElementById("theme-toggle");
  function currentTheme() {
    var t = root.getAttribute("data-theme");
    if (t === "light" || t === "dark") return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("p4sim-theme", next); } catch (e) {}
    });
  }

  // ---- copy buttons on code blocks ----
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy") ? resolve() : reject(); } catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  }
  document.querySelectorAll("pre.code").forEach(function (pre) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-btn";
    btn.textContent = "Copy";
    btn.setAttribute("aria-label", "Copy code");
    btn.addEventListener("click", function () {
      var code = pre.querySelector("code");
      copyText(code ? code.textContent : pre.textContent).then(function () {
        btn.textContent = "Copied";
        btn.classList.add("done");
      }, function () {
        btn.textContent = "Press Ctrl+C";
      });
      setTimeout(function () { btn.textContent = "Copy"; btn.classList.remove("done"); }, 1600);
    });
    pre.appendChild(btn);
  });

  // ---- tabs ----
  document.querySelectorAll("[data-tabs]").forEach(function (box) {
    var tabs = Array.prototype.slice.call(box.querySelectorAll('[role="tab"]'));
    function select(tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { select(tab); });
      tab.addEventListener("keydown", function (e) {
        var j = null;
        if (e.key === "ArrowRight") j = (i + 1) % tabs.length;
        if (e.key === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length;
        if (j !== null) { e.preventDefault(); tabs[j].focus(); select(tabs[j]); }
      });
    });
  });

  // ---- example filters ----
  var chips = document.querySelectorAll(".chip[data-filter]");
  var cards = document.querySelectorAll("#example-grid .ex");
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var f = chip.getAttribute("data-filter");
      chips.forEach(function (c) { c.setAttribute("aria-pressed", c === chip ? "true" : "false"); });
      cards.forEach(function (card) {
        card.hidden = !(f === "all" || card.getAttribute("data-cat") === f);
      });
    });
  });
})();
