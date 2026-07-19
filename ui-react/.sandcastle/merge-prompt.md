# TASK

Merge the following branches into the current branch:

{{BRANCHES}}

For each branch:

1. Run `git merge <branch> --no-edit`
2. If there are merge conflicts, resolve them intelligently by reading both sides and choosing the correct resolution
3. After resolving conflicts, verify types from inside ui-react: `cd ui-react && npm run typecheck`
   (Do NOT run `npm run test` here — this phase reuses the host node_modules, whose
   native binaries do not run in this container. Each branch's tests already passed
   during implementation and review; the type check confirms the merge is sound.)
4. If the type check fails, fix the issues before proceeding to the next branch

After all branches are merged, make a single commit summarizing the merge.

# CLOSE ISSUES

For each branch that was merged, close its issue using the following command:

`gh issue close <ID> --comment "Completed by Sandcastle"`

Here are all the issues:

{{ISSUES}}

Once you've merged everything you can, output <promise>COMPLETE</promise>.
