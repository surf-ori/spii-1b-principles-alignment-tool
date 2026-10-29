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

if (process.argv.includes("--ui")) await (await import("./test-app-ui.mjs")).default({ check, ROOT });

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
