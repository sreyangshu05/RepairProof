#!/usr/bin/env python3
"""Non-destructively verify a PostgreSQL custom-format dump and SHA-256 sidecar."""
import argparse
import hashlib
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dump", type=Path)
    parser.add_argument("--sha256-file", type=Path, help="Text file whose first token is the expected SHA-256")
    parser.add_argument("--max-age-hours", type=float, default=36)
    args = parser.parse_args()
    if not args.dump.is_file() or args.dump.stat().st_size == 0:
        print("FAIL: backup file is missing or empty", file=sys.stderr)
        return 2
    age_hours = (datetime.now(timezone.utc).timestamp() - args.dump.stat().st_mtime) / 3600
    if age_hours < -1 or age_hours > args.max_age_hours:
        print(f"FAIL: backup age {age_hours:.1f}h exceeds allowed age", file=sys.stderr)
        return 2
    digest = hashlib.sha256()
    with args.dump.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    actual = digest.hexdigest()
    if args.sha256_file:
        try:
            expected = args.sha256_file.read_text(encoding="utf-8").split()[0].lower()
        except (OSError, IndexError) as exc:
            print(f"FAIL: cannot read checksum sidecar: {exc}", file=sys.stderr)
            return 2
        if actual != expected:
            print("FAIL: SHA-256 mismatch", file=sys.stderr)
            return 2
    executable = shutil.which("pg_restore")
    if not executable:
        print("FAIL: pg_restore is required to inspect a custom-format dump", file=sys.stderr)
        return 2
    inspected = subprocess.run([executable, "--list", str(args.dump)], capture_output=True, text=True, check=False)
    if inspected.returncode != 0 or not inspected.stdout.strip():
        print(f"FAIL: pg_restore could not read archive: {inspected.stderr.strip()}", file=sys.stderr)
        return 2
    print(f"OK: archive readable; age={age_hours:.1f}h; sha256={actual}; entries={len(inspected.stdout.splitlines())}")
    print("NOTE: archive inspection does not replace a restore drill into an isolated database.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
