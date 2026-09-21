# Agents

This repo hosts both the Principles Alignment Tool's app code (see `CLAUDE.md` for its
architecture) and SPII deliverable 1B's feedback tracker. The checklist below concerns the
tracker only.

Running checklist for whoever, human or agent, triages feedback on this tracker.

## Recurring

- [ ] Check for new issues opened since the last pass.
- [ ] For each new issue, confirm the required fields (name, organisation, role, representing
      infrastructure) are filled in; if not, ask the reporter to complete them before triage.
- [ ] Check the feedback against deliverable 1B's scope on
      [spii-overview](https://surf-ori.github.io/spii-overview/#deliverables).
- [ ] Record the outcome as a comment on the issue (accepted, rejected, or already covered) with
      a short rationale, then close the issue.
- [ ] Check for new assessment report submissions (an issue with a JSON file attached, from
      "Save Report to GitHub Tracker" → "Open a new issue"; or a pull request adding a file under
      `data/reports/`). If it's an issue attachment, land the file in `data/reports/` yourself (a
      commit or a small PR) before closing the issue — only files actually in `data/reports/`
      count as saved; see `data/reports/README.md` for the filename convention. Review a PR the
      same way: does the file belong (real report, correctly named), does anything in it look
      wrong or spam.

## Open

- [ ] Assign a curator for this deliverable (see spii-overview's `TODO.md`).
- [ ] No feedback received yet.
