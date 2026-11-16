// Inside the switch: step players for the three animated walkthroughs.
// Each player shows one step at a time. A step is an async run() that animates,
// plus an optional after() that sets its end state instantly; jumping to step i
// replays after() of steps 0..i-1 before running step i.
(function () {
  "use strict";

  var reduceMQ = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function reduced() { return !!(reduceMQ && reduceMQ.matches); }
  var ABORT = { aborted: true };
  var STATE_CLASSES = ["on", "on-amber", "on-violet", "show", "new", "hit", "changed", "lit", "tick", "wait"];

  function Signal() { this.aborted = false; this.fns = []; }
  Signal.prototype.on = function (fn) { if (this.aborted) fn(); else this.fns.push(fn); };
  Signal.prototype.abort = function () {
    if (this.aborted) return;
    this.aborted = true;
    this.fns.forEach(function (f) { f(); });
    this.fns = [];
  };

  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOutBack(t) { var c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function $(id) { return document.getElementById(id); }

  function delay(ms, sig) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(resolve, ms);
      sig.on(function () { clearTimeout(t); reject(ABORT); });
    });
  }

  // ---------- context handed to every step ----------
  function Ctx(player, sig, instant) {
    this.p = player;
    this.sig = sig;
    this.instant = instant || reduced();
    this.mode = player.root.getAttribute("data-mode") || "";
  }
  Ctx.prototype.wait = function (ms) {
    if (this.sig.aborted) return Promise.reject(ABORT);
    return this.instant ? Promise.resolve() : delay(ms, this.sig);
  };
  Ctx.prototype.tween = function (ms, fn, ease) {
    var sig = this.sig;
    if (sig.aborted) return Promise.reject(ABORT);
    if (this.instant || ms <= 0) { fn(1); return Promise.resolve(); }
    ease = ease || easeInOut;
    return new Promise(function (resolve, reject) {
      var start = null;
      function frame(now) {
        if (sig.aborted) { reject(ABORT); return; }
        if (start === null) start = now;
        var t = Math.min(1, (now - start) / ms);
        fn(ease(t));
        if (t < 1) requestAnimationFrame(frame); else resolve();
      }
      requestAnimationFrame(frame);
    });
  };
  Ctx.prototype.add = function (id, cls) { var el = $(id); if (el) el.classList.add(cls || "on"); };
  Ctx.prototype.rm = function (id, cls) { var el = $(id); if (el) el.classList.remove(cls || "on"); };
  Ctx.prototype.show = function (id) { this.add(id, "show"); };
  Ctx.prototype.hide = function (id) { this.rm(id, "show"); };
  Ctx.prototype.text = function (id, s) {
    var el = $(id);
    if (!el) return;
    if (!el.hasAttribute("data-orig")) el.setAttribute("data-orig", el.textContent);
    el.textContent = s;
  };
  Ctx.prototype.place = function (id, pathId, frac) {
    var el = $(id), path = $(pathId);
    var pt = path.getPointAtLength(path.getTotalLength() * frac);
    el.setAttribute("transform", "translate(" + pt.x.toFixed(2) + " " + pt.y.toFixed(2) + ")");
    return pt;
  };
  Ctx.prototype.move = function (id, pathId, ms, opts) {
    var self = this;
    opts = opts || {};
    var from = opts.from || 0, to = opts.to === undefined ? 1 : opts.to;
    this.show(id);
    return this.tween(ms, function (t) {
      var pt = self.place(id, pathId, from + (to - from) * t);
      if (opts.onFrame) opts.onFrame(pt);
      self.follow(id);
    }, opts.ease);
  };
  // when the stage scrolls sideways (phones), keep a moving element in view
  Ctx.prototype.follow = function (id) {
    if (this.instant) return;
    var stage = this.p.stageEl;
    if (stage.scrollWidth <= stage.clientWidth + 1) return;
    var el = typeof id === "string" ? $(id) : id;
    var r = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
    var center = r.left + r.width / 2 - s.left + stage.scrollLeft;
    var target = Math.max(0, Math.min(stage.scrollWidth - stage.clientWidth, center - stage.clientWidth / 2));
    stage.scrollLeft += (target - stage.scrollLeft) * 0.12;
  };
  // briefly pull the header segments of a packet apart, as if parsed
  Ctx.prototype.spread = function (id) {
    if (this.instant) return Promise.resolve();
    var segs = $(id).querySelectorAll(".seg");
    var mid = (segs.length - 1) / 2;
    Array.prototype.forEach.call(segs, function (s, i) {
      s.style.transform = "translate(" + ((i - mid) * 4) + "px, -3px)";
    });
    var self = this;
    return this.wait(420).then(function () {
      Array.prototype.forEach.call(segs, function (s) { s.style.transform = ""; });
      return self.wait(300);
    });
  };

  // ---------- player ----------
  var ICONS = {
    prev: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 3 4.5 8l6 5z"/></svg>',
    next: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3l6 5-6 5z"/></svg>',
    play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3l8 5-8 5z"/></svg>',
    pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z"/></svg>'
  };

  function Player(root, def) {
    var self = this;
    this.root = root;
    this.def = def;
    this.svg = root.querySelector(".stage svg");
    this.stageEl = root.querySelector(".stage");
    this.items = Array.prototype.slice.call(root.querySelectorAll(".step-item"));
    this.caption = root.querySelector(".stage-caption");
    this.n = def.steps.length;
    this.i = 0;
    this.auto = !reduced();
    this.visible = false;
    this.started = false;
    this.done = false;
    this.sig = null;
    this.state = {};
    this.buildControls(root.querySelector(".controls"));
    var hint = document.createElement("p");
    hint.className = "stage-scroll-hint";
    hint.textContent = "← swipe the diagram to see all of it →";
    this.stageEl.insertAdjacentElement("afterend", hint);
    this.items.forEach(function (item, k) {
      item.addEventListener("click", function (e) {
        if (e.target.closest && e.target.closest(".copy-btn")) return;
        self.user(k);
      });
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          self.visible = en.isIntersecting;
          if (self.visible && !self.started) { self.started = true; self.go(0); }
          else if (self.visible && self.done) self.scheduleNext();
        });
      }, { threshold: 0.35 }).observe(root.querySelector(".stage"));
    } else {
      this.visible = true;
      this.started = true;
      this.go(0);
    }
    // show step 1 at once, so the stage is never blank before it scrolls in
    this.paint(0);
  }

  Player.prototype.buildControls = function (box) {
    var self = this;
    box.innerHTML =
      '<button type="button" class="ctrl-btn" data-act="prev" aria-label="Previous step">' + ICONS.prev + "</button>" +
      '<button type="button" class="ctrl-btn play" data-act="play"></button>' +
      '<button type="button" class="ctrl-btn" data-act="next" aria-label="Next step">' + ICONS.next + "</button>" +
      '<div class="progress"></div><span class="step-count"></span>';
    this.playBtn = box.querySelector('[data-act="play"]');
    this.count = box.querySelector(".step-count");
    var prog = box.querySelector(".progress");
    this.bars = [];
    for (var k = 0; k < this.n; k++) {
      var b = document.createElement("button");
      b.type = "button";
      var title = this.items[k] ? this.items[k].querySelector(".step-title").lastChild.textContent : "";
      b.setAttribute("aria-label", "Step " + (k + 1) + ": " + title);
      b.title = title;
      (function (k) { b.addEventListener("click", function () { self.user(k); }); })(k);
      prog.appendChild(b);
      this.bars.push(b);
    }
    box.querySelector('[data-act="prev"]').addEventListener("click", function () { self.user(self.i - 1); });
    box.querySelector('[data-act="next"]').addEventListener("click", function () { self.user(self.i + 1); });
    this.playBtn.addEventListener("click", function () {
      if (self.auto) { self.setAuto(false); return; }
      self.setAuto(true);
      if (self.done) self.go(self.i === self.n - 1 ? 0 : self.i + 1);
    });
    this.setAuto(this.auto);
  };

  Player.prototype.setAuto = function (on) {
    this.auto = on;
    this.playBtn.innerHTML = on ? ICONS.pause : ICONS.play;
    this.playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
  };

  Player.prototype.user = function (k) {
    this.started = true;   // a click before the stage scrolls in must not be overridden
    this.setAuto(false);
    this.go(k);
  };

  Player.prototype.ui = function () {
    var i = this.i;
    this.items.forEach(function (it, k) { it.classList.toggle("active", k === i); });
    this.bars.forEach(function (b, k) {
      b.classList.toggle("done", k < i);
      b.classList.toggle("active", k === i);
      if (k === i) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
    this.count.textContent = (i + 1) + " / " + this.n;
    if (this.caption && this.items[i]) {
      var item = this.items[i];
      this.caption.innerHTML = "";
      var head = document.createElement("strong");
      var num = document.createElement("span");
      num.className = "n";
      num.textContent = (i < 9 ? "0" : "") + (i + 1);
      head.appendChild(num);
      head.appendChild(document.createTextNode(item.querySelector(".step-title").lastChild.textContent));
      this.caption.appendChild(head);
      this.caption.classList.remove("swap");
      void this.caption.offsetWidth;
      this.caption.classList.add("swap");
      Array.prototype.forEach.call(item.children, function (ch) {
        if (ch.classList.contains("step-title")) return;
        var c = ch.cloneNode(true);
        var btn = c.querySelector && c.querySelector(".copy-btn");
        if (btn) btn.remove();
        this.caption.appendChild(c);
      }, this);
    }
  };

  Player.prototype.reset = function (ctx) {
    var svg = this.svg;
    STATE_CLASSES.forEach(function (cls) {
      Array.prototype.forEach.call(svg.querySelectorAll("." + cls), function (el) { el.classList.remove(cls); });
    });
    Array.prototype.forEach.call(svg.querySelectorAll("[data-orig]"), function (el) {
      el.textContent = el.getAttribute("data-orig");
    });
    Array.prototype.forEach.call(svg.querySelectorAll(".seg"), function (s) { s.style.transform = ""; });
    if (this.def.reset) this.def.reset(ctx);
  };

  // set the end state of steps 0..i-1 and the start of step i, without running it
  Player.prototype.paint = function (i) {
    var sig = new Signal();
    var ctx = new Ctx(this, sig, true);
    this.reset(ctx);
    var steps = this.def.steps, chain = Promise.resolve();
    for (var k = 0; k < i; k++) {
      (function (s) { chain = chain.then(function () { return s.after ? s.after(ctx) : null; }); })(steps[k]);
    }
    return chain;
  };

  Player.prototype.go = function (i) {
    var self = this;
    if (this.sig) this.sig.abort();
    var sig = this.sig = new Signal();
    this.i = ((i % this.n) + this.n) % this.n;
    this.done = false;
    this.ui();
    this.paint(this.i).then(function () {
      if (sig.aborted) throw ABORT;
      return self.def.steps[self.i].run(new Ctx(self, sig, false));
    }).then(function () {
      if (sig.aborted) return;
      self.done = true;
      self.scheduleNext();
    }).catch(function (e) {
      if (e !== ABORT && window.console) console.error(e);
    });
  };

  Player.prototype.scheduleNext = function () {
    var self = this, sig = this.sig;
    if (!this.auto || !this.visible || !sig || sig.aborted) return;
    var last = this.i === this.n - 1;
    delay(last ? 3200 : 1400, sig).then(function () {
      if (!self.auto || !self.visible) return;
      self.go(last ? 0 : self.i + 1);
    }).catch(function () {});
  };

  // ======================================================================
  // Chapter 1: the switch in ns-3
  // ======================================================================
  var chapterSwitch = {
    steps: [
      { // 01 a NetDevice with ports
        run: async function (c) {
          c.add("s1-switch");
          for (var k = 0; k < 4; k++) { await c.wait(180); c.add("s1-p" + k); }
          await c.wait(700);
        }
      },
      { // 02 the control plane installs a rule
        run: async function (c) {
          c.add("s1-ctrl", "on-violet");
          c.add("s1-ctrlwire", "on-violet");
          c.add("s1-thrift", "on-violet");
          c.add("s1-ctrlmsg", "on-violet");
          c.show("s1-cmd");
          c.place("s1-msg", "s1-p-ctrl", 0);
          await c.wait(250);
          await c.move("s1-msg", "s1-p-ctrl", 1800);
          c.hide("s1-msg");
          c.show("s1-row2g");
          c.add("s1-row2", "new");
          await c.wait(900);
        },
        after: function (c) { c.show("s1-row2g"); }
      },
      { // 03 a packet arrives and is parsed
        run: async function (c) {
          c.add("s1-h1");
          c.place("s1-pkt", "s1-p-in", 0);
          await c.move("s1-pkt", "s1-p-in", 1600, {
            onFrame: function (p) {
              if (p.y < 352) c.add("s1-p0");
              if (p.y < 276) c.add("s1-parser");
            }
          });
          c.text("s1-parser-sub", "dst = 10.1.1.2");
          c.add("s1-parser-sub", "changed");
          await c.spread("s1-pkt");
          await c.wait(600);
        },
        after: function (c) {
          c.place("s1-pkt", "s1-p-in", 1);
          c.show("s1-pkt");
          c.text("s1-parser-sub", "dst = 10.1.1.2");
        }
      },
      { // 04 match and act
        run: async function (c) {
          c.add("s1-table");
          await c.move("s1-pkt", "s1-p-mid", 1100);
          c.add("s1-row2", "hit");
          c.show("s1-hit");
          await c.wait(1100);
        },
        after: function (c) {
          c.place("s1-pkt", "s1-p-mid", 1);
          c.show("s1-pkt");
          c.add("s1-row2", "hit");
          c.show("s1-hit");
        }
      },
      { // 05 out of port 3
        run: async function (c) {
          c.add("s1-link2");
          await c.move("s1-pkt", "s1-p-out", 1700, {
            onFrame: function (p) { if (p.y > 300) c.add("s1-p3"); }
          });
          c.hide("s1-pkt");
          c.add("s1-h2");
          c.text("s1-h2-sub", "received ✓");
          c.add("s1-h2-sub", "changed");
          await c.wait(1200);
        }
      }
    ]
  };

  // ======================================================================
  // Chapter 2: pipeline and traffic manager
  // ======================================================================
  function tick(c) {
    var clock = $("s2-clock"), hand = clock.querySelector(".clock-hand");
    var p = c.p;
    var from = p.state.angle || 0;
    p.state.angle = from + 90;
    clock.classList.add("tick");
    return c.tween(260, function (t) {
      hand.setAttribute("transform", "rotate(" + (from + 90 * t) + " 489 292)");
    }).then(function () { return c.wait(160); }).then(function () { clock.classList.remove("tick"); });
  }

  var chapterPipeline = {
    reset: function (c) {
      var hand = $("s2-clock").querySelector(".clock-hand");
      hand.setAttribute("transform", "rotate(" + (c.p.state.angle || 0) + " 489 292)");
    },
    steps: [
      { // 01 configuration
        run: async function (c) {
          c.add("s2-cfg-ns3", "on-amber");
          c.add("s2-cfg-p4");
          await c.wait(450);
          var p4 = ["s2-parser", "s2-ing", "s2-eg", "s2-dep"];
          for (var k = 0; k < p4.length; k++) { c.add(p4[k]); await c.wait(170); }
          var ns3 = ["s2-in", "s2-tm", "s2-p0", "s2-p3"];
          for (k = 0; k < ns3.length; k++) { c.add(ns3[k], "on-amber"); await c.wait(170); }
          await c.wait(1100);
        }
      },
      { // 02 input buffer
        run: async function (c) {
          c.add("s2-in", "on-amber");
          c.place("s2-pkt", "s2-pA", 0);
          await c.move("s2-pkt", "s2-pA", 1400, {
            onFrame: function (p) { if (p.x > 20) c.add("s2-p0", "on-amber"); }
          });
          c.add("s2-lane-ext", "on-amber");
          await c.wait(500);
          c.add("s2-lane-int", "on-amber");
          await c.wait(900);
        },
        after: function (c) { c.place("s2-pkt", "s2-pA", 1); c.show("s2-pkt"); }
      },
      { // 03 parse
        run: async function (c) {
          c.add("s2-parser");
          await c.move("s2-pkt", "s2-pB", 900);
          await c.spread("s2-pkt");
          c.show("s2-phv");
          await c.wait(1000);
        },
        after: function (c) { c.place("s2-pkt", "s2-pB", 1); c.show("s2-pkt"); c.show("s2-phv"); }
      },
      { // 04 ingress
        run: async function (c) {
          c.add("s2-ing");
          await c.move("s2-pkt", "s2-pC", 1800, {
            onFrame: function (p) {
              if (p.x > 270) c.add("s2-i1");
              if (p.x > 314) c.add("s2-i2");
              if (p.x > 358) c.add("s2-i3");
            }
          });
          c.text("s2-phv-2", "egress_spec = 3   priority = 5");
          c.add("s2-phv-2", "changed");
          await c.wait(1100);
        },
        after: function (c) {
          c.place("s2-pkt", "s2-pC", 1);
          c.show("s2-pkt");
          c.text("s2-phv-2", "egress_spec = 3   priority = 5");
        }
      },
      { // 05 traffic manager: queue 7 is served before queue 5
        run: async function (c) {
          c.add("s2-tm", "on-amber");
          c.place("s2-bg7", "s2-pBg7", 0); c.show("s2-bg7"); c.add("s2-q7", "on-amber");
          c.place("s2-bg5", "s2-pE", 0); c.show("s2-bg5"); c.add("s2-q5", "on-amber");
          await c.move("s2-pkt", "s2-pD", 1100);
          await c.wait(350);
          await tick(c);
          await c.move("s2-bg7", "s2-pBg7", 1200);
          c.hide("s2-bg7"); c.rm("s2-q7", "on-amber");
          await tick(c);
          await c.move("s2-bg5", "s2-pE", 1200);
          c.hide("s2-bg5");
          await tick(c);
          await c.move("s2-pkt", "s2-pAdv", 450);
          await c.wait(600);
        },
        after: function (c) { c.place("s2-pkt", "s2-pAdv", 1); c.show("s2-pkt"); c.show("s2-phv"); }
      },
      { // 06 egress, deparser, out
        run: async function (c) {
          c.add("s2-eg");
          await c.move("s2-pkt", "s2-pE", 2300, {
            onFrame: function (p) {
              if (p.x > 590) c.add("s2-e1");
              if (p.x > 646) c.add("s2-e2");
              if (p.x > 712) { c.add("s2-dep"); c.hide("s2-phv"); }
              if (p.x > 798) c.add("s2-p3");
            }
          });
          c.hide("s2-pkt");
          await c.wait(700);
        },
        after: function (c) { c.hide("s2-pkt"); c.hide("s2-phv"); }
      },
      { // 07 loops and copies
        run: async function (c) {
          c.show("s2-loops");
          await c.wait(500);
          c.place("s2-copy", "s2-pResub", 0);
          await c.move("s2-copy", "s2-pResub", 1700);
          c.add("s2-lane-int", "on-amber");
          await c.wait(350);
          c.place("s2-copy", "s2-pRecirc", 0);
          await c.move("s2-copy", "s2-pRecirc", 2000);
          await c.wait(350);
          c.place("s2-copy", "s2-pE2E", 0);
          await c.move("s2-copy", "s2-pE2E", 1200);
          c.add("s2-tm", "on-amber");
          c.hide("s2-copy");
          await c.wait(1000);
        }
      }
    ]
  };

  // ======================================================================
  // Chapter 3: queues and scheduling
  // The steps follow P4CoreV1model and NSQueueingLogicPriRL (utils/p4-queue.h):
  // priority p -> queue p; on each tick (1 / SwitchRate) one packet leaves, from
  // the highest queue whose head is due; a packet is due at
  // max(arrival, previous due time of its queue + 1 / queue rate), and every
  // queue rate defaults to SwitchRate. Times here are in ms (1 tick = 1 ms).
  // ======================================================================
  var SVGNS = "http://www.w3.org/2000/svg";
  var QY = 228;                                              // main line
  function qLaneY(k) { return 116 + (7 - k) * 24 + 9; }       // centre of lane k
  function qSlotX(j) { return 584 - j * 21; }                 // j-th packet from the head
  function fmtNs(ms) { return String(Math.round(ms * 1e6)).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
  function fmtMs(ms) { return (Math.round(ms * 10) / 10).toFixed(1); }

  function qPos(el, x, y) {
    el._x = x; el._y = y;
    el.setAttribute("transform", "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ")");
  }
  function qMake(f) {
    var g = document.createElementNS(SVGNS, "g");
    g.setAttribute("class", "qp f" + f);
    var r = document.createElementNS(SVGNS, "rect");
    [["x", "-8.5"], ["y", "-6"], ["width", "17"], ["height", "12"], ["rx", "3"]].forEach(function (a) { r.setAttribute(a[0], a[1]); });
    var t = document.createElementNS(SVGNS, "text");
    t.setAttribute("y", "3");
    t.setAttribute("text-anchor", "middle");
    t.textContent = String(f);
    g.appendChild(r);
    g.appendChild(t);
    g._f = f;
    $("q-pkts").appendChild(g);
    return g;
  }
  // move a packet along a polyline at constant speed
  function qFly(c, el, pts, ms) {
    var lens = [], total = 0;
    for (var i = 1; i < pts.length; i++) {
      var l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      lens.push(l);
      total += l;
    }
    return c.tween(ms, function (t) {
      var d = t * total, k = 0;
      while (k < lens.length - 1 && d > lens[k]) { d -= lens[k]; k++; }
      var u = lens[k] ? Math.min(1, d / lens[k]) : 1;
      qPos(el, pts[k][0] + (pts[k + 1][0] - pts[k][0]) * u, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * u);
      c.follow(el);
    });
  }
  // slide the packets of lane k to their slots (packets still flying in keep flying)
  function qLane(c, k, ms) {
    var y = qLaneY(k), items = [];
    c.p.state.q[k].forEach(function (el, j) {
      if (!el._flying) items.push({ el: el, from: el._x, to: qSlotX(j) });
    });
    return c.tween(ms, function (t) {
      items.forEach(function (it) { qPos(it.el, it.from + (it.to - it.from) * t, y); });
    });
  }
  // light only these boxes
  function lit(c, ids) {
    Array.prototype.forEach.call(c.p.svg.querySelectorAll(".box.on"), function (el) { el.classList.remove("on"); });
    ids.forEach(function (id) { c.add(id); });
  }

  // a packet of flow f arrives, is classified and joins queue f (or is dropped)
  function qArrive(c, f, ms) {
    var st = c.p.state, q = st.q[f], y = qLaneY(f);
    st.t = Math.max(st.t, st.tick) + 0.1;
    var el = qMake(f);
    el._enq = st.t;
    qPos(el, 96, QY);
    c.add("q-r" + f, "hit");
    var j = q.length, full = j >= st.cap;
    if (!full) {
      el._due = Math.max(st.t, st.last[f] + 1000 / st.rate[f]);
      st.last[f] = el._due;
      q.push(el);   // the slot is taken now, so packets still in flight stack up
      c.text("q-m1", "enq_timestamp = " + fmtNs(el._enq) + "  ·  enq_qdepth = " + j);
      c.add("q-m1", "changed");
    }
    el._flying = true;
    return qFly(c, el, [[96, QY], [290, QY], [308, y], [qSlotX(j), y]], ms).then(function () {
      el._flying = false;
      c.rm("q-r" + f, "hit");
      if (!full) return qLane(c, f, 160);
      el.classList.add("drop");
      st.drop++;
      c.text("q-drop", "✕ " + st.drop + " dropped: queue " + f + " was full");
      c.show("q-drop");
      return c.tween(600, function (t) {
        qPos(el, qSlotX(j), y + 16 * t);
        el.style.opacity = String(1 - t);
      }).then(function () { el.remove(); });
    });
  }

  function qTick(c) {
    var st = c.p.state, clock = $("q-clock"), hand = clock.querySelector(".clock-hand");
    var from = st.angle;
    st.angle += 90;
    st.tick++;
    c.text("q-t", "t = " + st.tick + " ms");
    clock.classList.add("tick");
    return c.tween(240, function (t) {
      hand.setAttribute("transform", "rotate(" + (from + 90 * t) + " 702 182)");
    }).then(function () { return c.wait(110); }).then(function () { clock.classList.remove("tick"); });
  }
  // the highest queue whose head packet is due
  function qPick(st) {
    for (var k = 7; k >= 0; k--) {
      var q = st.q[k];
      if (q.length && q[0]._due <= st.tick + 1e-9) return k;
    }
    return -1;
  }
  function qDeqMeta(c, el, k) {
    var st = c.p.state;
    c.text("q-m2", "deq_timedelta = " + fmtNs(st.tick - el._enq) + "  ·  deq_qdepth = " + st.q[k].length + "  ·  qid = " + k);
    c.add("q-m2", "changed");
  }
  function qDeliver(c, el) {
    var st = c.p.state, f = el._f;
    el.remove();
    st.cnt[f]++;
    c.text("q-c" + f, String(st.cnt[f]));
    c.add("q-c" + f, "changed");
  }
  function qWaiting(c) {
    var st = c.p.state;
    [1, 2].forEach(function (k) {
      var q = st.q[k];
      if (q.length) c.text("q-w" + k, "waiting " + fmtMs(st.tick - q[0]._enq) + " ms");
    });
  }
  // one tick: the scheduler sends one packet on its way to Host 1
  async function qServe(c) {
    var st = c.p.state;
    await qTick(c);
    qWaiting(c);
    var k = qPick(st), held = -1;
    for (var h = 7; h > k; h--) { if (st.q[h].length) { held = h; break; } }
    if (held >= 0) {
      c.text("q-ready", "q" + held + " due at " + fmtMs(st.q[held][0]._due) + " ms");
      c.show("q-ready");
    } else {
      c.hide("q-ready");
    }
    if (k < 0) return;
    if (k === 1 || k === 2) { c.hide("q-w" + k); c.rm("q-l" + k, "wait"); }
    c.add("q-l" + k);
    var el = st.q[k].shift(), y = qLaneY(k);
    qDeqMeta(c, el, k);
    // packets keep flying while the next tick starts; a jump to another step aborts them
    var lane = qLane(c, k, 320);
    var fly = qFly(c, el, [[el._x, y], [606, y], [628, QY], [910, QY], [910, 350]], 1500)
      .then(function () { qDeliver(c, el); });
    st.flights.push(lane.catch(noop), fly.catch(noop));
    await c.wait(650);
    c.rm("q-l" + k);
  }
  function noop() {}
  async function qFlights(c) {
    var st = c.p.state, f = st.flights;
    st.flights = [];
    await Promise.all(f);
    if (c.sig.aborted) throw ABORT;
  }
  async function qServeN(c, n) {
    for (var i = 0; i < n; i++) await qServe(c);
    await qFlights(c);
  }
  function qStagger(c, flows, gap, ms) {
    return Promise.all(flows.map(function (f, i) {
      return c.wait(i * gap).then(function () { return qArrive(c, f, ms); });
    }));
  }

  // Each step is deterministic, so its end state is simply the step run instantly.
  var chapterQueues = {
    reset: function (c) {
      var st = c.p.state;
      $("q-pkts").textContent = "";
      st.q = []; st.last = []; st.rate = [];
      for (var k = 0; k < 8; k++) { st.q.push([]); st.last.push(-Infinity); st.rate.push(1000); }
      st.cnt = [0, 0, 0, 0];
      st.tick = 0; st.t = 0; st.angle = 0; st.drop = 0; st.cap = Infinity; st.flights = [];
      $("q-clock").querySelector(".clock-hand").setAttribute("transform", "rotate(0 702 182)");
    },
    steps: [
      { // 01 three flows, three priorities
        run: async function (c) {
          lit(c, ["q-h0", "q-ing"]);
          await c.wait(300);
          await qStagger(c, [1, 2, 3], 450, 1500);
          await c.wait(900);
        }
      },
      { // 02 eight queues per port; the queues fill
        run: async function (c) {
          lit(c, ["q-tm"]);
          await qStagger(c, [3, 1, 3, 2, 1], 300, 1100);
          await c.wait(1300);
        }
      },
      { // 03 one packet per tick, highest ready queue first
        run: async function (c) {
          lit(c, ["q-sch"]);
          await qServeN(c, 4);
          await c.wait(900);
        }
      },
      { // 04 strict priority: queue 3 wins every tick
        run: async function (c) {
          lit(c, ["q-sch"]);
          c.add("q-l2", "wait"); c.add("q-l1", "wait");
          qWaiting(c);
          c.show("q-w2"); c.show("q-w1");
          for (var i = 0; i < 3; i++) {
            await qArrive(c, 3, 800);
            await qServe(c);
          }
          await qFlights(c);
          await c.wait(900);
        }
      },
      { // 05 queue 3 limited to 500 pps
        run: async function (c) {
          lit(c, ["q-sch"]);
          c.p.state.rate[3] = 500;
          c.show("q-rate");
          await c.wait(500);
          await qStagger(c, [3, 3], 300, 900);
          await qServeN(c, 4);
          c.hide("q-ready");
          await c.wait(900);
        }
      },
      { // 06 tail drop
        run: async function (c) {
          lit(c, ["q-tm"]);
          c.p.state.cap = 6;
          c.show("q-cap");
          await c.wait(500);
          await qStagger(c, [1, 1, 1, 1, 1], 260, 1000);
          await c.wait(1300);
        }
      },
      { // 07 dequeue metadata, egress, the port's TX queue and the link
        run: async function (c) {
          var st = c.p.state;
          lit(c, ["q-sch"]);
          await qTick(c);
          var k = qPick(st);
          if (k < 0) return;
          c.add("q-l" + k);
          var el = st.q[k].shift(), y = qLaneY(k);
          qDeqMeta(c, el, k);
          await Promise.all([qLane(c, k, 320), qFly(c, el, [[el._x, y], [606, y], [628, QY], [821, QY]], 1100)]);
          c.rm("q-l" + k);
          lit(c, ["q-eg", "q-meta"]);
          await c.wait(1000);
          await qFly(c, el, [[821, QY], [910, QY]], 600);
          lit(c, ["q-tx"]);
          c.add("q-txl");
          await c.wait(700);
          c.rm("q-txl");
          c.add("q-link");
          await qFly(c, el, [[910, QY], [910, 350]], 800);
          qDeliver(c, el);
          lit(c, ["q-h1"]);
          await c.wait(1500);
        }
      }
    ]
  };
  chapterQueues.steps.forEach(function (s) { s.after = s.run; });

  // ======================================================================
  // Chapter 4: custom headers
  // ======================================================================
  var LAYOUTS = {
    normal: { eth: 140, ip: 268, udp: 422, pay: 530, cus: null },
    before: { eth: 72, cus: 200, ip: 336, udp: 490, pay: 598 },
    after: { eth: 72, ip: 200, cus: 354, udp: 490, pay: 598 }
  };
  var TRACK_X = [83, 247, 410, 573, 737];
  var BLOCKS = ["eth", "ip", "udp", "pay", "cus"];

  function setBlock(name, x, y) {
    $("s3-b-" + name).setAttribute("transform", "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ")");
  }
  // move the header blocks to a layout; cusDy lifts the custom header above the row
  function layout(c, name, ms, cusDy, ease) {
    var pos = c.p.state.pos;
    var target = LAYOUTS[name], cusX = LAYOUTS[c.mode || "before"].cus;
    var from = {}, to = {};
    BLOCKS.forEach(function (b) {
      from[b] = { x: pos[b].x, y: pos[b].y };
      to[b] = b === "cus"
        ? { x: target.cus === null ? cusX : target.cus, y: cusDy || 0 }
        : { x: target[b], y: 0 };
    });
    return c.tween(ms, function (t) {
      BLOCKS.forEach(function (b) {
        pos[b].x = from[b].x + (to[b].x - from[b].x) * t;
        pos[b].y = from[b].y + (to[b].y - from[b].y) * t;
        setBlock(b, pos[b].x, pos[b].y);
      });
    }, ease);
  }
  function marker(c, k, ms) {
    var st = c.p.state, from = st.mx === undefined ? TRACK_X[0] : st.mx, to = TRACK_X[k];
    var m = $("s3-marker");
    return c.tween(ms, function (t) {
      st.mx = from + (to - from) * t;
      m.setAttribute("cx", st.mx.toFixed(2));
      m.setAttribute("cy", "44");
    });
  }
  function showCustom(on) { $("s3-b-cus").classList.toggle("hidden-block", !on); }

  // the two note lines under the packet, per step and per position of the custom header
  var NOTES = [
    { before: ["etherType 0x0800 tells the receiver that IPv4 comes next", ""] },
    {
      before: ["CustomHeader: proto_id (16 bits) + dst_id (16 bits)", "LAYER_3 + ADD_BEFORE: goes between Ethernet and IPv4"],
      after: ["CustomHeader: proto_id (16 bits) + dst_id (16 bits)", "LAYER_3 + ADD_AFTER: goes between IPv4 and UDP"]
    },
    {
      before: ["etherType 0x00DC: a custom header follows", "the custom header keeps 0x0800, so IPv4 can be restored"],
      after: ["IPv4 protocol 0xDC: a custom header follows", "the custom header keeps 0x11, so UDP can be restored"]
    },
    {
      before: ["the switch parses ethernet → custom → ipv4", ""],
      after: ["the switch parses ethernet → ipv4 → custom", ""]
    },
    { before: ["custom header removed, original type field restored", "the IPv4 stack of Host 2 sees an ordinary packet"] }
  ];
  function notes(c, k) {
    var n = NOTES[k][c.mode] || NOTES[k].before;
    c.text("s3-note1", n[0]);
    c.text("s3-note2", n[1]);
  }

  var chapterHeaders = {
    reset: function (c) {
      var st = c.p.state;
      st.pos = {};
      var cusX = LAYOUTS[c.mode || "before"].cus;
      BLOCKS.forEach(function (b) {
        st.pos[b] = b === "cus" ? { x: cusX, y: -62 } : { x: LAYOUTS.normal[b], y: 0 };
        setBlock(b, st.pos[b].x, st.pos[b].y);
      });
      showCustom(false);
      st.mx = TRACK_X[0];
      var m = $("s3-marker");
      m.setAttribute("cx", TRACK_X[0]);
      m.setAttribute("cy", "44");
      if (c.mode === "after") {
        c.text("s3-pg-t2", "ipv4");
        c.text("s3-pg-t3", "custom");
        c.text("s3-pg-l1", "0x0800");
        c.text("s3-pg-l2", "0xDC");
      }
    },
    steps: [
      { // 01 an ordinary packet
        run: async function (c) {
          c.add("s3-c1");
          await c.wait(500);
          c.add("s3-f-eth", "changed");
          await c.wait(1600);
        }
      },
      { // 02 describe the header
        run: async function (c) {
          c.add("s3-c2");
          await marker(c, 1, 700);
          await layout(c, c.mode, 900, -62);
          showCustom(true);
          notes(c, 1);
          await c.wait(1800);
        },
        after: function (c) {
          return marker(c, 1, 0).then(function () { return layout(c, c.mode, 0, -62); }).then(function () {
            showCustom(true);
            notes(c, 1);
          });
        }
      },
      { // 03 the sending device inserts it
        run: async function (c) {
          c.add("s3-c2");
          await layout(c, c.mode, 750, 0, easeOutBack);
          if (c.mode === "after") {
            c.text("s3-f-ip", "protocol 0xDC (custom)");
            c.add("s3-f-ip", "changed");
            c.text("s3-f-cus", "next: 0x11 (UDP)");
          } else {
            c.text("s3-f-eth", "etherType 0x00DC");
            c.add("s3-f-eth", "changed");
          }
          notes(c, 2);
          await c.wait(2200);
        },
        after: function (c) {
          return layout(c, c.mode, 0, 0).then(function () {
            if (c.mode === "after") {
              c.text("s3-f-ip", "protocol 0xDC (custom)");
              c.text("s3-f-cus", "next: 0x11 (UDP)");
            } else {
              c.text("s3-f-eth", "etherType 0x00DC");
            }
            notes(c, 2);
          });
        }
      },
      { // 04 P4 switches parse it
        run: async function (c) {
          c.add("s3-c3");
          await marker(c, 2, 900);
          c.show("s3-pg");
          notes(c, 3);
          // the custom header is the 2nd parser state before IPv4, the 3rd after it
          var customSecond = c.mode !== "after";
          await c.wait(350);
          c.add("s3-pg-n1");
          await c.wait(450);
          c.add("s3-pg-e1");
          c.add("s3-pg-n2", customSecond ? "on-amber" : "on");
          await c.wait(450);
          c.add("s3-pg-e2");
          c.add("s3-pg-n3", customSecond ? "on" : "on-amber");
          await c.wait(350);
          c.show("s3-pg-tab");
          await c.wait(1800);
        },
        after: function (c) { return marker(c, 2, 0).then(function () { notes(c, 3); }); }
      },
      { // 05 the receiver removes it
        run: async function (c) {
          c.add("s3-c4");
          await marker(c, 3, 900);
          await layout(c, c.mode, 600, -62);
          showCustom(false);
          if (c.mode === "after") {
            c.text("s3-f-ip", "protocol 0x11 (UDP)");
            c.add("s3-f-ip", "changed");
          } else {
            c.text("s3-f-eth", "etherType 0x0800");
            c.add("s3-f-eth", "changed");
          }
          notes(c, 4);
          await layout(c, "normal", 800, -62);
          await marker(c, 4, 800);
          c.add("s3-c5");
          await c.wait(1600);
        }
      }
    ]
  };

  // ======================================================================
  // Chapter 3, live model: a small discrete-event simulation of the same rules
  // for one output port (flow f uses queue f), followed by the port's ns-3 TX
  // queue (DropTail, 100 packets) and the link.
  // ======================================================================
  var LINKS = [1, 2, 5, 10, 20, 50, 100, 1000];               // Mbps
  var FRAME_BITS = (1000 + 8 + 20 + 14) * 8;                 // 1000-byte payload + UDP, IPv4, Ethernet
  var TX_CAP = 100, BIN = 0.2, NBINS = 50;                    // 50 bins of 0.2 s = the last 10 s
  var CW = 560, CX0 = 44, CX1 = 478, CY0 = 12, CY1 = 176;     // chart geometry (viewBox 560 x 206)
  var BASE = { r1: 375, r2: 500, r3: 625, sw: 1000, cap: 128, lim: false, limr: 300, link: 7 };
  var PRESETS = {
    starve: { note: "The three flows offer 1500 packets per second, but SwitchRate is 1000. Strict priority serves all of flow 3 and 375 of flow 2's 500 packets; flow 1 gets nothing, so queue 1 fills up and drops every new packet." },
    limit: { lim: true, note: "Queue 3 may send only 300 packets per second. Whenever its next packet is not due yet, the scheduler serves a lower queue: flow 2 now gets all 500 packets and flow 1 the remaining 200, while queues 3 and 1 overflow." },
    light: { r1: 200, r2: 250, r3: 300, note: "750 packets per second is below SwitchRate. Each packet leaves within a tick or two, the queues stay almost empty, and priority hardly matters." },
    link: { link: 2, note: "The link carries 5 Mbps, about 600 packets per second, less than the switch sends. The TX queue behind the switch fills and drops packets in arrival order, so even flow 3, the highest priority, now loses packets." }
  };
  var CUSTOM_NOTE = "Your own settings: watch which queue grows, where packets are dropped and how long they wait.";

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function keyEl(f) { return el("i", "key f" + f); }

  function initSandbox(root) {
    var form = root.querySelector(".sb-controls");
    var inp = function (n) { return form.elements[n]; };
    var runBtn = root.querySelector('[data-act="run"]');
    var note = root.querySelector(".sb-note");
    var clockEl = root.querySelector(".sb-clock");
    var plot = root.querySelector(".sb-plot");
    var svg = plot.querySelector("svg");
    var tip = plot.querySelector(".sb-tip");
    var presetBtns = Array.prototype.slice.call(root.querySelectorAll("[data-preset]"));
    var P = {}, S = null;
    var wants = !reduced(), visible = false, loop = 0, lastTable = 0;
    var hoverBack = null, chartDirty = true;

    // ----- fixed parts: queue lanes, legend, table rows -----
    var lanesBox = root.querySelector(".sb-lanes"), lanes = [];
    function addLane(label, fillCls, rowCls) {
      var row = el("div", "sb-lane" + (rowCls ? " " + rowCls : ""));
      var track = el("span", "sb-track"), fill = el("span", "sb-fill" + (fillCls ? " " + fillCls : ""));
      var val = el("span", "sb-val");
      track.appendChild(fill);
      row.appendChild(el("span", "", label));
      row.appendChild(track);
      row.appendChild(val);
      lanesBox.appendChild(row);
      return { fill: fill, val: val };
    }
    for (var k = 7; k >= 0; k--) lanes[k] = addLane("q" + k, k >= 1 && k <= 3 ? "f" + k : "");
    var txLane = addLane("TX", "", "tx");

    var legend = root.querySelector(".sb-legend");
    [1, 2, 3].forEach(function (f) {
      var li = el("li");
      li.appendChild(keyEl(f));
      li.appendChild(document.createTextNode("Flow " + f + " · q" + f));
      legend.appendChild(li);
    });
    var refLi = el("li");
    refLi.appendChild(el("i", "ref-key"));
    refLi.appendChild(document.createTextNode("SwitchRate"));
    legend.appendChild(refLi);

    var tbody = root.querySelector(".sb-table tbody"), cells = [];
    [1, 2, 3].forEach(function (f) {
      var tr = el("tr"), first = el("td");
      first.appendChild(keyEl(f));
      first.appendChild(document.createTextNode("Flow " + f + " · :" + (1000 + 1000 * f) + " → q" + f));
      tr.appendChild(first);
      cells[f] = [];
      for (var i = 0; i < 5; i++) { var td = el("td"); tr.appendChild(td); cells[f].push(td); }
      tbody.appendChild(tr);
    });

    // ----- parameters -----
    function out(name, text) {
      var o = inp(name).parentNode.querySelector("output");
      if (o) o.textContent = text;
    }
    function pps(v) { return v >= 10000 ? Math.round(v / 1000) + "k" : String(Math.round(v)); }
    function read() {
      P.rate = [0, +inp("r1").value, +inp("r2").value, +inp("r3").value];
      P.sw = +inp("sw").value;
      P.cap = +inp("cap").value;
      P.lim = inp("lim").checked;
      P.limr = +inp("limr").value;
      P.link = LINKS[+inp("link").value];
      inp("limr").disabled = !P.lim;
      for (var f = 1; f <= 3; f++) out("r" + f, P.rate[f] + " pps");
      out("sw", P.sw + " pps");
      out("cap", P.cap + " packets");
      out("limr", P.limr + " pps");
      out("link", P.link + " Mbps ≈ " + pps(P.link * 1e6 / FRAME_BITS) + " pps");
      chartDirty = true;
    }
    function setPreset(name) {
      presetBtns.forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-preset") === name ? "true" : "false"); });
      note.textContent = name ? PRESETS[name].note : CUSTOM_NOTE;
    }
    function applyPreset(name) {
      var v = {}, p = PRESETS[name];
      Object.keys(BASE).forEach(function (key) { v[key] = p[key] !== undefined ? p[key] : BASE[key]; });
      ["r1", "r2", "r3", "sw", "cap", "limr", "link"].forEach(function (key) { inp(key).value = v[key]; });
      inp("lim").checked = v.lim;
      read();
      restart();
      setPreset(name);
      hoverBack = null;
      draw(true);
    }

    // ----- the model -----
    function newBin(i) { return { i: i, n: [0, 0, 0, 0], d: [0, 0, 0, 0], dn: [0, 0, 0, 0] }; }
    function restart() {
      S = {
        now: 0, nextTick: 1 / P.sw, next: [Infinity, 0, 0, 0], q: [], last: [],
        tx: [], txCur: null, txDone: Infinity,
        drop: [0, 0, 0, 0], txDrop: [0, 0, 0, 0], bins: [], cur: newBin(0)
      };
      for (var k = 0; k < 8; k++) { S.q.push([]); S.last.push(-Infinity); }
      for (var f = 1; f <= 3; f++) S.next[f] = P.rate[f] > 0 ? f * 0.0003 : Infinity;
      chartDirty = true;
    }
    function queueRate(k) { return k === 3 && P.lim ? P.limr : P.sw; }
    function roll(t) {
      while (t >= (S.cur.i + 1) * BIN) {
        S.bins.push(S.cur);
        if (S.bins.length > NBINS) S.bins.shift();
        S.cur = newBin(S.cur.i + 1);
        chartDirty = true;
      }
    }
    function arrive(f) {
      S.next[f] = P.rate[f] > 0 ? S.now + 1 / P.rate[f] : Infinity;
      var q = S.q[f];
      if (q.length >= P.cap) { S.drop[f]++; return; }        // tail drop
      var due = Math.max(S.now, S.last[f] + 1 / queueRate(f));
      S.last[f] = due;
      q.push({ f: f, enq: S.now, due: due });
    }
    function transmit(p) { S.txCur = p; S.txDone = S.now + FRAME_BITS / (P.link * 1e6); }
    function tick() {
      S.nextTick += 1 / P.sw;
      for (var k = 7; k >= 0; k--) {
        var q = S.q[k];
        if (q.length && q[0].due <= S.now + 1e-12) {
          var p = q.shift();
          S.cur.d[p.f] += S.now - p.enq;
          S.cur.dn[p.f]++;
          if (!S.txCur) transmit(p);
          else if (S.tx.length >= TX_CAP) S.txDrop[p.f]++;
          else S.tx.push(p);
          return;
        }
      }
    }
    function linkDone() {
      S.cur.n[S.txCur.f]++;
      S.txCur = null;
      S.txDone = Infinity;
      if (S.tx.length) transmit(S.tx.shift());
    }
    function advance(to) {
      for (;;) {
        var fa = 1;
        if (S.next[2] < S.next[fa]) fa = 2;
        if (S.next[3] < S.next[fa]) fa = 3;
        var t = Math.min(S.next[fa], S.nextTick, S.txDone);
        if (t > to) break;
        roll(t);
        S.now = t;
        if (t === S.txDone) linkDone();
        else if (t === S.nextTick) tick();
        else arrive(fa);
      }
      roll(to);
      S.now = to;
    }

    // ----- drawing -----
    function recent() {
      var b = S.bins.slice(-5), r = { n: [0, 0, 0, 0], d: [0, 0, 0, 0], dn: [0, 0, 0, 0], secs: b.length * BIN };
      b.forEach(function (x) {
        for (var f = 1; f <= 3; f++) { r.n[f] += x.n[f]; r.d[f] += x.d[f]; r.dn[f] += x.dn[f]; }
      });
      return r;
    }
    function draw(full) {
      for (var k = 0; k < 8; k++) {
        var n = S.q[k].length;
        lanes[k].fill.style.width = Math.min(100, n / P.cap * 100) + "%";
        lanes[k].val.textContent = n + " / " + P.cap;
        lanes[k].val.classList.toggle("full", n >= P.cap);
      }
      var tn = S.tx.length;
      txLane.fill.style.width = (tn / TX_CAP * 100) + "%";
      txLane.val.textContent = tn + " / " + TX_CAP;
      txLane.val.classList.toggle("full", tn >= TX_CAP);
      clockEl.textContent = "t = " + S.now.toFixed(1) + " s";
      if (chartDirty) { chartDirty = false; drawChart(); }
      if (full) drawTable();
    }
    function drawTable() {
      var r = recent();
      for (var f = 1; f <= 3; f++) {
        var c = cells[f], q = S.q[f];
        c[0].textContent = P.rate[f] + " pps";
        c[1].textContent = r.secs ? Math.round(r.n[f] / r.secs) + " pps" : "–";
        c[2].textContent = S.drop[f].toLocaleString("en-US");
        c[3].textContent = S.txDrop[f].toLocaleString("en-US");
        var starved = !r.dn[f] && q.length > 0;
        c[4].classList.toggle("warn", starved);
        c[4].textContent = r.dn[f] ? (r.d[f] / r.dn[f] * 1000).toFixed(1) + " ms"
          : starved ? "starved, " + (S.now - q[0].enq).toFixed(1) + " s" : "–";
      }
    }
    function niceScale(v) {
      var best = null;
      [50, 100, 200, 250, 500].forEach(function (s) {
        var m = Math.max(2, Math.ceil(v / s));
        if (m <= 6 && (!best || s * m < best.max)) best = { max: s * m, step: s };
      });
      return best || { max: Math.ceil(v / 500) * 500, step: 500 };
    }
    function drawChart() {
      var sc = niceScale(Math.max(P.sw, P.rate[1], P.rate[2], P.rate[3], 100) * 1.08);
      var b = S.bins, n = b.length, dx = (CX1 - CX0) / (NBINS - 1);
      var X = function (j) { return CX1 - (n - 1 - j) * dx; };
      var Y = function (v) { return CY1 - Math.min(v, sc.max) / sc.max * (CY1 - CY0); };
      var h = [];
      for (var v = 0; v <= sc.max + 1e-9; v += sc.step) {
        var y = Y(v).toFixed(1);
        if (v > 0) h.push('<line class="grid" x1="' + CX0 + '" x2="' + CX1 + '" y1="' + y + '" y2="' + y + '"/>');
        h.push('<text x="' + (CX0 - 6) + '" y="' + (Y(v) + 3.5).toFixed(1) + '" text-anchor="end">' + v + "</text>");
      }
      h.push('<line class="axis" x1="' + CX0 + '" x2="' + CX1 + '" y1="' + CY1 + '" y2="' + CY1 + '"/>');
      h.push('<text x="' + CX0 + '" y="194">−10 s</text>');
      h.push('<text x="' + ((CX0 + CX1) / 2) + '" y="194" text-anchor="middle">−5 s</text>');
      h.push('<text x="' + CX1 + '" y="194" text-anchor="end">now</text>');
      var ysw = Y(P.sw).toFixed(1);
      h.push('<line class="ref" x1="' + CX0 + '" x2="' + CX1 + '" y1="' + ysw + '" y2="' + ysw + '"/>');
      if (n) {
        var r = recent(), ends = [];
        for (var f = 1; f <= 3; f++) {
          var pts = b.map(function (x, j) { return X(j).toFixed(1) + "," + Y(x.n[f] / BIN).toFixed(1); }).join(" ");
          h.push('<polyline class="ln f' + f + '" points="' + pts + '"/>');
          var avg = r.n[f] / r.secs;
          ends.push({ f: f, v: avg, y: Y(avg) });
        }
        // direct labels at the line ends, pushed apart so they never overlap
        ends.sort(function (a, c) { return a.y - c.y; });
        for (var i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 12) ends[i].y = ends[i - 1].y + 12;
        var over = ends[ends.length - 1].y - (CY1 + 2);
        if (over > 0) ends.forEach(function (e) { e.y -= over; });
        ends.forEach(function (e) {
          var ly = e.y.toFixed(1);
          h.push('<line class="tick-f' + e.f + '" stroke-width="2" x1="' + (CX1 + 4) + '" x2="' + (CX1 + 12) + '" y1="' + ly + '" y2="' + ly + '"/>');
          h.push('<text class="dl" x="' + (CX1 + 15) + '" y="' + (e.y + 3.5).toFixed(1) + '">q' + e.f + " · " + Math.round(e.v) + "</text>");
        });
        if (hoverBack !== null) {
          var j = Math.max(0, n - 1 - hoverBack), xh = X(j);
          h.push('<line class="xh" x1="' + xh.toFixed(1) + '" x2="' + xh.toFixed(1) + '" y1="' + CY0 + '" y2="' + CY1 + '"/>');
          for (f = 1; f <= 3; f++) h.push('<circle class="dot f' + f + '" cx="' + xh.toFixed(1) + '" cy="' + Y(b[j].n[f] / BIN).toFixed(1) + '" r="4"/>');
          showTip(j, xh);
        } else {
          tip.hidden = true;
        }
      } else {
        tip.hidden = true;
      }
      svg.innerHTML = h.join("");
    }
    function showTip(j, x) {
      var b = S.bins[j], ago = (S.bins.length - 1 - j) * BIN;
      tip.textContent = "";
      tip.appendChild(el("div", "when", ago < 0.05 ? "latest 0.2 s" : ago.toFixed(1) + " s ago"));
      [3, 2, 1].forEach(function (f) {
        var row = el("div", "row"), key = el("i");
        key.style.borderColor = "var(--f" + f + ")";
        row.appendChild(key);
        row.appendChild(el("b", "", String(Math.round(b.n[f] / BIN))));
        row.appendChild(el("span", "", "pps · flow " + f));
        tip.appendChild(row);
      });
      tip.hidden = false;
      var w = plot.clientWidth, px = x / CW * w;
      if (px > w * 0.55) { tip.style.left = ""; tip.style.right = (w - px + 12) + "px"; }
      else { tip.style.right = ""; tip.style.left = (px + 12) + "px"; }
    }

    // ----- running -----
    function start() {
      var id = ++loop, last = null;
      requestAnimationFrame(function frame(ts) {
        if (id !== loop) return;
        if (last !== null) advance(S.now + Math.min(0.1, (ts - last) / 1000));
        last = ts;
        var full = ts - lastTable > 250;
        if (full) lastTable = ts;
        draw(full);
        requestAnimationFrame(frame);
      });
    }
    var running = false;
    function sync() {
      runBtn.textContent = wants ? "Pause" : "Run";
      var should = wants && visible;
      if (should && !running) { running = true; start(); }
      else if (!should && running) { running = false; loop++; }
    }

    runBtn.addEventListener("click", function () { wants = !wants; sync(); });
    root.querySelector('[data-act="restart"]').addEventListener("click", function () { restart(); draw(true); });
    presetBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyPreset(btn.getAttribute("data-preset"));
        if (!wants) { wants = true; sync(); }
      });
    });
    form.addEventListener("submit", function (e) { e.preventDefault(); });
    form.addEventListener("input", function () {
      var oldSw = P.sw, oldRate = P.rate.slice();
      read();
      for (var f = 1; f <= 3; f++) {
        if (P.rate[f] <= 0) S.next[f] = Infinity;
        else if (S.next[f] === Infinity || P.rate[f] !== oldRate[f]) S.next[f] = S.now + 1 / P.rate[f];
      }
      if (P.sw !== oldSw) S.nextTick = S.now + 1 / P.sw;
      setPreset(null);
      draw(true);
    });

    plot.addEventListener("pointermove", function (e) {
      var r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * CW, n = S.bins.length;
      hoverBack = !n || x < CX0 - 8 || x > CX1 + 8 ? null
        : Math.max(0, Math.min(n - 1, Math.round((CX1 - x) / ((CX1 - CX0) / (NBINS - 1)))));
      drawChart();
    });
    plot.addEventListener("pointerleave", function () { hoverBack = null; drawChart(); });
    plot.addEventListener("focus", function () { if (hoverBack === null) hoverBack = 0; drawChart(); });
    plot.addEventListener("blur", function () { hoverBack = null; drawChart(); });
    plot.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") hoverBack = Math.min(Math.max(0, S.bins.length - 1), (hoverBack || 0) + 1);
      else if (e.key === "ArrowRight") hoverBack = Math.max(0, (hoverBack || 0) - 1);
      else if (e.key === "Escape") hoverBack = null;
      else return;
      e.preventDefault();
      drawChart();
    });

    applyPreset("starve");
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { visible = en.isIntersecting; sync(); });
      }, { threshold: 0.15 }).observe(root);
    } else {
      visible = true;
      sync();
    }
    sync();
  }

  // ---------- wire up ----------
  var defs = { "switch": chapterSwitch, pipeline: chapterPipeline, queues: chapterQueues, headers: chapterHeaders };
  Array.prototype.forEach.call(document.querySelectorAll("[data-player]"), function (root) {
    var def = defs[root.getAttribute("data-player")];
    if (!def) return;
    if (root.getAttribute("data-player") === "headers") root.setAttribute("data-mode", "before");
    var player = new Player(root, def);
    Array.prototype.forEach.call(root.querySelectorAll(".mode-toggle [data-mode]"), function (btn, _, all) {
      btn.addEventListener("click", function () {
        root.setAttribute("data-mode", btn.getAttribute("data-mode"));
        Array.prototype.forEach.call(all, function (b) { b.setAttribute("aria-pressed", b === btn ? "true" : "false"); });
        player.go(player.i);
      });
    });
  });
  var sandbox = document.getElementById("qsim");
  if (sandbox) initSandbox(sandbox);
})();
