# P4sim website: change log and development guide

The P4sim project site is a hand-written static sub-site of this Hexo blog. This file records what has been built so far, how it is built and published, and how to keep developing it.

| | |
|---|---|
| Live site | <https://mingyumaz.github.io/p4sim/> |
| Pages | Overview `/p4sim/` · Inside the switch `/p4sim/inside/` · Roadmap `/p4sim/roadmap/` |
| Source | [`source/p4sim/`](../source/p4sim/) in this repository |
| Generator | Hexo 8.1.2 with the Fluid theme; `source/p4sim/**` is copied as is (`skip_render`) |
| Publishing | [`.github/workflows/pages.yml`](../.github/workflows/pages.yml), on every push to `main` |
| Project | [HapCommSys/p4sim](https://github.com/HapCommSys/p4sim); site facts last checked against `main` at `4f43a3f` |

## Change log

### 2026-11-16 · "Inside the switch" page

[PR #2](https://github.com/Mingyumaz/Mingyumaz.github.io/pull/2), commit `b2814a7`, merged as `9ab95e2`.

- New page `/p4sim/inside/` with four animated, step-by-step walkthroughs, drawn from the P4sim design figures and checked against the p4sim code:
  1. **The switch in ns-3** (5 steps): `P4SwitchNetDevice` with four ports; the controller installs `10.1.1.2 → port 3` through the control-plane interface; a packet from Host 1 is parsed, hits the table and leaves on port 3.
  2. **Through the pipeline** (7 steps): what ns-3 attributes and the P4 program each configure; the input buffer (external and internal queues), parser and PHV, ingress stages, the traffic manager's 8 priority queues and `SwitchRate` clock, egress and deparser; resubmit, recirculate, clone and multicast.
  3. **Queues and scheduling** (7 steps, based on `p4-queue-test` and `qos.p4`):
     - priority p goes to queue p;
     - one packet leaves per 1 / `SwitchRate` tick, from the highest queue whose head is due;
     - strict priority starves the lower queues;
     - per-queue rate limits let them through;
     - a full queue drops new packets (tail drop);
     - the switch writes `enq_*`/`deq_*` queueing metadata;
     - after the switch come the port's ns-3 TX queue and the link.

     Below it, a **live queue model** with sliders, queue bars, a throughput chart, a per-flow table and four preset scenarios.
  4. **Custom headers** (5 steps): `CustomHeader` with `LAYER_3` and `ADD_BEFORE` or `ADD_AFTER`; `CustomP2PNetDevice` inserts it and rewrites the type field to `0xDC`; the `basic_tunnel` parser reads it; the receiver removes it. A toggle switches between "before IPv4" and "after IPv4".
- Overview page: a "More detail" card under the hero figure, a link at the end of "How it works", and "Inside" in the navigation. The roadmap navigation gets "Inside" too.
- Roadmap v1.1: "priority queues, resubmit and recirculate done; clone and digest in progress" (after p4sim #39).

### 2026-11-13 · One repository, published by GitHub Pages Actions

[PR #1](https://github.com/Mingyumaz/Mingyumaz.github.io/pull/1), commits `f094478`, `d623823` and `1d67d4f`.

- The Hexo source moved from `Mingyumaz/Hexo-Blog` into this repository, keeping its history. The generated files that used to be pushed here were removed.
- The site is now built and deployed by `pages.yml`: Node 24, `npm ci`, `npx hexo generate`, then `upload-pages-artifact` and `deploy-pages`. It needs no personal access token. Repository setting: Settings → Pages → Source = **GitHub Actions**.
- Hexo 8.1.1 → 8.1.2 (Dependabot, `8d98418`).

### 2026-11-13 · Roadmap page

Commit `a394cb8`.

- `/p4sim/roadmap/`: a release timeline with these releases:
  - **v1.0**: released June 2025.
  - **v1.1**: stability and control plane, mostly on `main`.
  - **v1.2**: ns-3.49 with C++23.
  - **v2.0**: switch-centric architecture with a traffic manager.
  - **Later**: ideas.

  Each release has a status badge (Released, In progress, Planned, Ideas).

### 2026-11-13 · Overview page

Commit `f437250`.

- `/p4sim/`: hero with the architecture figure, then these sections:
  - features (`#features`);
  - how it works (`#how`);
  - getting started (`#start`);
  - from a P4 program to a simulation (`#workflow`);
  - the examples (`#examples`);
  - test suites (`#testing`);
  - roadmap summary (`#roadmap`);
  - publications and citation (`#papers`);
  - people (`#people`).
- Light and dark themes (toggle stored in `localStorage` as `p4sim-theme`), plus a "P4sim" entry in the blog's navigation bar (`themes/fluid/_config.yml`).

## Files

```
source/p4sim/
├── index.html            overview page
├── roadmap/index.html    roadmap page
├── inside/index.html     "Inside the switch": SVG stages, step texts, live queue model markup
└── assets/
    ├── style.css         shared design tokens (light/dark), layout and components of all pages
    ├── main.js           theme toggle, copy buttons on code blocks, tabs
    ├── inside.css        stage, player controls, chapter-specific marks, queue model
    ├── inside.js         step player engine, the four chapters, the queue model
    ├── p4sim-arch.png    architecture figure on the overview
    └── favicon.svg
```

Related configuration:

- `_config.yml`: `skip_render: p4sim/**`. Hexo copies these files byte for byte and does not wrap them in the blog theme.
- `themes/fluid/_config.yml`: the navbar entry `{ key: "P4sim", link: "/p4sim/" }`.
- `.github/workflows/pages.yml`: build and deploy.
- `.github/dependabot.yml`: npm updates for Hexo.

## Development workflow

### 1. Branch

Work on a branch from an up-to-date `main`, and open a pull request for every change.

```bash
git fetch origin
git switch -c <topic> origin/main
```

### 2. Edit

The pages are plain HTML, CSS and JavaScript: no build step, framework or external script. Keep it that way:

- **Theme**: use the CSS variables of `style.css`, which define both the light and the dark theme. The animation stages are dark in both themes.
- **Language**: page text is English and short. Each claim about P4sim needs a source in the p4sim code or docs (see [Facts to keep in sync](#facts-to-keep-in-sync-with-p4sim)).
- **Navigation**: each page has its own copy of the top navigation and the footer. A new page needs a link in the `topnav` of every page.

### 3. Preview locally

Serve the source folder directly, which is the fastest way to preview:

```bash
python3 -m http.server 8417 --directory source
```

Then open <http://localhost:8417/p4sim/>, `/p4sim/inside/` or `/p4sim/roadmap/`. To preview the whole blog, run `npx hexo server` instead.

Check each change in these conditions:

- the light and the dark theme;
- a 375 px wide window: no page-level horizontal scroll, and the stages scroll sideways;
- `prefers-reduced-motion`: steps appear without animation and nothing autoplays;
- the browser console: no errors.

### 4. Check the build

Use Node 24, as the workflow does:

```bash
node --check source/p4sim/assets/inside.js
npm ci
npx hexo generate
```

Every file in `source/p4sim/` must come out unchanged in `public/p4sim/`:

```bash
(cd source/p4sim && find . -type f) | while read -r f; do
  cmp -s "source/p4sim/$f" "public/p4sim/$f" && echo "same  $f" || echo "DIFF  $f"
done
```

`public/` and `db.json` are ignored by git; never commit them.

### 5. Commit

- Write commit messages in English, with an imperative subject (for example "Add …", "Fix …") and a body that says what changed and why.
- Stage files by name, for example `git add source/p4sim/...`. The repository root on the main development machine has untracked scratch files (diffs, PR drafts), so do not use `git add -A` or `git add .`.
- The Windows checkout uses CRLF line endings (`core.autocrlf`). Git's "LF will be replaced by CRLF" warnings are expected; the repository stores LF.

### 6. Pull request and review

- Push the branch (SSH remote `git@github.com:Mingyumaz/Mingyumaz.github.io.git`) and open a pull request to `main`. In the description, list the visible changes and how they were tested.
- Website pull requests need **one review** by the maintainer. Pull requests to the P4sim code itself need two.
- Pull requests have no CI checks: the Pages workflow runs only on `main`.

### 7. Merge, deploy, verify

1. Merging into `main` starts **Deploy site to GitHub Pages** (Actions tab, about 40 s).
2. When the run is green, check that the live files match `main`:

   ```bash
   for p in p4sim/ p4sim/inside/ p4sim/roadmap/; do
     curl -s "https://mingyumaz.github.io/$p" | cmp -s - <(git show "origin/main:source/${p}index.html") \
       && echo "same $p" || echo "DIFF $p"
   done
   ```

3. GitHub Pages caches pages for a few minutes: reload with Ctrl+F5 if the old page still shows.

If a deploy fails, open the run in the Actions tab. A failed `npm ci` usually means `package-lock.json` is out of date. The deploy job also needs Settings → Pages → Source to be **GitHub Actions**.

## How the "Inside the switch" page works

### Markup

Each chapter is a `section.chapter` with a player:

```html
<div class="player" data-player="queues">
  <div class="player-stage">
    <div class="stage wide"><svg viewBox="…">…</svg></div>
    <div class="stage-caption" aria-live="polite"></div>
    <div class="controls"></div>
  </div>
  <ol class="steps">
    <li class="step-item">
      <button type="button" class="step-title"><span class="n">01</span>Title</button>
      <p>Text …</p>
    </li>
    …
  </ol>
</div>
```

Without JavaScript the step list is shown under the figure. With JavaScript the list is hidden, and the active step's title and text are copied into `.stage-caption`. SVG ids carry a prefix per chapter: `s1-` for the switch, `s2-` for the pipeline, `q-` for queues and `s3-` for custom headers.

### The player engine (`inside.js`)

- `defs` maps each `data-player` value to a chapter definition `{ reset(c), steps: [{ run(c), after(c) }] }`.
- `run(c)` animates a step. `after(c)` sets the step's end state at once. Jumping to step *i* resets the stage, replays `after()` of steps 0 to *i*−1, then runs step *i*. The queue chapter is deterministic, so its `after` is its `run` executed instantly.
- The context `c` provides these helpers:
  - `wait`, `tween`: timing; both can be aborted;
  - `add`, `rm`, `show`, `hide`: state classes;
  - `text`: changes a text, and the original comes back on reset;
  - `place`, `move`: move along an SVG path;
  - `follow`: keeps a moving packet in view on phones;
  - `spread`: the "parsed" effect.
- The state classes listed in `STATE_CLASSES` are cleared on every reset. Add new ones there.
- A chapter autoplays when 35 % of its stage is visible, and steps advance after 1.4 s, looping after the last one. A click on a step, a progress bar or a control button stops autoplay.
- With reduced motion, steps render instantly and nothing autoplays.

**To add a step**, add an `li.step-item` and a matching entry in `steps`; the two lists must have the same length. **To add a chapter**, add the section and its `data-player`, an entry in `defs`, a link in the hero's `.chapter-links`, and use an unused id prefix.

### The live queue model (chapter 3)

`initSandbox()` in `inside.js` is a small discrete-event simulation of one output port. It follows the same rules as `P4CoreV1model` and `NSQueueingLogicPriRL` (`utils/p4-queue.h`):

- Flow f (UDP ports 2000, 3000, 4000) uses queue f. Each queue holds `QueueBufferSize` packets; a packet arriving at a full queue is dropped.
- A packet's due time is max(arrival, the queue's previous due time + 1 / queue rate). Every queue rate defaults to `SwitchRate`; the model can limit queue 3, which corresponds to `SetEgressPriorityQueueRate`.
- A timer ticks every 1 / `SwitchRate`. Each tick dequeues one packet: the head of the highest queue (7 → 0) that is due.
- After the switch comes the port's TX queue (DropTail, 100 packets, as in ns-3) and a link that sends 1042-byte frames (1000-byte payload plus UDP, IPv4 and Ethernet headers) at the chosen DataRate.
- The model is drawn with `requestAnimationFrame` at 1 simulated second per real second, and pauses when it is off screen.

Expected results of the presets, useful as a regression check after edits:

| Preset | Settings | Delivered pps (flow 1 / 2 / 3) | Notes |
|---|---|---|---|
| Default: queue 1 starves | 375 / 500 / 625 pps, SwitchRate 1000, capacity 128 | 0 / 375 / 625 | queues 1 and 2 full; flow 2 waits about 340 ms |
| Rate-limit queue 3 | as default, queue 3 limited to 300 pps | 200 / 500 / 300 | queues 3 and 1 overflow |
| Light load | 200 / 250 / 300 pps | 200 / 250 / 300 | queue delays below 2 ms |
| Slow link | as default, link 5 Mbps (≈ 600 pps) | 0 / ≈ 225 / ≈ 375 | the TX queue is full and drops in arrival order |

### Colours

- Stage tokens (`--s-*`) are defined on `.stage, .sb-panel` in `inside.css`.
- The three flows of chapter 3 use `--f1` `#3b82f6`, `--f2` `#d97706` and `--f3` `#0d9488`. This set passed a colour-blindness separation and contrast check on the dark stage (`#0a1018`) and on both page surfaces (`#ffffff`, `#121a23`). Keep this order. Flow packets also carry their number, so their identity never depends on colour alone.
- Red (`--s-red`, `#ef4444`) means drops and waiting, and nothing else.

## Facts to keep in sync with P4sim

The page states these facts. When P4sim changes, check them and update the page and this list.

| Fact on the site | Source in p4sim |
|---|---|
| 8 priority queues per port; priority p → queue p; the highest index is served first | `model/p4-core-v1model.cc` (`Enqueue`), `utils/p4-queue.h` |
| One scheduler (`m_nbEgressThreads = 1`) ticking every 1 / `SwitchRate`; all ports share it | `p4-core-v1model.h/.cc` (`SetEgressTimerEvent`, `CalculateScheduleTime`) |
| Defaults: `SwitchRate` 1000 pps; `QueueBufferSize`, `InputBufferSizeLow` and `InputBufferSizeHigh` all 128 | `model/p4-switch-net-device.cc` attributes |
| Per-queue rates and depths are set through the V1model core (`SetEgressPriorityQueueRate`, `SetEgressQueueDepth`, …), not through `P4Controller` | `p4-core-v1model.cc`, `p4-controller.h` |
| Queueing metadata `enq_timestamp`, `enq_qdepth`, `deq_timedelta`, `deq_qdepth`, `qid`; times in **nanoseconds** | `P4SwitchCore::GetTimeStamp()` |
| `p4-queue-test`: UDP ports 2000/3000/4000 → priority 1/2/3; 3/4/5 Mbps; 1000-byte payloads | `examples/p4-queue-test.cc`, `examples/p4src/qos/` |
| Custom headers: protocol number `0xDC`; `LAYER_2`…`LAYER_5`; `ADD_BEFORE`, `REPLACE`, `ADD_AFTER` | `model/custom-header.h`, `model/custom-p2p-net-device.cc` |
| `basic_tunnel` fields `proto_id` and `dst_id` (16 bits each) | `examples/p4-basic-tunnel.cc`, `examples/p4src/basic_tunnel/` |
| Resubmit and recirculate work on `main` (#39); clone and digest are in progress | p4sim pull requests; roadmap v1.1 |

## Open items

- **Old blog repository**: archive `Mingyumaz/Hexo-Blog`, delete its `GH_TOKEN` and `GH_USERNAME` secrets, and revoke that personal access token. It is no longer used.
- **Merged branches**: `merge-hexo-source` and `add-p4sim-how-it-works` can be deleted.
- **Optional**: a short explainer video built from the animations (deferred).
- **Questions for the P4sim code** (found while writing the page; they are not website bugs):
  - The `utils/p4-queue.h` comment says priority 0 is the highest, but the code serves 7 first.
  - `P4CoreV1model::Enqueue` ignores the result of `push_front`, so packets dropped at a full queue are not logged or counted.
  - Queueing timestamps are in nanoseconds, while simple_switch uses microseconds. If the v1model fields are 32-bit, they wrap after about 4.3 s (to verify).
  - `P4Controller` offers no queue rate or depth calls.
  - `p4-firewall.cc` loads `p4_basic.json`.
  - The citation in `doc/p4sim.rst` lists the wrong authors.
