# Principles page improvements — design

Source: colleagues' comments collected in `PrinciplesPage-improvements.docx` (points 1–6), plus the
decisions taken in conversation on 2026-10-29. Repo state when written: `main` at `f5efba6`.

## Goal

Simplify the page around one selected framework, give POSI a three-step adoption scale, let people
define their own scale, move the badge out of the sidebar, and embed the complementary SPII principles
in POSI.

## Page layout

`#app` holds three sections, in this order:

1. **Intro** — the existing one-sentence introduction (text unchanged; a longer how-to text follows in a later iteration).
2. **Infrastructure description** — the existing form, now one accordion (`<details>`), closed by default.
3. **Selected framework** — the panel of the framework chosen in the sidebar. All panels stay in the DOM
   (print/PDF still needs them); only the selected one is visible.

The tab strip is removed.

## Sidebar

1. **Framework dropdown** (native `<select>`), default POSI. Two `<optgroup>`s: **Approved** (POSI v2.0) and
   **Other assessments** (everything else, including imported frameworks). Each option shows `title (x/y scored)`.
2. **Accordions** of the selected framework: one `<details open>` per section, containing the principle links with
   their status icons (as today).
3. **Footer, "Settings"** (gear icon) with two switches: **Customize scales** and **Show badge (experimental)**.
   Each switch opens a modal dialog (like About/Changelog); closing the dialog switches it off again.

Order of the built-in frameworks (this is the order in the dropdown): POSI v2.0, GORC, FAIR, BD, OSR, 7GPRI, CARE,
FOREST, SPII v0.1, SPII Alignment v0.3, POSI+SPII merged v0.5. The three SPII frameworks stay (moved to the bottom).
The UI word "draft" becomes **experimental** (title suffix, banner). The JSON field stays `draft`.

## POSI v2.0 data (`data/frameworks/posi-v2.0.json`)

- `aboutHtml`: first paragraph (the "Approved assessment framework" paragraph) removed.
- New optional framework field `intro: {title, html}`, rendered as an accordion above "About POSI":
  "Introduction to Strategic Plan on Integrated Infrastructure" (text from the document; "Complimentary" is
  corrected to "Complementary").
- `levels`: Low adoption (cross, `--destructive`), Making progress (clock, `--warning`), High adoption
  (tick, `--compliant`), worst first. Ids `low-adoption`, `making-progress`, `high-adoption`.
- New last section **Complementary Principles** with three principles: Autonomy; Researcher-centric: Seamless
  user-experience; Researcher-centric: Recognition and rewards. Criteria come from SPII v0.1, re-keyed to the new
  level ids. Autonomy links to the DAAF
  (`https://utrechtuniversity.github.io/digital-autonomy-assessment-tool/`). They count in POSI's score and badge.
- The three POSI example reports are migrated to the new ids. No alias for old saved reports.

## Scale model

`levels` entries gain optional fields: `icon` (`check`, `clock`, `cross`, `1`–`9`, `question`), `color`
(`#rrggbb` or a CSS token name such as `--warning`), `description`, `excludeFromScore` (boolean).
`LEGACY_LEVELS` carries icon and color too, so one code path renders both kinds.

Scoring for frameworks with `levels`: options are ordered worst → best; the position among the options that count
gives the grade (0 … 1). Options with `excludeFromScore` (e.g. "Not applicable") are shown and counted in the
level tally but ignored in the percentage.

Card text: the principle's own `criteria[level.id]` wins; otherwise the level's `description` is shown.

## Customize scales

- Edits the **selected framework's** scale. Rows run top → bottom = cards left → right = worst → best.
  Per row: reorder (▲▼), icon, color, title (required), description (optional), "Counts toward score", remove.
  "Add option"; 2–9 options.
- Legacy frameworks (compliant/progress/non-compliant) are listed worst → best in the editor; saving flips their card
  order. Existing option ids are kept so `criteria` keep working; new options get `level-N` ids.
- **Save** applies the scale. Answers whose option no longer exists are cleared (after a confirm). **Reset**
  (open-circle arrow icon) immediately restores the framework's own scale. Per-principle descriptions are not
  editable here; the dialog points to Import → framework JSON for that.
- Implementation: the scale replaces `framework.levels` in place; the original is kept in a `WeakMap`, so cards,
  sidebar icons, summary, badge and exports follow automatically.
- Persistence: in memory, plus `localStorage` (`spii-principles-tool.scales.v1`, built-in frameworks only; every
  access in try/catch). Export report gets `scales: {frameworkId: levels}` for customized built-ins; import
  report applies it. Download Assessment Frameworks writes the customized `levels`.
- Disabled for frameworks with a `scoring` block (CRIS tender): their points depend on the fixed answers.

## Out of scope

Backward compatibility for POSI reports saved with the old ids; a how-to intro text; per-principle
descriptions in the scale dialog; `localStorage` for anything but scales.

## Research notes

- Codebase: the N-level machinery (`levels`, `principle_levels_for`, `level_icon_markup`, `level_color`,
  `compute_summary`) already exists since 2026-09-21; extending it is smaller than a second mechanism.
- Oat provides `role="switch"`, `<dialog>` styling and the sidebar layout; no new dependency.
- DAAF = Utrecht University's Digital Autonomy Assessment Framework
  (`https://www.uu.nl/en/organisation/digital-autonomy/tools`); the user supplied the tool URL above.
- Inbound links: `spii-overview` links only to `#posi`; the SPII hashes keep working (frameworks stay).
