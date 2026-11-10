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

    // A dialog's "close" event (which switches its toggle off) fires asynchronously: wait for it.
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
            check("intro accordion sits above About POSI", detailsTitles[0] === "Introduction to Strategic Plan for Integrated Infrastructure" && detailsTitles[1] === "About POSI", detailsTitles.join("|"));
            check("About POSI has no approved paragraph", !/Approved assessment framework/.test(await panel.locator("#framework-posi > details").nth(1).innerText()));
            check("23 principle accordions", (await panel.locator('details[id^="principle-posi-"]').count()) === 23);
            const aut = panel.locator("#principle-posi-autonomy");
            await aut.locator("summary").click();
            check("Autonomy text links to the DAAF", (await aut.locator('a[href="https://utrechtuniversity.github.io/digital-autonomy-assessment-tool/"]').count()) === 2);
            check("cards show the criteria from SPII v0.1", /Data, infrastructure control, and critical decisions remain/.test(await aut.innerText()));
            await first.locator('.status-card[data-status="high-adoption"]').click();
            const heading = (await panel.locator('[id^="summary-heading-posi"]').first().innerText()).trim();
            check("one High adoption answer gives 100% average score", heading === "Self-assessment score: 100%", heading);
            check("the status chip colours follow the level", (await first.locator('.status-card[data-status="high-adoption"]').evaluate((el) => getComputedStyle(el).getPropertyValue("--status-accent"))).trim() !== "");
            check("no console or page errors (POSI)", errors.length === 0, JSON.stringify(errors));
            await ctx.close();
        }
        {
            // Layout: intro, infrastructure accordion, selected framework; dropdown + sidebar accordions
            const { page, errors, ctx } = await open("index.html");
            check("no tab strip", (await page.locator('[role="tab"], [role="tablist"]').count()) === 0);
            const groups = await page.$$eval("#framework-select optgroup", (gs) => gs.map((g) => [g.label, [...g.querySelectorAll("option")].map((o) => o.value)]));
            check("dropdown groups: Default / Other assessments", groups.length === 2 && groups[0][0] === "Default" && groups[0][1].join() === "posi" && groups[1][0] === "Other assessments", JSON.stringify(groups));
            check("other assessments order", groups[1] && groups[1][1].join() === "gorc,fair,bd,osr,7gpri,care,forest", groups[1] && groups[1][1].join());
            check("POSI is selected by default", (await page.inputValue("#framework-select")) === "posi");
            check("option label shows the scored count", /^POSI v2\.0 Assessment \(0\/23 scored\)$/.test(await page.locator('#framework-select option[value="posi"]').innerText()));
            const order = await page.$$eval("#app > *", (els) => els.map((e) => e.id || e.tagName.toLowerCase()));
            check("main page: intro, infra description, selected framework", order.join() === "intro-section,infra-description-section,framework-section", order.join());
            check("infra description is a closed accordion", await page.$eval("#infra-description-section", (e) => e.tagName === "DETAILS" && !e.open));
            await page.click("#infra-description-section > summary");
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
            check("Settings icon is a cog (a toothed outline, not rays)", (await page.locator("#sidebar-footer .settings-heading svg path").evaluate((p) => p.getAttribute("d").length > 400)) && (await page.locator("#sidebar-footer .settings-heading svg circle").count()) === 1);
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
            check("Escape closes the overlay and flips the switch off", await closedAndOff(page, "badge-dialog", "toggle-badge"));
            await page.check("#toggle-badge");
            await page.click("#badge-dialog footer >> text=Close");
            check("Close button also flips the switch off", await closedAndOff(page, "badge-dialog", "toggle-badge"));
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
            check("Save closes the dialog and switches the toggle off", await closedAndOff(page, "scales-dialog", "toggle-scales"));
            await page.locator("#framework-panel-posi details[id^=principle-posi-]").first().locator("summary").click();
            check("POSI now has 4 cards, the last one is Not applicable", (await cards().count()) === 4 && (await cards().nth(3).locator(".status-label").innerText()) === "Not applicable");
            check("the generic description shows on the card", /Does not apply to us/.test(await cards().nth(3).innerText()));
            check("the question-mark icon is used", (await cards().nth(3).locator(".status-icon svg text").textContent()) === "?");
            await cards().nth(2).click();
            const second = page.locator("#framework-panel-posi details[id^=principle-posi-]").nth(1);
            await second.locator("summary").click();
            await second.locator('.status-card[data-status^="level-"]').click();
            const heading = (await page.locator('[id^="summary-heading-posi"]').first().innerText()).trim();
            check("Not applicable is not part of the average", heading === "Self-assessment score: 100%", heading);
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
            await page.check("#toggle-scales");
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
            await page.check("#toggle-scales");
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
            check("Escape closes the scales dialog and flips the switch off", await closedAndOff(page, "scales-dialog", "toggle-scales"));
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
            await page.click("#infra-description-section > summary");
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
            check("top menu: About, Changelog, Feedback in that order", items.join() === "About,Changelog,Feedback", items.join());
            const fb = page.locator('nav[data-topnav] a:has-text("Feedback")');
            check("Feedback opens the issue form in a new tab", (await fb.getAttribute("href")) === "https://github.com/surf-ori/spii-1b-principles-alignment-tool/issues/new?template=feedback.yml" && (await fb.getAttribute("target")) === "_blank" && /noopener/.test(await fb.getAttribute("rel")));
            const same = await page.$eval('nav[data-topnav] a:has-text("Feedback")', (a) => { const b = [...document.querySelectorAll("nav[data-topnav] button.ghost")].find((x) => x.textContent.trim() === "Changelog"); return Math.abs(a.getBoundingClientRect().height - b.getBoundingClientRect().height) < 3; });
            check("Feedback is styled like its neighbours", same);
            check("no console or page errors (menu)", errors.length === 0, JSON.stringify(errors));
            await ctx.close();
            for (const width of [412, 375, 320]) {
                const m = await open("index.html", width, 800);
                const [sw, iw] = await m.page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
                check("no horizontal overflow with the Feedback link at " + width + "px", sw <= iw, sw + "/" + iw);
                await m.ctx.close();
            }
        }
        {
            // Theme toggle
            const mk = async (scheme, width = 1280) => {
                const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme });
                const page = await ctx.newPage();
                const errors = [];
                page.on("pageerror", (e) => errors.push(e.message));
                await page.route(/unpkg\.com|html2canvas/, (r) => r.abort());
                await page.goto(base + "index.html");
                await page.waitForSelector("#app > *");
                return { page, ctx, errors };
            };
            const bg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
            const { page, ctx, errors } = await mk("dark");
            const radios = await page.$$eval('#sidebar-footer [role="radiogroup"] input[type="radio"]', (els) => els.map((e) => e.value + (e.checked ? "*" : "")));
            check("theme toggle: Dark / System / Light, System selected", radios.join() === "dark,system*,light", radios.join());
            check("the group is labelled", (await page.locator('#sidebar-footer [role="radiogroup"]').getAttribute("aria-label")) === "Theme");
            check("System follows a dark OS", (await page.evaluate(() => document.documentElement.dataset.theme)) === "dark" && (await bg(page)) === "rgb(16, 20, 15)");
            await page.locator("#sidebar-footer label:has(input[value=light])").click();
            check("Light overrides a dark OS", (await page.evaluate(() => document.documentElement.dataset.theme)) === "light" && (await bg(page)) === "rgb(246, 244, 236)");
            check("the choice is stored", (await page.evaluate(() => localStorage.getItem("spii-principles-tool.theme"))) === "light");
            // colors that are set per answer follow the theme without a re-render
            await page.locator("#framework-panel-posi details[id^=principle-posi-]").first().locator("summary").click();
            const card = page.locator("#framework-panel-posi details[id^=principle-posi-]").first().locator('.status-card[data-status="high-adoption"]');
            await card.click();
            const accent = () => card.evaluate((el) => getComputedStyle(el).getPropertyValue("--status-accent").trim());
            const lightAccent = await accent();
            await page.locator("#sidebar-footer label:has(input[value=dark])").click();
            const darkAccent = await accent();
            check("answer colors follow the theme (#1f5c43 light, #59b98a dark)", lightAccent === "#1f5c43" && darkAccent === "#59b98a", lightAccent + " / " + darkAccent);
            await page.reload();
            await page.waitForSelector("#app > *");
            check("the choice survives a reload", (await page.evaluate(() => document.documentElement.dataset.theme)) === "dark" && await page.isChecked('#sidebar-footer input[value="dark"]'));
            await page.locator("#sidebar-footer label:has(input[value=system])").click();
            await page.emulateMedia({ colorScheme: "light" });
            await page.waitForTimeout(100);
            check("System follows the OS live", (await page.evaluate(() => document.documentElement.dataset.theme)) === "light");
            check("no page errors (theme)", errors.length === 0, errors.join("|"));
            await ctx.close();
            const a = await mk("light");
            check("System with a light OS is light", (await a.page.evaluate(() => document.documentElement.dataset.theme)) === "light");
            await a.ctx.close();
            const mobile = await mk("dark", 320);
            await mobile.page.click("#sidebar-toggle");
            const [sw, iw] = await mobile.page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
            const fits = await mobile.page.$eval("#sidebar-footer .theme-toggle", (e) => e.getBoundingClientRect().right <= document.querySelector("aside[data-sidebar]").getBoundingClientRect().right + 1);
            check("theme toggle fits at 320px", sw <= iw && fits, sw + "/" + iw);
            await mobile.ctx.close();
        }
        {
            // Not applicable, the short printed report, copy changes
            const { page, errors, ctx } = await open("index.html");
            check("no external PDF scripts any more", (await page.locator('script[src*="jspdf"], script[src*="html2canvas"]').count()) === 0);
            const intro = await page.locator("#intro-section").innerText();
            check("intro mentions the dropdown, POSI default and About", /Select an assessment framework from the dropdown in the sidebar/.test(intro) && /POSI/.test(intro) && /About/.test(intro), intro);
            await page.click('#intro-section a:has-text("About")');
            check("the About link opens the About dialog", await page.$eval("#about-dialog", (d) => d.open));
            await page.keyboard.press("Escape");
            check("infra accordion title says what it is for (while collapsed)", /Fill in some basic details about the Open Science infrastructure this alignment is for\./.test(await page.locator("#infra-description-section > summary").innerText()));
            await page.click("#infra-description-section > summary");
            check("new Classify sentence", /Tell us what activities this infrastructure fits in the research activities landscape:/.test(await page.locator("#infra-description-section").innerText()));
            await page.click("#infra-description-section > summary");
            const first = page.locator("#framework-panel-posi details[id^=principle-posi-]").first();
            await first.locator("summary").click();
            const labels = await first.locator(".status-label").allInnerTexts();
            check("POSI cards end with Not applicable", labels.join() === "Low adoption,Making progress,High adoption,Not applicable", labels.join());
            await first.locator('.status-card[data-status="not-applicable"]').click();
            const second = page.locator("#framework-panel-posi details[id^=principle-posi-]").nth(1);
            await second.locator("summary").click();
            await second.locator('.status-card[data-status="making-progress"]').click();
            const heading = (await page.locator('[id^="summary-heading-posi"]').first().innerText()).trim();
            check("N/A does not pull the score down", heading === "Self-assessment score: 50%", heading);
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
            check("Export: GitHub tracker on top, frameworks last after a separator", exp.join("|") === "Save Report to GitHub Tracker|Save assessment to a file (JSON)|Print report / save as PDF|---|Download Assessment Framework (JSON)", exp.join("|"));
            const imp = await menu("import-menu");
            check("Import: report first, frameworks after a separator", imp.join("|") === "Import Assessment Report (JSON)|---|Import Assessment Framework (JSON)|Download Assessment Framework Template (JSON)", imp.join("|"));
            check("every menu item has an icon", (await page.locator('[role="menuitem"]').count()) === 7 && (await page.locator('[role="menuitem"] > svg.menuitem-icon').count()) === 7);
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
            await page.click("#infra-description-section > summary");
            await page.fill("#infra-name", "OpenAIRE");
            await page.fill("#infra-assessed-on", "2026-11-09");
            const dl = async (id) => {
                await page.click('button:has-text("Export")');
                const [d] = await Promise.all([page.waitForEvent("download"), page.click("#" + id)]);
                return { name: d.suggestedFilename(), json: JSON.parse(fs.readFileSync(await d.path(), "utf8")) };
            };
            const rep = await dl("export-report-btn");
            check("report download name", rep.name === "2026-11-09-posi-v2-0-assessment-openaire.json", rep.name);
            check("report download: selected framework only, with readme", Object.keys(rep.json.frameworks).join() === "posi" && typeof rep.json._readme === "string");
            const fw = await dl("download-frameworks-btn");
            const today = await page.evaluate(() => today_iso_date());
            check("framework download name", fw.name === today + "-posi-v2-0-assessment-framework.json", fw.name);
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
            check("dropdown: Default (POSI) and Other assessments without the SPII frameworks", groups.join("|") === "Default:posi|Other assessments:gorc,fair,bd,osr,7gpri,care,forest", groups.join("|"));
            const first = page.locator("#framework-panel-posi details[id^=principle-posi-]").first();
            await first.locator("summary").click();
            await first.locator('.status-card[data-status="high-adoption"]').click();
            check("summary heading: Self-assessment score", (await page.locator("#summary-heading-posi").innerText()).trim() === "Self-assessment score: 100%");
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
            check("embed dialog gives a self-contained snippet", (await page.$eval("#embed-dialog", (d) => d.open)) && code.startsWith("<div") && code.includes("Self-assessment score: 100%") && code.includes("spii-1b-principles-alignment-tool"));
            await page.keyboard.press("Escape");
            check("badge is titled self-assessment score", (await page.evaluate(() => build_badge_svg_markup(state))).includes("POSI self-assessment score"));
            // autosave
            await page.click("#infra-description-section > summary");
            await page.fill("#infra-name", "Saved Repo");
            await page.waitForTimeout(500);
            await page.reload();
            await page.waitForSelector("#app > *");
            check("answers and description survive a reload", (await page.inputValue("#infra-name")) === "Saved Repo" && (await page.locator("#summary-heading-posi").innerText()).trim() === "Self-assessment score: 100%");
            check("the saving is explained in Settings", /saved automatically in this browser/.test(await page.locator("#sidebar-footer .saved-note").innerText()));
            page.once("dialog", (d) => d.accept());
            await page.click("#sidebar-footer .start-new");
            await page.waitForTimeout(400);
            await page.reload();
            await page.waitForSelector("#app > *");
            check("Start a new assessment clears it", (await page.inputValue("#infra-name")) === "" && /\(0\/23 scored\)$/.test(await page.locator('#framework-select option[value="posi"]').innerText()));
            check("Export menu: Save assessment to a file", /Save assessment to a file \(JSON\)/.test(await page.locator("#export-report-btn").innerText()));
            check("no console or page errors (Nida)", errors.length === 0, JSON.stringify(errors));
            await ctx.close();
        }
    } finally {
        await browser.close();
        server.close();
    }
}
