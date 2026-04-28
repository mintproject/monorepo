---
phase: quick-260427-vbh
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - ui/.github/workflows/docker-publish.yml
autonomous: true
requirements:
  - QUICK-260427-vbh
must_haves:
  truths:
    - "docker-publish.yml uses docker/build-push-action@v3.0.0 for the build step"
    - "Branch names with '/' are sanitized to '-' before use as Docker tags"
    - "Changes are committed in the ui submodule and the superproject pointer is bumped"
  artifacts:
    - path: "ui/.github/workflows/docker-publish.yml"
      provides: "CI workflow with sanitized branch tag logic"
      contains: "SAFE_BRANCH"
  key_links:
    - from: "ui/.github/workflows/docker-publish.yml"
      to: "docker/build-push-action@v3.0.0"
      via: "tags: ${{ env.SAFE_BRANCH }}"
      pattern: "SAFE_BRANCH"
---

<objective>
Commit the already-applied diff in `ui/.github/workflows/docker-publish.yml` that:
1. Widens the branch trigger from `'*'` to `'**'` (matches slash-containing branches)
2. Adds a `SAFE_BRANCH` env var that replaces `/` with `-` in the branch name
3. Uses `${{ env.SAFE_BRANCH }}` as the Docker image tag (instead of the raw branch name)
4. Keeps `docker/build-push-action@v3.0.0` as the build action

Then bump the `ui` submodule pointer in the superproject so CI picks up the updated workflow.

Purpose: Branches like `gsd/phase-12-is-optional` produce invalid Docker tags (`/` is forbidden). The sanitization converts them to valid tags (`gsd-phase-12-is-optional`).
Output: One commit in `ui` submodule + one commit in superproject (`mint`).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Commit the diff in the ui submodule</name>
  <files>ui/.github/workflows/docker-publish.yml</files>
  <action>
The diff is already applied in the working tree of the `ui` submodule at
`/Users/mosorio/repos/mint/ui`. No edits are needed — only a commit.

From within the `ui` submodule directory, stage and commit the file:

```bash
git -C /Users/mosorio/repos/mint/ui add .github/workflows/docker-publish.yml
git -C /Users/mosorio/repos/mint/ui commit -m "ci: use build-push-action and sanitize branch name for Docker tag"
```

The commit message must follow the project's no-emoji, no-Claude-attribution convention.
  </action>
  <verify>
    <automated>git -C /Users/mosorio/repos/mint/ui log --oneline -1 | grep -q "sanitize branch" && echo "PASS" || echo "FAIL"</automated>
  </verify>
  <done>
`git log --oneline -1` inside the ui submodule shows the new commit. `git status` shows no unstaged changes for docker-publish.yml.
  </done>
</task>

<task type="auto">
  <name>Task 2: Bump the ui submodule pointer in the superproject</name>
  <files>ui</files>
  <action>
After the submodule commit, the superproject (`/Users/mosorio/repos/mint`) sees `ui` as
modified (new HEAD). Stage and commit the pointer update:

```bash
git -C /Users/mosorio/repos/mint add ui
git -C /Users/mosorio/repos/mint commit -m "chore: bump ui submodule (sanitize branch for Docker tag)"
```

Do NOT stage any other files (`.wolf/`, `.planning/`, etc.).
  </action>
  <verify>
    <automated>git -C /Users/mosorio/repos/mint log --oneline -1 | grep -q "bump ui" && echo "PASS" || echo "FAIL"</automated>
  </verify>
  <done>
`git log --oneline -1` in the superproject shows the pointer bump commit. `git submodule status` shows the `ui` submodule pointer matches the commit from Task 1.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| CI runner → DockerHub | Push credentials stored as GitHub secrets; no change in this plan |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-vbh-01 | Tampering | docker-publish.yml | accept | Workflow change is additive (sanitization only); no new secret access or privilege escalation |
</threat_model>

<verification>
After both tasks complete:

1. `git -C /Users/mosorio/repos/mint/ui log --oneline -3` — new commit is the top entry
2. `grep -n "SAFE_BRANCH" /Users/mosorio/repos/mint/ui/.github/workflows/docker-publish.yml` — shows 3 occurrences (set, export, tags line)
3. `grep "on:" -A5 /Users/mosorio/repos/mint/ui/.github/workflows/docker-publish.yml` — branches trigger shows `'**'`
4. `git -C /Users/mosorio/repos/mint submodule status ui` — shows `+` resolved (pointer updated)
</verification>

<success_criteria>
- docker-publish.yml committed in ui submodule with SAFE_BRANCH sanitization
- ui submodule pointer bumped in superproject
- No other files modified in either repository
</success_criteria>

<output>
After completion, create `.planning/quick/260427-vbh-modify-ui-github-workflows-docker-publis/260427-vbh-SUMMARY.md`
</output>
