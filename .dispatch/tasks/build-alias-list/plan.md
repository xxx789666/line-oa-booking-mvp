# Build alias list by task complexity

- [x] Read `C:\Users\xx\.claude\CLAUDE.md` to understand global conventions (web-access policy, no other dev conventions defined)
- [x] Read project spec: `D:\line官方網站訂閱系統\docs\superpowers\specs\2026-05-13-line-oa-booking-mvp-design.md` (single-business LINE OA booking MVP, GAS backend, LIFF frontend, Google Sheet as DB)
- [x] Read project plan: `D:\line官方網站訂閱系統\docs\superpowers\plans\2026-05-13-line-oa-booking-mvp-plan.md` (25 tasks across 8 phases — sampled task structure incl. Tasks 01-08, 16-22, 24-25)
- [x] Score each of the 25 plan tasks by complexity (low / medium / high) using these rubrics:
      - LOW: pure scaffolding / config files / placeholder writes / no logic (e.g., Task 01, 02, 03, 04, 22 setup steps)
      - MEDIUM: well-specified TDD tasks with the test + code already in the plan (e.g., Tasks 06-15)
      - HIGH: integration / multi-side-effect / cross-module work with judgement calls (e.g., Tasks 16-17 router, 19-21 LIFF, 23-25 deploy)
      Scored: T01-04=LOW; T05=MEDIUM; T06-10,12-14=MEDIUM; T11=HIGH (lock+race); T15=LOW (stub); T16-17=HIGH; T18=LOW; T19-21=HIGH (per LIFF range); T22=LOW (per rubric example); T23-25=HIGH
- [x] Map complexity to model: LOW → haiku, MEDIUM → sonnet, HIGH → opus (applied above)
- [x] Produce a YAML block of aliases (each task one alias, name pattern `booking-t<NN>-<short-slug>`) including a short `prompt:` that points the worker at the relevant Task section in the plan (25 aliases, all ≤40 chars — verified)
- [x] Write the deliverable to `.dispatch/tasks/build-alias-list/output.md` with two sections: (a) a markdown summary table (task / complexity / model / reason), (b) the YAML block ready to paste into `~/.dispatch/config.yaml`
