# Teams / multi-tenancy (not in v1)

v1 is single-user. `user_id` is the tenancy key on every table. This page is the **migration path only** — it is not implemented (DEC-SCOPE-01).

## Intended shape

Add `workspace_id` (uuid) to every tenant table (`categories`, `tasks`, `clients`, `projects`, `time_logs`, `subscriptions`). Membership:

```text
workspaces (id, name, created_at)
workspace_members (workspace_id, user_id, role, unique (workspace_id, user_id))
```

RLS `using` / `with check` changes from `(select auth.uid()) = user_id` to “current user is a member of this row’s workspace”. Keep `user_id` as **created-by** where audit matters; do not use it as the only isolation key after the move.

## Client store

Today `ownerId` is the device’s account. A workspace world needs `workspaceId` (or a list) in persist, and sync must not treat another member’s snapshot as “deleted here”. Tombstones stay per workspace.

`prepareForSync` account-switch behaviour (wipe device when a different user signs in) becomes “switch workspace”, not “switch human”, if several people share a browser profile — unlikely, but the wipe rule must be rewritten explicitly.

## Billing

`subscriptions.user_id` is the account that pays. For a team, that probably becomes `subscriptions.workspace_id` with one Pro gate per workspace. The free-plan client cap (`client_count`) must count inside the workspace, not per user, or two members each get a “free” client.

## Suggested rollout

1. Add nullable `workspace_id` columns + backfill `workspace_id = user_id` (one personal workspace per existing user).
2. New RLS policies beside the old ones, then drop the `user_id`-only policies.
3. Stop writing rows with null `workspace_id`; then `not null`.
4. Only then add invites / roles.

Do not put a unique `(workspace_id, name)` on clients or categories for the same reason v1 has none: two offline devices would 23505 the whole sync tour.
