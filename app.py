"""Compatibility launcher for the notebook. Requires Node.js 22.13 or later."""
import shutil
import subprocess
from pathlib import Path

if __name__ == "__main__":
    node = shutil.which("node")
    if not node:
        raise SystemExit("Install Node.js 22.13 or newer, then run python app.py again.")
    subprocess.run([node, "server/local.js"], cwd=Path(__file__).parent, check=True)
