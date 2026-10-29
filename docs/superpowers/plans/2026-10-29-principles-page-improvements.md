# Principles Page Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One selected framework per page, a three-step adoption scale for POSI, user-defined scales, the badge in an overlay, and the complementary SPII principles inside POSI.

**Architecture:** Extend the existing N-level machinery (`levels` + `level_icon_markup` + `level_color` + `compute_summary`) with `icon`, `color`, `description`, `excludeFromScore`; a customized scale replaces `framework.levels` in place (original kept in a `WeakMap`). The layout change is a re-arrangement of `render()`: intro, infrastructure accordion, selected framework panel; a sidebar `<select>` replaces the tab strip.

**Tech Stack:** Single `index.html` (no build), Oat CSS, JSON frameworks in `data/frameworks/`, Node `vm` + Playwright for tests.

**Spec:** `docs/superpowers/specs/2026-10-29-principles-page-improvements-design.md`

## Global Constraints

- Single self-contained `index.html`, no build step, no new dependency (ponytail: reuse `description_segments`, `level_*` helpers, Oat `role="switch"` and `<dialog>`).
- English UI copy; the UI word "draft" becomes "experimental" (JSON field `draft` unchanged).
- Every `localStorage` access in try/catch; the page works without it.
- The three SPII frameworks stay as built-ins (bottom of the list); do not touch `.claude/skills/`.
- Built-in order: posi, gorc, fair, bd, osr, 7gpri, care, forest, spii (v0.1), spii-alignment (v0.3), posi-spii (merged v0.5).
- Commit only after `node test-app.mjs --ui` is green; commit trailers `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01Ty7TZndw3rZSH1jYcDeSGp`.

## File structure

- `index.html` — modify (logic in `<script id="app-logic">`, rendering in `<script id="app-render">`, CSS, dialogs).
- `data/frameworks/posi-v2.0.json` — modify (levels, about, intro, complementary section).
- `data/frameworks/*.json` — titles: `(draft)` → `(experimental)`.
- `data/examples/{openaire,openalex,hal}-posi-assessment-report-*.json` — migrate POSI statuses.
- `test-app.mjs` — create: logic tests (Node `vm`) always; browser tests (Playwright, own static server) with `--ui`.
- `README.md`, `CLAUDE.md` — document; `index.html` CHANGELOG entry.

---

### Task 1: Test harness

**Files:** Create `test-app.mjs`.

**Produces:** `check(name, ok, detail)`, `loadLogic()` returning a `vm` context with `FRAMEWORKS` populated from `data/frameworks` in the built-in order, `serve()` + `withPage(width, fn)` for browser tests.

- [ ] **Step 1: Write the harness**

```js
// node test-app.mjs        -> logic tests (no browser)
// node test-app.mjs --ui   -> plus Chromium tests (needs playwright; set PW_MODULE to its path if not installed locally)
import fs from "node:fs"; import vm from "node:vm"; import http from "node:http"; import path from "node:path";
const ROOT = path.dirname(new URL(import.meta.url).pathname);
let failed = 0;
export const check = (name, ok, detail = "") => { if (!ok) failed++; console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : "  -> " + detail)); };
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const storage = new Map();
export function loadLogic() {
  const ctx = vm.createContext({
    console,
    getComputedStyle: () => ({ getPropertyValue: (v) => ({ "--destructive": "#b3261e", "--warning": "#b06b00", "--compliant": "#1f5c43" }[v] || "") }),
    document: { documentElement: {} },
    localStorage: { getItem: (k) => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k) },
  });
  vm.runInContext(html.match(/<script id="app-logic">([\s\S]*?)<\/script>/)[1], ctx);
  const files = vm.runInContext("BUILTIN_FRAMEWORK_FILES", ctx);
  ctx.__frameworks = files.map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8")));
  vm.runInContext("FRAMEWORKS = __frameworks;", ctx);
  return ctx;
}
export const run = (ctx, code) => vm.runInContext(code, ctx);
export const clearStorage = () => storage.clear();
// ... logic tests are appended per task ...
if (process.argv.includes("--ui")) await (await import("./test-app-ui.mjs")).default({ check, ROOT });
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
```

(`BUILTIN_FRAMEWORK_FILES` currently lives in `app-logic`; if it is not a global `const` reachable from `vm.runInContext`, keep it there and read it the same way — it is declared at top level of that script.)

