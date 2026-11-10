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

The installers aren't code-signed yet ([code signing policy](https://intuacode.com/code-signing.html)), so Windows
SmartScreen and macOS Gatekeeper warn the first time they're opened: check the checksum or the attestation first.
Signing is set up in the release workflow and starts once the certificates are bought (below).

## Code signing (for the maintainer)

The release workflow (`.github/workflows/desktop.yml`) signs the installers by itself once the secrets below are in
the repository (Settings → Secrets and variables → Actions). Without them, it builds unsigned installers as before.
Each platform turns on separately. When signing is on, the workflow checks every signature after the build and stops
the release if one isn't valid. Turn on multi-factor authentication for GitHub first: these secrets can sign code in
your name.

### Windows: an SSL.com certificate with eSigner cloud signing

Tauri signs the app, its uninstaller, the setup `.exe` and the `.msi` with `tools/sign-windows.ps1`. That script
uses [Jsign](https://ebourg.github.io/jsign/) (downloaded by the workflow and checked against its SHA-256) and
SSL.com's eSigner, so the key stays in SSL.com's cloud HSM and no USB token is needed.

1. Buy a code signing certificate from [SSL.com](https://www.ssl.com/certificates/code-signing/buy/): Individual
   Validation (IV) in your own name, or Organization Validation (OV) in a registered business's name. The name on it
   is what Windows shows as the publisher. Choose **eSigner cloud signing** when it's issued, and take an eSigner plan
   that covers about 5 signatures per release (the first 30 days are free).
2. Enrol the certificate in eSigner for automated signing. Keep the **TOTP secret** (the base64 text under the QR
   code); it's shown only once.
3. Add four secrets: `ESIGNER_USERNAME` and `ESIGNER_PASSWORD` (your SSL.com login), `ESIGNER_CREDENTIAL_ID` (the
   certificate's credential ID in eSigner) and `ESIGNER_TOTP_SECRET`.
4. Optional, to rehearse first: SSL.com has a sandbox with a test certificate. Add the variable (not a secret)
   `ESIGNER_ENDPOINT` = `https://cs-try.ssl.com` with the sandbox's login in the secrets, run a release, then delete
   the variable and put the real login back. The rehearsal's installers aren't trusted by Windows, so delete that
   release afterwards.

Windows' SmartScreen trusts a new certificate gradually, as people download signed releases, so the first signed
versions may still be warned about. No certificate gets instant trust since 2024.

### macOS: Apple Developer ID and notarisation

Tauri signs the app with a Developer ID certificate, sends it to Apple to be notarised, and staples the result, so
macOS opens it without warnings.

1. Join the [Apple Developer Program](https://developer.apple.com/programs/) (US$99 a year).
2. On a Mac, create a **Developer ID Application** certificate (Xcode → Settings → Accounts → Manage Certificates),
   export it from Keychain Access as a `.p12` with a password, and turn it into one line of text:
   `base64 -i certificate.p12 | tr -d '\n'`.
3. At [account.apple.com](https://account.apple.com), create an app-specific password for notarisation.
4. Add six secrets: `APPLE_CERTIFICATE` (the base64 text), `APPLE_CERTIFICATE_PASSWORD` (the `.p12`'s password),
   `APPLE_SIGNING_IDENTITY` (the certificate's name, like `Developer ID Application: Your Name (TEAMID)`),
   `APPLE_ID` (your Apple Account's email), `APPLE_PASSWORD` (the app-specific password) and `APPLE_TEAM_ID`.

### Once both are set up

Update the [code signing policy](https://intuacode.com/code-signing.html) (`site/code-signing.html`) to name the
publisher and the certificates, and the README's "These builds aren't code-signed yet" section.

## How the project keeps itself safe

- Every GitHub Action is pinned to a commit, not a movable tag.
- Every change runs the tests, including the real desktop app on Windows and Linux, before it's merged.
- The desktop app has a strict Content-Security-Policy (`src-tauri/tauri.conf.json`); the home page has one too.
- The website is served over HTTPS only.
