# Games: contracts, engagement and achievement

[Version française](jeux-suivi.fr.md) · [Proposed ADR 0033](decisions/0033-suivi-jeux.md).

## Delivery batches

1. Document and classify all nine existing games, separating navigation families, pedagogical intent, activity types, interaction, restitution, editorial difficulty and canonical targets.
2. Add a versioned game event bridge, bounded local attempt journal, duplicate protection, interruption handling and report validation.
3. Instrument the six shared Academies and Hangman's private spelling sessions without collecting words or answers.
4. Add adapters for 2048, Sudoku and crosswords, plus catalogue family filtering.
5. Show local activity details and share bounded aggregates through the existing Family and Teacher spaces.

These are application extensions for review. The Notion S6–S9 transpositions and human editorial reviews are not automatically approved. Game pages remain offline-capable, self-contained and sandboxed, with pure rule engines and existing keyboard/mobile tests.

## Existing games and observed success

| Game | Family / intent | Interaction / output | Success and limits |
|---|---|---|---|
| 2048 | Numbers / apply | Tile merging / target | Target tile reached; blocked board before target is failure. No measured autonomy. Explicit target: powers of two (`notion.mathematiques.puissances`), not academic mastery |
| Minesweeper | Logic / practise | Grid / game | Safe cells cleared, mine hit, solver-checked Academy exercises. No inferred probability mastery; canonical target pending qualification |
| Chess | Strategy / practise | Moves / game | Computer-game outcome and Academy exercises. Two-player games end neutrally; draws are excluded from assessable successes. Canonical target pending |
| Belote | Cards / practise | Choices / game | Game outcome and corrected trick/bidding exercises. Advice counts as a hint. Canonical target pending |
| Arrowwords | Language / consolidate | Entry / grid | Completed grid and Academy exercises. Errors observed when checked, hints counted; canonical target pending |
| Crosswords | Language / consolidate | Entry / grid | Completed stage grid, errors observed when checked, hints counted. Mathematical vocabulary does not prove concept mastery; canonical target pending |
| Hangman | Language / consolidate | Entry / word | Word found/lost and Academy exercises; incorrect letters and hints counted. Canonical target pending |
| Texas Hold'em | Cards / practise | Choices / hand | Hand outcome and corrected hand comparisons. Ties neutral; chips/stakes excluded from pedagogical KPIs. Canonical target pending |
| Sudoku | Logic / practise | Entry / grid | Completed grid; conflicts, incorrect checks and revealed hints observed. Canonical target pending |

The main game interaction is classified as manipulation. Academy lessons are guided activities; reviews, challenges and spelling tests are exercises. Difficulty uses each game's editorial grades, independently of curriculum Stage and learner mastery. No game automatically becomes a Lab.

Hangman's “My words” reports only session counters: one boolean per correction and an all-correct session outcome. Private words, lists, definitions and learner answers never enter events or reports. Restarting an incorrect-word review creates a separate attempt.

## KPI semantics and retention

Local details group attempts by activity and mode. Reports show the latest played version, based on up to the **last 64 attempts per game**. Active days cover the last seven days within that window. Previous badges remain intact without fabricating historical attempts.

- Completion: completed non-abandoned attempts / started attempts. Draws count as completed.
- Success: successful / assessable completed attempts. Draws, abandoned and pending attempts are excluded.
- Autonomy: successes without observed errors or hints / successes with observable errors. Unobservable autonomy is shown as not measured.
- Consolidation: successful / completed reviews. Progression uses actual acquired lessons or grades and the adapter's real total.
- Active time comes from the existing inactivity-aware timer, cumulative across versions; its scope is explicitly labelled.
- Game points, global XP and academic mastery remain separate. Client-reported results are not server-certified assessments.

The v2 bridge requires declared parent origins and a verified parent window; the dashboard requires the expected sandboxed frame and game ID. Unknown fields, invalid counters, duplicate/out-of-order events and changed attempt identities are rejected. Actual first actions start attempts; previews/restoration alone do not. New activities, frame removal, reload and recovery after closing mark unfinished attempts as abandoned rather than failed.

Game facts live under the optional `jeux` key of the existing v1 local event envelope. They follow session/remember/erase, export/import and encrypted account sync. Existing snapshot size limits remain: oversized optional event data may be omitted by the existing account compaction. Standalone pages keep independent local trophies and emit no shared events.

## Tutor sharing

Family reports include all measured games for attached children. Teacher responses are filtered on the server using explicit, resolved targets and the teacher's subjects, before any game aggregate is exposed. This release qualifies 2048 for mathematics when Powers is available in the served catalogue; the other eight games await target qualification and remain visible to parents. Legacy navigation links do not grant teacher access.

Reports contain only bounded counters, dates and game versions, never the attempt journal or learner text. The existing JSON report columns need no migration. Existing roles, attachment permissions, agreements, report cadence and cascade deletion apply. Freshness and unavailable measurement are shown explicitly; no notifications or external exports are added.

Validation covers the shared contract, canonical references, persistence, privacy and teacher filtering in `tests/unit/suivi-jeux.test.mjs`, the real bridge and dashboard in `tests/e2e/suivi-jeux.test.mjs`, and all existing game engine/browser suites. Run `npm run ci` before CODEOWNER review. Human review and ADR approval remain tracked in the manual-actions register.
