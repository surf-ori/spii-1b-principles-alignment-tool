# The new interface: several infrastructures side by side

Since 27 November 2026 `index.html` is the Principles Alignment Assessment Tool's new interface: https://surf-ori.github.io/spii-1b-principles-alignment-tool/. It started as a proof of concept in `poc/` (that address now redirects here). The previous version is in `old/index.html`: https://surf-ori.github.io/spii-1b-principles-alignment-tool/old/

It takes its user experience cues from the [Digital Autonomy Assessment Tool](https://utrechtuniversity.github.io/digital-autonomy-assessment-tool/) (DAAF, Utrecht University). None of DAAF's code is used: its licence (CC BY-NC-SA 4.0) does not allow turning it into another framework. It works on the real POSI data (`data/frameworks/`) and on the example reports in `data/examples/`.

## What is in it

| Idea | In the new interface |
| --- | --- |
| DAAF starts with an explanation when nothing is saved yet | A welcome screen: what the tool does, three steps, and buttons to add an infrastructure, import, open the framework, or load the three examples (OpenAIRE, OpenAlex, HAL). |
| An overview, and several applications side by side | An **overview** tab plus one tab per infrastructure. The overview has key figures, the research-landscape circle, a scatter plot and a sortable table. |
| DAAF's organisational unit | The **research activities** of the landscape, as chips on each infrastructure. |
| The DAAF quadrant | A **scatter plot** where you choose what goes on each axis: overall alignment, a section or one principle. |
| The 101 Innovations circle (Bosman and Kramer) | The **research-landscape circle**: each slice is a research activity. An infrastructure appears in every activity it supports, and the further out it sits, the more aligned it is. You choose the measure: overall, a section or one principle. |
| Profiles in DAAF's top bar | A **Framework and scale** button (layers icon). At the top a **catalogue** of all frameworks (approved ones first, POSI + complementary principles by default). Below it every field of the framework JSON is editable, for full disclosure: id, title, short name, description, about, approved, and so on. Two closed accordions hold the **scale** (icon, colour, order, title, description, and whether a level counts; with a warning that the per-principle descriptions may stop fitting) and the **sections and principles** (all texts editable; sections and principles can be added, removed and reordered). The footer has Import framework, Reset, Download (JSON) and Save and use. Answers are kept per framework, so switching does not lose them. |
| The title and description inside the input fields | The infrastructure's name is a large field with its placeholder. URL, date, "assessed by" and framework sit side by side, so there is less scrolling. |
| Progressive disclosure | Each principle is one compact row: code, star, title, a short question and the level buttons. Click it and it unfolds the principle text, what each level looks like (where we have it), ideas to improve, examples and a notes field. Once rated, the chosen level's description shows under the row. |
| A radar plot | A **radar per infrastructure** with all 23 principles, and the four sections as a coloured ring. |
| Wider, smaller type | A 15 px base and an 84 rem page. |
| The DURF position paper's contents | A **Contents** drawer (bottom left) with all sections and principles, a coloured dot for each answer, ★ for priorities, and the principle in view highlighted. |
| Settings in the tool's own bar | A cog in the tool's bar opens Settings. Import, export and the framework button sit there too. |
| Import and export as in the current tool | **Import** opens a dialog: drop JSON reports on it or choose them (this page's exports, or reports saved with the current tool, for all their frameworks). **Export** is a menu with the current tool's options: save report to the GitHub tracker, save alignment to a file (JSON), print report / save as PDF, save to Word (.docx), and download the framework. On an infrastructure's page it exports that one; on the overview all of them. |

## Kevin's feedback, and what the new interface does with it

- **"The sidebar and the score at the top say the same thing."** There is no permanent sidebar any more. The contents drawer opens only when you want it, and the scores sit in one results row.
- **"There is no payoff at the end."** When every principle is rated, a toast appears and a result card shows at the bottom of the page, with buttons to compare in the overview or export.
- **"Folding questions in and out seems unnecessary."** Rating works on the compact row, without unfolding. Unfolding is only for when you want the explanation. After you rate a principle, the keyboard focus moves to the next unrated one (keys 1, 2, 3, and 0 for not applicable).
- **"The questions are a copy of the principles."** Each principle now has a short question under its title. These 23 questions are a **first draft (AI-assisted) and need review**. Settings can hide them.
- **"Percentages and number of principles: do they serve a purpose?"** The overview keeps one percentage per infrastructure and per section, and drops the %/# switch.
- **"Custom scales weaken comparisons."** The scale is the same for every infrastructure on the page. Your own level descriptions switch off the POSI descriptions per principle, so the two never contradict each other.

## Not in it (yet)

The badge; comparing infrastructures across different frameworks; the bar chart in the Word report. The research activities of the three examples are a demo choice, not part of the published reports.

## Data

Everything is kept in this browser (`localStorage`, key `spii-alignment-poc.v1`): the infrastructures with their answers per framework (`alignments[frameworkId][principleId]`), your edited or imported frameworks, and the framework in use. Older saves (answers without a framework, a POSI scale of their own) are converted on load. The JSON export carries your own frameworks along, so an import restores them.

## Icons

The research-activity icons (on the circle, the chips and the table) come from the [SPII design system](https://surf-ori.github.io/spii-design-system/) (`SPII.activityIcon`). The current tool uses them from there too, and keeps the same set as a fallback for when the design system does not load; a test checks that the two stay equal.
