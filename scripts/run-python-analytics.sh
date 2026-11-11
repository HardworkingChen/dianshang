#!/usr/bin/env bash
set -euo pipefail

container_name="${PYTHON_ANALYTICS_CONTAINER:-ecommerce-python-analytics}"
workspace_root="${PYTHON_ANALYTICS_WORKSPACE:-/workspace}"
venv_python="${PYTHON_ANALYTICS_PYTHON:-${workspace_root}/.python-analytics-venv/bin/python}"
scheduler_path="${PYTHON_ANALYTICS_SCHEDULER:-${workspace_root}/backend/python_analytics/scheduler.py}"

run_once="false"
snapshot_date=""
jobs="analytics,kmeans,recommendation"
interval_minutes="60"
k="3"
auto_k="false"
min_k="2"
max_k="6"
retry="1"
python_exe=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -RunOnce|--run-once)
      run_once="true"
      shift
      ;;
    -SnapshotDate|--snapshot-date)
      snapshot_date="${2:-}"
      shift 2
      ;;
    -Jobs|--jobs)
      jobs="${2:-$jobs}"
      shift 2
      ;;
    -IntervalMinutes|--interval-minutes)
      interval_minutes="${2:-$interval_minutes}"
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
    -Retry|--retry)
      retry="${2:-$retry}"
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

if [[ -n "$python_exe" ]]; then
  venv_python="$python_exe"
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required to run python analytics on Linux compatibility mode." >&2
  exit 127
fi

if ! docker inspect "$container_name" >/dev/null 2>&1; then
  echo "python analytics container not found: $container_name" >&2
  exit 1
fi

if [[ "$(docker inspect -f '{{.State.Running}}' "$container_name")" != "true" ]]; then
  docker start "$container_name" >/dev/null
fi

contains_kmeans="false"
normalized_jobs=",$(echo "$jobs" | tr '[:upper:]' '[:lower:]' | tr -d ' '),"
if [[ "$normalized_jobs" == *",kmeans,"* ]]; then
  contains_kmeans="true"
fi

cmd=(
  docker exec
  -w "${workspace_root}/backend/python_analytics"
  "$container_name"
  "$venv_python"
  "$scheduler_path"
  --jobs "$jobs"
  --interval-minutes "$interval_minutes"
  --k "$k"
  --auto-k "$auto_k"
  --min-k "$min_k"
  --max-k "$max_k"
  --retry "$retry"
)

if [[ "$run_once" == "true" ]]; then
  cmd+=(--run-once)
fi

if [[ -n "$snapshot_date" ]]; then
  cmd+=(--snapshot-date "$snapshot_date")
fi

echo "[run-python-analytics] container=$container_name jobs=$jobs snapshotDate=${snapshot_date:-auto} runOnce=$run_once"
"${cmd[@]}"
status=$?

if [[ "$status" -eq 0 && "$contains_kmeans" == "true" ]]; then
  if command -v redis-cli >/dev/null 2>&1; then
    redis-cli -h "${REDIS_HOST:-127.0.0.1}" -p "${REDIS_PORT:-6379}" DEL \
      analytics:kmeans:latest:task analytics:kmeans:latest:summary analytics:kmeans:latest:segments >/dev/null || true
  else
    docker exec ecommerce-redis redis-cli DEL \
      analytics:kmeans:latest:task analytics:kmeans:latest:summary analytics:kmeans:latest:segments >/dev/null || true
  fi
fi

exit "$status"
