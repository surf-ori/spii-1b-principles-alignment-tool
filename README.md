# Open Science Infrastructure Self-Assessment Tool

SPII deliverable 1B, Tool for: Principles Alignment Tool. Part of the [SPII overview](https://surf-ori.github.io/spii-overview/).
This repository hosts both the tool itself and its feedback/issue tracker.

A self-assessment tool for Open Science infrastructures. Name your
infrastructure, classify the activities it supports, and score it against
one or more assessment frameworks — POSI scores low adoption / making
progress / high adoption, most other frameworks compliant / making progress /
not compliant, and a framework can define its own ordinal scale (see SPII
Alignment below); you can also define your own scale for any framework
(Settings → Customize scales) — with optional notes, then export the result.

Eleven frameworks are included today, each as its own JSON file under
[`data/frameworks/`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/tree/main/data/frameworks/) — edit them directly to tweak
principles, criteria, or copy, no code changes needed:

- **[Principles of Open Scholarly Infrastructure (POSI) v2.0](https://openscholarlyinfrastructure.org/)**
  ([`posi-v2.0.json`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/blob/main/data/frameworks/posi-v2.0.json)) — 20 principles across
  Governance, Sustainability, and Insurance. **The official, approved
  assessment framework** (marked with a seal icon in the tool), the only
  framework under "Approved" in the framework dropdown and the default.
  Scored low adoption / making progress / high adoption. Three
  complementary SPII principles (Autonomy, and the Researcher-centric
  principles Seamless user-experience and Recognition and rewards) are
  added at the end as a section "Complementary Principles". On October 1,
  2026, SPII's values and principles working group decided to use POSI
  v2.0 as the official framework, and to show and discuss the four-level
  scale and SPII additions of POSI+SPII with POSI's authors and the POSI
  community, aiming for a mandate for POSI to adopt them officially, on a
  global scale.
- **POSI+SPII merged v0.5** (experimental, [`posi+spii-merged-v0.5.json`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/blob/main/data/frameworks/posi%2Bspii-merged-v0.5.json))
  — a proposal for discussion with the POSI community: POSI v2.0's 20
  principles quoted verbatim, followed by 17 SPII principles POSI does not
  already cover, all on a four-level maturity scale. Not an official
  framework; the overlap analysis behind it is on the [deliverable 1A
  page](https://surf-ori.github.io/spii-1a-values-and-principles/#posi-spii).
- **SPII Alignment v0.3** (experimental, [`spii-alignment-v0.3.json`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/blob/main/data/frameworks/spii-alignment-v0.3.json))
  — 17 subprinciples across Openness, Autonomy, Sustainable, and Researcher
  centric, transcribed verbatim from a table Till Bey shared by email
  (CC-BY licensed), scoring the same territory as deliverable 1A's
  published values and principles on a four-level maturity scale (Level
  1–4, shown as numbered circles colored red to green) instead of
  compliant/progress/non-compliant; six subprinciples have no level
  descriptions yet.
- **SPII v0.1** (experimental, [`spii-v0.1.json`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/blob/main/data/frameworks/spii-v0.1.json)) — 19
  principles across Openness, Autonomy, Sustainability, Interoperability,
  and Researcher-centric.
- **GORC v1.1 Assessment** (experimental, [`gorc-v1.1.json`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/blob/main/data/frameworks/gorc-v1.1.json))
  — 55 principles adapting the Research Data Alliance's [Global Open
  Research Commons (GORC) International Model, version
  1.1](https://doi.org/10.15497/RDA00119) (2024), an aspirational (not
  prescriptive) framework for planning, developing, or operating a research
  commons of any kind. By far the largest framework here, across the
  model's ten essential elements: Governance & Leadership, Rules of
  Participation & Access, Sustainability, Engagement, Human Capacity,
  Interoperability, Standards & Conventions, ICT Infrastructure, Services &
  Tools, and Research Objects.
- **FAIR v1.0** (experimental, [`fair-v1.0.json`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/blob/main/data/frameworks/fair-v1.0.json))
  — 15 principles transcribing the [FAIR Guiding
  Principles](https://www.gofair.foundation/fair-principles) (Wilkinson et
  al., 2016) verbatim: Findable, Accessible, Interoperable, and Reusable,
  covering both data and metadata.
- **BD v1.0** (experimental, [`bd-v1.0.json`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/blob/main/data/frameworks/bd-v1.0.json))
  — 8 principles adapting the four commitments of the [Barcelona
  Declaration on Open Research Information](https://www.barcelona-declaration.org)
  (2024): making openness the default, working with open-enabling services
  and systems, supporting infrastructure sustainability, and coordinating
  collective action.
- **OSR v0.1** (experimental, [`osr-v0.1.json`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/blob/main/data/frameworks/osr-v0.1.json)) — 25
  principles adapting Jeroen Bosman and Jeroen Sondervan's [open science
  resilience model](https://upstream.force11.org/the-resilience-of-open-science-in-times-of-crisis/),
  related to the International Science Council's [*Protecting Science in
  Times of Crisis*](https://doi.org/10.24948/2024.01) (2024). Five areas of
  concern (funding, infrastructure, academic freedom, safety,
  disinformation), each scored across five resilience types (prevention,
  protection, resistance, withstanding, repair).
- **7GPRI v1.0** (experimental, [`7gpri-v1.0.json`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/blob/main/data/frameworks/7gpri-v1.0.json))
  — 7 principles adapting the Dutch Taskforce on Responsible Management of
  Research Information and Data's [Seven Guiding Principles for Open
  Research Information](https://www.universiteitenvannederland.nl/files/documenten/Nieuwsberichten/Guiding%20Principles%20on%20Management%20of%20Research%20Information%20and%20Data_11May.pdf)
  (February 2022): trusted and transparent provenance, openness of
  metadata, openness of algorithms, enduring access and availability, open
  standards and interoperability, open collaboration with third parties,
  and academic sovereignty through governance.
- **CARE v1.0** (experimental, [`care-v1.0.json`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/blob/main/data/frameworks/care-v1.0.json))
  — 12 sub-principles adapting the Global Indigenous Data Alliance's [CARE
  Principles for Indigenous Data
  Governance](https://www.gida-global.org/careprinciples) (2019; [Carroll et
  al., 2020](https://doi.org/10.5334/dsj-2020-043)): Collective Benefit,
  Authority to Control, Responsibility, and Ethics. Complements FAIR's
  focus on data reusability with a people- and purpose-oriented lens
  asserting Indigenous Peoples' rights and interests in the data
  ecosystems that concern them. At the bottom of the framework order.

A concept framework sits next to these, deliberately **not** built in:
**CRIS Tender v0.1** (experimental,
[`cris-tender-v0.1.json`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/blob/main/data/frameworks/cris-tender-v0.1.json))
— 138 principles in 15 sections for comparing Current Research Information
System (CRIS) solutions, based on the public 2026 European tender of
Maastricht University for a CRIS with repository function
([Mercell](https://app.mercell.com/tender/1548230057/Current-Research-Information-System-(CRIS)-with-repository-function)). It is
not an Open Science infrastructure principles framework, so it is not loaded
at startup; it is loaded at runtime via `?framework=` (see below). Drafted
with AI assistance (Claude) and pending review.

Its sections and principles carry the tender's own question numbers (for
example `2.6, 2.7 Role and organisation based access`). Each principle is a
**Must have** (a knock-out question in the tender) or a **Should have** (a
question that earns points), shown as chips in its accordion title together
with the given answer (Yes / Partly / No, with its icon) and the points
earned; the tender's plans and price keep their own labels. Compliance is the
points earned out of the 997 points on offer, and drops to 0% as soon as one
Must have is not answered Yes. This is the optional `scoring` block of a
framework (`"type": "points-knockout"`, with `points` and `knockOut` per
principle), so it needs no code change for other tender-style frameworks.
- **FOREST v2.0** (experimental, [`forest-v2.0.json`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/blob/main/data/frameworks/forest-v2.0.json))
  — 96 indicators under 23 principles and six values (Financial and organizational
  resilience, Openness, Responsible governance, Equity, accessibility and
  anti-oppression, Sharing of knowledge, Transparency), transcribed from the
  [FOREST Framework for Values-Driven Scholarly
  Communication](https://doi.org/10.5281/zenodo.6557302) (Lippincott & Skinner,
  Educopia Institute, Framework 2.0, Spring 2022, CC BY 4.0). Uses FOREST's own
  four-step progress bar (Not planning, Considering, In progress, Implemented;
  leave an indicator unanswered for Not applicable). Each indicator notes
  whether it applies to mature communities, to publishers or to software &
  infrastructure providers, and lists the evidence FOREST proposes. FOREST
  itself discourages tallying a score. At the bottom of the framework order.

## Features

- **Classify** — tag the infrastructure against a research activities
  taxonomy (research life cycle activities plus related activities such as
  managing, documenting, reviewing, publishing, and evaluating), each with
  its own icon.
- **Score** — pick a framework in the sidebar dropdown (POSI under
  "Approved", the others under "Other assessments") and rate every
  principle. The dropdown shows a live scored/total count per framework,
  and the sidebar lists the selected framework's sections as accordions with
  a status icon next to every principle, so you can see progress at a
  glance without opening each section.
- **Customize scales** (Settings, bottom of the sidebar) — define your own
  scale for the selected framework: 2 to 9 options, each with an icon (tick,
  clock, cross, 1–9, ?), a color, a title, an optional description and
  whether it counts toward the score (so "Not applicable" can stay out of
  the average). The scale is kept in your browser (localStorage), is part
  of the exported report and framework files, and can be reset to the
  framework's own scale.
- **Bring your own framework** — import a custom assessment framework
  (JSON) at runtime alongside POSI, GORC, FAIR, BD, OSR, 7GPRI, CARE, FOREST,
  and the SPII frameworks, download a template to help author one, and export whichever
  frameworks are currently loaded.
- **Export as JSON** — download your results and reload them later to
  continue or revise an assessment.
- **Export as PDF** — download a report of the full assessment.
- **Assessment badge (experimental)** — switch on "Show badge" in Settings to
  open, in an overlay, a doughnut-style SVG/PNG badge
  summarizing the score for the active framework, including the classified
  activities as small icons, suitable for hosting on the infrastructure's
  own site.

## Usage

Also live at **[surf-ori.github.io/spii-1b-principles-alignment-tool](https://surf-ori.github.io/spii-1b-principles-alignment-tool/)**
(GitHub Pages, served from this repo's `main` branch — no separate deploy
step). Or serve the directory with any static file server (for example
`python3 -m http.server`) and open `index.html` over http(s); there is
nothing to install or build beyond that. **Opening `index.html` directly
as a `file://` page no longer works** — the eleven built-in frameworks are
loaded from [`data/frameworks/`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/tree/main/data/frameworks/) via `fetch()` at
startup, and browsers block that kind of request from a `file://` page;
you'll see a clear on-page message explaining this instead of a blank
page. The top bar's Import/Export menus cover loading and saving a report
or a custom framework by hand; "About" and "Changelog", also in the top
bar, open as dialogs.

[`data/examples/`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/tree/main/data/examples/) has three example POSI assessment reports based
on published self-assessments from real infrastructures (OpenAIRE,
OpenAlex, HAL+/CCSD) — linked from the About dialog as one-click loads
against the live site (see below), or load one by hand via "Import
Assessment Report". It also holds a concept example for the CRIS Tender
framework above, `moris-broccoli-cris-tender-assessment-2026.json`, scoring
MORIS+ (SURF's Modular Open Research Information System, extended for
universities and UMCs) combined with BROCCOLI (SURF's Open Research
Information hub) on all 138 principles. It is an illustration for discussion,
not a validated product assessment, and was drafted with AI assistance
(Claude), pending review. One click from the About dialog loads framework and
example together and selects the CRIS Tender framework:
[demo](https://surf-ori.github.io/spii-1b-principles-alignment-tool/?framework=data/frameworks/cris-tender-v0.1.json&report=data/examples/moris-broccoli-cris-tender-assessment-2026.json#cris-tender).

### Loading via URL parameters

When served over http(s) (not opened directly as a `file://` page, since
browsers block that kind of cross-file fetch), `index.html` can load a
report and/or a custom framework automatically from query parameters:

- `index.html?report=report5.json` — loads and merges an exported
  assessment report.
- `index.html?framework=custom2.json` — imports a custom assessment
  framework.
- `index.html?framework=custom2.json&report=report5.json` — both at once;
  the framework loads first, so the report's scores for it (if any) apply
  on top rather than being lost.

### Linking directly to a framework

`index.html#gorc` (or any framework id — `posi-spii`, `spii`, `spii-alignment`, `posi`, `gorc`, `fair`, `bd`, `osr`, `7gpri`, `care`, `forest`, matched
case-insensitively) opens straight to that framework, selected in the dropdown with its
sections in the sidebar. Selecting a framework in the app updates the
URL the same way, so the address bar always reflects which framework is open and can be shared
or bookmarked. It combines with `?report=`/`?framework=`: the three example links in the About
dialog are `?report=data/examples/<file>.json#posi`, so they load the report and land straight on the
framework it's scored against.

## Feedback

This repository is also SPII deliverable 1B's feedback and issue tracker.
Open an issue to propose a correction, flag a gap, or suggest an
addition, using the feedback template (name, organisation, role, and
"representing infrastructure"). See the ["Way of
working"](https://surf-ori.github.io/spii-overview/#way-of-working)
section on the SPII overview for how a curator reviews issues and records
the outcome (accepted, rejected, or already covered) directly on the
issue.

### Saving an assessment report

The Export menu's "Save Report to GitHub Tracker" downloads your report and opens a dialog with
two ways to contribute it, both landing on this same repository:

- **Open a new issue** — attach the downloaded file to a new issue.
- **Propose it as a file (pull request)** — drop the downloaded file onto GitHub's "new file"
  page under [`data/reports/`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/tree/main/data/reports/). If you don't have write access (the common case), GitHub
  forks the repo for you and opens the pull request automatically — no manual fork needed.

Either way, the report (including any name, description, or notes you've entered) becomes
**public** once you submit it — the dialog says so before you pick an option. A curator reviews
submissions the same way as other feedback before they're merged in; see
[`data/reports/README.md`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/blob/main/data/reports/README.md) for the filename convention.

## Citing

If you use this tool, please cite it using the metadata in
[`CITATION.cff`](CITATION.cff) — including each author's ORCID and their
affiliation's ROR identifier — which GitHub's "Cite this repository"
button uses automatically.

## License

Licensed under the [EUPL-1.2](LICENSE).

Copyright (c) 2026:
- Till Bey ([ORCID](https://orcid.org/0000-0001-7509-9875)) — [SURF](https://ror.org/009vhk114)
- Maurice Vanderfeesten ([ORCID](https://orcid.org/0000-0001-6397-4759)) — [Vrije Universiteit Amsterdam](https://ror.org/008xxew50) & [SURF](https://ror.org/009vhk114)
- Sander Bosch ([ORCID](https://orcid.org/0000-0001-6845-0911)) — [Vrije Universiteit Amsterdam](https://ror.org/008xxew50)

## Credits

Styling is provided by [Oat](https://oat.ink), layered with color and font
tokens matching the [SPII overview](https://surf-ori.github.io/spii-overview/) page (Outfit and
IBM Plex Mono, self-hosted under `fonts/`).
The SURF logo in the top bar and favicon is [SURF](https://www.surf.nl/)'s own.
