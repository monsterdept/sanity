// Stamp a release version into every file that carries one: `node scripts/stamp-version.mjs 0.32.0`.
//
// The git tag is the single source of truth for the version — `just release` tags, it never bumps
// committed files — so CI writes it into the runner's checkout before building, and never commits
// the result. Shared by the app bundles and the headless archives, so the two cannot be stamped
// differently.
//
// EVERY file that carries the version, not just the bundle's. Stamping tauri.conf.json alone let
// v0.8.1 ship a binary compiled from a Cargo.toml still reading 0.1.0, and `mcp.rs` hands
// `CARGO_PKG_VERSION` to every client as `serverInfo.version`.
//
// Fails closed: a stamp that silently missed is exactly how 0.1.0 shipped inside a 0.8.1 bundle.
import fs from 'node:fs'

const v = process.argv[2]
if (!/^\d+\.\d+\.\d+$/.test(v ?? '')) {
  console.error(`::error::expected a plain MAJOR.MINOR.PATCH version, got '${v}'`)
  process.exit(1)
}

const json = (f, k) => {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'))
  j[k] = v
  fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\n')
}
const sub = (f, re, to) => {
  const before = fs.readFileSync(f, 'utf8')
  const after = before.replace(re, to)
  if (after === before && !before.match(re)) {
    console.error(`::error::${f}: nothing to stamp`)
    process.exit(1)
  }
  fs.writeFileSync(f, after)
}

json('src-tauri/tauri.conf.json', 'version')
json('web/package.json', 'version')
// Anchored to the FIRST `version =` at the start of a line, which is the one in [package] — a
// blind replace would hit every dependency pin in the file.
sub('src-tauri/Cargo.toml', /^version = ".*"$/m, `version = "${v}"`)
// The lockfile entry for this package, found by its own name line. Cargo would rewrite it
// quietly — fine today, an error the moment anything builds --locked.
sub('src-tauri/Cargo.lock', /(name = "sanity"\nversion = )".*"/, `$1"${v}"`)

const cargo = fs.readFileSync('src-tauri/Cargo.toml', 'utf8')
const conf = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'))
if (!cargo.match(new RegExp(`^version = "${v.replaceAll('.', '\\.')}"$`, 'm'))) {
  console.error(`::error::Cargo.toml not stamped to ${v}`)
  process.exit(1)
}
if (conf.version !== v) {
  console.error(`::error::tauri.conf.json not stamped to ${v}`)
  process.exit(1)
}
console.log('version →', v)