- [ ] **Step 2: Run** `node test-app.mjs` → prints `all passed` (no tests yet).
- [ ] **Step 3:** Create `test-app-ui.mjs` skeleton exporting `export default async function ({ check, ROOT }) {}` plus helpers: `serve(ROOT)` (node:http static server on port 0, MIME map for html/json/css/woff2/svg/png), `launch()` using `import(process.env.PW_MODULE || "playwright")` with `executablePath: process.env.PW_CHROMIUM` when set (`/opt/pw-browsers/chromium` in this sandbox; `/opt/node22/lib/node_modules/playwright/index.mjs` for `PW_MODULE`), routing `unpkg.com` and `html2canvas` requests to abort. Each UI test opens `http://localhost:PORT/index.html`.
- [ ] **Step 4: Commit** `git add test-app.mjs test-app-ui.mjs && git commit -m "Add a small logic + browser test harness"`.

---

### Task 2: Level model (icon, color, description, excludeFromScore) and POSI data

**Files:** Modify `index.html` (`app-logic`: `ICONS`, `LEGACY_LEVELS`, `level_icon_markup`, `level_color`, `compute_summary`; `app-render`: `render_principle`, `render_framework_section`); modify `data/frameworks/posi-v2.0.json`, three example reports, `test-app.mjs`.

**Interfaces — Produces:**
`ICON_NAMES: string[]`, `icon_markup_by_name(name): string`, `resolve_color(color: string): string`, `counting_levels(levels): level[]`, `append_linked_text(el, text)` (DOM, in app-render).

- [ ] **Step 1: Failing tests** (append to `test-app.mjs`)

```js
{
  const c = loadLogic(); const R = (s) => run(c, s);
  const posi = R('FRAMEWORKS.find(f => f.id === "posi")');
  const ids = posi.sections.flatMap(s => s.principles.map(p => p.id));
  check("POSI has 23 principles incl. 3 complementary", ids.length === 23 && posi.sections.at(-1).section === "Complementary Principles" && posi.sections.at(-1).principles.length === 3, ids.length);
  check("POSI levels low/making/high in order", posi.levels.map(l => l.id).join() === "low-adoption,making-progress,high-adoption");
  check("POSI icons and colors", posi.levels.map(l => l.icon + l.color).join() === "cross--destructive,clock--warning,check--compliant");
  check("complementary criteria use level ids", posi.sections.at(-1).principles.every(p => Object.keys(p.criteria).sort().join() === "high-adoption,low-adoption,making-progress"));
  check("About POSI lost the approved paragraph", !/Approved assessment framework/.test(posi.aboutHtml) && /Principles of Open Scholarly Infrastructure \(POSI\) is/.test(posi.aboutHtml));
  check("intro present", /Strategic Plan on Integrated Infrastructure/.test(posi.intro.title) && /Complementary principles/.test(posi.intro.html) && !/Complimentary/.test(posi.intro.html));
  check("validate_framework_shape accepts POSI", R("validate_framework_shape")(posi) === true);
  check("level icon markup by name", R('icon_markup_by_name("cross")').includes("M7 7l6 6") && R('icon_markup_by_name("3")').includes(">3<") && R('icon_markup_by_name("question")').includes(">?<"));
  check("level_color resolves tokens", R('level_color(FRAMEWORKS[0], "high-adoption")') === "#1f5c43");
  check("legacy frameworks keep icons and colors", R('level_color(FRAMEWORKS.find(f=>f.id==="gorc"), "compliant")') === "#1f5c43" && R('level_icon_markup(FRAMEWORKS.find(f=>f.id==="gorc"), "progress")').includes("M10 5.5v5"));
  // exclusion of "not applicable" from the average
  R(`globalThis.fw = {id:"t",title:"T",levels:[{id:"a",label:"A"},{id:"b",label:"B"},{id:"c",label:"C"},{id:"na",label:"N/A",excludeFromScore:true}],sections:[{section:"s",principles:[{id:"p1",title:"1",text:""},{id:"p2",title:"2",text:""},{id:"p3",title:"3",text:""}]}]};
         globalThis.st = {frameworks:{t:{p1:{status:"c",notes:""},p2:{status:"na",notes:""},p3:{status:"b",notes:""}}}};`);
  const sum = R('compute_summary(st, "t", fw)');
  check("N/A answered but not in average", sum.scoredCount === 3 && sum.percentMature === 75 && sum.counts.join() === "0,1,1,1", JSON.stringify(sum));
}
```

- [ ] **Step 2: Run** `node test-app.mjs` → FAIL (POSI json not changed, helpers missing).
- [ ] **Step 3: Implement the logic.** In `app-logic`:

