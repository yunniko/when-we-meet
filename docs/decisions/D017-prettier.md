# D017 · Prettier with the Company config, checked by format:check
Date: 2026-11-22 · Goal: ui-kit G-001 (pilot) · Status: active (superseded by: —)
Context: the project had no formatter; 14 files differed from Prettier's output on master.
Decision: `.prettierrc.json` copied from `COMPANY/configs/`, prettier pinned, `npm run format:check`;
generated files, kit copies and Markdown are ignored (`.prettierignore`).
Force: requirement — STANDARDS.md, Code style: "A formatter is not optional."
Rejected: formatting only files a change touches (the drift would surface in every later diff).
Consequence: one formatting-only commit (e5a8893) sits in history; use `git blame --ignore-rev e5a8893`.
Kit copies are formatted in ui-kit, never here.
Evidence: .prettierrc.json; .prettierignore; commit e5a8893.
