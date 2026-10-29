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
            const panel = page.locator('[role="tabpanel"]:visible');
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
    } finally {
        await browser.close();
        server.close();
    }
}