```js
const ICON_NAMES = ["check", "clock", "cross", "1", "2", "3", "4", "5", "6", "7", "8", "9", "question"];
function icon_markup_by_name(name) {
    if (name === "check") return ICONS.compliant;
    if (name === "clock") return ICONS.progress;
    if (name === "cross") return ICONS["non-compliant"];
    if (name === "question") return numbered_circle_icon("?");
    return /^[1-9]$/.test(name) ? numbered_circle_icon(name) : ICONS.unanswered;
}
function resolve_color(color) {
    if (typeof color !== "string") return "#cccccc";
    if (!color.startsWith("--")) return color;
    return getComputedStyle(document.documentElement).getPropertyValue(color).trim() || "#cccccc";
}
const counting_levels = (levels) => levels.filter((l) => !l.excludeFromScore);
```

`LEGACY_LEVELS` entries become `{ id, label, icon: "check"|"clock"|"cross", color: "--compliant"|"--warning"|"--destructive" }`. Replace `level_icon_markup` / `level_color` bodies with:

```js
function level_icon_markup(framework, statusId) {
    if (!statusId) return ICONS.unanswered;
    const levels = principle_levels_for(framework);
    const idx = levels.findIndex((l) => l.id === statusId);
    if (idx === -1) return ICONS.unanswered;
    return levels[idx].icon ? icon_markup_by_name(levels[idx].icon) : numbered_circle_icon(idx + 1);
}
function level_color(framework, statusId) {
    if (!statusId) return "#cccccc";
    const levels = principle_levels_for(framework);
    const idx = levels.findIndex((l) => l.id === statusId);
    if (idx === -1) return "#cccccc";
    return levels[idx].color ? resolve_color(levels[idx].color) : level_gradient_color(idx, levels.length);
}
```

Delete `STATUS_COLOR_VAR` and `status_color()` only if nothing else references them (`grep -n "status_color\|STATUS_COLOR_VAR" index.html`); otherwise keep `status_color` as a thin wrapper over `resolve_color`. `numbered_circle_icon(n)` already takes any text. In `compute_summary` (non-legacy branch) replace the average with:

```js
const counting = counting_levels(levels);
const graded = scored.filter((e) => counting.some((l) => l.id === e.status));
const avgIdx = graded.length ? graded.reduce((s, e) => s + counting.findIndex((l) => l.id === e.status), 0) / graded.length : 0;
// ...
percentMature: counting.length > 1 ? Math.round((avgIdx / (counting.length - 1)) * 100) : 0,
```

(`maxIdx` is then unused — delete it.)

- [ ] **Step 4: Implement the data.** Write a one-off Python script (not committed) that edits `posi-v2.0.json`: drop the first `<p>…</p>` of `aboutHtml`; add `levels`, `intro` (`title` "Introduction to Strategic Plan on Integrated Infrastructure", `html` with the three paragraphs from the document, "Complementary principles:" and "Other frameworks:" as `<strong>` lead-ins), and a final section `{section: "Complementary Principles", sourceUrl: "https://surf-ori.github.io/spii-1a-values-and-principles/", principles: [...]}` whose three principles copy `text`, `criteria`, `improvementAction` from `spii-v0.1.json` (`spii-digital-sovereignty`, `spii-seamless-ux`, `spii-recognition-rewards`) with criteria keys mapped `compliant→high-adoption`, `progress→making-progress`, `non-compliant→low-adoption`. Ids `autonomy`, `researcher-centric-seamless-ux`, `researcher-centric-recognition-rewards`; titles `Autonomy`, `Researcher-centric: Seamless user-experience`, `Researcher-centric: Recognition and rewards`. Autonomy `text`: "The infrastructure safeguards digital and academic autonomy — control over data, infrastructure, and decisions stays with the academic community rather than being ceded to external commercial or geopolitical interests. A more detailed assessment can be done with the [Digital Autonomy Assessment Framework (DAAF)](https://utrechtuniversity.github.io/digital-autonomy-assessment-tool/)." and the same markdown link inside its `improvementAction`. Migrate the `posi` block statuses in the three example reports with the same key map; leave their `spii` blocks.
- [ ] **Step 5: Rendering.** In `app-render` add

```js
function append_linked_text(el, text) {
    description_segments(text).forEach((s) => {
        if (s.url) { const a = document.createElement("a"); a.href = s.url; a.textContent = s.label; el.appendChild(a); }
        else el.appendChild(document.createTextNode(s.text));
    });
}
```

