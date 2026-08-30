# TASK

Review the code changes on branch `{{BRANCH}}` and improve code clarity, consistency, and maintainability while preserving exact functionality.

All changes are scoped to the **`ui-react/`** subdirectory of the mint monorepo.
Review only `ui-react/` code and run commands from inside it.

# CONTEXT

## Branch diff

!`git diff {{TARGET_BRANCH}}...{{BRANCH}} -- ui-react`

## Commits on this branch

!`git log {{TARGET_BRANCH}}..{{BRANCH}} --oneline`

# REVIEW PROCESS

1. **Understand the change**: Read the diff and commits above to understand the intent.

2. **Analyze for improvements**: Look for opportunities to:
   - Reduce unnecessary complexity and nesting
   - Eliminate redundant code and abstractions
   - Improve readability through clear variable and function names
   - Consolidate related logic
   - Remove unnecessary comments that describe obvious code
   - Avoid nested ternary operators - prefer switch statements or if/else chains
   - Choose clarity over brevity - explicit code is often better than overly compact code

3. **Check correctness**:
   - Does the implementation match the intent? Are edge cases handled?
   - Are new/changed behaviours covered by tests?
   - Are there unsafe casts, `any` types, or unchecked assumptions?
   - Does the change introduce injection vulnerabilities, credential leaks, or other security issues?

4. **Maintain balance**: Avoid over-simplification that could:
   - Reduce code clarity or maintainability
   - Create overly clever solutions that are hard to understand
   - Combine too many concerns into single functions or components
   - Remove helpful abstractions that improve code organization
   - Make the code harder to debug or extend

5. **Apply project standards**: Follow the coding standards below (also read `ui-react/CLAUDE.md`):

<coding-standards>

!`cat ui-react/.sandcastle/CODING_STANDARDS.md`

</coding-standards>

6. **Preserve functionality**: Never change what the code does - only how it does it. All original features, outputs, and behaviors must remain intact.

# EXECUTION

If you find improvements to make:

1. Make the changes directly on this branch (only under `ui-react/`)
2. Verify nothing is broken: `cd ui-react && npm run typecheck && npm run test`
3. Commit describing the refinements

If the code is already clean and well-structured, do nothing.

Once complete, output <promise>COMPLETE</promise>.
