// Browser tests for test-app.mjs --ui. Serves the repo over http and drives Chromium via Playwright.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const MIME = { ".html": "text/html", ".json": "application/json", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };

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

    // Opens the page in a fresh context (fresh localStorage); returns { page, errors, ctx }.
    async function open(url = "index.html", width = 1280, height = 900) {
        const ctx = await browser.newContext({ viewport: { width, height }, acceptDownloads: true });
        const page = await ctx.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
        page.on("console", (m) => { if (m.type() === "error" && !ignorable(m.text())) errors.push("console: " + m.text()); });
        await page.route(/unpkg\.com|html2canvas/, (r) => r.abort());
        await page.goto(base + url, { waitUntil: "load" });
        await page.waitForSelector("#app > *");
        return { page, errors, ctx };
    }

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
            check("POSI cards: Low adoption / Making progress / High adoption", labels.join() === "Low adoption,Making progress,High adoption", labels.join());
            const detailsTitles = await panel.locator("#framework-posi > details > summary").allInnerTexts();
            check("intro accordion sits above About POSI", detailsTitles[0] === "Introduction to Strategic Plan on Integrated Infrastructure" && detailsTitles[1] === "About POSI", detailsTitles.join("|"));
            check("About POSI has no approved paragraph", !/Approved assessment framework/.test(await panel.locator("#framework-posi > details").nth(1).innerText()));
            check("23 principle accordions", (await panel.locator('details[id^="principle-posi-"]').count()) === 23);
            const aut = panel.locator("#principle-posi-autonomy");
            await aut.locator("summary").click();
            check("Autonomy text links to the DAAF", (await aut.locator('a[href="https://utrechtuniversity.github.io/digital-autonomy-assessment-tool/"]').count()) === 2);
            check("cards show the criteria from SPII v0.1", /Data, infrastructure control, and critical decisions remain/.test(await aut.innerText()));
            await first.locator('.status-card[data-status="high-adoption"]').click();
            const heading = (await panel.locator('[id^="summary-heading-posi"]').first().innerText()).trim();
            check("one High adoption answer gives 100% average score", heading === "Overall: 100% average score", heading);
            check("the status chip colours follow the level", (await first.locator('.status-card[data-status="high-adoption"]').evaluate((el) => getComputedStyle(el).getPropertyValue("--status-accent"))).trim() !== "");
            check("no console or page errors (POSI)", errors.length === 0, JSON.stringify(errors));
            await ctx.close();
        }
        {
            // Layout: intro, infrastructure accordion, selected framework; dropdown + sidebar accordions
            const { page, errors, ctx } = await open("index.html");
            check("no tab strip", (await page.locator('[role="tab"], [role="tablist"]').count()) === 0);
            const groups = await page.$$eval("#framework-select optgroup", (gs) => gs.map((g) => [g.label, [...g.querySelectorAll("option")].map((o) => o.value)]));
            check("dropdown groups: Approved / Other assessments", groups.length === 2 && groups[0][0] === "Approved" && groups[0][1].join() === "posi" && groups[1][0] === "Other assessments", JSON.stringify(groups));
            check("other assessments order, SPII frameworks last", groups[1] && groups[1][1].join() === "gorc,fair,bd,osr,7gpri,care,forest,spii,spii-alignment,posi-spii", groups[1] && groups[1][1].join());
            check("POSI is selected by default", (await page.inputValue("#framework-select")) === "posi");
            check("option label shows the scored count", /^POSI v2\.0 Assessment \(0\/23 scored\)$/.test(await page.locator('#framework-select option[value="posi"]').innerText()));
            const order = await page.$$eval("#app > *", (els) => els.map((e) => e.id || e.tagName.toLowerCase()));
            check("main page: intro, infra description, selected framework", order.join() === "intro-section,infra-description-section,framework-section", order.join());
            check("infra description is a closed accordion", await page.$eval("#infra-description-section", (e) => e.tagName === "DETAILS" && !e.open));
            await page.click("#infra-description-section > summary");
            await page.fill("#infra-name", "Test infra");
            check("infra description fields work", (await page.inputValue("#infra-name")) === "Test infra");
            check("11 framework panels, only POSI visible", (await page.locator(".framework-panel").count()) === 11 && (await page.locator(".framework-panel:visible").count()) === 1 && (await page.locator("#framework-panel-posi:visible").count()) === 1);
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
            check("experimental suffix present", optionTexts.filter((t) => /\(experimental\)/.test(t)).length >= 8, optionTexts.join("|"));
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
            check("runtime-loaded framework opens from the hash and lands under Other", (await page.inputValue("#framework-select")) === "cris-tender" && (await page.locator('optgroup[label="Other assessments"] option[value="cris-tender"]').count()) === 1);
            await ctx.close();
        }
        for (const width of [412, 375, 320]) {
            const { page, ctx } = await open("index.html#forest", width, 800);
            const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
            check("no horizontal overflow at " + width + "px", sw <= iw, sw + "/" + iw);
            await ctx.close();
        }
        {
            // Settings footer and the badge overlay
            const { page, errors, ctx } = await open("index.html");
            check("Settings heading with an icon", (await page.locator("#sidebar-footer .settings-heading svg").count()) === 1 && /Settings/.test(await page.locator("#sidebar-footer .settings-heading").innerText()));
            const switches = await page.$$eval('#sidebar-footer input[role="switch"]', (els) => els.map((e) => e.closest("label").innerText.trim()));
            check("two switches: Customize scales, Show badge (experimental)", switches.join("|") === "Customize scales|Show badge (experimental)", switches.join("|"));
            check("no sidebar badge accordion", (await page.locator("#sidebar-footer details, #sidebar-footer summary").count()) === 0);
            await page.locator("#framework-panel-posi details[id^=principle-posi-]").first().locator("summary").click();
            await page.locator("#framework-panel-posi .status-card[data-status='making-progress']").first().click();
            await page.check("#toggle-badge");
            check("badge switch opens the badge overlay", await page.$eval("#badge-dialog", (d) => d.open));
            check("overlay holds the badge and its buttons", (await page.locator("#badge-dialog #badge-preview svg").count()) === 1 && (await page.locator("#badge-dialog button", { hasText: /Download badge \(SVG\)|Download badge \(PNG\)|Embed badge/ }).count()) === 3);
            check("badge shows the score (50%)", /50%/.test(await page.locator("#badge-dialog #badge-preview").innerText()));
            const [download] = await Promise.all([page.waitForEvent("download"), page.click("#badge-dialog >> text=Download badge (SVG)")]);
            check("SVG download works", download.suggestedFilename() === "badge.svg");
            await page.keyboard.press("Escape");
            check("Escape closes the overlay and flips the switch off", !(await page.$eval("#badge-dialog", (d) => d.open)) && !(await page.isChecked("#toggle-badge")));
            await page.check("#toggle-badge");
            await page.click("#badge-dialog footer >> text=Close");
            check("Close button also flips the switch off", !(await page.isChecked("#toggle-badge")));
            check("no console or page errors (badge)", errors.length === 0, JSON.stringify(errors));
            await ctx.close();
        }
        {
            // Customize scales
            const { page, errors, ctx } = await open("index.html");
            const rows = () => page.locator("#scales-dialog .scale-row");
            const cards = () => page.locator("#framework-panel-posi details[id^=principle-posi-]").first().locator(".status-card");
            await page.check("#toggle-scales");
            check("switch opens the scales dialog with POSI's 3 options", (await page.$eval("#scales-dialog", (d) => d.open)) && (await rows().count()) === 3);
            check("rows run worst to best", (await rows().locator(".scale-title").evaluateAll((els) => els.map((e) => e.value))).join() === "Low adoption,Making progress,High adoption");
            const row0 = rows().first();
            check("a row has icon, colour, title, description, counts, move and remove controls", (await row0.locator("select.scale-icon option").count()) === 13 && (await row0.locator('input[type="color"]').count()) === 1 && (await row0.locator("input.scale-description").count()) === 1 && (await row0.locator("input.scale-counts").isChecked()) && (await row0.locator(".scale-up, .scale-down, .scale-remove").count()) === 3);
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
            check("Save closes the dialog and switches the toggle off", !(await page.$eval("#scales-dialog", (d) => d.open)) && !(await page.isChecked("#toggle-scales")));
            await page.locator("#framework-panel-posi details[id^=principle-posi-]").first().locator("summary").click();
            check("POSI now has 4 cards, the last one is Not applicable", (await cards().count()) === 4 && (await cards().nth(3).locator(".status-label").innerText()) === "Not applicable");
            check("the generic description shows on the card", /Does not apply to us/.test(await cards().nth(3).innerText()));
            check("the question-mark icon is used", (await cards().nth(3).locator(".status-icon svg text").textContent()) === "?");
            await cards().nth(2).click();
            const second = page.locator("#framework-panel-posi details[id^=principle-posi-]").nth(1);
            await second.locator("summary").click();
            await second.locator('.status-card[data-status^="level-"]').click();
            const heading = (await page.locator('[id^="summary-heading-posi"]').first().innerText()).trim();
            check("Not applicable is not part of the average", heading === "Overall: 100% average score", heading);
            check("both answers count as scored", /\(2\/23 scored\)$/.test(await page.locator('#framework-select option[value="posi"]').innerText()));
            // persistence
            await page.reload();
            await page.waitForSelector("#framework-panel-posi");
            check("the scale survives a reload (localStorage)", (await page.locator("#framework-panel-posi details[id^=principle-posi-]").first().locator(".status-card").count()) === 4);
            // answers are not persisted, so answer again before exporting and resetting
            const firstP = page.locator("#framework-panel-posi details[id^=principle-posi-]").first();
            await firstP.locator("summary").click();
            await firstP.locator('.status-card[data-status="high-adoption"]').click();
            const secondP = page.locator("#framework-panel-posi details[id^=principle-posi-]").nth(1);
            await secondP.locator("summary").click();
            await secondP.locator('.status-card[data-status^="level-"]').click();
            // export
            await page.click('button:has-text("Export")');
            const [download] = await Promise.all([page.waitForEvent("download"), page.click("#export-report-btn")]);
            const exported = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
            check("the exported report carries the scale", Array.isArray(exported.scales && exported.scales.posi) && exported.scales.posi.length === 4 && exported.scales.posi[3].excludeFromScore === true);
            // reset: dismiss first, then accept
            await page.check("#toggle-scales");
            check("reopened with the custom scale (4 rows)", (await rows().count()) === 4);
            let confirms = 0;
            page.once("dialog", (d) => { confirms++; d.dismiss(); });
            await page.click('#scales-dialog-footer button[aria-label="Reset to the default scale"]');
            check("reset asks before clearing answers; Cancel keeps the scale", confirms === 1 && (await page.$eval("#scales-dialog", (d) => d.open)));
            page.once("dialog", (d) => { confirms++; d.accept(); });
            await page.click('#scales-dialog-footer button[aria-label="Reset to the default scale"]');
            await page.waitForFunction(() => !document.getElementById("scales-dialog").open);
            check("reset restores 3 default cards", (await cards().count()) === 3);
            check("reset removes the saved scale", (await page.evaluate(() => localStorage.getItem("spii-principles-tool.scales.v1"))) === null);
            check("the answer on a removed option is cleared, the others stay", /\(1\/23 scored\)$/.test(await page.locator('#framework-select option[value="posi"]').innerText()));
            check("no console or page errors (scales)", errors.length === 0, JSON.stringify(errors));
            await ctx.close();
        }
        {
            // Reordering, legacy frameworks, scoring frameworks, mobile
            const { page, ctx } = await open("index.html#gorc");
            const rows = () => page.locator("#scales-dialog .scale-row");
            await page.check("#toggle-scales");
            check("legacy framework lists worst to best", (await rows().locator(".scale-title").evaluateAll((els) => els.map((e) => e.value))).join() === "Not compliant,Making progress,Compliant");
            await rows().first().locator(".scale-down").click();
            check("move down reorders the rows", (await rows().locator(".scale-title").evaluateAll((els) => els.map((e) => e.value))).join() === "Making progress,Not compliant,Compliant");
            await rows().nth(1).locator(".scale-remove").click();
            check("remove drops a row, at least 2 remain", (await rows().count()) === 2 && (await rows().locator(".scale-remove:disabled").count()) === 2);
            await page.click("#scales-dialog-footer >> text=Save");
            await page.locator("#framework-panel-gorc details[id^=principle-gorc-]").first().locator("summary").click();
            const labels = await page.locator("#framework-panel-gorc details[id^=principle-gorc-]").first().locator(".status-label").allInnerTexts();
            check("saved legacy scale: cards follow the new order", labels.join() === "Making progress,Compliant", labels.join());
            await ctx.close();
        }
        {
            const { page, ctx } = await open("index.html?framework=data/frameworks/cris-tender-v0.1.json#cris-tender");
            await page.waitForTimeout(800);
            check("scales cannot be customised for points-based frameworks", await page.$eval("#toggle-scales", (e) => e.disabled));
            await ctx.close();
        }
        {
            const { page, ctx } = await open("index.html", 375, 800);
            await page.click("#sidebar-toggle");
            await page.check("#toggle-scales");
            const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
            const fits = await page.$eval("#scales-dialog", (d) => d.getBoundingClientRect().right <= window.innerWidth + 1 && d.scrollWidth <= d.clientWidth + 1);
            check("scales dialog fits a 375px phone", sw <= iw && fits, sw + "/" + iw);
            await page.keyboard.press("Escape");
            check("Escape closes the scales dialog and flips the switch off", !(await page.$eval("#scales-dialog", (d) => d.open)) && !(await page.isChecked("#toggle-scales")));
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
    } finally {
        await browser.close();
        server.close();
    }
}