use it in `render_framework_section` (replacing the inline loop for `framework.description`), for `principle.text` and `principle.improvementAction` in `render_principle` (the latter as `improvement.append("To improve: "); append_linked_text(improvement, …)`), and make the card text `const criteria = (principle.criteria && principle.criteria[option.id]) || option.description;`. In `render_framework_section`, before the "About" `<details>`, render `framework.intro` (when it has a string `title` and `html`) as `<details open><summary>title</summary>html</details>` (html is trusted framework data, as `aboutHtml` already is).
- [ ] **Step 6: Run** `node test-app.mjs` → all PASS. Then `--ui` check (add to `test-app-ui.mjs`): open `#posi`, expect 3 cards per principle with labels "Low adoption / Making progress / High adoption", the intro accordion above "About POSI", the DAAF link in the Autonomy text, 23 principle accordions, no console errors; click "High adoption" on the first principle and expect the summary "Overall: 100% average score".
- [ ] **Step 7: Commit** "POSI: Low adoption / Making progress / High adoption scale, intro, complementary principles".

---

### Task 3: Layout — dropdown, sidebar sections, no tabs, experimental wording

**Files:** Modify `index.html` (HTML shell, CSS, `render*`, `switch_tab`→`select_framework`, hash handling, `update_summary`, `boot`), `BUILTIN_FRAMEWORK_FILES` order, `data/frameworks/*.json` titles.

**Interfaces — Produces:** `select_framework(frameworkId)`, `framework_option_label(framework)`, `render_framework_picker()`, `render_sidebar_sections(framework)`; DOM ids `framework-select`, `framework-panel-<id>` (class `framework-panel`), `infra-description-section` (a `<details>`).

- [ ] **Step 1: Failing UI test.** Open the page; expect: no `[role=tab]`; `#framework-select` exists with `optgroup[label="Approved"]` containing 1 option (POSI) and `optgroup[label="Other assessments"]` with 10 options whose last three values are `spii,spii-alignment,posi-spii`; selected value `posi`; a visible `#framework-panel-posi` and 10 hidden panels; `#infra-description-section` is a `details` (closed) between the intro and the panel; the sidebar shows POSI's 4 section accordions (`#sidebar-nav details`), no framework title list; changing the select to `forest` shows `#framework-panel-forest`, rebuilds the sidebar to 6 sections, sets `location.hash` to `#forest`, and the option text ends with `(0/96 scored)`; loading `index.html#gorc` selects GORC; no option or banner contains the word "draft" (case-insensitive) — the banner reads "Experimental"; no horizontal overflow at 375 px. Run → FAIL.
- [ ] **Step 2: Order and wording.** Set `BUILTIN_FRAMEWORK_FILES` to `posi-v2.0, gorc-v1.1, fair-v1.0, bd-v1.0, osr-v0.1, 7gpri-v1.0, care-v1.0, forest-v2.0, spii-v0.1, spii-alignment-v0.3, posi+spii-merged-v0.5`. Replace `(draft)` by `(experimental)` in framework `title`s (`grep -l "(draft)" data/frameworks/*.json`); in the render code change the suffix and the banner text ("Experimental – work in progress. This framework's principles and scoring criteria may still change.").
- [ ] **Step 2b: Markup.** `<aside data-sidebar>` keeps `<nav id="sidebar-nav">` and `<footer id="sidebar-footer">`; put `<div id="framework-picker"></div>` as the first child of `<nav id="sidebar-nav">` and a `<div id="sidebar-sections"></div>` after it. `render_sidebar_nav()` now only fills `#sidebar-sections`.
- [ ] **Step 3: Rendering.**

```js
function framework_option_label(f) {
    const s = compute_summary(state, f.id, f);
    return f.title + (f.draft && !/\((draft|experimental)\)/i.test(f.title) ? " (experimental)" : "") + " (" + s.scoredCount + "/" + s.totalCount + " scored)";
}
function render_framework_picker() {
    const host = document.getElementById("framework-picker");
    host.innerHTML = "";
    const label = document.createElement("label"); label.htmlFor = "framework-select"; label.textContent = "Assessment framework";
    const select = document.createElement("select"); select.id = "framework-select";
    [["Approved", (f) => f.approved], ["Other assessments", (f) => !f.approved]].forEach(([name, test]) => {
        const group = document.createElement("optgroup"); group.label = name;
        all_frameworks().filter(test).forEach((f) => { const o = document.createElement("option"); o.value = f.id; o.textContent = framework_option_label(f); group.appendChild(o); });
        if (group.children.length) select.appendChild(group);
    });
    select.value = activeFrameworkId;
    select.addEventListener("change", () => select_framework(select.value));
    host.append(label, select);
}
```

