# Changelog

## Unreleased

### New features

- `GET /standardvariables` accepts `label_contains=<term>`: a case-insensitive substring filter on the label. `%` and `_` in the term are matched literally, so underscore-heavy labels such as `land_surface_wind__speed` search as typed. Available on every list endpoint; documented on `/standardvariables`.
- `GET /standardvariables` accepts `enable_ckan=true`, returning the CKAN autocomplete shape `{"ResultSet": {"Result": [{"Name": "..."}]}}` instead of the default array. Restores the v1.8.0 behaviour that the CKAN dataset form's standard-variable autocomplete depends on.

### Notes

- `label` is unchanged and still an exact match. Use `label_contains` for prefix/substring search.

## v2.1.0 — 2026-05-09

### Breaking changes

- Relationship arrays no longer accept string-id form. Send objects: `hasInput: [{id: "..."}]`. Old form `hasInput: ["..."]` returns HTTP 400 `STRING_ID_DEPRECATED`. Migration: replace every `[string, ...]` array on relationship fields with `[{id: string}, ...]`.

### New features

- `POST` and `PUT` on every resource accept arbitrarily nested payloads (depth <= 8, total nodes <= 500, per-array length <= 200). Single atomic Hasura mutation per request. Replace-subtree semantics on `PUT`: payload IS the new state of every relationship at every depth.
- Dynamic `update_columns` per nested target row from supplied payload keys: id-only links without clobbering, id+scalars updates only those columns.

### Fixes

- bug-087: nested target on_conflict no longer clobbers existing rows when client sends only the id.
- bug-087 (PUT): junction FK column resolution from `resource-registry` (with optional `targetFkColumn` override). Hasura FK violations on writes now surface as 400 with `"id may target wrong resource type"` hint.
- bug-089: no parity gap between POST and PUT for nested writes.
