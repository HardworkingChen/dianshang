from __future__ import annotations

import argparse
import posixpath
import sys
import time
from pathlib import Path

import paramiko


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_KEY_FILE = Path.home() / ".ssh" / "codex_aliyun_deploy"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Deploy only the management-pc frontend to a remote server.")
    parser.add_argument("--host", required=True, help="Remote server host or IP.")
    parser.add_argument("--port", type=int, default=22, help="SSH port.")
    parser.add_argument("--user", required=True, help="SSH username.")
    parser.add_argument("--password", help="SSH password.")
    parser.add_argument("--key-file", type=Path, default=DEFAULT_KEY_FILE, help="SSH private key path.")
    parser.add_argument("--remote-root", default="/opt/ecommerce", help="Remote deployment root.")
    parser.add_argument("--keep-releases", type=int, default=3, help="How many admin-dist backup releases to keep.")
    return parser.parse_args()


def ensure_local_path(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(f"Required local path not found: {path}")


def sftp_mkdir_p(sftp: paramiko.SFTPClient, remote_dir: str) -> None:
    parts = [part for part in remote_dir.split("/") if part]
    current = "/"
    for part in parts:
        current = posixpath.join(current, part)
        try:
            sftp.stat(current)
        except FileNotFoundError:
            sftp.mkdir(current)


def upload_file(sftp: paramiko.SFTPClient, local_path: Path, remote_path: str) -> None:
    sftp_mkdir_p(sftp, posixpath.dirname(remote_path))
    print(f"[upload] {local_path} -> {remote_path}")
    sftp.put(str(local_path), remote_path)


def upload_tree(sftp: paramiko.SFTPClient, local_dir: Path, remote_dir: str) -> None:
    ensure_local_path(local_dir)
    for item in sorted(local_dir.rglob("*")):
        remote_path = posixpath.join(remote_dir, item.relative_to(local_dir).as_posix())
        if item.is_dir():
            sftp_mkdir_p(sftp, remote_path)
            continue
        upload_file(sftp, item, remote_path)


def run(ssh: paramiko.SSHClient, command: str, check: bool = True) -> tuple[int, str, str]:
    print(f"[remote] {command}")
    stdin, stdout, stderr = ssh.exec_command(command)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    if out.strip():
        print(out.strip())
    if err.strip():
        print(err.strip(), file=sys.stderr)
    if check and exit_code != 0:
        raise RuntimeError(f"Remote command failed ({exit_code}): {command}")
    return exit_code, out, err


def connect_ssh(args: argparse.Namespace) -> paramiko.SSHClient:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    connect_kwargs = {
        "hostname": args.host,
        "port": args.port,
        "username": args.user,
        "timeout": 20,
        "banner_timeout": 20,
        "auth_timeout": 20,
    }

    if args.password:
        connect_kwargs["password"] = args.password
    else:
        ensure_local_path(args.key_file)
        connect_kwargs["key_filename"] = str(args.key_file)
        connect_kwargs["look_for_keys"] = False
        connect_kwargs["allow_agent"] = False

    print(f"[connect] {args.user}@{args.host}:{args.port}")
    ssh.connect(**connect_kwargs)
    return ssh


def main() -> int:
    args = parse_args()

    dist_dir = PROJECT_ROOT / "management-pc" / "dist"
    nginx_conf = PROJECT_ROOT / "management-pc" / "nginx.default.conf"
    compose_file = PROJECT_ROOT / "deploy" / "docker-compose.runtime.yml"
    server_env = PROJECT_ROOT / "deploy" / "server.env"

    for required in (dist_dir, nginx_conf, compose_file, server_env):
        ensure_local_path(required)

    timestamp = time.strftime("%Y%m%d-%H%M%S")
    remote_root = args.remote_root.rstrip("/")
    remote_next = f"{remote_root}/admin-dist.next-{timestamp}"
    remote_current = f"{remote_root}/admin-dist"
    remote_backup_prefix = f"{remote_root}/admin-dist.release-"

    ssh = connect_ssh(args)
    try:
        sftp = ssh.open_sftp()
        try:
            run(
                ssh,
                (
                    f"mkdir -p {remote_root} {remote_root}/deploy-history "
                    f"&& rm -rf {remote_next} && mkdir -p {remote_next}"
                ),
            )

            upload_tree(sftp, dist_dir, remote_next)
            upload_file(sftp, nginx_conf, f"{remote_root}/nginx.default.conf")
            upload_file(sftp, compose_file, f"{remote_root}/docker-compose.runtime.yml")
            upload_file(sftp, server_env, f"{remote_root}/server.env")

            deploy_cmd = f"""bash -lc '
set -euo pipefail
remote_root="{remote_root}"
remote_current="{remote_current}"
remote_next="{remote_next}"
backup_dir="{remote_backup_prefix}{timestamp}"
mkdir -p "$remote_root/deploy-history"
if [ -d "$remote_current" ]; then
  rm -rf "$backup_dir"
  mv "$remote_current" "$backup_dir"
fi
mv "$remote_next" "$remote_current"
docker compose --env-file "$remote_root/server.env" -f "$remote_root/docker-compose.runtime.yml" up -d admin-frontend
docker ps --filter "name=ecommerce-admin-frontend" --format "table {{{{.Names}}}}\\t{{{{.Status}}}}\\t{{{{.Ports}}}}"
curl -I --max-time 10 http://127.0.0.1:8088/
find "$remote_root" -maxdepth 1 -type d -name "admin-dist.release-*" | sort -r | tail -n +{args.keep_releases + 1} | xargs -r rm -rf
'"""
            run(ssh, deploy_cmd)
        finally:
            sftp.close()
    finally:
        ssh.close()

    print("[done] admin frontend deploy completed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