`render_sidebar_nav()` renders, for the active framework only, one `<details open>` per section: `<summary>` = the section link (as `render_nav_link` does today) and its `nav-principle-list` of `render_principle_nav_link` items. `render()` becomes: intro (`render_header`), `render_infra_description_section()` (now a `<details class="container" id="infra-description-section"><summary><h4>OS Infrastructure Description</h4></summary>…same fields…</details>`, closed), then a `<section id="framework-section">` holding one `<div class="framework-panel" id="framework-panel-<id>" hidden?>` per framework (content from `render_framework_section`); then `render_framework_picker(); render_sidebar_nav(); render_sidebar_footer(); wire_up_events(); update_summary(); update_badge();`. Delete `render_tabs`, `tab_defs`, `tab_label_text`, `activeTabId` (use `activeFrameworkId`). `select_framework(id)`: set `activeFrameworkId`, toggle `hidden` on the panels, set the select's value, `render_sidebar_nav()`, `update_badge()`, `history.replaceState(null, "", "#" + id)`, and close the mobile sidebar. `navigate_to(frameworkId, anchorId)` calls `select_framework` when the framework differs, then scrolls/opens the target as today. `framework_id_from_hash`, `boot` (initial `activeFrameworkId = hash id || FRAMEWORKS[0].id`) and the `hashchange` handler call `select_framework`. `update_summary` refreshes each `<option>` text via `framework_option_label` instead of tab labels.
- [ ] **Step 4: CSS.** Rename `[role="tabpanel"]` → `.framework-panel` in every CSS rule, in `download_pdf`, and in the `beforeprint`/`afterprint` handlers; delete the `[role="tablist"]` rules; style `#framework-picker` (label above select, full width, `--space-3` margin) and make the sidebar's existing mobile click-to-close also close on the select's `change`.
- [ ] **Step 5: Run** `node test-app.mjs --ui` → PASS (including the 320/375/412 px overflow check). Visually check a 1280 px screenshot (dropdown open state included).
- [ ] **Step 6: Commit** "Select one framework from a sidebar dropdown; remove the tab strip".

---

### Task 4: Settings footer and the badge overlay

**Files:** Modify `index.html` (dialogs, `render_sidebar_footer`, CSS).

**Interfaces — Produces:** DOM ids `toggle-scales`, `toggle-badge`, `badge-dialog`, `badge-dialog-content`, `scales-dialog` (empty shell now, filled in Task 6); `open_badge_dialog()`.

- [ ] **Step 1: Failing UI test.** The sidebar footer has a heading "Settings" with an `svg`, and two `input[role=switch]` labelled "Customize scales" and "Show badge (experimental)"; no `summary` with "Assessment badge". Checking the badge switch opens `#badge-dialog` (open attribute) containing `#badge-preview svg` and buttons "Download badge (SVG)", "Download badge (PNG)", "Embed badge"; the badge percentage equals the summary percentage after answering a POSI principle; pressing Escape closes the dialog and the switch is unchecked again. Run → FAIL.
- [ ] **Step 2: Implement.** Add two `<dialog id="badge-dialog" closedby="any">` / `<dialog id="scales-dialog" closedby="any">` blocks next to the existing dialogs (same `<form method="dialog"><header><h3>…</h3></header><div id="…-content"></div><footer>…Close…</footer></form>` shape; titles "Assessment badge (experimental)" and "Customize scale"). Replace `render_sidebar_footer` with a heading (`<h3 class="settings-heading">` + gear SVG `<svg viewBox="0 0 20 20" …>` + "Settings") and a helper

```js
function settings_switch(id, text) {
    const label = document.createElement("label");
    const input = document.createElement("input"); input.type = "checkbox"; input.id = id; input.setAttribute("role", "switch");
    label.append(input, " " + text); return label;
}
```

`#toggle-badge` change → if checked `open_badge_dialog()`; `open_badge_dialog()` moves the existing `badge-wrap` + three buttons markup (from the old footer code) into `#badge-dialog-content`, calls `update_badge()`, `showModal()`. Both dialogs get a `close` listener that sets their switch's `checked = false`. CSS: `.settings-heading` (flex, gap, `--text-6`), `#sidebar-footer label` spacing; drop the now-unused `#sidebar-footer button`/`details` rules only if nothing else uses them.
- [ ] **Step 3: Run** `node test-app.mjs --ui` → PASS. **Step 4: Commit** "Badge in an overlay behind a 'Show badge (experimental)' switch; Settings footer".

