# zero

Minimal CLI-style TUI wrapper for the coding agent.

```sh
bun run tui
```

Output is written to normal terminal scrollback while the prompt stays pinned
at the bottom under a `⊘` marker. Type a message and press Enter to send it.
Use Shift+Enter for a newline, `/new` to start a fresh session, and Ctrl+C to
abort an active turn or exit when idle. Colors follow the terminal light/dark
theme when the terminal reports it.

## Scripts

```sh
bun install
bun run tui
bun run check
bun run typecheck
```

## Vendored dependencies

`drone` is bundled as a packed tarball under `vendor/` and referenced via
`file:./vendor/drone-1.0.0.tgz` in `package.json`. To refresh it, rebuild and
pack from the drone repo, then copy the tarball in:

```sh
bun --filter drone dist:pack   # in the drone repo → packages/drone/drone-1.0.0.tgz
cp ../drone/packages/drone/drone-1.0.0.tgz vendor/
bun pm cache rm                # required — see note below
bun install
```

The `bun pm cache rm` step is not optional. bun caches `file:` tarballs keyed by
path + version, and `drone` stays at `1.0.0` across repacks, so the cache key
never changes. Without clearing the cache, `bun install` re-extracts the stale
copy and the new tarball's contents never reach `node_modules`. `bun install
--force` does **not** help — only clearing the cache does.
