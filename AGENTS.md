# Agent instructions for mova

## Always use the Nix dev environment

Run every project command (yarn, node, jest, expo, gradle, adb tooling, etc.)
inside this repo's Nix dev shell — never against system-wide toolchains. The
shells pin the supported versions (e.g. Node 22; the system profile may carry a
different major version).

Non-interactive shells do not load the direnv hook, so activate the environment
explicitly:

```bash
# Preferred: reuse the .envrc (equivalent to `use flake . --impure`)
direnv exec . <command>

# Equivalent:
nix develop --impure . --command <command>

# Android work (SDK, gradle, emulator) needs the android shell:
nix develop --impure .#android --command <command>
```

The `--impure` flag is required — the flake's nixGL input fails to evaluate in
pure mode.