---

### Task 5: Scale logic — set/reset, validation, persistence, export/import

**Files:** Modify `index.html` (`app-logic`), `test-app.mjs`.

**Interfaces — Produces:**
`default_levels_for(framework): level[]|undefined`, `editable_levels(framework): level[]` (deep copy, worst → best), `default_editable_levels(framework): level[]`, `validate_scale(levels): boolean`, `set_scale(framework, levels|null): void`, `clear_orphan_statuses(state, framework): number`, `customised_scales(): {id: level[]}`, `persist_scales(): void`, `apply_saved_scales(frameworks): void`; `build_export_object` adds `scales`; `merge_loaded_state` applies `loaded.scales`.

- [ ] **Step 1: Failing tests**

```js
{
  clearStorage(); const c = loadLogic(); const R = (s) => run(c, s);
  R('globalThis.gorc = FRAMEWORKS.find(f => f.id === "gorc"); globalThis.state = initial_state();');
  check("legacy editor list is worst→best", R("editable_levels(gorc).map(l => l.id).join()") === "non-compliant,progress,compliant");
  check("validate_scale", R('validate_scale([{id:"a",label:"A"},{id:"b",label:"B"}])') && !R('validate_scale([{id:"a",label:"A"}])') && !R('validate_scale([{id:"a",label:""},{id:"b",label:"B"}])') && !R('validate_scale([{id:"a",label:"A"},{id:"a",label:"B"}])') && !R('validate_scale(Array.from({length:10},(_, i)=>({id:"x"+i,label:"L"})))'));
  R('state.frameworks.gorc[Object.keys(state.frameworks.gorc)[0]].status = "progress"; state.frameworks.gorc[Object.keys(state.frameworks.gorc)[1]].status = "compliant";');
  R('set_scale(gorc, [{id:"compliant",label:"Great",icon:"check",color:"#00aa00"},{id:"level-1",label:"Not applicable",icon:"question",color:"#888888",excludeFromScore:true}])');
  check("custom scale replaces levels", R("gorc.levels.map(l => l.label).join()") === "Great,Not applicable" && R("is_legacy_levels(gorc)") === false);
  check("orphans cleared", R("clear_orphan_statuses(state, gorc)") === 1);
  check("export carries scales for customised built-ins", R("Object.keys(build_export_object(state).scales).join()") === "gorc");
  check("persisted", /"gorc"/.test(R('localStorage.getItem("spii-principles-tool.scales.v1")')));
  R("set_scale(gorc, null)");
  check("reset restores legacy", R("is_legacy_levels(gorc)") === true && R("build_export_object(state).scales") === undefined);
  check("reset removes the persisted entry", !/"gorc"/.test(R('localStorage.getItem("spii-principles-tool.scales.v1") || ""')));
  // import applies scales, drops statuses that are not in the scale
  const c2 = loadLogic(); const R2 = (s) => run(c2, s);
  R2('globalThis.state = merge_loaded_state({scales:{gorc:[{id:"x",label:"X"},{id:"y",label:"Y"}]}, frameworks:{gorc:{}}})');
  check("import applies scales", R2('FRAMEWORKS.find(f => f.id === "gorc").levels.map(l => l.id).join()') === "x,y");
  check("invalid imported scale ignored", (() => { const c3 = loadLogic(); run(c3, 'merge_loaded_state({scales:{gorc:[{id:"x"}]}})'); return run(c3, 'FRAMEWORKS.find(f => f.id === "gorc").levels') === undefined; })());
  // saved scales are applied on boot
  clearStorage(); const c4 = loadLogic(); run(c4, 'set_scale(FRAMEWORKS.find(f => f.id === "fair"), [{id:"a",label:"A"},{id:"b",label:"B"},{id:"c",label:"C"}])');
  const c5 = loadLogic(); run(c5, "apply_saved_scales(FRAMEWORKS)");
  check("saved scale survives a reload", run(c5, 'FRAMEWORKS.find(f => f.id === "fair").levels.length') === 3);
  clearStorage();
}
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** in `app-logic`:

```js
const SCALES_KEY = "spii-principles-tool.scales.v1";
const DEFAULT_LEVELS = new WeakMap();
const copy_levels = (levels) => levels.map((l) => Object.assign({}, l));
function default_levels_for(framework) { return DEFAULT_LEVELS.has(framework) ? DEFAULT_LEVELS.get(framework) : framework.levels; }
function default_editable_levels(framework) { const d = default_levels_for(framework); return copy_levels(d && d.length ? d : LEGACY_LEVELS.slice().reverse()); }
function editable_levels(framework) { return is_legacy_levels(framework) ? copy_levels(LEGACY_LEVELS.slice().reverse()) : copy_levels(framework.levels); }
function validate_scale(levels) {
    if (!Array.isArray(levels) || levels.length < 2 || levels.length > 9) return false;
    const seen = new Set();
    return levels.every((l) => l && typeof l.id === "string" && l.id && !seen.has(l.id) && seen.add(l.id) && typeof l.label === "string" && l.label.trim() &&
        (l.icon === undefined || ICON_NAMES.includes(l.icon)) && (l.color === undefined || /^(#[0-9a-f]{6}|--[\w-]+)$/i.test(l.color)) &&
        (l.description === undefined || typeof l.description === "string"));
}
function set_scale(framework, levels) {
    if (!DEFAULT_LEVELS.has(framework)) DEFAULT_LEVELS.set(framework, framework.levels);
    const original = DEFAULT_LEVELS.get(framework);
    if (levels) framework.levels = copy_levels(levels);
    else if (original === undefined) delete framework.levels; else framework.levels = original;
    persist_scales();
}
function customised_scales() {
    const out = {};
    FRAMEWORKS.forEach((f) => { if (DEFAULT_LEVELS.has(f) && f.levels !== DEFAULT_LEVELS.get(f)) out[f.id] = f.levels; });
    return out;
}
function persist_scales() {
    try { const s = customised_scales(); if (Object.keys(s).length) localStorage.setItem(SCALES_KEY, JSON.stringify(s)); else localStorage.removeItem(SCALES_KEY); } catch (e) { /* storage unavailable: the scale just lasts for this page view */ }
}
function apply_saved_scales(frameworks) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(SCALES_KEY) || "{}") || {}; } catch (e) { return; }
    frameworks.forEach((f) => { if (validate_scale(saved[f.id])) set_scale(f, saved[f.id]); });
}
function clear_orphan_statuses(state, framework) {
    const ids = principle_levels_for(framework).map((l) => l.id);
    let n = 0;
    Object.values(state.frameworks[framework.id] || {}).forEach((e) => { if (e.status && !ids.includes(e.status)) { e.status = null; n++; } });
    return n;
}
```

`build_export_object`: `const scales = customised_scales(); … return { …, frameworks, ...(Object.keys(scales).length ? { scales } : {}) }` — keep the key absent when empty (the test expects `undefined`). `merge_loaded_state`: after the customFrameworks block and before the status loop, `if (loaded.scales && typeof loaded.scales === "object") FRAMEWORKS.forEach((f) => { if (validate_scale(loaded.scales[f.id])) set_scale(f, loaded.scales[f.id]); });`. In `boot()` call `apply_saved_scales(FRAMEWORKS)` right after `load_builtin_frameworks()`.
- [ ] **Step 4: Run** `node test-app.mjs` → PASS. **Step 5: Commit** "Scales: set/reset, validation, localStorage, export and import".

---

### Task 6: Customize-scales dialog

**Files:** Modify `index.html` (`render_sidebar_footer` wiring, new `render_scales_editor`, CSS).

**Interfaces — Consumes:** Task 4 ids `toggle-scales`, `scales-dialog`; Task 5 functions. **Produces:** `open_scales_dialog()`, `render_scales_editor(framework, draft)`.

- [ ] **Step 1: Failing UI test.** With POSI selected, switch "Customize scales" on: `#scales-dialog` opens with 3 rows ordered Low adoption, Making progress, High adoption; each row has controls icon select (16 options: check, clock, cross, 1–9, question), colour input, title input, description input, "Counts toward score" checkbox, ▲ ▼ and remove buttons; footer has Save, Cancel and a button with `aria-label="Reset to the default scale"`. Scenario: add an option (4 rows), title "Not applicable", icon question, uncheck "Counts toward score", move it to the bottom, Save → dialog closed, switch off, POSI shows 4 cards, the 4th labelled "Not applicable" with the question-mark icon; answering one principle "High adoption" and another "Not applicable" gives summary 100% and "(2/23 scored)"; reload the page → the 4-card scale is still there (localStorage); Export report (download) contains `scales.posi` with 4 levels; Reset → 3 default cards again and the saved key is gone; removing the option that holds an answer asks for confirm (accept it via `page.on("dialog")`) and clears the answer; a title left empty keeps the dialog open with an inline message; with the CRIS framework (`?framework=data/frameworks/cris-tender-v0.1.json#cris-tender`) the switch is disabled. Run → FAIL.
- [ ] **Step 2: Implement.** `#toggle-scales` change → `open_scales_dialog()` (disabled and titled "This framework scores points per answer, so its answers are fixed" when `tender_scoring(active)`; `select_framework` re-evaluates this). `open_scales_dialog()` sets the title ("Customize scale — <framework title>"), `let draft = editable_levels(framework)`, fills `#scales-dialog-content` with `render_scales_editor`, adds the footer buttons (Save, Cancel, Reset icon button with an open-circle-arrow SVG), `showModal()`. Rows are plain DOM: `<div class="scale-row">` with ▲/▼ (`aria-label` "Move up/down"), `<select>` of `ICON_NAMES` with a live preview `<span>` from `icon_markup_by_name`, `<input type="color">` (value `to_hex(resolve_color(level.color))`, writing `level.color` only on `input`), title `<input>`, description `<input>`, a checkbox bound to `excludeFromScore` (inverted), and a remove button (disabled at 2 rows). "Add option" (max 9) appends `{id: next free "level-N", label: "", icon: String(n), color: level_gradient-derived hex}`; structural changes re-render the rows from `draft`, field edits just mutate `draft`. A paragraph under the rows: "Options run from lowest (top) to highest (bottom). Untick ‘Counts toward score’ for an option such as Not applicable. Per-principle descriptions can't be set here — to change them, edit a framework JSON file and use Import ▾ → Import Assessment Framework." Save: `validate_scale(draft)` else show an inline `role="alert"` message ("Every option needs a title."); `const lost = count of statuses not in draft ids` → `if (lost && !confirm(lost + " answer(s) use options you removed and will be cleared. Continue?")) return;` then `set_scale(framework, draft); clear_orphan_statuses(state, framework); close; render();`. Reset: confirm the same way for answers that would be lost, then `set_scale(framework, null); clear_orphan_statuses(...)`, close, `render()`. Note: `render()` rebuilds the DOM, so it must keep the selected framework (it does: `activeFrameworkId`).
- [ ] **Step 3: Run** `node test-app.mjs --ui` → PASS at 1280 and 375 px (dialog scrolls, no overflow); Escape and the Cancel button close it and switch the toggle off.
- [ ] **Step 4: Commit** "Customize scales dialog: icon, colour, title, description, counts toward score; reset".

