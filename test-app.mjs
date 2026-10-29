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
    check("intro present", !!posi.intro && /Strategic Plan on Integrated Infrastructure/.test(posi.intro.title) && /Complementary principles/.test(posi.intro.html) && !/Complimentary/.test(posi.intro.html));
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

if (process.argv.includes("--ui")) await (await import("./test-app-ui.mjs")).default({ check, ROOT });

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
