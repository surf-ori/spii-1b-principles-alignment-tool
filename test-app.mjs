// node test-app.mjs        -> logic tests (Node vm, no browser)
// node test-app.mjs --ui   -> plus Chromium tests (test-app-ui.mjs); needs playwright:
//   PW_MODULE=/path/to/playwright/index.mjs PW_CHROMIUM=/path/to/chromium node test-app.mjs --ui
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
let failed = 0;
export const check = (name, ok, detail = "") => {
    if (!ok) failed++;
    console.log((ok ? "PASS  " : "FAIL  ") + name + (ok ? "" : "  -> " + detail));
};

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const storage = new Map();
export const clearStorage = () => storage.clear();
export const storageGet = (key) => (storage.has(key) ? storage.get(key) : null);

// The pure logic of the page (<script id="app-logic">) in a fresh vm context, with the
// built-in frameworks loaded from data/frameworks in BUILTIN_FRAMEWORK_FILES order.
export function loadLogic() {
    const ctx = vm.createContext({
        console,
        getComputedStyle: () => ({ getPropertyValue: (v) => ({ "--destructive": "#b3261e", "--warning": "#b06b00", "--compliant": "#1f5c43" })[v] || "" }),
        document: { documentElement: {} },
        localStorage: { getItem: storageGet, setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k) },
    });
    vm.runInContext(html.match(/<script id="app-logic">([\s\S]*?)<\/script>/)[1], ctx);
    const files = vm.runInContext("BUILTIN_FRAMEWORK_FILES", ctx);
    ctx.__frameworks = files.map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8")));
    vm.runInContext("FRAMEWORKS = __frameworks;", ctx);
    return ctx;
}
export const run = (ctx, code) => vm.runInContext(code, ctx);

// ---- logic tests -------------------------------------------------------------------------

{
    const c = loadLogic();
    const R = (s) => run(c, s);
    const posi = R('FRAMEWORKS.find(f => f.id === "posi")');
    const ids = posi.sections.flatMap((s) => s.principles.map((p) => p.id));
    check("POSI has 23 principles incl. 3 complementary", ids.length === 23 && posi.sections.at(-1).section === "Complementary Principles" && posi.sections.at(-1).principles.length === 3, ids.length);
    check("POSI levels low/making/high in order", (posi.levels || []).map((l) => l.id).join() === "low-adoption,making-progress,high-adoption");
    check("POSI icons and colors", (posi.levels || []).map((l) => l.icon + l.color).join() === "cross--destructive,clock--warning,check--compliant");
    check("complementary criteria use level ids", posi.sections.at(-1).principles.every((p) => p.criteria && Object.keys(p.criteria).sort().join() === "high-adoption,low-adoption,making-progress"));
    check("About POSI lost the approved paragraph", !/Approved assessment framework/.test(posi.aboutHtml) && /Principles of Open Scholarly Infrastructure \(POSI\) is/.test(posi.aboutHtml));
    check("intro present", !!posi.intro && /Strategic Plan for Integrated Infrastructure/.test(posi.intro.title) && /Complementary principles/.test(posi.intro.html) && !/Complimentary/.test(posi.intro.html));
    check("validate_framework_shape accepts POSI", R("validate_framework_shape")(posi) === true);
    check("icon markup by name", R('icon_markup_by_name("cross")').includes("M7 7l6 6") && R('icon_markup_by_name("3")').includes(">3<") && R('icon_markup_by_name("question")').includes(">?<"));
    check("level_color resolves tokens", R('level_color(FRAMEWORKS[0], "high-adoption")') === "#1f5c43");
    check("legacy frameworks keep icons and colors", R('level_color(FRAMEWORKS.find((f) => f.id === "gorc"), "compliant")') === "#1f5c43" && R('level_icon_markup(FRAMEWORKS.find((f) => f.id === "gorc"), "progress")').includes("M10 5.5v5"));
    R(`globalThis.fw = {id:"t",title:"T",levels:[{id:"a",label:"A"},{id:"b",label:"B"},{id:"c",label:"C"},{id:"na",label:"N/A",excludeFromScore:true}],sections:[{section:"s",principles:[{id:"p1",title:"1",text:""},{id:"p2",title:"2",text:""},{id:"p3",title:"3",text:""}]}]};
        globalThis.st = {frameworks:{t:{p1:{status:"c",notes:""},p2:{status:"na",notes:""},p3:{status:"b",notes:""}}}};`);
    const sum = R('compute_summary(st, "t", fw)');
    check("N/A is answered but not in the average", sum.scoredCount === 3 && sum.percentMature === 75 && sum.counts.join() === "0,1,1,1", JSON.stringify(sum));
    // example reports use POSI's new ids
    const levelIds = posi.levels ? posi.levels.map((l) => l.id) : [];
    for (const f of ["openaire-posi-assessment-report-2026", "openalex-posi-assessment-report-2026", "hal-posi-assessment-report-2024"]) {
        const rep = JSON.parse(fs.readFileSync(path.join(ROOT, "data/examples", f + ".json"), "utf8"));
        check("example " + f + " uses the new POSI ids", Object.values(rep.frameworks.posi).every((e) => e.status === null || levelIds.includes(e.status)));
    }
}