---

### Task 7: Docs, changelog, final verification

**Files:** Modify `README.md`, `CLAUDE.md`, `index.html` (CHANGELOG_HTML, `FRAMEWORK_TEMPLATE` comment mentioning `icon`/`color`/`description`/`excludeFromScore`, `<meta name="description">`).

- [ ] **Step 1:** CHANGELOG entry 2026-10-29 (layout, POSI scale, complementary principles, customizable scales, badge overlay, experimental wording, SPII frameworks under Other). README: framework list (POSI scale, SPII frameworks "experimental"), features (Customize scales, badge), linking (`#posi`… hashes unchanged). CLAUDE.md: new layout/sidebar description, the `levels` extension fields, scale customization and its storage key, `intro` field, `test-app.mjs` (replace the "no committed test suite" paragraph), removal of the tab functions.
- [ ] **Step 2:** `node test-app.mjs --ui` → all PASS; `node -e "JSON.parse(...)"` over every `data/**/*.json`; manual screenshots at 1280/375 saved to the scratchpad and looked at.
- [ ] **Step 3:** Commit "Document the page changes", push `feature/principles-page-improvements`, open one PR to `main` (summary of the six document points, decisions, what is untested: PDF export is still broken as before).

---

## Self-review

- **Spec coverage:** layout (T3), sidebar dropdown/accordions/footer (T3, T4), order + experimental (T3), POSI data/levels/intro/complementary/migration (T2), level fields + scoring + N/A (T2), customize dialog/reset/persistence/export/import/disabled-for-scoring (T5, T6), docs (T7). Out-of-scope items are not planned.
- **Placeholders:** none; the one-off Python edit of the POSI JSON is described exactly (keys, ids, texts) rather than shown because it is a throw-away script.
- **Names:** `select_framework`, `framework_option_label`, `render_framework_picker`, `icon_markup_by_name`, `resolve_color`, `counting_levels`, `set_scale`, `editable_levels`, `default_editable_levels`, `validate_scale`, `clear_orphan_statuses`, `customised_scales`, `persist_scales`, `apply_saved_scales`, `open_scales_dialog`, `render_scales_editor` are defined where first produced and used consistently in later tasks.
