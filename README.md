# Open Science Infrastructure Self-Assessment Tool

SPII deliverable 1B, Tool for: Principles Alignment Tool. Part of the [SPII overview](https://surf-ori.github.io/spii-overview/).
This repository hosts both the tool itself and its feedback/issue tracker.

A self-assessment tool for Open Science infrastructures. Name your
infrastructure, classify the activities it supports, and score it against
one or more assessment frameworks — most frameworks here score compliant /
making progress / not compliant, but a framework can instead define its
own ordinal scale (see SPII Alignment below) — with optional
notes, then export the result.

Ten frameworks are included today, each as its own JSON file under
[`data/frameworks/`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/tree/main/data/frameworks/) — edit them directly to tweak
principles, criteria, or copy, no code changes needed:

- **[Principles of Open Scholarly Infrastructure (POSI) v2.0](https://openscholarlyinfrastructure.org/)**
  ([`posi-v2.0.json`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/blob/main/data/frameworks/posi-v2.0.json)) — 20 principles across
  Governance, Sustainability, and Insurance. **The official, approved
  assessment framework** (marked with a seal icon in the tool), first in
  the framework list, right after the infrastructure-description tab. On
  October 1, 2026, SPII's values and principles working group decided to
  use POSI v2.0 as the official framework, and to show and discuss the
  four-level scale and SPII additions of POSI+SPII with POSI's authors and
  the POSI community, aiming for a mandate for POSI to adopt them
  officially, on a global scale.
- **POSI+SPII merged v0.5** (draft, [`posi+spii-merged-v0.5.json`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/blob/main/data/frameworks/posi%2Bspii-merged-v0.5.json))
  — a proposal for discussion with the POSI community: POSI v2.0's 20
  principles quoted verbatim, followed by 17 SPII principles POSI does not
  already cover, all on a four-level maturity scale. Not an official
  framework; the overlap analysis behind it is on the [deliverable 1A
  page](https://surf-ori.github.io/spii-1a-values-and-principles/#posi-spii).
- **SPII Alignment v0.3** (draft, [`spii-alignment-v0.3.json`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/blob/main/data/frameworks/spii-alignment-v0.3.json))
  — 17 subprinciples across Openness, Autonomy, Sustainable, and Researcher
  centric, transcribed verbatim from a table Till Bey shared by email
  (CC-BY licensed), scoring the same territory as deliverable 1A's
  published values and principles on a four-level maturity scale (Level
  1–4, shown as numbered circles colored red to green) instead of
  compliant/progress/non-compliant; six subprinciples have no level
  descriptions yet.
- **SPII v0.1** (draft, [`spii-v0.1.json`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/blob/main/data/frameworks/spii-v0.1.json)) — 19
  principles across Openness, Autonomy, Sustainability, Interoperability,
  and Researcher-centric.
- **GORC v1.1 Assessment** (draft, [`gorc-v1.1.json`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/blob/main/data/frameworks/gorc-v1.1.json))
  — 55 principles adapting the Research Data Alliance's [Global Open
  Research Commons (GORC) International Model, version
  1.1](https://doi.org/10.15497/RDA00119) (2024), an aspirational (not
  prescriptive) framework for planning, developing, or operating a research
  commons of any kind. By far the largest framework here, across the
  model's ten essential elements: Governance & Leadership, Rules of
  Participation & Access, Sustainability, Engagement, Human Capacity,
  Interoperability, Standards & Conventions, ICT Infrastructure, Services &
  Tools, and Research Objects.
- **FAIR v1.0** (draft, [`fair-v1.0.json`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/blob/main/data/frameworks/fair-v1.0.json))
  — 15 principles transcribing the [FAIR Guiding
  Principles](https://www.gofair.foundation/fair-principles) (Wilkinson et
  al., 2016) verbatim: Findable, Accessible, Interoperable, and Reusable,
  covering both data and metadata.
- **BD v1.0** (draft, [`bd-v1.0.json`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/blob/main/data/frameworks/bd-v1.0.json))
  — 8 principles adapting the four commitments of the [Barcelona
  Declaration on Open Research Information](https://www.barcelona-declaration.org)
  (2024): making openness the default, working with open-enabling services
  and systems, supporting infrastructure sustainability, and coordinating
  collective action.
- **OSR v0.1** (draft, [`osr-v0.1.json`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/blob/main/data/frameworks/osr-v0.1.json)) — 25
  principles adapting Jeroen Bosman and Jeroen Sondervan's [open science
  resilience model](https://upstream.force11.org/the-resilience-of-open-science-in-times-of-crisis/),
  related to the International Science Council's [*Protecting Science in
  Times of Crisis*](https://doi.org/10.24948/2024.01) (2024). Five areas of
  concern (funding, infrastructure, academic freedom, safety,
  disinformation), each scored across five resilience types (prevention,
  protection, resistance, withstanding, repair).
- **7GPRI v1.0** (draft, [`7gpri-v1.0.json`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/blob/main/data/frameworks/7gpri-v1.0.json))
  — 7 principles adapting the Dutch Taskforce on Responsible Management of
  Research Information and Data's [Seven Guiding Principles for Open
  Research Information](https://www.universiteitenvannederland.nl/files/documenten/Nieuwsberichten/Guiding%20Principles%20on%20Management%20of%20Research%20Information%20and%20Data_11May.pdf)
  (February 2022): trusted and transparent provenance, openness of
  metadata, openness of algorithms, enduring access and availability, open
  standards and interoperability, open collaboration with third parties,
  and academic sovereignty through governance.
- **CARE v1.0** (draft, [`care-v1.0.json`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/blob/main/data/frameworks/care-v1.0.json))
  — 12 sub-principles adapting the Global Indigenous Data Alliance's [CARE
  Principles for Indigenous Data
  Governance](https://www.gida-global.org/careprinciples) (2019; [Carroll et
  al., 2020](https://doi.org/10.5334/dsj-2020-043)): Collective Benefit,
  Authority to Control, Responsibility, and Ethics. Complements FAIR's
  focus on data reusability with a people- and purpose-oriented lens
  asserting Indigenous Peoples' rights and interests in the data
  ecosystems that concern them. At the bottom of the framework order.

A concept framework sits next to these, deliberately **not** built in:
**CRIS Tender v0.1** (draft,
[`cris-tender-v0.1.json`](https://github.com/surf-ori/spii-1b-principles-alignment-tool/blob/main/data/frameworks/cris-tender-v0.1.json))
— 138 principles in 15 sections for comparing Current Research Information
System (CRIS) solutions, based on the public 2026 European tender of
Maastricht University for a CRIS with repository function
([Mercell](https://app.mercell.com/tender/1548230057/Current-Research-Information-System-(CRIS)-with-repository-function)). It is
not an Open Science infrastructure principles framework, so it is not loaded
at startup; it is loaded at runtime via `?framework=` (see below). Drafted
with AI assistance (Claude) and pending review.

## Features

- **Classify** — tag the infrastructure against a research activities
  taxonomy (research life cycle activities plus related activities such as
  managing, documenting, reviewing, publishing, and evaluating), each with
  its own icon.
- **Score** — rate every principle of the selected framework(s), one tab
  per framework, with a live-updating scored/total count in the tab label
  and a status icon (compliant / making progress / not compliant /
  unanswered) next to every principle in the sidebar navigation, so you can
  see progress at a glance without opening each section.
- **Bring your own framework** — import a custom assessment framework
  (JSON) at runtime alongside POSI, POSI+SPII, SPII, GORC, FAIR, BD, OSR, 7GPRI,
  and CARE, download a template to help author one, and export whichever
  frameworks are currently loaded.
- **Export as JSON** — download your results and reload them later to
  continue or revise an assessment.
- **Export as PDF** — download a report of the full assessment.
- **Assessment badge** — download a doughnut-style SVG/PNG badge
  summarizing the score for the active framework, including the classified
  activities as small icons, suitable for hosting on the infrastructure's
  own site.

## Usage

Also live at **[surf-ori.github.io/spii-1b-principles-alignment-tool](https://surf-ori.github.io/spii-1b-principles-alignment-tool/)**
(GitHub Pages, served from this repo's `main` branch — no separate deploy
step). Or serve the directory with any static file server (for example
`python3 -m http.server`) and open `index.html` over http(s); there is
nothing to install or build beyond that. **Opening `index.html` directly
as a `file://` page no longer works** — the ten built-in frameworks are
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
example together and opens the CRIS Tender tab:
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

`index.html#gorc` (or any framework id — `posi-spii`, `spii`, `spii-alignment`, `posi`, `gorc`, `fair`, `bd`, `osr`, `7gpri`, `care`, matched
case-insensitively) opens straight to that framework's tab, with its sidebar section expanded
and every other framework's section collapsed. Selecting a framework tab in the app updates the
URL the same way, so the address bar always reflects which framework is open and can be shared
or bookmarked. It combines with `?report=`/`?framework=`: the three example links in the About
dialog are `?report=data/examples/<file>.json#posi`, so they load the report and land straight on the
framework it's scored against instead of the infrastructure-description tab.

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
