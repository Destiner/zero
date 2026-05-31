# zero

## Scripts

```sh
bun install
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
