# In CI

You take readings on your own machine, against the code you're about to ship, and commit
them. CI doesn't take readings, because that would mean putting model credentials in CI. It
only checks what you committed. `sanity verify` fails unless the readings are:

- **complete**: every function and file in scope has a reading;
- **current**: no reading is out of date for the code that's checked out, and none was taken
  with an older version of the questions;
- **from one model**: every reading was taken with the same agent and model. `--model` and
  `--harness` require a specific one. `--mixed` turns this check off but still prints what
  was used.

`verify` doesn't need git history, network access or credentials.

## GitHub Actions

[`monsterdept/sanity-action`](https://github.com/monsterdept/sanity-action) runs `verify` on
Linux, macOS and Windows runners, x86-64 or ARM64 (macOS: ARM64 only):

```yaml
name: Readings
on: [pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: monsterdept/sanity-action@v2
        with:
          version: 0.33.0          # the Sanity release your team reads with
          model: claude-sonnet-5   # optional: require this model
          # harness: claude        # optional: require this agent
          # path: services/api     # optional: a repo in a subdirectory
          # consistent-reader: false   # optional: allow mixed models
```

**Pin `version`.** A new release can change the parser or the questions, which can make
existing readings out of date. Pinning means your check only changes when you decide to
upgrade.

`@v2` needs Sanity 0.33.0 or later, the first release with headless builds. For an older
version, `@v1` runs the Linux x86-64 AppImage.

To check releases instead of pull requests, add the job before your build with `needs:`.
Sanity checks its own releases this way: see
[`.github/workflows/readings.yml`](../.github/workflows/readings.yml).

## Other CI systems

Each release from 0.33.0 includes a headless `sanity`: every command, without the app's window,
as a single binary of about 16 MB compressed. Download the one for your runner and run it:

```sh
curl -fsSL https://github.com/monsterdept/sanity/releases/download/v0.33.0/sanity-0.33.0-x86_64-unknown-linux-gnu.tar.gz | tar -xz
./sanity verify
```

The targets are `x86_64-unknown-linux-gnu`, `aarch64-unknown-linux-gnu`, `aarch64-apple-darwin`,
`x86_64-pc-windows-msvc` and `aarch64-pc-windows-msvc`; Windows archives are `.zip`. From 0.34.0
the archives are named `sanity-headless-<version>-<target>`; 0.33.0's are `sanity-0.33.0-<target>`,
as above. Each release's notes say which file is which. The Linux
builds need glibc 2.35 or later (Ubuntu 22.04). On a desktop, install the app instead: it
includes the same `sanity`.
