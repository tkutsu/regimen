"""Check the release APK retains the Tauri method called through JNI at startup."""

import argparse
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import zipfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("apk", type=Path)
    parser.add_argument("--dexdump", default=shutil.which("dexdump"))
    args = parser.parse_args()
    dexdump = args.dexdump
    if not dexdump:
        sdk = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
        candidates = sorted((Path(sdk) / "build-tools").glob("*/dexdump")) if sdk else []
        if not candidates:
            parser.error("Set ANDROID_HOME or pass --dexdump from Android SDK build-tools")
        dexdump = str(candidates[-1])

    with zipfile.ZipFile(args.apk) as apk, tempfile.TemporaryDirectory() as directory:
        for name in apk.namelist():
            if not re.fullmatch(r"classes\d*\.dex", name):
                continue
            dex = Path(directory) / name
            dex.write_bytes(apk.read(name))
            output = subprocess.check_output([dexdump, str(dex)]).decode(errors="replace")
            for block in re.split(r"(?=Class #\d+)", output):
                if not re.search(r"Class descriptor\s*:\s*'Ldev/themos/regimen/TauriActivity;'", block):
                    continue
                method = re.search(r"name\s*:\s*'getPluginManager'\s+type\s*:\s*'\(\)Lapp/tauri/plugin/PluginManager;'\s+access\s*:\s*0x([0-9a-fA-F]+)", block)
                if method and int(method[1], 16) & 0x0009 == 0x0001:
                    print("PASS: TauriActivity retains public getPluginManager() for JNI startup")
                    return
    raise SystemExit("FAIL: APK is missing TauriActivity.getPluginManager() required by JNI startup")


if __name__ == "__main__":
    main()
