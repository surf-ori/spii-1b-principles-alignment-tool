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

if (process.argv.includes("--ui")) await (await import("./test-app-ui.mjs")).default({ check, ROOT });

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
