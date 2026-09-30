"""Download the Python engine (Pyodide) into ./pyodide so IntuiCode runs without the internet.

    python3 tools/fetch_pyodide.py

Without this folder, IntuiCode loads Pyodide from a CDN instead, which works when
running locally. Hosted pages (such as a claude.ai artifact) can't reach the CDN,
so they need this folder published next to the page. Two adjustments make that
possible, and runner.js undoes both when it loads:
  - the 10 MB engine is split into 4 parts (hosts limit upload size);
  - the standard-library .zip gets a .wasm suffix (hosts don't serve .zip).
"""
import base64
import hashlib
import io
import json
import os
import sys
import tarfile
import urllib.request

VERSION = "0.26.4"
URL = f"https://registry.npmjs.org/pyodide/-/pyodide-{VERSION}.tgz"
# The package's checksum as published on the npm registry (dist.integrity). Change it with VERSION.
INTEGRITY = "sha512-z2CHsjVlhhJi5tYBF0AYAfNEPo3zq/z+xOpFtk1tweJkRaTqU4UK/7pLvo8DBU2VDPH31vB3pSI+8fnoqrVrFg=="
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "pyodide")
KEEP = {"pyodide.js", "pyodide.asm.js", "pyodide-lock.json", "pyodide.asm.wasm", "python_stdlib.zip"}


def main():
    print(f"Downloading Pyodide {VERSION}…")
    data = urllib.request.urlopen(URL).read()
    got = "sha512-" + base64.b64encode(hashlib.sha512(data).digest()).decode()
    if got != INTEGRITY:
        sys.exit(f"The download isn't Pyodide {VERSION} as published (its checksum is {got}), so nothing was changed.")
    os.makedirs(OUT, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
        for member in tar.getmembers():
            name = os.path.basename(member.name)
            if name not in KEEP:
                continue
            blob = tar.extractfile(member).read()
            if name == "pyodide.asm.wasm":
                parts, size = [], -(-len(blob) // 4)
                for i in range(4):
                    part = f"pyodide.asm.part{i + 1}.wasm"
                    with open(os.path.join(OUT, part), "wb") as fh:
                        fh.write(blob[i * size:(i + 1) * size])
                    parts.append(part)
                with open(os.path.join(OUT, "pyodide.asm.parts.json"), "w") as fh:
                    json.dump({"file": name, "bytes": len(blob), "sha256": hashlib.sha256(blob).hexdigest(), "parts": parts}, fh, indent=1)
            elif name == "python_stdlib.zip":
                with open(os.path.join(OUT, "python_stdlib.zip.wasm"), "wb") as fh:
                    fh.write(blob)
            else:
                with open(os.path.join(OUT, name), "wb") as fh:
                    fh.write(blob)
    print("Done:", ", ".join(sorted(os.listdir(OUT))))


if __name__ == "__main__":
    main()
