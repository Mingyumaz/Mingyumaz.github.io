# P4sim website: change log and development guide

The P4sim project site is a hand-written static sub-site of this Hexo blog. This file records what has been built so far, how it is built and published, and how to keep developing it.

| | |
|---|---|
| Live site | <https://mingyumaz.github.io/p4sim/> |
| Pages | Overview `/p4sim/` · Inside the switch `/p4sim/inside/` · Roadmap `/p4sim/roadmap/` |
| Source | [`source/p4sim/`](../source/p4sim/) in this repository |
| Generator | Hexo 8.1.2 with the Fluid theme; `source/p4sim/**` is copied as is (`skip_render`) |
| Publishing | [`.github/workflows/pages.yml`](../.github/workflows/pages.yml), on every push to `main` |
| Project | [HapCommSys/p4sim](https://github.com/HapCommSys/p4sim); site facts last checked against release v2.0.0 and `main` at `488dd6b` |

## Change log

### 2026-11-26 · Inside the switch for P4sim 2.0

Redraws the queue parts of `/p4sim/inside/` for the event-driven egress of P4sim 2.0 (`doc/event-driven-tm-scheduler.md`, `p4-core-v1model.cc`, `p4-switch-core.cc`, `utils/p4-queue.h` on `main` at `488dd6b`) and removes the version note.

- Chapter 2, step 5: "port 3 free → next" replaces the clock; the steps mention `PipelineDelay` and that the input buffer only holds packets while `SwitchRate` keeps the pipeline busy.
- Chapter 3 (8 steps instead of 7):
  - Host 0 sends at 1 Gbps and port 1 sends at 100 Mbps (as in `p4-priority-queues`), with the classification of `qos.p4`.
  - "Next packet" replaces the scheduler and its clock: port 1 sends one frame at a time (83.36 µs), and when it is free it takes the highest queue whose head is due.
  - The port box shows the frame on the wire, instead of an ns-3 TX queue. Times are in µs on the stage, in ns in the metadata.
  - The queue 3 limit is now 6 000 pps (two frame times).
  - Step 7 mentions `TransferBufferSize`. The new step 8 shows `SwitchRate`: packets wait in the input buffer, in arrival order.
- Live model: `SwitchRate` 0–2000 (0 = no limit) feeds an input buffer of 128 packets. The port sends at the link's data rate, and there is no TX queue any more. The table gets "Dropped: input" and "Input wait". The presets are recomputed, and "Slower pipeline" replaces "Slow link".
- `inside.css`: no clock styles; new styles for the bar of the frame on the wire, the earlier frame (`.qp.f0`) and the input-buffer lane.

### 2026-11-26 · P4sim 2.0

Brings the overview and the roadmap up to [release v2.0.0](https://github.com/HapCommSys/p4sim/releases/tag/v2.0.0) (2026-11-20) and to `main` at `488dd6b`. The site describes `main`, which is what `git clone` gives; the roadmap says what is released and what is only on `main`.

- Overview:
  - hero facts: ns-3.39 to 3.49 (main), release v2.0.0;
  - features: the pipeline core, the new controller features, a "Timing and queues" card instead of "Switch-level knobs";
  - how it works: event-driven egress; bridge ports and switched-Ethernet ports instead of "Arch 1 (main)" and "Arch 2 (switch_channel)"; `P4SwitchArch` 3 in the table;
  - get started: `install.sh`, Docker and `p4-hello`, as in the p4sim README; no `P4SIM_DIR`, no "Why ns-3.39?" note;
  - workflow: the code tab uses `SwitchedEthernetHelper` as `p4-v1model-ipv4-forwarding` does now; the flow table and `topo.txt` match the files; the attribute table follows the README (new: `PipelineDelay`, `TransferBufferSize`, `EnableVoqFabric`; `SwitchRate` default 0; `BmLogLevel` default `off`; `ChannelType` and `EnableTracing` deprecated);
  - examples: all 27, with their self-checks;
  - testing: 20 suites, grouped; the STF sample shows mirroring and registers; the scope list follows the README's known limitations;
  - roadmap cards: v1.0, v2.0, Next (on `main`), Later;
  - people: GSoC 2025 and 2026 and the contributors of the release notes; the GSoC 2025 link points to `program/2025/README.md` (the old `2025/ideas_list.md` gave 404);
  - footer (all pages): some files are under GPL-2.0-only.
- Roadmap: v1.1 and v1.2 are gone (their content shipped in 2.0, or is on `main`). v2.0 is released; "Next" lists what `main` has since v2.0.0; "Later" and "Ideas" come from `doc/TODO.md` and open pull request #102.
- Inside the switch: chapter 1 calls its ports bridge ports. A version note said that chapters 2 and 3 showed the 1.x scheduler, until the entry above redrew them.
- The architecture figure is unchanged. It still names the branches `main` and `switch_channel`; the caption says so. p4sim pull request #85 redraws it.
- `style.css`: `.split > * { min-width: 0; }`. The STF code block in "Testing" made the overview about 20 px wider than a 375 px phone screen (before this change too); now it scrolls inside its box.

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

`initSandbox()` in `inside.js` is a small discrete-event simulation of one output port. It follows the same rules as `P4SwitchCore::StartIngress()`, `P4CoreV1model` and `NSQueueingLogicPriRL` (`utils/p4-queue.h`):

- Flow f (UDP ports 2000, 3000, 4000) sends constant-rate 1000-byte payloads and uses queue f.
- With `SwitchRate` 0 the pipeline takes every packet at once. With a rate R, an idle pipeline takes a packet at once and is then busy for 1 / R. Packets that arrive meanwhile wait in the input buffer (FIFO, 128 packets, as `InputBufferSizeLow`) and are dropped when it is full.
- Each output queue holds `QueueBufferSize` packets; a packet arriving at a full queue is dropped.
- A packet's due time is max(arrival, the queue's previous due time + 1 / queue rate). Queues have no rate by default; the model can limit queue 3, which corresponds to `set_queue_rate` or `SetEgressPriorityQueueRate`.
- Port 1 sends one 1042-byte frame at a time (1000-byte payload plus UDP, IPv4 and Ethernet headers) at the chosen DataRate. When it is free, it takes the head of the highest queue (7 → 0) that is due, or waits for the earliest due time. There is no queue after the port (`TransferBufferSize` 0).
- The model is drawn with `requestAnimationFrame` at 1 simulated second per real second, and pauses when it is off screen.

Expected results of the presets, useful as a regression check after edits. Measured in the built-in browser after 12–14 s; the default link is 10 Mbps, about 1200 pps:

| Preset | Settings | Delivered pps (flow 1 / 2 / 3) | Notes |
|---|---|---|---|
| Default: queue 1 starves | 300 / 600 / 700 pps, `SwitchRate` 0, capacity 128 | 0 / 499 / 700 | queues 1 and 2 full; flow 2 waits about 255 ms |
| Rate-limit queue 3 | as default, queue 3 limited to 250 pps | 300 / 600 / 250 | queue 3 overflows and waits about 510 ms; the others below 1 ms |
| Light load | 200 / 250 / 300 pps | 200 / 250 / 300 | queue delays below 0.5 ms |
| Slower pipeline | as default, `SwitchRate` 1000 | 200 / 300 / 500 | the input buffer is full, waits about 128 ms and drops from every flow; the split follows the arrival times of the constant-rate flows, not the priorities; the output queues stay empty |

### Colours

- Stage tokens (`--s-*`) are defined on `.stage, .sb-panel` in `inside.css`.
- The three flows of chapter 3 use `--f1` `#3b82f6`, `--f2` `#d97706` and `--f3` `#0d9488`. This set passed a colour-blindness separation and contrast check on the dark stage (`#0a1018`) and on both page surfaces (`#ffffff`, `#121a23`). Keep this order. Flow packets also carry their number, so their identity never depends on colour alone.
- Red (`--s-red`, `#ef4444`) means drops and waiting, and nothing else.

## Facts to keep in sync with P4sim

The pages state these facts. When P4sim changes, check them and update the pages and this list.

Overview and roadmap (checked against v2.0.0 and `main` at `488dd6b`):

| Fact on the site | Source in p4sim |
|---|---|
| Latest release v2.0.0; its highlights, breaking changes, 18 suites (1.0: 6), 23 examples | GitHub release v2.0.0 |
| ns-3.39 to ns-3.49, tested with ns-3.39 and ns-3.49 and BMv2 1.15.8 (on `main`, not in v2.0.0) | `README.md` (Installation) |
| Installation: `install.sh` (about 6 minutes on 16 cores), Docker, step by step, VM; no `P4SIM_DIR` | `README.md`, `doc/installation.md` |
| Attributes and defaults: `SwitchRate` 0, `PipelineDelay` 0, `TransferBufferSize` 0, buffers 128, `BmLogLevel` `off`, `ThriftPort` 0 | `model/p4-switch-net-device.cc`, `README.md` (Switch Parameters) |
| `P4SwitchArch` 0–3; the pipeline core has no output queue and no packet replication | `README.md` (Supported P4 Architectures) |
| 27 examples and their descriptions | `doc/examples.md`, `test/examples-to-run.py` |
| 20 test suites and what they check | `test/Readme.md` |
| Roadmap "Next" = commits in `v2.0.0..main`; "Later" and "Ideas" | `git log v2.0.0..main`, `doc/TODO.md`, open p4sim pull requests |

Inside the switch (chapters 2 and 3 checked against `main` at `488dd6b`, chapters 1 and 4 against `4f43a3f`):

| Fact on the site | Source in p4sim |
|---|---|
| 8 priority queues per port; priority p → queue p; the highest index is served first; a full queue drops the new packet | `model/p4-core-v1model.cc` (`Enqueue`), `utils/p4-queue.h` (`push_front`, `pop_back_for_port`) |
| A port takes its next packet when it has sent its frame (`PortTxComplete`), from the highest queue whose head is due; the egress runs then; each port has its own state | `doc/event-driven-tm-scheduler.md`, `p4-core-v1model.cc` |
| Queues have no rate unless one is set (`set_queue_rate`, `SetEgressPriorityQueueRate`); send = max(now, previous send + 1 / rate) | `utils/p4-queue.h`, `doc/switch.md` |
| `SwitchRate` (default 0 = no limit) limits the whole pipeline: an idle pipeline takes a packet at once, a busy one after 1 / R; packets wait in the input buffer and are dropped when it is full | `P4SwitchCore::StartIngress()`, `ServeIngress()`, `doc/switch.md` |
| `PipelineDelay` delays a packet once before the queues; `TransferBufferSize` (default 0) is a FIFO after the egress | `doc/switch.md`, `doc/event-driven-tm-scheduler.md` |
| Defaults: `QueueBufferSize`, `InputBufferSizeLow` and `InputBufferSizeHigh` all 128 | `model/p4-switch-net-device.cc` attributes |
| Queueing metadata `enq_timestamp`, `enq_qdepth`, `deq_timedelta`, `deq_qdepth` (own queue, after the dequeue), `qid`; times in **nanoseconds** | `P4SwitchCore::GetTimeStamp()`, `p4-core-v1model.cc` |
| `qos.p4` (`p4-queue-test`): UDP ports 2000/3000/4000 → priority 1/2/3 | `examples/p4src/qos/flowtable_0.txt` |
| A 1042-byte frame takes 83.36 µs at 100 Mbps; `p4-priority-queues` uses 1 Gbps host links and a 100 Mbps bottleneck | `doc/switch.md` (Timing on the wire), `examples/p4-priority-queues.cc` |
| Custom headers: protocol number `0xDC`; `LAYER_2`…`LAYER_5`; `ADD_BEFORE`, `REPLACE`, `ADD_AFTER` | `model/custom-header.h`, `model/custom-p2p-net-device.cc` |
| `basic_tunnel` fields `proto_id` and `dst_id` (16 bits each) | `examples/p4-basic-tunnel.cc`, `examples/p4src/basic_tunnel/` |

## Open items

- **Architecture figure**: replace `assets/p4sim-arch.png` when p4sim pull request #85 merges.
- **Old blog repository**: archive `Mingyumaz/Hexo-Blog`, delete its `GH_TOKEN` and `GH_USERNAME` secrets, and revoke that personal access token. It is no longer used.
- **Optional**: a short explainer video built from the animations (deferred).
- **Questions for the P4sim code** (found while writing the page; they are not website bugs):
  - The `utils/p4-queue.h` comment says priority 0 is the highest, but the code serves 7 first.
  - `P4CoreV1model::Enqueue` ignores the result of `push_front`, so packets dropped at a full queue are not logged or counted.
  - Queueing timestamps are in nanoseconds, while simple_switch uses microseconds. If the v1model fields are 32-bit, they wrap after about 4.3 s (to verify).
  - `P4Controller` offers no queue rate or depth calls.
  - `p4-firewall.cc` loads `p4_basic.json`.
  - The citation in `doc/p4sim.rst` lists the wrong authors.
