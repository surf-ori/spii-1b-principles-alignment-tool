// Browser tests for test-app.mjs --ui. Serves the repo over http and drives Chromium via Playwright.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const MIME = { ".js": "text/javascript", ".html": "text/html", ".json": "application/json", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };

function serve(root) {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "") || "index.html";
            const file = path.join(root, rel);
            if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("not found"); }
            res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
            res.end(fs.readFileSync(file));
        }).listen(0, () => resolve(server));
    });
}

export default async function ({ check, ROOT }) {
    const { chromium } = await import(process.env.PW_MODULE || "playwright");
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    const server = await serve(ROOT);
    const base = "http://localhost:" + server.address().port + "/";
    const ignorable = (e) => /net::|ERR_/.test(e);

    // The shared SPII top bar (spii-nav.js, spii.css) comes from the design system's GitHub Pages site;
    // tests serve it from a local clone next to this repo (SPII_DS_DIR to override), or leave it out.
    const DS_DIR = process.env.SPII_DS_DIR || path.join(ROOT, "..", "spii-design-system");
    const HAVE_DS = fs.existsSync(path.join(DS_DIR, "spii-nav.js"));
    async function routeDS(ctx, withDS = true) {
        await ctx.route(/surf-ori\.github\.io\/spii-design-system\//, (r) => {
            const file = path.join(DS_DIR, new URL(r.request().url()).pathname.replace(/^\/spii-design-system\//, ""));
            if (!withDS || !file.startsWith(DS_DIR) || !fs.existsSync(file)) return r.abort();
            return r.fulfill({ status: 200, contentType: MIME[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
        });
    }

    // Opens the page in a fresh context (fresh localStorage); returns { page, errors, ctx }.
    // `others`: start with "Show other alignment frameworks" on (most tests need the picker); `ds`: load the SPII top bar.
    async function open(url = "index.html", width = 1280, height = 900, { others = true, ds = true, scheme, ready = "#app > *" } = {}) {
        const ctx = await browser.newContext({ viewport: { width, height }, acceptDownloads: true, colorScheme: scheme });
        await routeDS(ctx, ds);
        if (others) await ctx.addInitScript(() => { if (!localStorage.getItem("spii-principles-tool.prefs.v1")) localStorage.setItem("spii-principles-tool.prefs.v1", JSON.stringify({ showOtherFrameworks: true })); });
        const page = await ctx.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
        page.on("console", (m) => { if (m.type() === "error" && !ignorable(m.text())) errors.push("console: " + m.text()); });
        await page.route(/unpkg\.com|html2canvas/, (r) => r.abort());
        await page.goto(base + url, { waitUntil: "load" });
        await page.waitForSelector(ready);
        return { page, errors, ctx };
    }

    // A dialog's "close" event (which switches its toggle off) fires asynchronously: wait for it.
    const closed = (page, dialog) =>
        page.waitForFunction((d) => !document.getElementById(d).open, dialog, { timeout: 3000 }).then(() => true, () => false);
    const closedAndOff = (page, dialog, toggle) =>
        page.waitForFunction(([d, t]) => !document.getElementById(d).open && !document.getElementById(t).checked, [dialog, toggle], { timeout: 3000 }).then(() => true, () => false);

    try {
        {
            const { page, errors, ctx } = await open();
            check("page loads and renders the intro", /Self-assess how your Open Science infrastructure/.test(await page.locator("#app").innerText()));
            check("no console or page errors on load", errors.length === 0, JSON.stringify(errors));
            await ctx.close();
        }
        // ---- UI tests per task are added below ----
        {
            // POSI: adoption scale, intro accordion, complementary principles
            const { page, errors, ctx } = await open("index.html#posi");
            const panel = page.locator('.framework-panel:visible');
            const first = panel.locator('details[id^="principle-posi-"]').first();
            await first.locator("summary").click();
            const labels = await first.locator(".status-label").allInnerTexts();
            check("POSI cards: Low adoption / Making progress / High adoption (+ Not applicable)", labels.join() === "Low adoption,Making progress,High adoption,Not applicable", labels.join());
            const detailsTitles = await panel.locator("#framework-posi > details > summary").allInnerTexts();
            check("About POSI is the only accordion above the principles, open, highlighted", detailsTitles.join("|") === "About POSI" && (await panel.locator("#framework-posi > details.framework-about").evaluate((d) => d.open && getComputedStyle(d).backgroundColor !== "rgba(0, 0, 0, 0)")), detailsTitles.join("|"));
            check("About POSI has no approved paragraph", !/Approved assessment framework/.test(await panel.locator("#framework-posi > details").first().innerText()));
            check("SPII intro accordion sits on top of the page, outside POSI", (await page.locator("#intro-section details.spii-intro > summary").innerText()).trim() === "Introduction to the Strategic Plan for Integrated Infrastructure");
            check("23 principle accordions", (await panel.locator('details[id^="principle-posi-"]').count()) === 23);
            const aut = panel.locator("#principle-posi-autonomy");
            await aut.locator("summary").click();
            check("Autonomy text links to the DAAF", (await aut.locator('a[href="https://utrechtuniversity.github.io/digital-autonomy-assessment-tool/"]').count()) === 2);
            check("cards show the criteria from SPII v0.1", /Data, infrastructure control, and critical decisions remain/.test(await aut.innerText()));
            await first.locator('.status-card[data-status="high-adoption"]').click();
            const heading = (await panel.locator('[id^="summary-heading-posi"]').first().innerText()).trim();
            check("one High adoption answer gives 100% average score", heading === "Alignment summary: 100%", heading);
            check("the status chip colours follow the level", (await first.locator('.status-card[data-status="high-adoption"]').evaluate((el) => getComputedStyle(el).getPropertyValue("--status-accent"))).trim() !== "");
            check("no console or page errors (POSI)", errors.length === 0, JSON.stringify(errors));
            await ctx.close();
        }
        {
            // Layout: intro, infrastructure accordion, selected framework; dropdown + sidebar accordions
            const { page, errors, ctx } = await open("index.html");
            check("no tab strip", (await page.locator('[role="tab"], [role="tablist"]').count()) === 0);
            const groups = await page.$$eval("#framework-select optgroup", (gs) => gs.map((g) => [g.label, [...g.querySelectorAll("option")].map((o) => o.value)]));
            check("dropdown groups: Default / Other alignment frameworks", groups.length === 2 && groups[0][0] === "Default" && groups[0][1].join() === "posi" && groups[1][0] === "Other alignment frameworks", JSON.stringify(groups));
            check("other assessments order", groups[1] && groups[1][1].join() === "gorc,fair,bd,osr,7gpri,care,forest", groups[1] && groups[1][1].join());
            check("POSI is selected by default", (await page.inputValue("#framework-select")) === "posi");
            check("option label shows the scored count", /^POSI v2\.0 \(0\/23 scored\)$/.test(await page.locator('#framework-select option[value="posi"]').innerText()));
            const order = await page.$$eval("#app > *", (els) => els.map((e) => e.id || e.tagName.toLowerCase()));
            check("main page: intro, infra description, selected framework", order.join() === "intro-section,infra-description-section,framework-section", order.join());
            check("infra description is an open accordion", await page.$eval("#infra-description-section", (e) => e.tagName === "DETAILS" && e.open));
            check("sidebar starts with a link to the infrastructure description", (await page.locator("#sidebar-sections li").first().innerText()).trim() === "OS Infrastructure Description");
            await page.fill("#infra-name", "Test infra");
            check("infra description fields work", (await page.inputValue("#infra-name")) === "Test infra");
            check("8 framework panels, only POSI visible", (await page.locator(".framework-panel").count()) === 8 && (await page.locator(".framework-panel:visible").count()) === 1 && (await page.locator("#framework-panel-posi:visible").count()) === 1);
            check("sidebar shows POSI's 4 section accordions", (await page.locator("#sidebar-sections details").count()) === 4);
            check("sidebar principles carry status icons", (await page.locator("#sidebar-sections .nav-status-icon").count()) === 23);
            await page.click('#sidebar-sections a[href="#principle-posi-autonomy"]');
            check("sidebar link opens its principle", await page.$eval("#principle-posi-autonomy", (e) => e.open));
            await page.selectOption("#framework-select", "forest");
            check("selecting FOREST shows its panel only", (await page.locator(".framework-panel:visible").count()) === 1 && (await page.locator("#framework-panel-forest:visible").count()) === 1);
            check("sidebar rebuilt for FOREST (6 sections)", (await page.locator("#sidebar-sections details").count()) === 6);
            check("hash follows the selection", (await page.evaluate(() => location.hash)) === "#forest");
            check("option label updates", /\(0\/96 scored\)$/.test(await page.locator('#framework-select option[value="forest"]').innerText()));
            const banner = await page.locator("#framework-panel-forest [role=alert]").first().innerText();
            check("experimental banner", /^Experimental/.test(banner), banner);
            const optionTexts = await page.$$eval("#framework-select option", (os) => os.map((o) => o.textContent));
            check("no 'draft' in the dropdown", !optionTexts.some((t) => /draft/i.test(t)), optionTexts.join("|"));
            check("experimental suffix present", optionTexts.filter((t) => /\(experimental\)/.test(t)).length >= 7, optionTexts.join("|"));
            check("no console or page errors (layout)", errors.length === 0, JSON.stringify(errors));
            await ctx.close();
        }
        {
            const { page, ctx } = await open("index.html#gorc");
            check("#gorc selects GORC", (await page.inputValue("#framework-select")) === "gorc" && (await page.locator("#framework-panel-gorc:visible").count()) === 1);
            await page.evaluate(() => { location.hash = "#fair"; });
            await page.waitForTimeout(200);
            check("hashchange selects FAIR", (await page.inputValue("#framework-select")) === "fair");
            await ctx.close();
        }
        {
            const { page, ctx } = await open("index.html?framework=data/frameworks/cris-tender-v0.1.json#cris-tender");
            await page.waitForTimeout(800);
            check("runtime-loaded framework opens from the hash and lands under Other", (await page.inputValue("#framework-select")) === "cris-tender" && (await page.locator('optgroup[label="Other alignment frameworks"] option[value="cris-tender"]').count()) === 1);
            await ctx.close();
        }
        for (const width of [412, 375, 320]) {
            const { page, ctx } = await open("index.html#forest", width, 800);
            const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
            check("no horizontal overflow at " + width + "px", sw <= iw, sw + "/" + iw);
            await ctx.close();
        }
        {
            // Settings button, the Settings dialog and the badge overlay
            const { page, errors, ctx } = await open("index.html");
            check("Settings button with a cog icon", (await page.locator("#sidebar-footer #settings-btn svg path").evaluate((p) => p.getAttribute("d").length > 400)) && /Settings/.test(await page.locator("#settings-btn").innerText()));
            check("no theme toggle in the sidebar any more", (await page.locator('#sidebar-footer [role="radiogroup"], #sidebar-footer input').count()) === 0);
            await page.locator("#framework-panel-posi details[id^=principle-posi-]").first().locator("summary").click();
            await page.locator("#framework-panel-posi .status-card[data-status='making-progress']").first().click();
            await page.click("#settings-btn");
            check("Settings opens a dialog", await page.$eval("#settings-dialog", (d) => d.open));
            const switches = await page.$$eval('#settings-dialog input[role="switch"]', (els) => els.map((e) => e.closest("label").innerText.trim()));
            check("switches: Show other alignment frameworks, Show badge (experimental)", switches.join("|") === "Show other alignment frameworks|Show badge (experimental)", switches.join("|"));
            check("Start a new alignment sits in Settings", (await page.locator("#settings-dialog .start-new").count()) === 1);
            await page.check("#toggle-badge");
            check("badge switch closes Settings and opens the badge overlay", (await page.$eval("#badge-dialog", (d) => d.open)) && !(await page.$eval("#settings-dialog", (d) => d.open)));
            check("overlay holds the badge and its buttons", (await page.locator("#badge-dialog #badge-preview svg").count()) === 1 && (await page.locator("#badge-dialog button", { hasText: /Download badge \(SVG\)|Download badge \(PNG\)|Embed badge/ }).count()) === 3);
            check("badge shows the score (50%)", /50%/.test(await page.locator("#badge-dialog #badge-preview").innerText()));
            const [download] = await Promise.all([page.waitForEvent("download"), page.click("#badge-dialog >> text=Download badge (SVG)")]);
            check("SVG download works", download.suggestedFilename() === "badge.svg");
            await page.keyboard.press("Escape");
            check("Escape closes the overlay and flips the switch off", await closedAndOff(page, "badge-dialog", "toggle-badge"));
            await page.click("#settings-btn");
            await page.check("#toggle-badge");
            await page.click("#badge-dialog footer >> text=Close");
            check("Close button also flips the switch off", await closedAndOff(page, "badge-dialog", "toggle-badge"));
            check("no console or page errors (badge)", errors.length === 0, JSON.stringify(errors));
            await ctx.close();
        }
        {
            // Show other alignment frameworks: off by default, POSI only
            const { page, errors, ctx } = await open("index.html", 1280, 900, { others: false });
            check("by default only POSI: the framework picker is hidden", await page.locator("#framework-picker").isHidden());
            await page.click("#settings-btn");
            check("the switch is off by default", !(await page.isChecked("#toggle-other-frameworks")));
            await page.check("#toggle-other-frameworks");
            check("switching it on shows the picker", await page.locator("#framework-picker").isVisible());
            check("the choice is stored", JSON.parse(await page.evaluate(() => localStorage.getItem("spii-principles-tool.prefs.v1"))).showOtherFrameworks === true);
            await page.keyboard.press("Escape");
            await page.reload();
            await page.waitForSelector("#app > *");
            check("and survives a reload", await page.locator("#framework-picker").isVisible());
            check("scale button above the principles", (await page.locator("#framework-panel-posi .customize-scale-btn").innerText()).trim() === "Customize and define your own alignment scale");
            check("no console or page errors (other frameworks)", errors.length === 0, JSON.stringify(errors));
            await ctx.close();
            const g = await open("index.html#gorc", 1280, 900, { others: false });
            check("a link to another framework still opens it, with the picker to go back", (await g.page.locator("#framework-panel-gorc:visible").count()) === 1 && (await g.page.locator("#framework-picker").isVisible()));
            await g.ctx.close();
        }
        {
            // Alignment level descriptions above the POSI principles
            const { page, errors, ctx } = await open("index.html");
            const first = page.locator("#principle-posi-coverage");
            await first.locator("summary").click();
            const sw = page.locator("#toggle-descriptions-posi");
            check("switch 'Show alignment level descriptions' sits next to the scale button, off by default", (await sw.count()) === 1 && !(await sw.isChecked()) && /Show alignment level descriptions/.test(await page.locator("#framework-panel-posi .framework-tools").innerText()));
            check("with a work-in-progress note", /Work in progress/.test(await page.locator("#framework-panel-posi .descriptions-note").innerText()));
            check("descriptions hidden while off", (await first.locator(".status-guidance").first().isHidden()) && (await first.locator(".principle-guidance").isHidden()));
            await sw.check();
            const texts = await first.locator(".status-guidance").allInnerTexts();
            check("switched on: a description on each level card", texts.length === 3 && /limited evidence/.test(texts[0]) && /demonstrable evidence/.test(texts[2]), texts.join(" | "));
            check("plus ideas to improve and examples", /Ideas on how to improve adoption/.test(await first.locator(".principle-guidance").innerText()) && /ROR/.test(await first.locator(".principle-guidance").innerText()));
            check("principles without descriptions stay as they were", (await page.locator("#principle-posi-non-discriminatory .status-guidance, #principle-posi-non-discriminatory .principle-guidance").count()) === 0);
            await page.reload();
            await page.waitForSelector("#app > *");
            check("the choice survives a reload", await page.locator("#toggle-descriptions-posi").isChecked());
            // a custom scale switches them off
            await page.click(".framework-panel:not([hidden]) .customize-scale-btn");
            await page.click("#scales-dialog .scale-add, #scales-dialog button:has-text('Add option')");
            await page.locator("#scales-dialog .scale-row").last().locator(".scale-title").fill("Extra");
            page.once("dialog", (d) => d.accept());
            await page.click("#scales-dialog-footer button:has-text('Save')");
            await page.waitForFunction(() => !document.getElementById("scales-dialog").open);
            check("with a custom scale the switch is off and disabled, and says why", (await page.locator("#toggle-descriptions-posi").isDisabled()) && !(await page.locator("#toggle-descriptions-posi").isChecked()) && /your own scale/.test(await page.locator("#framework-panel-posi .descriptions-note").innerText()) && (await page.locator("#framework-panel-posi .status-guidance").count()) === 0);
            check("no console or page errors (descriptions)", errors.length === 0, JSON.stringify(errors));
            await ctx.close();
        }
        {
            // Priority star
            const { page, errors, ctx } = await open("index.html");
            const p = page.locator("#principle-posi-coverage");
            const star = p.locator("summary .priority-star");
            check("each principle has a star, off by default", (await page.locator("#framework-panel-posi .priority-star").count()) === 23 && (await star.getAttribute("aria-pressed")) === "false");
            await star.click();
            check("clicking the star marks it, without opening the accordion", (await star.getAttribute("aria-pressed")) === "true" && !(await p.evaluate((d) => d.open)));
            check("the sidebar shows the star too", await page.locator("#sidebar-sections a.is-priority").count() === 1);
            await page.waitForTimeout(500);
            await page.reload();
            await page.waitForSelector("#app > *");
            check("the star survives a reload", (await page.locator("#principle-posi-coverage .priority-star").getAttribute("aria-pressed")) === "true");
            await page.click('button:has-text("Export")');
            const [download] = await Promise.all([page.waitForEvent("download"), page.click("#export-report-btn")]);
            const exported = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
            check("the exported report carries the star", exported.frameworks.posi.coverage.priority === true);
            check("no console or page errors (star)", errors.length === 0, JSON.stringify(errors));
            await ctx.close();
        }
        {
            // Proof of concept (poc/): loads, examples, overview charts, an infrastructure page
            const { page, errors, ctx } = await open("poc/index.html", 1280, 900, { ready: "#view > *" });
            page.on("dialog", (d) => d.accept());
            check("POC: welcome screen when nothing is saved", (await page.locator(".welcome h1").count()) === 1);
            await page.click("#w-examples");
            await page.waitForSelector("#circle svg");
            check("POC: three examples, the circle, the scatter plot and the table", (await page.locator(".tab").count()) === 5 && (await page.locator("#circle .dot").count()) > 5 && (await page.locator("#scatter .dot").count()) === 3 && (await page.locator("#o-table tbody tr").count()) === 3);
            check("POC: activity icons from the design system on the circle", (await page.locator("#circle g svg").count()) === 12);
            const allDots = await page.locator("#circle .dot").count();
            await page.click('.seg [data-group="admin"]');
            const adminSlices = await page.locator("#circle path[data-activity]").count();
            check("POC: the circle switches to the research-administration activities only", adminSlices === 5 && (await page.locator("#circle .dot").count()) < allDots, adminSlices + " slices");
            await page.click('.seg [data-group="both"]');
            await page.locator(".tab", { hasText: "OpenAIRE" }).click();
            check("POC: infrastructure page with radar and 23 principles", (await page.locator("#i-radar svg").count()) === 1 && (await page.locator(".p-row").count()) === 23);
            await page.locator("#p-coverage .p-title").click();
            check("POC: the rating buttons show the scale icons", (await page.locator("#p-coverage .levels .lvl svg").count()) === 4 && (await page.locator("#p-coverage .levels .lvl").first().innerText()).trim() === "Low");
            check("POC: a principle unfolds its level descriptions", (await page.locator("#p-coverage .rubric > div").count()) === 3 && /demonstrable evidence/.test(await page.locator("#p-coverage .rubric").innerText()));
            // export menu: the options of the current tool, for the open infrastructure
            await page.click("#btn-export");
            check("POC: export menu with GitHub, JSON, print, Word and framework", (await page.locator("#export-menu [data-export]").count()) === 5 && /openaire/i.test(await page.locator("#export-scope").innerText()));
            let dl = page.waitForEvent("download");
            await page.click('#export-menu [data-export="word"]');
            const docx = fs.readFileSync(await (await dl).path());
            check("POC: Word export is a zip with a document", docx[0] === 0x50 && docx[1] === 0x4b && docx.includes(Buffer.from("word/document.xml")));
            await page.click("#btn-export");
            dl = page.waitForEvent("download");
            await page.click('#export-menu [data-export="json"]');
            const ej = JSON.parse(fs.readFileSync(await (await dl).path(), "utf8"));
            check("POC: JSON export of the open infrastructure, answers per framework", ej.infras.length === 1 && Object.keys(ej.infras[0].alignments.posi || {}).length > 0);
            // import dialog with drag and drop
            await page.click("#btn-import");
            check("POC: import opens a dialog with a drop zone", (await page.$eval("#dlg-import", (d) => d.open)) && (await page.locator("#drop input[type=file]").count()) === 1);
            await page.setInputFiles("#drop-input", { name: "r.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(ej)) });
            await page.waitForFunction(() => !document.querySelector("#dlg-import").open);
            check("POC: importing the file adds an infrastructure", (await page.locator(".tab").count()) === 6);
            // framework catalogue and editor
            await page.locator(".tab", { hasText: "OpenAIRE" }).first().click();
            await page.click("#btn-framework");
            const opts = await page.locator("#fw-select option").evaluateAll((os) => os.map((o) => o.value));
            check("POC: catalogue lists the frameworks, approved first, POSI selected", opts.length >= 8 && opts[0] === "posi" && (await page.$eval("#fw-select", (s) => s.value)) === "posi", opts.join());
            check("POC: id, title, short name and approved are editable", (await page.locator('#fw-body [data-top="id"]').count()) === 1 && (await page.locator('#fw-body [data-top="shortName"]').count()) === 1 && (await page.locator('#fw-body [data-top="approved"]').isChecked()));
            check("POC: scale and sections are closed accordions, with a warning", !(await page.$eval("#acc-scale", (d) => d.open)) && !(await page.$eval("#acc-sections", (d) => d.open)) && (await page.locator("#acc-scale .warn").count()) === 1);
            await page.click("#acc-scale summary");
            check("POC: the scale editor has 3 levels with icon, colour and title", (await page.locator(".lvl-row").count()) === 3 && (await page.locator('.lvl-row input[type="color"]').count()) === 3);
            await page.locator('.lvl-row [data-f="label"]').nth(2).fill("Fully aligned");
            await page.click("#acc-sections summary");
            await page.locator("details.sec-ed summary").first().click();
            await page.locator("details.sec-ed").first().locator(".pr-ed").first().waitFor();
            const before = await page.locator("details.sec-ed").first().locator(".pr-ed").count();
            await page.locator("details.sec-ed").first().locator("[data-padd]").click();
            check("POC: a principle can be added to a section", (await page.locator("details.sec-ed").first().locator(".pr-ed").count()) === before + 1, before + " -> " + (await page.locator("details.sec-ed").first().locator(".pr-ed").count()) + " open " + (await page.$eval("details.sec-ed", (d) => d.open)));
            await page.locator("details.sec-ed").first().locator(".pr-ed").last().locator('[data-p="title"]').fill("Test principle");
            await page.click("#fw-save");
            check("POC: Save and use applies the edited framework", !(await page.$eval("#dlg-framework", (d) => d.open)) && (await page.locator(".p-row").count()) === 24 && /Fully aligned/.test(await page.locator(".p-row").first().innerText()));
            await page.click("#btn-framework");
            await page.selectOption("#fw-select", "gorc");
            await page.click("#fw-save");
            check("POC: switching to another framework from the catalogue", (await page.locator(".p-row").count()) > 0 && (await page.locator(".p-row").count()) !== 24);
            await page.click("#btn-framework");
            await page.selectOption("#fw-select", "posi");
            await page.click("#fw-reset");
            await page.click("#fw-save");
            check("POC: reset brings back the original POSI", (await page.locator(".p-row").count()) === 23);
            check("no console or page errors (POC)", errors.length === 0, JSON.stringify(errors));
            await ctx.close();
        }
        {
            // Customize scales
            const { page, errors, ctx } = await open("index.html");
            const rows = () => page.locator("#scales-dialog .scale-row");
            const cards = () => page.locator("#framework-panel-posi details[id^=principle-posi-]").first().locator(".status-card");
            await page.click(".framework-panel:not([hidden]) .customize-scale-btn");
            check("switch opens the scales dialog with POSI's 3 options", (await page.$eval("#scales-dialog", (d) => d.open)) && (await rows().count()) === 3);
            check("rows run worst to best", (await rows().locator(".scale-title").evaluateAll((els) => els.map((e) => e.value))).join() === "Low adoption,Making progress,High adoption");
            const row0 = rows().first();
            check("a row has icon, colour, title, description, counts, move and remove controls", (await row0.locator("select.scale-icon option").count()) === 14 && (await row0.locator('input[type="color"]').count()) === 1 && (await row0.locator("input.scale-description").count()) === 1 && (await row0.locator("input.scale-counts").isChecked()) && (await row0.locator(".scale-up, .scale-down, .scale-remove").count()) === 3);
            check("footer: Save, Cancel and a labelled reset icon button", (await page.locator('#scales-dialog-footer button[aria-label="Reset to the default scale"]').count()) === 1 && (await page.locator("#scales-dialog-footer >> text=Save").count()) === 1 && (await page.locator("#scales-dialog-footer >> text=Cancel").count()) === 1);
            // an empty title is refused
            await page.click("#scales-dialog >> text=Add option");
            check("add option gives a 4th row", (await rows().count()) === 4);
            await page.click("#scales-dialog-footer >> text=Save");
            check("an empty title keeps the dialog open with a message", (await page.$eval("#scales-dialog", (d) => d.open)) && /title/i.test(await page.locator("#scales-dialog [role=alert]").innerText()));
            const last = rows().nth(3);
            await last.locator(".scale-title").fill("Not applicable");
            await last.locator("select.scale-icon").selectOption("question");
            await last.locator("input.scale-counts").uncheck();
            await last.locator(".scale-description").fill("Does not apply to us");
            await page.click("#scales-dialog-footer >> text=Save");
            check("Save closes the dialog", await closed(page, "scales-dialog"));
            await page.locator("#framework-panel-posi details[id^=principle-posi-]").first().locator("summary").click();
            check("POSI now has 4 cards, the last one is Not applicable", (await cards().count()) === 4 && (await cards().nth(3).locator(".status-label").innerText()) === "Not applicable");
            check("the generic description shows on the card", /Does not apply to us/.test(await cards().nth(3).innerText()));
            check("the question-mark icon is used", (await cards().nth(3).locator(".status-icon svg text").textContent()) === "?");
            await cards().nth(2).click();
            const second = page.locator("#framework-panel-posi details[id^=principle-posi-]").nth(1);
            await second.locator("summary").click();
            await second.locator('.status-card[data-status^="level-"]').click();
            const heading = (await page.locator('[id^="summary-heading-posi"]').first().innerText()).trim();
            check("Not applicable is not part of the average", heading === "Alignment summary: 100%", heading);
            check("both answers count as scored", /\(2\/23 scored\)$/.test(await page.locator('#framework-select option[value="posi"]').innerText()));
            // persistence
            await page.reload();
            await page.waitForSelector("#framework-panel-posi");
            check("the scale survives a reload (localStorage)", (await page.locator("#framework-panel-posi details[id^=principle-posi-]").first().locator(".status-card").count()) === 4);
            // answers are saved in the browser, so they are still there after the reload
            // export
            await page.click('button:has-text("Export")');
            const [download] = await Promise.all([page.waitForEvent("download"), page.click("#export-report-btn")]);
            const exported = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
            check("the exported report carries the scale", Array.isArray(exported.scales && exported.scales.posi) && exported.scales.posi.length === 4 && exported.scales.posi[3].excludeFromScore === true);
            // reset: dismiss first, then accept
            await page.click(".framework-panel:not([hidden]) .customize-scale-btn");
            check("reopened with the custom scale (4 rows)", (await rows().count()) === 4);
            let confirms = 0;
            page.once("dialog", (d) => { confirms++; d.dismiss(); });
            await page.click('#scales-dialog-footer button[aria-label="Reset to the default scale"]');
            check("reset asks before clearing answers; Cancel keeps the scale", confirms === 1 && (await page.$eval("#scales-dialog", (d) => d.open)));
            page.once("dialog", (d) => { confirms++; d.accept(); });
            await page.click('#scales-dialog-footer button[aria-label="Reset to the default scale"]');
            await page.waitForFunction(() => !document.getElementById("scales-dialog").open);
            check("reset restores the default cards (3 + Not applicable)", (await cards().count()) === 4);
            check("reset removes the saved scale", (await page.evaluate(() => localStorage.getItem("spii-principles-tool.scales.v1"))) === null);
            check("the answer on a removed option is cleared, the others stay", /\(1\/23 scored\)$/.test(await page.locator('#framework-select option[value="posi"]').innerText()));
            check("no console or page errors (scales)", errors.length === 0, JSON.stringify(errors));
            await ctx.close();
        }
        {
            // Reordering, legacy frameworks, scoring frameworks, mobile
            const { page, ctx } = await open("index.html#gorc");
            const rows = () => page.locator("#scales-dialog .scale-row");
            await page.click(".framework-panel:not([hidden]) .customize-scale-btn");
            check("legacy framework lists worst to best", (await rows().locator(".scale-title").evaluateAll((els) => els.map((e) => e.value))).join() === "Not compliant,Making progress,Compliant");
            await rows().first().locator(".scale-down").click();
            check("move down reorders the rows", (await rows().locator(".scale-title").evaluateAll((els) => els.map((e) => e.value))).join() === "Making progress,Not compliant,Compliant");
            await rows().nth(1).locator(".scale-remove").click();
            check("remove drops a row, at least 2 remain", (await rows().count()) === 2 && (await rows().locator(".scale-remove:disabled").count()) === 2);
            await page.click("#scales-dialog-footer >> text=Save");
            await page.locator("#framework-panel-gorc details[id^=principle-gorc-]").first().locator("summary").click();
            const labels = await page.locator("#framework-panel-gorc details[id^=principle-gorc-]").first().locator(".status-label").allInnerTexts();
            check("saved legacy scale: cards follow the new order", labels.join() === "Making progress,Compliant,Not applicable", labels.join());
            await ctx.close();
        }
        {
            const { page, ctx } = await open("index.html?framework=data/frameworks/cris-tender-v0.1.json#cris-tender");
            await page.waitForTimeout(800);
            check("scales cannot be customised for points-based frameworks", await page.$eval("#framework-panel-cris-tender .customize-scale-btn", (e) => e.disabled));
            await ctx.close();
        }
        {
            const { page, ctx } = await open("index.html", 375, 800);
            await page.click(".framework-panel:not([hidden]) .customize-scale-btn");
            const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
            const fits = await page.$eval("#scales-dialog", (d) => d.getBoundingClientRect().right <= window.innerWidth + 1 && d.scrollWidth <= d.clientWidth + 1);
            check("scales dialog fits a 375px phone", sw <= iw && fits, sw + "/" + iw);
            await page.keyboard.press("Escape");
            check("Escape closes the scales dialog", await closed(page, "scales-dialog"));
            await ctx.close();
        }
        {
            // Every framework opens without errors; example reports load on the new POSI scale
            const { page, errors, ctx } = await open("index.html");
            const values = await page.$$eval("#framework-select option", (os) => os.map((o) => o.value));
            for (const v of values) {
                await page.selectOption("#framework-select", v);
                const ok = (await page.locator(".framework-panel:visible").count()) === 1 && (await page.locator("#sidebar-sections details").count()) > 0;
                if (!ok) check("framework " + v + " opens", false);
            }
            check("all " + values.length + " frameworks open", true);
            check("no console or page errors across frameworks", errors.length === 0, JSON.stringify(errors));
            await ctx.close();
            const ex = await open("index.html?report=data/examples/openaire-posi-assessment-report-2026.json#posi");
            await ex.page.waitForTimeout(800);
            const opt = await ex.page.locator('#framework-select option[value="posi"]').innerText();
            check("OpenAIRE example loads its POSI scores", /\(20\/23 scored\)$/.test(opt) || /\(19\/23 scored\)$/.test(opt), opt);
            check("example report shows no console errors", ex.errors.length === 0, JSON.stringify(ex.errors));
            await ex.ctx.close();
        }
        {
            // Classify: heading, stable stored values, cog icon
            const { page, errors, ctx } = await open("index.html");
            const headings = await page.locator("#infra-description-section h4").allInnerTexts();
            check("Classify headings", headings.includes("Research life cycle activities") && headings.includes("Research administrative activities") && !headings.some((h) => /related/i.test(h)), headings.join("|"));
            check("checkbox values keep the stored key", (await page.locator('input[value="Research related activities > Manage & Organise"]').count()) === 1);
            check("an old saved selection still counts", await page.evaluate(() => { state.activities = ["Research related activities > Manage & Organise"]; return selected_activity_items(state).join() === "Manage & Organise"; }));
            const process = page.locator('label:has(input[value="Research life cycle activities > Process"]) svg');
            check("Process icon is a cog", (await process.locator("path").first().getAttribute("d")).startsWith("M19.4 15") || (await process.innerHTML()).includes("M19.4 15"));
            check("no console or page errors (classify)", errors.length === 0, JSON.stringify(errors));
            await ctx.close();
        }
        {
            const { page, errors, ctx } = await open("index.html");
            const items = await page.$$eval("nav[data-topnav] > button, nav[data-topnav] > a", (els) => els.map((e) => e.textContent.trim()).filter((t) => /^(About|Changelog|Feedback)$/.test(t)));
            check("top menu: About, Changelog (Feedback moved to the floating button)", items.join() === "About,Changelog", items.join());
            check("the tool's logo is its 1B hexagon from the design system", (await page.getAttribute("nav[data-topnav] > img.tool-logo", "src")) === "https://surf-ori.github.io/spii-design-system/assets/hex/1b.svg" && (await page.locator("nav[data-topnav] > svg").count()) === 0);
            if (HAVE_DS) {
                const fb = page.locator("#spii-feedback");
                check("floating Feedback button at the bottom right", await fb.locator(".fab").evaluate((b) => { const r = b.getBoundingClientRect(); return getComputedStyle(b).position === "fixed" && r.right > window.innerWidth - 40 && r.bottom > window.innerHeight - 40; }));
                await page.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); }; });
                await fb.locator(".fab").click();
                await fb.locator("#fb-text").fill("Great tool");
                await fb.locator("#fb-gh").click();
                const url = new URL((await page.evaluate(() => window.__opened[0])) || "http://x/");
                check("it opens this repo's feedback form with the text in 'Anything else?'", url.pathname === "/surf-ori/spii-1b-principles-alignment-tool/issues/new" && url.searchParams.get("template") === "feedback.yml" && /^Great tool/.test(url.searchParams.get("other") || ""), url.href);
            }
            check("no console or page errors (menu)", errors.length === 0, JSON.stringify(errors));
            await ctx.close();
            for (const width of [412, 375, 320]) {
                const m = await open("index.html", width, 800);
                const [sw, iw] = await m.page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
                check("no horizontal overflow at " + width + "px (menu)", sw <= iw, sw + "/" + iw);
                await m.ctx.close();
            }
        }
        {
            // Theme: the choice lives in the shared SPII top bar
            const bg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
            const theme = (page) => page.evaluate(() => document.documentElement.dataset.theme);
            if (HAVE_DS) {
                const { page, ctx, errors } = await open("index.html", 1280, 900, { scheme: "dark" });
                const links = await page.$$eval(".spii-topbar__nav a", (as) => as.map((a) => a.textContent.trim()));
                check("SPII top bar: Overview and the six deliverables", links.length === 7 && links[0] === "Overview" && links[2] === "1BAlignment", links.join("|"));
                check("no old back bar", (await page.locator(".back-bar").count()) === 0);
                check("System follows a dark OS", (await theme(page)) === "dark" && (await bg(page)) === "rgb(16, 20, 15)");
                await page.click("#spii-theme-btn");
                check("top-bar theme button: System -> Light overrides a dark OS", (await theme(page)) === "light" && (await bg(page)) === "rgb(246, 244, 236)");
                check("the choice is stored for all SPII sites", (await page.evaluate(() => localStorage.getItem("spii-theme"))) === "light");
                // colors that are set per answer follow the theme without a re-render
                await page.locator("#framework-panel-posi details[id^=principle-posi-]").first().locator("summary").click();
                const card = page.locator("#framework-panel-posi details[id^=principle-posi-]").first().locator('.status-card[data-status="high-adoption"]');
                await card.click();
                const accent = () => card.evaluate((el) => getComputedStyle(el).getPropertyValue("--status-accent").trim());
                const lightAccent = await accent();
                await page.click("#spii-theme-btn");
                const darkAccent = await accent();
                check("answer colors follow the theme (#1f5c43 light, #59b98a dark)", lightAccent === "#1f5c43" && darkAccent === "#59b98a", lightAccent + " / " + darkAccent);
                await page.reload();
                await page.waitForSelector("#app > *");
                check("the choice survives a reload", (await theme(page)) === "dark");
                await page.click("#spii-theme-btn");
                await page.emulateMedia({ colorScheme: "light" });
                await page.waitForTimeout(100);
                check("System follows the OS live", (await theme(page)) === "light");
                const shell = await page.$eval("#app-shell", (e) => e.getBoundingClientRect().bottom <= window.innerHeight + 1);
                check("the app shell fits under the top bar (Settings stays in view)", shell && (await page.locator("#settings-btn").isVisible()));
                check("no page errors (theme)", errors.length === 0, errors.join("|"));
                await ctx.close();
                const old = await open("index.html", 1280, 900, { scheme: "light" });
                await old.page.evaluate(() => localStorage.setItem("spii-principles-tool.theme", "dark"));
                await old.page.reload();
                await old.page.waitForSelector("#app > *");
                check("an older choice made in this tool moves to the SPII top bar", (await theme(old.page)) === "dark" && (await old.page.evaluate(() => localStorage.getItem("spii-theme"))) === "dark");
                await old.ctx.close();
                const mobile = await open("index.html", 320, 800, { scheme: "dark" });
                const [sw, iw] = await mobile.page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
                check("top bar fits at 320px", sw <= iw && (await mobile.page.locator("#spii-theme-btn").isVisible()), sw + "/" + iw);
                await mobile.ctx.close();
            } else {
                console.log("SKIP  SPII top bar tests: no design system clone at " + DS_DIR);
            }
            const bare = await open("index.html", 1280, 900, { ds: false, scheme: "dark" });
            check("without the design system the page still works and follows the OS theme", (await theme(bare.page)) === "dark" && bare.errors.length === 0 && (await bare.page.locator(".spii-topbar").count()) === 0, bare.errors.join("|"));
            await bare.ctx.close();
        }
        {
            // Not applicable, the short printed report, copy changes
            const { page, errors, ctx } = await open("index.html");
            check("no external PDF scripts any more", (await page.locator('script[src*="jspdf"], script[src*="html2canvas"]').count()) === 0);
            const intro = await page.locator("#intro-section").innerText();
            check("short intro pointing to the About", /^Self-assess how your Open Science infrastructure puts open science values and principles into practice\. For examples, read the About\./.test(intro), intro);
            await page.click('#intro-section a:has-text("About")');
            check("the About link opens the About dialog", await page.$eval("#about-dialog", (d) => d.open));
            await page.keyboard.press("Escape");
            check("infra accordion title says what it is for", /Fill in some basic details about the Open Science infrastructure this alignment is for\./.test(await page.locator("#infra-description-section > summary").innerText()));
            check("new Classify sentence", /Tell us what activities this infrastructure fits in the research activities landscape:/.test(await page.locator("#infra-description-section").innerText()));
            const first = page.locator("#framework-panel-posi details[id^=principle-posi-]").first();
            await first.locator("summary").click();
            const labels = await first.locator(".status-label").allInnerTexts();
            check("POSI cards end with Not applicable", labels.join() === "Low adoption,Making progress,High adoption,Not applicable", labels.join());
            await first.locator('.status-card[data-status="not-applicable"]').click();
            const second = page.locator("#framework-panel-posi details[id^=principle-posi-]").nth(1);
            await second.locator("summary").click();
            await second.locator('.status-card[data-status="making-progress"]').click();
            const heading = (await page.locator('[id^="summary-heading-posi"]').first().innerText()).trim();
            check("N/A does not pull the score down", heading === "Alignment summary: 50%", heading);
            await page.selectOption("#framework-select", "gorc");
            const g = page.locator("#framework-panel-gorc details[id^=principle-gorc-]").first();
            await g.locator("summary").click();
            check("legacy frameworks have Not applicable too", (await g.locator(".status-label").allInnerTexts()).join() === "Compliant,Making progress,Not compliant,Not applicable");
            await page.selectOption("#framework-select", "posi");
            // answer all of POSI, with notes, then print
            await page.evaluate(() => {
                const posi = all_frameworks().find((f) => f.id === "posi");
                posi.sections.flatMap((s) => s.principles).forEach((p, i) => {
                    state.frameworks.posi[p.id].status = ["low-adoption", "making-progress", "high-adoption", "not-applicable"][i % 4];
                    state.frameworks.posi[p.id].notes = "A short explanation of why we chose this answer for this principle, two lines at most.";
                });
                window.__printed = 0;
                window.print = () => { window.__printed++; };
            });
            await page.click('button:has-text("Export")');
            await page.click("#print-report-btn");
            check("Export → Print report fills the report and opens the print dialog", (await page.evaluate(() => window.__printed)) === 1 && (await page.locator("#print-report h2").count()) === 1);
            await page.emulateMedia({ media: "print" });
            check("printing shows only the report", (await page.locator("#print-report").isVisible()) && !(await page.locator("#app-shell").isVisible()) && !(await page.locator(".back-bar").isVisible()));
            const pdf = await page.pdf({ format: "A4" });
            const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
            check("a fully answered POSI report fits in at most 5 A4 pages", pages >= 1 && pages <= 5, pages + " pages");
            await page.emulateMedia({ media: "screen" });
            check("the menu item says what it does", /Print report \/ save as PDF/.test(await page.locator("#print-report-btn").innerText()));
            check("no console or page errors (N/A, report)", errors.length === 0, JSON.stringify(errors));
            await ctx.close();
        }
        {
            // Import/Export menus: icons, reports first, frameworks after a separator
            const { page, errors, ctx } = await open("index.html");
            const menu = (id) => page.$$eval("#" + id + " > *", (els) => els.map((e) => e.getAttribute("role") === "separator" ? "---" : e.querySelector(".menuitem-title").textContent.trim()));
            const exp = await menu("export-menu");
            check("Export: GitHub tracker on top, frameworks last after a separator", exp.join("|") === "Save Report to GitHub Tracker|Save alignment to a file (JSON)|Print report / save as PDF|Save to Word (.docx)|---|Download Alignment Framework (JSON)", exp.join("|"));
            const imp = await menu("import-menu");
            check("Import: report first, frameworks after a separator", imp.join("|") === "Import Alignment Report (JSON)|---|Import Alignment Framework (JSON)|Download Alignment Framework Template (JSON)", imp.join("|"));
            check("every menu item has an icon", (await page.locator('[role="menuitem"]').count()) === 8 && (await page.locator('[role="menuitem"] > svg.menuitem-icon').count()) === 8);
            check("the frameworks item explains save, edit, import again", /edit/i.test(await page.locator("#download-frameworks-btn .menuitem-desc").textContent()) && /import/i.test(await page.locator("#download-frameworks-btn .menuitem-desc").textContent()));
            await page.click('button:has-text("Export")');
            const box = await page.$eval("#export-menu", (m) => { const r = m.getBoundingClientRect(); return r.right <= window.innerWidth + 1; });
            check("Export menu fits in the window", box);
            check("no console or page errors (menus)", errors.length === 0, JSON.stringify(errors));
            await ctx.close();
        }
        {
            // Export downloads: names and content
            const { page, errors, ctx } = await open("index.html");
            await page.fill("#infra-name", "OpenAIRE");
            await page.fill("#infra-assessed-on", "2026-11-09");
            const dl = async (id) => {
                await page.click('button:has-text("Export")');
                const [d] = await Promise.all([page.waitForEvent("download"), page.click("#" + id)]);
                return { name: d.suggestedFilename(), json: JSON.parse(fs.readFileSync(await d.path(), "utf8")) };
            };
            const rep = await dl("export-report-btn");
            check("report download name", rep.name === "2026-11-09-posi-v2-0-openaire.json", rep.name);
            await page.click('button:has-text("Export")');
            const [word] = await Promise.all([page.waitForEvent("download"), page.click("#word-report-btn")]);
            const wordBytes = fs.readFileSync(await word.path());
            check("Save to Word downloads a .docx (a zip)", word.suggestedFilename() === "2026-11-09-alignment-report-openaire.docx" && wordBytes.subarray(0, 2).toString() === "PK", word.suggestedFilename());
            check("report download: selected framework only, with readme", Object.keys(rep.json.frameworks).join() === "posi" && typeof rep.json._readme === "string");
            const fw = await dl("download-frameworks-btn");
            const today = await page.evaluate(() => today_iso_date());
            check("framework download name", fw.name === today + "-posi-v2-0-framework.json", fw.name);
            check("framework download: the selected framework only", !Array.isArray(fw.json) && fw.json.id === "posi" && typeof fw.json._readme === "string");
            check("menu says it is the selected framework", /selected framework/i.test(await page.locator("#download-frameworks-btn").innerText()) && /selected framework/i.test(await page.locator("#export-report-btn").innerText()));
            check("no console or page errors (downloads)", errors.length === 0, JSON.stringify(errors));
            await ctx.close();
        }
        {
            // Ben: HTML from a framework file cannot run script
            const evil = {
                id: "import-alert-repro", title: "Import alert reproduction", shortName: "<img src=x onerror=window.__x=3>",
                aboutHtml: "<img src=\"/missing-review-image.png\" onerror=\"window.__x=1\"><p>Kept <strong>bold</strong> <a href=\"javascript:window.__x=4\">bad link</a> <a href=\"https://example.org\" onclick=\"window.__x=5\">good link</a></p><script>window.__x=6<\/script>",
                intro: { title: "Intro", html: "<p onmouseover=\"window.__x=2\">Intro text</p><svg onload=\"window.__x=7\"></svg>" },
                levels: [{ id: "a", label: "A", color: "red\" onload=\"window.__x=8" }, { id: "b", label: "B" }],
                sections: [{ section: "S", sourceUrl: "javascript:window.__x=9", principles: [{ id: "p", title: "P", text: "T" }] }],
            };
            const { page, errors, ctx } = await open("index.html");
            await page.evaluate((fw) => { import_custom_frameworks([fw]); }, evil);
            await page.selectOption("#framework-select", "import-alert-repro");
            const panel = page.locator("#framework-panel-import-alert-repro");
            await page.evaluate(() => document.querySelectorAll("#framework-panel-import-alert-repro details").forEach((d) => { d.open = true; }));
            await panel.locator("p:has-text('Intro text')").hover();
            await page.locator("#framework-panel-import-alert-repro .status-card").first().click({ trial: false }).catch(() => {});
            await page.waitForTimeout(300);
            check("no script from an imported framework ran", (await page.evaluate(() => window.__x)) === undefined, String(await page.evaluate(() => window.__x)));
            const aboutHtml = await panel.locator("section > details").nth(1).evaluate((d) => [...d.children].filter((c) => c.tagName !== "SUMMARY").map((c) => c.outerHTML).join(""));
            check("unsafe markup is removed, simple formatting kept", !/\son\w+=|<script|<img|<svg|href="javascript/i.test(aboutHtml + await panel.locator("section > details").first().evaluate((d) => [...d.children].filter((c) => c.tagName !== "SUMMARY").map((c) => c.outerHTML).join(""))) && /<strong>bold<\/strong>/.test(aboutHtml) && /href="https:\/\/example.org"/.test(aboutHtml), aboutHtml);
            check("the short name is shown as text", (await panel.locator("section > details").nth(1).locator("summary").innerText()).includes("<img src=x"));
            check("a non-http source is not a link", (await panel.locator('a[href^="javascript"]').count()) === 0);
            check("no console or page errors (sanitizer)", errors.filter((e) => !/missing-review-image/.test(e)).length === 0, JSON.stringify(errors));
            await ctx.close();
        }
        {
            // built-in frameworks look the same after sanitizing
            const { page, ctx } = await open("index.html");
            const same = await page.evaluate(() => FRAMEWORKS.every((f) => {
                const tmp = document.createElement("div");
                tmp.appendChild(sanitized_fragment(f.aboutHtml));
                const raw = document.createElement("div");
                raw.innerHTML = f.aboutHtml;
                return tmp.textContent === raw.textContent && tmp.querySelectorAll("a, strong, em, p").length === raw.querySelectorAll("a, strong, em, p").length;
            }));
            check("built-in About texts are unchanged by the sanitizer", same);
            await ctx.close();
        }
        {
            // Nida: dropdown, score chart, embed, autosave
            const { page, errors, ctx } = await open("index.html");
            const groups = await page.$$eval("#framework-select optgroup", (gs) => gs.map((g) => g.label + ":" + [...g.querySelectorAll("option")].map((o) => o.value).join(",")));
            check("dropdown: Default (POSI) and Other alignment frameworks without the SPII frameworks", groups.join("|") === "Default:posi|Other alignment frameworks:gorc,fair,bd,osr,7gpri,care,forest", groups.join("|"));
            const first = page.locator("#framework-panel-posi details[id^=principle-posi-]").first();
            await first.locator("summary").click();
            await first.locator('.status-card[data-status="high-adoption"]').click();
            check("summary heading: Self-assessment score", (await page.locator("#summary-heading-posi").innerText()).trim() === "Alignment summary: 100%");
            check("the score is explained on the page", /from Low adoption \(0%\) to High adoption \(100%\)/.test(await page.locator("#framework-panel-posi .summary-explanation").innerText()));
            const chart = page.locator("#summary-chart-posi");
            check("chart: one bar per section with a legend", (await chart.innerText()).includes("Governance") && (await chart.innerText()).includes("Not answered") && (await chart.innerText()).includes("Complementary Principles"));
            check("relative is the default", (await page.locator('#framework-panel-posi .chart-mode[data-mode="relative"]').getAttribute("aria-pressed")) === "true");
            const width = () => chart.locator('span[title^="High adoption"]').first().evaluate((el) => el.style.width);
            const rel = await width();
            await page.click('#framework-panel-posi .chart-mode[data-mode="absolute"]');
            const abs = await width();
            check("switching to absolute changes the bars", rel === "14.29%" && abs === "12.5%" && (await page.locator('#framework-panel-posi .chart-mode[data-mode="absolute"]').getAttribute("aria-pressed")) === "true", rel + " / " + abs);
            await page.click('#framework-panel-posi .chart-mode[data-mode="relative"]');
            await page.click("#framework-panel-posi .chart-embed");
            const code = await page.inputValue("#embed-code");
            check("embed dialog gives a self-contained snippet", (await page.$eval("#embed-dialog", (d) => d.open)) && code.startsWith("<div") && code.includes("Alignment summary: 100%") && code.includes("spii-1b-principles-alignment-tool"));
            await page.keyboard.press("Escape");
            check("badge is titled self-assessment score", (await page.evaluate(() => build_badge_svg_markup(state))).includes("POSI alignment summary"));
            // autosave
            await page.fill("#infra-name", "Saved Repo");
            await page.waitForTimeout(500);
            await page.reload();
            await page.waitForSelector("#app > *");
            check("answers and description survive a reload", (await page.inputValue("#infra-name")) === "Saved Repo" && (await page.locator("#summary-heading-posi").innerText()).trim() === "Alignment summary: 100%");
                        await page.click("#settings-btn");
            check("the saving is explained in Settings", /saved automatically in this browser/.test(await page.locator("#settings-dialog .saved-note").innerText()));
            page.once("dialog", (d) => d.accept());
            await page.click("#settings-dialog .start-new");
            await page.waitForTimeout(400);
            await page.reload();
            await page.waitForSelector("#app > *");
            check("Start a new alignment clears it", (await page.inputValue("#infra-name")) === "" && /\(0\/23 scored\)$/.test(await page.locator('#framework-select option[value="posi"]').innerText()));
            check("Export menu: Save alignment to a file", /Save alignment to a file \(JSON\)/.test(await page.locator("#export-report-btn").innerText()));
            check("no console or page errors (Nida)", errors.length === 0, JSON.stringify(errors));
            await ctx.close();
        }
    } finally {
        await browser.close();
        server.close();
    }
}