{
    // Scales: set/reset, validation, persistence, export/import
    clearStorage();
    const c = loadLogic();
    const R = (s) => run(c, s);
    R('globalThis.gorc = FRAMEWORKS.find((f) => f.id === "gorc"); globalThis.state = initial_state();');
    check("legacy editor list is worst to best", R("editable_levels(gorc).map((l) => l.id).join()") === "non-compliant,progress,compliant");
    check("a POSI-like levels framework lists as declared", R('editable_levels(FRAMEWORKS[0]).map((l) => l.id).join()') === "low-adoption,making-progress,high-adoption");
    check("validate_scale", R('validate_scale([{id:"a",label:"A"},{id:"b",label:"B"}])') === true
        && !R('validate_scale([{id:"a",label:"A"}])')
        && !R('validate_scale([{id:"a",label:" "},{id:"b",label:"B"}])')
        && !R('validate_scale([{id:"a",label:"A"},{id:"a",label:"B"}])')
        && !R('validate_scale([{id:"a",label:"A",icon:"star"},{id:"b",label:"B"}])')
        && !R('validate_scale([{id:"a",label:"A",color:"red"},{id:"b",label:"B"}])')
        && !R('validate_scale(Array.from({length:10}, (_, i) => ({id:"x"+i,label:"L"})))'));
    const keys = R("Object.keys(state.frameworks.gorc)");
    R(`state.frameworks.gorc["${keys[0]}"].status = "progress"; state.frameworks.gorc["${keys[1]}"].status = "compliant";`);
    R('set_scale(gorc, [{id:"compliant",label:"Great",icon:"check",color:"#00aa00",junk:1},{id:"level-1",label:"Not applicable",icon:"question",color:"#888888",excludeFromScore:true}])');
    check("custom scale replaces the levels (only known fields kept)", R("gorc.levels.map((l) => l.label).join()") === "Great,Not applicable" && R("is_legacy_levels(gorc)") === false && R("gorc.levels[0].junk") === undefined);
    check("orphan statuses are counted and cleared", R("clear_orphan_statuses(state, gorc)") === 1 && R(`state.frameworks.gorc["${keys[0]}"].status`) === null && R(`state.frameworks.gorc["${keys[1]}"].status`) === "compliant");
    check("export carries the scales of customised built-ins", R("Object.keys(build_export_object(state).scales).join()") === "gorc");
    check("the scale is persisted", /"gorc"/.test(storageGet("spii-principles-tool.scales.v1") || ""));
    R("set_scale(gorc, null)");
    check("reset restores the legacy scale", R("is_legacy_levels(gorc)") === true && R("build_export_object(state).scales") === undefined);
    check("reset removes the persisted entry", storageGet("spii-principles-tool.scales.v1") === null);
    // import
    const c2 = loadLogic();
    run(c2, 'merge_loaded_state({scales:{gorc:[{id:"x",label:"X"},{id:"y",label:"Y"}]}, frameworks:{gorc:{}}})');
    check("importing a report applies its scales", run(c2, 'FRAMEWORKS.find((f) => f.id === "gorc").levels.map((l) => l.id).join()') === "x,y");
    clearStorage();
    const c3 = loadLogic();
    run(c3, 'merge_loaded_state({scales:{gorc:[{id:"x"}]}})');
    check("an invalid imported scale is ignored", run(c3, 'FRAMEWORKS.find((f) => f.id === "gorc").levels') === undefined);
    // statuses of a customised scale survive an export/import round trip
    const c4 = loadLogic();
    run(c4, 'globalThis.fair = FRAMEWORKS.find((f) => f.id === "fair"); set_scale(fair, [{id:"a",label:"A"},{id:"b",label:"B"},{id:"c",label:"C"}]); globalThis.state = initial_state();');
    const fkeys = run(c4, "Object.keys(state.frameworks.fair)");
    run(c4, `state.frameworks.fair["${fkeys[0]}"].status = "b";`);
    const exported = run(c4, "JSON.stringify(build_export_object(state))");
    const c5 = loadLogic();
    run(c5, "globalThis.back = merge_loaded_state(" + exported + ");");
    check("custom-scale answers round trip", run(c5, `back.frameworks.fair["${fkeys[0]}"].status`) === "b" && run(c5, 'FRAMEWORKS.find((f) => f.id === "fair").levels.length') === 3);
    // saved scales are applied on boot
    clearStorage();
    const c6 = loadLogic();
    run(c6, 'set_scale(FRAMEWORKS.find((f) => f.id === "fair"), [{id:"a",label:"A"},{id:"b",label:"B"},{id:"c",label:"C"}])');
    const c7 = loadLogic();
    run(c7, "apply_saved_scales(FRAMEWORKS)");
    check("a saved scale is applied again after a reload", run(c7, 'FRAMEWORKS.find((f) => f.id === "fair").levels.length') === 3);
    clearStorage();
    const c8 = loadLogic();
    check("without storage nothing breaks", (() => { try { run(c8, 'delete globalThis.localStorage; set_scale(FRAMEWORKS[1], [{id:"a",label:"A"},{id:"b",label:"B"}]); apply_saved_scales(FRAMEWORKS); true'); return true; } catch (e) { return false; } })());
}

