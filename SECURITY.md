# Security

## Reporting a problem

Please report security problems privately, not in a public issue: on GitHub, open the **Security** tab and choose
**Report a vulnerability**. Say what you found, how to reproduce it, and which version (or intuacode.com) you used.
If that option isn't there, open an issue asking for a private way to send it, without the details.

You'll get a reply as soon as possible, a fix in the next release for anything confirmed, and credit if you'd like it.

Supported: the newest release, and intuacode.com.

## What IntuaCode does with your code

- **No accounts, no tracking.** There is no sign-up, telemetry, analytics or advertising. The website and the app
  load nothing from other sites: the fonts, the Python engine (Pyodide) and the code parsers are bundled.
- **The browser version** (intuacode.com/app/) runs entirely in your browser. Projects are kept in that browser's
  storage on your computer and are never uploaded.
- **The desktop app** reads and writes only folders you choose (and its own scratch folder); it refuses paths
  outside a project's folder. It runs your programs, and `$` commands you type, with your own Python, compilers
  and arduino-cli, with your user's permissions, as a terminal would.
- **Web pages you build** run in a sealed preview: a sandboxed frame with an origin of its own, so they can't reach
  the editor, your other projects or (in the desktop app) its commands. They talk to the editor only by messages.
- **Imported code:** `.env` files (where passwords and keys usually live) are never brought into a project.

## Checking a download

Installers are built only by GitHub Actions (`.github/workflows/desktop.yml`) from this public source.
Each release has:

- `SHA256SUMS.txt`, the SHA-256 of every file (also shown on intuacode.com):
  `sha256sum -c SHA256SUMS.txt --ignore-missing` on Linux, `Get-FileHash <file> -Algorithm SHA256` in PowerShell;
- a signed provenance attestation for each installer, recording the workflow run and commit that built it:
  `gh attestation verify <file> --repo matthewvincentthomasmalone-ops/IntuiCode`.

The installers aren't code-signed yet, so Windows SmartScreen and macOS Gatekeeper warn the first time they're
opened. Check the checksum or the attestation first.

## How the project keeps itself safe

- Every GitHub Action is pinned to a commit, not a movable tag.
- Every change runs the tests, including the real desktop app on Windows and Linux, before it's merged.
- The desktop app has a strict Content-Security-Policy (`src-tauri/tauri.conf.json`); the home page has one too.
- The website is served over HTTPS only.
