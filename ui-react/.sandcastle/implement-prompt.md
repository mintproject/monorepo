# TASK

Fix issue {{TASK_ID}}: {{ISSUE_TITLE}}

Pull in the issue using `gh issue view <ID>`. If it has a parent PRD, pull that in too.

Only work on the issue specified.

Work on branch {{BRANCH}}. Make commits and run tests.

# SCOPE — IMPORTANT

You are in the **mint monorepo**, but this work is scoped entirely to the
**`ui-react/`** subdirectory (a React 18 + Vite + TypeScript app). Read
`ui-react/CLAUDE.md` first.

- Only create or modify files under `ui-react/`.
- Run every `npm` command from inside `ui-react/` (`cd ui-react` first).
- Do not touch the other monorepo components (submodules like `model-catalog-api`,
  `ui`, `graphql_engine`, etc.). They are out of scope and may be empty in this
  worktree.

# CONTEXT

Here are the last 10 commits touching ui-react:

<recent-commits>

!`git log -n 10 --format="%H%n%ad%n%B---" --date=short -- ui-react`

</recent-commits>

# EXPLORATION

Explore the repo and fill your context window with relevant information that will allow you to complete the task.

Pay extra attention to test files that touch the relevant parts of the code.

# EXECUTION

If applicable, use RGR to complete the task.

1. RED: write one test
2. GREEN: write the implementation to pass that test
3. REPEAT until done
4. REFACTOR the code

# FEEDBACK LOOPS

Before committing, from inside `ui-react/`:

1. Type check: `cd ui-react && npm run typecheck`
2. Run the tests, **scoped to the file(s) you touched**, once, wrapped in an OS
   timeout so a runaway test can never wedge the run:

   `cd ui-react && timeout 180 npx vitest run <path/to/file.test.tsx> --no-file-parallelism`

   Run the full suite (`npm run test`) at most once, at the end, the same way:
   `cd ui-react && timeout 300 npm run test`.

Both type check and tests must pass before you commit.

## Rules for running commands (do NOT ignore)

- **Run each check ONCE and wait for it to finish.** Never start a second test
  run while one is still going. Never launch overlapping/background vitest runs —
  they compete for the container's few CPUs and nothing completes.
- **Do not poll with `sleep`/`cat`/`until` loops.** Run the command in the
  foreground and read its output when it returns.
- **A `timeout` exit (code 124) is NOT flakiness — it means your code or test has
  an infinite loop.** Stop and fix the cause. Do not just re-run it.
  - The usual culprit is a synchronous render loop: vitest's own `testTimeout`
    cannot interrupt a blocked event loop, so the test hangs instead of failing.
    Common cause here is `@tanstack/react-table` with `autoResetPageIndex`
    (default `true`) while `data` changes on every render/keystroke — set
    `autoResetPageIndex: false` or reset the page index explicitly.
- Do not `pkill` node/vitest and retry; that just hides the real bug.

# COMMIT

Make a git commit. The commit message must:

1. Start with `RALPH:` prefix
2. Include task completed + PRD reference
3. Key decisions made
4. Files changed
5. Blockers or notes for next iteration

Keep it concise.

# THE ISSUE

If the task is not complete, leave a comment on the issue with what was done.

Do not close the issue - this will be done later.

Once complete, output <promise>COMPLETE</promise>.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.
