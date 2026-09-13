# What a GitHub repository rename breaks

Research for [mintproject/monorepo#285](https://github.com/mintproject/monorepo/issues/285)
(part of #281). Date: 2026-09-12.

**Primary source:** GitHub's own documentation (`docs.github.com`), read from the source
repository [`github/docs`](https://github.com/github/docs) and from the official OpenAPI
description [`github/rest-api-description`](https://github.com/github/rest-api-description).
Answers that GitHub does not document are marked **NOT AUTHORITATIVE**.

## Summary

| # | Question | Answer |
|---|----------|--------|
| 1 | Does GitHub Pages follow a rename? | **No.** Project site URLs are the one documented exception to the redirect. |
| 2 | Does a GHCR package keep its repository link? | **Undocumented for a rename.** GitHub documents link loss for a *transfer* only. |
| 3 | What does the redirect cover? | Web traffic, issues, wikis, stars, followers, and `git clone`/`fetch`/`push`. Not Pages. Not Actions `uses:`. The REST API redirect is documented on 19 of 1229 endpoints. |
| 4 | Can a name that a redirect claims be taken? | **Yes.** GitHub allows it and silently deletes the redirect. A separate retirement rule can block reuse after a *transfer*. |
| 5 | Can an archived repository be renamed? | **Unarchive first.** GitHub does not name rename explicitly, but says every change needs an unarchive. |
| 6 | Does issue transfer work with an archived repository? | **No.** Same read-only rule. Not stated explicitly. |

---

## 1. GitHub Pages does not follow a rename

GitHub states the exception in the first sentence of the rename page:

> When you rename a repository, all existing information, **with the exception of project
> site URLs**, is automatically redirected to the new name.

A project site is the one served at `http(s)://<owner>.github.io/<repositoryname>`.

The site itself is not deleted. Pages derives the path from the repository name, so after a
rename the site is served at `https://<owner>.github.io/<new-name>`. The old path gets no
redirect. GitHub's recommended mitigation is a custom domain:

> If you plan to rename a repository that has a GitHub Pages site, we recommend using a
> custom domain for your site. This ensures that the site's URL isn't impacted by renaming
> the repository.

GitHub says the same about a repository transfer:

> If the transferred repository contains a GitHub Pages site, then links to the Git
> repository on the Web and through Git activity are redirected. However, we don't redirect
> GitHub Pages associated with the repository.

**Docs do not state the HTTP status of the old URL.** They say only that it is not
redirected. GitHub does not document a 404 for this case; the 404 troubleshooting page lists
other causes and does not list renames.

Sources:
- <https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository>
- <https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#types-of-github-pages-sites>
- <https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository#whats-transferred-with-a-repository>
- <https://docs.github.com/en/pages/getting-started-with-github-pages/troubleshooting-404-errors-for-github-pages-sites>

## 2. The GHCR package-to-repository link after a rename

**GitHub does not document this case.** A full-text search of the `github/docs` content tree
finds no statement about a package link and a repository *rename*. The only rename note under
`content/packages/` is about renaming an *account*, not a repository.

What GitHub does document is the neighbouring case, a repository **transfer**:

> For registries that support granular permissions, packages are scoped to a personal account
> or organization... **If you have linked a package to a repository, the link is removed when
> you transfer the repository to another user.** Any codespaces or GitHub Actions workflows
> associated with the repository will lose access to the package. If the package inherited its
> access permissions from the linked repository, users will lose access to the package.

GHCR (`ghcr.io`) is in the granular-permissions list, so this paragraph covers container
packages.

How the link grants push access:

> By default, if you publish a package that is linked to a repository, the package
> automatically inherits the access permissions (but not the visibility) of the linked
> repository... When a package automatically inherits access permissions, GitHub Actions
> workflows in the linked repository also automatically get access to the package.

And the condition that matters here:

> A package only inherits the access permissions of a linked repository automatically if you
> link the repository to the package **before** you publish the package, such as by adding the
> `org.opencontainers.image.source` Docker label to a container image.

**NOT AUTHORITATIVE (community reports, no GitHub docs page):** GitHub Community discussions
report that a rename or a delete-and-recreate can leave a package linked to a repository name
that no longer resolves, and that a workflow then fails with `permission_denied: write_package`
even though the workflow has `packages: write`. The reported fixes are to unlink and relink the
package in its settings, or to push once with a PAT that has `write:packages`.

Practical reading for MINT: the `org.opencontainers.image.source` label is written into the
image at build time and contains the **old** repository URL. Every image built before a rename
carries a stale label. Re-check the link on the package settings page after any rename, and
update the label in the Dockerfile or the build workflow.

Sources:
- <https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages#about-repository-transfers>
- <https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility#about-inheritance-of-access-permissions>
- <https://docs.github.com/en/packages/learn-github-packages/connecting-a-repository-to-a-package>
- Non-authoritative: <https://github.com/orgs/community/discussions/166194>, <https://github.com/orgs/community/discussions/26274>

## 3. What the rename redirect covers

GitHub's list is explicit:

> When you rename a repository, all existing information, with the exception of project site
> URLs, is automatically redirected to the new name, including:
> * Issues
> * Wikis
> * Stars
> * Followers

> In addition to redirecting web traffic, all `git clone`, `git fetch`, or `git push` operations
> targeting the previous location will continue to function as if made on the new location.
> However, to reduce confusion, we strongly recommend updating any existing local clones to
> point to the new repository URL.

**Git remotes: yes.** Fetch and push keep working. GitHub still asks you to run
`git remote set-url origin NEW_URL`.

**Issue and pull request links: yes.** Web traffic redirects.

**REST API: partly, and narrowly documented.** The redirect appears as HTTP `301 Moved
Permanently`:

> A `301` status code indicates permanent redirection. You should repeat your request to the
> URL specified by the `location` header. Additionally, you should update your code to use this
> URL for future requests.

Only **19 of 1229** operations in GitHub's official OpenAPI description declare a `301`
response. They are the repository-level and issue-level reads plus a few issue mutations:

```
GET    /networks/{owner}/{repo}/events
GET    /repos/{owner}/{repo}
GET    /repos/{owner}/{repo}/branches/{branch}
GET    /repos/{owner}/{repo}/commits/{ref}/statuses
GET    /repos/{owner}/{repo}/installation
GET    /repos/{owner}/{repo}/issues
GET    /repos/{owner}/{repo}/issues/{issue_number}
PATCH  /repos/{owner}/{repo}/issues/{issue_number}
GET    /repos/{owner}/{repo}/issues/{issue_number}/parent
GET    /repos/{owner}/{repo}/issues/{issue_number}/labels
POST   /repos/{owner}/{repo}/issues/{issue_number}/labels
PUT    /repos/{owner}/{repo}/issues/{issue_number}/labels
DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels
DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}
GET    /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values
GET    /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by
POST   /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by
DELETE /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by/{issue_id}
GET    /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocking
```

Do not assume any other endpoint follows the rename. Treat an API client that hardcodes the
old name as broken.

**GitHub Pages: no.** See answer 1.

**GitHub Actions `uses:`: no.** This is a separate documented failure:

> GitHub will not redirect calls to an action hosted by a renamed repository. Any workflow that
> uses that action will fail with the error `repository not found`. Instead, create a new
> repository and action with the new name and archive the old repository.

Sources:
- <https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository>
- <https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#follow-redirects>
- <https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#get-a-repository>
- OpenAPI source: `descriptions/api.github.com/api.github.com.json` in <https://github.com/github/rest-api-description>

## 4. Taking a name that a redirect still claims

**Yes, GitHub lets you take it. The redirect is then destroyed.** GitHub does not return an
error; it warns you in advance instead.

On rename:

> [!WARNING]
> If you create a new repository under your account in the future, do not reuse the original
> name of the renamed repository. If you do, redirects to the renamed repository will no longer
> work.

On transfer, the wording is stronger and covers forks too:

> [!WARNING]
> If you create a new repository or fork at the previous repository location, the redirects to
> the transferred repository will be permanently deleted.

The docs speak of *creating* a repository at the old name. A rename into that name reaches the
same end state, and GitHub documents no separate rule for it. **NOT AUTHORITATIVE for the
rename-into-a-claimed-name path specifically**: GitHub does not document an error string, and I
did not test it.

**One case does produce a hard error, but only after a transfer.** A name can be permanently
retired:

> If the transferred repository contains an action listed on GitHub Marketplace, or had more
> than 100 clones or more than 100 uses of GitHub Actions in the week prior to the transfer,
> GitHub permanently retires the owner name and repository name combination
> (`OWNER/REPOSITORY-NAME`) when you transfer the repository. If you try to create a repository
> using a retired owner name and repository name combination, you will see the error:
> "The repository `REPOSITORY_NAME` has been retired and cannot be reused."

Note the trigger is a **transfer**, not a rename. GitHub documents no equivalent retirement for
a plain rename inside the same account.

A related retirement rule exists for account renames and public container images with more than
5,000 downloads. It retires `OLD-NAMESPACE/IMAGE-NAME` permanently.

Sources:
- <https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository>
- <https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository>
- `data/reusables/package_registry/rename-account-namespace-retirement.md` in <https://github.com/github/docs>

## 5. Renaming an archived repository

**You must unarchive it first.** GitHub does not use the word "rename", so this is an inference
from a general rule that is stated plainly:

> When a repository is archived, its issues, pull requests, code, labels, milestones, projects,
> wiki, releases, commits, tags, branches, reactions, code scanning alerts, comments and
> permissions become read-only. **To make changes in an archived repository, you must unarchive
> the repository first.**

> Once a repository is archived, you cannot add or remove collaborators or teams.

The rename page itself assumes an unarchived repository. Its own advice for a renamed action is
"create a new repository and action with the new name and **archive the old repository**" — that
is, archive last.

**NOT AUTHORITATIVE (community, unanswered by GitHub staff):** Community Discussion #58440 is a
feature request to rename an archived repository *without* unarchiving. It confirms that the
current workflow is unarchive, rename, re-archive. It also records a real cost: re-archiving
resets the archive date, so the original archival date is lost.

Sources:
- <https://docs.github.com/en/repositories/archiving-a-github-repository/archiving-repositories#about-repository-archival>
- <https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository>
- Non-authoritative: <https://github.com/orgs/community/discussions/58440>

## 6. Issue transfer and an archived repository

**It does not work, in either direction. Unarchive first.** GitHub does not state this
explicitly for transfers, so it is an inference from two documented rules.

Rule one — the transfer needs write access on both sides:

> To transfer an open issue to another repository, you must have write access to the repository
> the issue is in and the repository you're transferring the issue to.

> You can only transfer issues between repositories owned by the same user or organization
> account. A private repository issue cannot be transferred to a public repository.

Rule two — an archived repository grants no write access:

> When a repository is archived, its **issues**, pull requests, code, labels, milestones,
> projects, wiki, releases, commits, tags, branches, reactions, code scanning alerts, comments
> and permissions become **read-only**.

An archived source repository cannot give up an issue, because moving the issue changes it. An
archived target repository cannot accept one, because it cannot be written to.

`gh issue transfer` calls the same API as the UI, so it inherits the same limit. The CLI page is
a thin wrapper over the UI procedure in GitHub's own docs.

The redirect on a *transferred issue* is documented and does work:

> The original URL redirects to the new issue's URL.

Sources:
- <https://docs.github.com/en/issues/tracking-your-work-with-issues/administering-issues/transferring-an-issue-to-another-repository>
- <https://docs.github.com/en/repositories/archiving-a-github-repository/archiving-repositories#about-repository-archival>
- <https://cli.github.com/manual/gh_issue_transfer>

---

## Checklist if MINT renames a repository

1. **Pages.** Any project site moves to the new path. Set a custom domain first, or accept the
   break. (Answer 1)
2. **GHCR.** Check the package's "Repository source" section after the rename. Update
   `org.opencontainers.image.source` in every Dockerfile. (Answer 2)
3. **Actions.** Grep every workflow for `uses: <owner>/<old-name>`. No redirect exists.
   (Answer 3)
4. **API clients.** Only 19 endpoints document a 301. Update hardcoded names. (Answer 3)
5. **Never reuse the old name.** A new repository or fork at the old name deletes the redirect
   for good. (Answer 4)
6. **Archived repositories.** Unarchive, rename, re-archive. The archive date resets.
   (Answer 5)
7. **Move issues before archiving, not after.** (Answer 6)

## Method

- `github/docs` `main` was downloaded as a tarball and grepped in full. This is the source of
  `docs.github.com`, so the Liquid templating (`{% data variables... %}`) is visible in the
  quotations above.
- `descriptions/api.github.com/api.github.com.json` from `github/rest-api-description` was
  parsed to count the operations that declare a `301` response.
- No repository setting was changed and nothing was tested against a live repository.