{
    // Activities: the Process icon is a cog; the right-hand group is called "Research administrative activities"
    const c = loadLogic();
    const R = (s) => run(c, s);
    check("Process activity icon is a cog, not rays", R('ACTIVITY_ICONS.Process').includes("M19.4 15") && !R('ACTIVITY_ICONS.Process').includes("M10 3.5v2"));
    check("every activity still has an icon", R("[...ACTIVITIES.primary.items, ...ACTIVITIES.related.items].every((i) => !!ACTIVITY_ICONS[i])"));
    check("right-hand group is titled administrative", R("ACTIVITIES.related.title") === "Research administrative activities");
    check("its stored key stays the old one (saved reports keep their selections)", R("ACTIVITIES.related.key") === "Research related activities");
}

{
    // One feedback issue template; the top-menu Feedback link points at it
    const templates = fs.readdirSync(path.join(ROOT, ".github/ISSUE_TEMPLATE")).filter((f) => f !== "config.yml");
    check("exactly one issue template", templates.join() === "feedback.yml", templates.join());
    const link = html.match(/<a [^>]*href="([^"]*issues\/new\?template=([^"&]+))"[^>]*>Feedback<\/a>/);
    check("top menu has a Feedback link to that template", !!link && link[1] === "https://github.com/surf-ori/spii-1b-principles-alignment-tool/issues/new?template=feedback.yml" && fs.existsSync(path.join(ROOT, ".github/ISSUE_TEMPLATE", link[2])), link && link[1]);
    const form = fs.readFileSync(path.join(ROOT, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
    const questions = ["Is the tool easy to navigate and understand?", "Is the overall layout and design clear?", "Was it clear that you can define your own assessment criteria and definitions?", "Were you able to generate and export the assessment report without difficulty?", "Did you know you can also import an existing assessment and then review it in the tool?", "Are the principles and explanations clear and easy to understand?", "Is the level of detail sufficient?", "Would additional guidance or examples help you better interpret and assess the principles?", "Do you miss any principles?"];
    check("the template asks all 9 tester questions", questions.every((q) => form.includes("label: " + q)), questions.filter((q) => !form.includes("label: " + q)).join("|"));
}

{
    // Theme: dark / system / light
    const c = loadLogic();
    const R = (s) => run(c, s);
    check("effective_theme resolves system through the OS setting", R('effective_theme("system", true)') === "dark" && R('effective_theme("system", false)') === "light");
    check("an explicit theme ignores the OS setting", R('effective_theme("dark", false)') === "dark" && R('effective_theme("light", true)') === "light");
    check("unknown stored values fall back to system", R('normalise_theme("blue")') === "system" && R("normalise_theme(null)") === "system" && R('normalise_theme("dark")') === "dark");
    check("token colors can be resolved live (var(--x)) for inline styles", R('level_color(FRAMEWORKS[0], "high-adoption", true)') === "var(--compliant)" && R('level_color(FRAMEWORKS[0], "high-adoption")') === "#1f5c43");
    check("the dark tokens hang on data-theme, not on a media query", !/@media \(prefers-color-scheme: dark\)/.test(html) && /:root\[data-theme="dark"\]/.test(html));
}

{
    // Not applicable on every framework; the short report
    clearStorage();
    const c = loadLogic();
    const R = (s) => run(c, s);
    R('globalThis.byId = (id) => FRAMEWORKS.find((f) => f.id === id);');
    check("legacy frameworks offer Not applicable", R('answer_options(byId("gorc")).map((l) => l.id).join()') === "compliant,progress,non-compliant,not-applicable");
    check("POSI offers Not applicable last", R('answer_options(byId("posi")).map((l) => l.id).join()') === "low-adoption,making-progress,high-adoption,not-applicable");
    check("a scale with its own N/A gets no second one", R('answer_options(byId("fair"), [{id:"a",label:"A"},{id:"b",label:"B"},{id:"x",label:"N/A",excludeFromScore:true}]).length') === 3);
    const cris = JSON.parse(fs.readFileSync(path.join(ROOT, "data/frameworks/cris-tender-v0.1.json"), "utf8"));
    c.__cris = cris;
    check("points-based frameworks get no N/A", R("answer_options(__cris).length") === 3);
    check("N/A has a dash icon and a muted color", R('level_icon_markup(byId("gorc"), "not-applicable")').includes("M6.5 10h7") && R('level_color(byId("gorc"), "not-applicable", true)') === "var(--muted-foreground)");
    R('globalThis.state = initial_state(); globalThis.k = Object.keys(state.frameworks.gorc);');
    R('state.frameworks.gorc[k[0]].status = "compliant"; state.frameworks.gorc[k[1]].status = "non-compliant"; state.frameworks.gorc[k[2]].status = "not-applicable";');
    const g = R('compute_summary(state, "gorc", byId("gorc"))');
    check("legacy: N/A is answered but not in the percentage", g.scoredCount === 3 && g.notApplicable === 1 && g.percentCompliant === 50, JSON.stringify(g));
    check("legacy summary text mentions N/A", /1 not applicable \(3\/\d+ scored\)$/.test(R('summary_text(compute_summary(state, "gorc", byId("gorc")), byId("gorc")).counts')));
    R('globalThis.pk = Object.keys(state.frameworks.posi); state.frameworks.posi[pk[0]].status = "high-adoption"; state.frameworks.posi[pk[1]].status = "not-applicable"; state.frameworks.posi[pk[1]].notes = "We do not <publish> & curate";');
    const p = R('compute_summary(state, "posi", byId("posi"))');
    check("levels: N/A is answered but not in the percentage", p.scoredCount === 2 && p.notApplicable === 1 && p.percentMature === 100, JSON.stringify(p));
    check("levels summary text mentions N/A", /· 1 not applicable \(2\/23 scored\)$/.test(R('summary_text(compute_summary(state, "posi", byId("posi")), byId("posi")).counts')));
    const exported = R("JSON.stringify(build_export_object(state))");
    const c2 = loadLogic();
    run(c2, "globalThis.back = merge_loaded_state(" + exported + ");");
    check("import keeps Not applicable", run(c2, `back.frameworks.posi["${R("pk[1]")}"].status`) === "not-applicable");
    check("orphan clearing keeps Not applicable", R('clear_orphan_statuses(state, byId("posi"))') === 0);
    // report
    R('state.name = "Repo <X>"; state.assessedOn = "2026-11-09"; state.activities = ["Research life cycle activities > Discover"];');
    const html = R("build_report_html(state, FRAMEWORKS)");
    check("report: header with escaped name, date and activities", html.includes("Repo &lt;X&gt;") && html.includes("2026-11-09") && html.includes("Discover"));
    check("report: only frameworks with answers", html.includes("POSI v2.0 Assessment") && html.includes("GORC") && !html.includes("FAIR v1.0") && !html.includes("FOREST"));
    check("report: answers, N/A and escaped notes, no criteria", html.includes("High adoption") && html.includes("Not applicable") && html.includes("We do not &lt;publish&gt; &amp; curate") && !html.includes("Data, infrastructure control, and critical decisions remain"));
    check("report: score lines", html.includes("Self-assessment score: 100%") && html.includes("Self-assessment score: 50% compliant"));
    check("report without answers says so", run(loadLogic(), "build_report_html(initial_state(), FRAMEWORKS)").includes("No answers yet"));
}

{
    // Export file names and self-describing JSON
    clearStorage();
    const c = loadLogic();
    const R = (s) => run(c, s);
    R('globalThis.posi = FRAMEWORKS.find((f) => f.id === "posi"); globalThis.state = initial_state(); state.name = "OpenAIRE"; state.assessedOn = "2026-11-09"; globalThis.k = Object.keys(state.frameworks.posi); state.frameworks.posi[k[0]].status = "high-adoption"; state.frameworks.gorc[Object.keys(state.frameworks.gorc)[0]].status = "compliant";');
    check("report file name: date, framework, infrastructure", R("report_filename(state, posi)") === "2026-11-09-posi-v2-0-assessment-openaire.json", R("report_filename(state, posi)"));
    check("report file name without a name", R('report_filename(Object.assign({}, state, {name: ""}), posi)') === "2026-11-09-posi-v2-0-assessment-unnamed-infrastructure.json");
    check("framework file name: date and framework", R('framework_filename(posi, "2026-11-09")') === "2026-11-09-posi-v2-0-assessment-framework.json");
    const rep = R('build_export_object(state, "posi")');
    check("report export holds only the selected framework", Object.keys(rep.frameworks).join() === "posi" && rep.customFrameworks.length === 0);
    check("report export explains itself", Object.keys(rep)[0] === "_readme" && rep._readme.includes("POSI v2.0 Assessment") && rep._readme.includes("https://surf-ori.github.io/spii-1b-principles-alignment-tool/") && /Import Assessment Report/.test(rep._readme));
    const c2 = loadLogic();
    run(c2, "globalThis.back = merge_loaded_state(" + JSON.stringify(rep) + ");");
    check("a single-framework report imports", run(c2, `back.frameworks.posi["${R("k[0]")}"].status`) === "high-adoption" && run(c2, "back.name") === "OpenAIRE");
    const fw = R('build_framework_export(posi, "2026-11-09")');
    check("framework export: one framework, readme first, valid", !Array.isArray(fw) && Object.keys(fw)[0] === "_readme" && fw.id === "posi" && R("validate_framework_shape")(fw) === true);
    check("framework readme says what to edit, to change the id, and where to import", /criteria/.test(fw._readme) && /new `id`|new id/i.test(fw._readme) && fw._readme.includes("https://surf-ori.github.io/spii-1b-principles-alignment-tool/") && /Import Assessment Framework/.test(fw._readme));
    check("an old _readme is replaced, not kept", R('build_framework_export(Object.assign({_readme: "old"}, posi), "2026-11-09")._readme') !== "old");
}

{
    // Nida's feedback: frameworks, wording, score view; Ben: no script in imported HTML (see the UI tests)
    clearStorage();
    const c = loadLogic();
    const R = (s) => run(c, s);
    check("the SPII frameworks are no longer built in", R("FRAMEWORKS.map((f) => f.id).join()") === "posi,gorc,fair,bd,osr,7gpri,care,forest");
    const posi = R('FRAMEWORKS[0]');
    check("SPII is the Strategic Plan for Integrated Infrastructure", posi.intro.title === "Introduction to Strategic Plan for Integrated Infrastructure" && /Strategic Plan for Integrated Infrastructure \(SPII\)/.test(posi.intro.html) && !/ on Integrated/.test(R("ABOUT_TOOL_HTML") + JSON.stringify(posi)));
    check("the 'Other frameworks' line is gone from the POSI intro", !/Other frameworks:/.test(posi.intro.html));
    check("About: SPII spelled out, AI statement, no values/CRIS paragraphs", /Strategic Plan for Integrated Infrastructure \(SPII\)/.test(R("ABOUT_TOOL_HTML")) && /developed with AI assistance \(Claude\)/.test(R("ABOUT_TOOL_HTML")) && !/UNESCO/.test(R("ABOUT_TOOL_HTML")) && !/Current Research Information System/.test(R("ABOUT_TOOL_HTML")));
    R('globalThis.posi = FRAMEWORKS[0]; globalThis.state = initial_state(); globalThis.k = posi.sections[0].principles.map((p) => p.id);');
    R('state.frameworks.posi[k[0]].status = "high-adoption"; state.frameworks.posi[k[1]].status = "low-adoption"; state.frameworks.posi[k[2]].status = "not-applicable";');
    check("summary heading is the self-assessment score", R('summary_text(compute_summary(state, "posi", posi), posi).heading') === "Self-assessment score: 50%");
    check("the score is explained", /Low adoption.*0%.*High adoption.*100%/.test(R("score_explanation(posi)")) && /Not applicable/.test(R("score_explanation(posi)")));
    const rows = R('section_breakdown(state, posi)');
    check("breakdown per section: counts per answer, unanswered and score", rows.length === 4 && rows[0].section === "Governance" && rows[0].total === 7 && rows[0].counts["high-adoption"] === 1 && rows[0].counts["not-applicable"] === 1 && rows[0].unanswered === 4 && rows[0].score === 50 && rows[1].score === null, JSON.stringify(rows[0]));
    const rel = R('build_chart_html(state, posi, "relative")');
    const abs = R('build_chart_html(state, posi, "absolute")');
    check("chart: legend with every answer and Not answered", ["Low adoption", "Making progress", "High adoption", "Not applicable", "Not answered"].every((l) => rel.includes(l)));
    check("chart: relative widths fill a row (1 of 7 = 14.29%)", rel.includes("width:14.29%") && rel.includes("Governance"));
    check("chart: absolute widths are relative to the longest section (1 of 8)", abs.includes("width:12.5%"));
    check("chart: section scores shown", />50%</.test(rel));
    check("chart colors print", rel.includes("print-color-adjust:exact"));
    R('state.name = "Repo <b>"; state.assessedOn = "2026-11-10";');
    const embed = R('build_embed_html(state, posi, "relative")');
    check("embed snippet: self-contained, escaped, score and link back", embed.startsWith("<div") && embed.includes("Repo &lt;b&gt;") && embed.includes("Self-assessment score: 50%") && embed.includes("https://surf-ori.github.io/spii-1b-principles-alignment-tool/") && !embed.includes("var(--"));
    check("report starts each framework with the chart", R("build_report_html(state, FRAMEWORKS)").includes("score-chart"));
    // autosave
    R("save_assessment(state)");
    check("the assessment is saved in the browser", JSON.parse(storageGet("spii-principles-tool.assessment.v1")).name === "Repo <b>");
    const c2 = loadLogic();
    check("and restored on the next visit", run(c2, "load_saved_assessment(initial_state()).name") === "Repo <b>" && run(c2, `load_saved_assessment(initial_state()).frameworks.posi["${R("k[0]")}"].status`) === "high-adoption");
    run(c2, "forget_saved_assessment()");
    check("starting a new assessment forgets it", storageGet("spii-principles-tool.assessment.v1") === null && run(c2, "load_saved_assessment(initial_state()).name") === "");
    clearStorage();
}

if (process.argv.includes("--ui")) await (await import("./test-app-ui.mjs")).default({ check, ROOT });

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
