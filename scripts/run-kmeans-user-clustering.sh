#!/usr/bin/env bash
set -euo pipefail

snapshot_date="$(date +%F)"
k="4"
auto_k="true"
min_k="2"
max_k="6"
python_exe=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -SnapshotDate|--snapshot-date)
      snapshot_date="${2:-$snapshot_date}"
      shift 2
      ;;
    -K|--k)
      k="${2:-$k}"
      shift 2
      ;;
    -AutoK|--auto-k)
      auto_k="${2:-$auto_k}"
      shift 2
      ;;
    -MinK|--min-k)
      min_k="${2:-$min_k}"
      shift 2
      ;;
    -MaxK|--max-k)
      max_k="${2:-$max_k}"
      shift 2
      ;;
    -PythonExe|--python-exe)
      python_exe="${2:-}"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
runner="${script_dir}/run-python-analytics.sh"

if [[ ! -f "$runner" ]]; then
  echo "Python analytics runner not found: $runner" >&2
  exit 1
fi

args=(
  --run-once
  --jobs "kmeans"
  --snapshot-date "$snapshot_date"
  --k "$k"
  --auto-k "$auto_k"
  --min-k "$min_k"
  --max-k "$max_k"
)

if [[ -n "$python_exe" ]]; then
  args+=(--python-exe "$python_exe")
fi

echo "[run-kmeans-user-clustering] Delegating to run-python-analytics.sh"
exec "$runner" "${args[@]}"
