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
bun install
```
