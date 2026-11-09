# Not applicable + short report Implementation Plan

**Goal:** Answer the tester feedback (Maurits van der Graaf, 2026-11-08): a "Not applicable" answer on every
principle, and a short report instead of the 141-page PDF; plus three copy changes.

**Decisions (Maurice, 2026-11-09):** N/A on every framework; the report covers only frameworks with something
filled in; the old PDF export (jsPDF + html2canvas from CDNs) is replaced.

## Tasks

1. **Not applicable everywhere** (`app-logic`). `NOT_APPLICABLE = {id: "not-applicable", label: "Not applicable",
   icon: "dash", color: "--muted-foreground", excludeFromScore: true}`; `answer_options(framework, levels?)` =
   the framework's scale plus N/A, except when the scale already has an option that does not count (a custom N/A)
   or the framework scores points per answer (`scoring`, CRIS). Cards, icons, colors, import validation, orphan
   clearing and the scale dialog's "answers that will be cleared" use `answer_options`. `compute_summary` reports
   `notApplicable`; N/A counts as answered ("scored") but never in the percentage (legacy: compliant / (answered −
   N/A); levels: already excluded). `summary_text` adds "· N not applicable" when N > 0.
   Tests: options per framework, legacy and levels percentages with N/A, import keeps N/A, summary text.
2. **Short report** (`build_report_html(state, frameworks)` in `app-logic`, pure): header (name, assessment date,
   URL, description, activities), then per framework with at least one answer or note: title, score line, and per
   section a table Principle | Answer (icon + label) | Notes. No criteria or explanations. `#print-report` is filled
   by the Export menu's "Print report / save as PDF" (and on `beforeprint`, so Ctrl+P prints the same), and
   `@media print` shows only it. Removes `download_pdf`, the CDN scripts, `body.printing` and the old print rules.
   Tests: content and escaping in Node; in Chromium the PDF of a fully answered POSI assessment is at most 5 pages
   and only answered frameworks appear.
3. **Copy:** intro text with the sidebar hint and an About link (opens the About dialog); a description line in
   the infrastructure accordion's title; the new Classify sentence.
4. **Docs:** changelog, README, CLAUDE.md.
