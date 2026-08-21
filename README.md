# dsh-worktree

Git worktree integration for DeepSeek Harness.

## Features

- Adds **Create Worktree** to Git Workspace rows.
- Registers each linked worktree as a normal DSH Workspace.
- Names new workspaces as `<parent>/<task>`.
- Uses a GitTree icon for linked worktree workspaces.
- Removes the Git worktree before deleting its DSH Workspace registration.
- Provides Chinese and English UI strings and follows DSH light/dark theme tokens.

## Development

```bash
node build.mjs
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vitest run
```
