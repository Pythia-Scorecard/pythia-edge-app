#!/usr/bin/env bash
# Prepare a side-by-side runtime. Does NOT switch PATH, PM2, systemd, or a running app.
set -euo pipefail
version="${1:-$(cat "$(dirname "$0")/../.nvmrc")}"
case "$version" in 22.23.4|24.22.1) ;; *) echo "Use a reviewed, tested version from .nvmrc" >&2; exit 1 ;; esac
[[ "$(uname -s)" == Linux ]] || { echo "Linux provisioning only" >&2; exit 1; }
case "$(uname -m)" in
  x86_64) arch=x64 ;;
  aarch64) arch=arm64 ;;
  armv7l) [[ "$version" == 22.* ]] || { echo "32-bit ARM requires the tested Node 22 build" >&2; exit 1; }; arch=armv7l ;;
  *) echo "Unsupported architecture; stop for compatibility review" >&2; exit 1 ;;
esac
command -v curl >/dev/null
command -v sha256sum >/dev/null
archive="node-v${version}-linux-${arch}.tar.xz"
target="/opt/node-v${version}-linux-${arch}"
if [[ -e "$target" ]]; then
  echo "$target already exists. Verify its provenance; this script will not overwrite it." >&2
  exit 1
fi
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
curl --fail --show-error --silent --location "https://nodejs.org/dist/v${version}/${archive}" -o "$scratch/$archive"
curl --fail --show-error --silent --location "https://nodejs.org/dist/v${version}/SHASUMS256.txt" -o "$scratch/SHASUMS256.txt"
(cd "$scratch"; awk -v file="$archive" '$2 == file { print }' SHASUMS256.txt > CHECKSUM; test "$(wc -l < CHECKSUM)" -eq 1; sha256sum --check CHECKSUM)
tar -xJf "$scratch/$archive" -C "$scratch"
[[ "$("$scratch/node-v${version}-linux-${arch}/bin/node" --version)" == "v$version" ]]
sudo cp -a "$scratch/node-v${version}-linux-${arch}" "$target"
echo "Prepared $target; no running application, service or shell default was changed."
echo "Next: follow the approved canary/rollback runbook before switching any service."
