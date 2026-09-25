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

[`monsterdept/sanity-action`](https://github.com/monsterdept/sanity-action) runs `verify` on a
Linux x86-64 runner:

```yaml
name: Readings
on: [pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: monsterdept/sanity-action@v1
        with:
          version: 0.31.2          # the Sanity release your team reads with
          model: claude-sonnet-5   # optional: require this model
          # harness: claude        # optional: require this agent
          # path: services/api     # optional: a repo in a subdirectory
          # consistent-reader: false   # optional: allow mixed models
```

**Pin `version`.** A new release can change the parser or the questions, which can make
existing readings out of date. Pinning means your check only changes when you decide to
upgrade.

To check releases instead of pull requests, add the job before your build with `needs:`.
Sanity checks its own releases this way: see
[`.github/workflows/readings.yml`](../.github/workflows/readings.yml).

## Other CI systems

Download the `.AppImage` for your pinned version and run it:

```sh
curl -fsSLo sanity https://dl.dept.monster/sanity/Sanity_0.31.2_amd64.AppImage
chmod +x sanity
APPIMAGE_EXTRACT_AND_RUN=1 ./sanity verify "$PWD"   # use an absolute path: the AppImage starts in its own directory
```

`APPIMAGE_EXTRACT_AND_RUN=1` is needed on runners without `libfuse2`.
