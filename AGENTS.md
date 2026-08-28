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

## Testing changes on the physical Wear OS watch

Wear tile layouts cannot be trusted until they render on a real screen — tile
slots have tight, size-dependent width budgets, and overflowing content is
silently clipped rather than reported. Verify watch UI changes on hardware.

```bash
nix develop --impure .#android --command just watch connect   # find + connect
nix develop --impure .#android --command just watch push      # build + install
nix develop --impure .#android --command just watch shot      # screenshot
```

`scripts/wear/watch.sh` (behind `just watch`) discovers the watch over mDNS, so
the randomized wireless-debugging port does not have to be re-read after every
reboot. It needs a one-time `just watch pair <ip:port> <code>` from the watch's
Developer options → Wireless debugging → Pair new device screen.

`push` signs with the release keystore from `pass`, matching the signature of
the published APKs, so it upgrades the existing install instead of forcing an
uninstall that would drop the watch's paired credentials.
