#!/usr/bin/env python3
"""Register or update the MINT dev stack on Tapis Pods.

This script is intentionally safe for local inspection: use ``--dry-run`` to
print redacted pod specs without calling Tapis. Live create/update/start/restart
operations are intended to run from the GitHub Actions dev deployment workflow.
"""

from __future__ import annotations

import argparse
from http.client import RemoteDisconnected
import json
import os
import sys
import time
from getpass import getpass
from functools import partial
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
POSTGRES_IMAGE = "postgis/postgis:16-3.5"
POSTGRES_VOLUME = "mintdevpostgresdata"
POSTGRES_MOUNT = "/var/lib/postgresql/data"
POSTGRES_DATA = f"{POSTGRES_MOUNT}/pgdata"

PODS = {
    "postgres": "mintdevpostgres",
    "redis": "mintdevredis",
    "graphql": "mintdevgraphql",
    "api": "mintdevapi",
    "ensemble": "mintdevensemble",
    "svo": "mintdevsvo",
    "ui": "mintdevui",
}

ORDER = ["postgres", "redis", "graphql", "api", "ensemble", "svo", "ui"]

# Recreating a pod is destructive. Only stateless application services may use
# this fallback; Redis queue state and PostgreSQL data are protected.
RECREATE_ON_IMAGE_MISMATCH_PODS = frozenset({"graphql", "api", "ensemble", "svo", "ui"})
POD_IMAGE_VERIFY_TIMEOUT = 120
POD_RESTART_TIMEOUT = 600

SECRET_KEYS = {
    "HASURA_GRAPHQL_ADMIN_SECRET",
    "HASURA_ADMIN_SECRET",
    "HASURA_GRAPHQL_DATABASE_URL",
    "MINTDEV_POSTGRES_PASSWORD",
    "PGPASSWORD",
    "DATABASE_URL",
    "DATA_CATALOG_KEY",
    "ENSEMBLE_MANAGER_CONFIG_JSON",
    "TAPIS_PASSWORD",
    "TAPIS_CLIENT_KEY",
    "MINTDEV_HASURA_JWT_SECRET",
}


def _load_dotenv() -> None:
    try:
        from dotenv import load_dotenv

        load_dotenv(REPO_ROOT / ".env")
    except ImportError:
        pass


def _pods_domain(base_url: str) -> str:
    return base_url.rstrip("/").split("://", 1)[-1]


def pod_urls(base_url: str) -> dict[str, str]:
    domain = _pods_domain(base_url)
    return {name: f"https://{pid}.pods.{domain}" for name, pid in PODS.items()}


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


def _postgres_user() -> str:
    return _env("MINTDEV_POSTGRES_USER", "postgres")


def _postgres_db() -> str:
    return _env("MINTDEV_POSTGRES_DB", "postgres")


def _postgres_password() -> str:
    return _env("MINTDEV_POSTGRES_PASSWORD") or _env("PGPASSWORD")


def _admin_secret() -> str:
    return _env("HASURA_GRAPHQL_ADMIN_SECRET") or _env("HASURA_ADMIN_SECRET")


def _hasura_auth_env() -> dict[str, str]:
    """Optional Hasura auth settings for authenticated writes.

    The dev stack can boot with only an anonymous role and admin-secret reads,
    but Model Catalog writes require Hasura to validate user JWTs. Operators can
    provide either a full Hasura JWT secret JSON string or an auth hook URL.
    """
    if _env("MINTDEV_HASURA_AUTH_HOOK"):
        return {
            "HASURA_GRAPHQL_AUTH_HOOK": _env("MINTDEV_HASURA_AUTH_HOOK"),
            "HASURA_GRAPHQL_AUTH_HOOK_MODE": _env("MINTDEV_HASURA_AUTH_HOOK_MODE", "POST"),
        }
    if _env("MINTDEV_HASURA_JWT_SECRET"):
        return {"HASURA_GRAPHQL_JWT_SECRET": _env("MINTDEV_HASURA_JWT_SECRET")}
    return {}


def _database_url(base_url: str) -> str:
    explicit = _env("MINTDEV_HASURA_DATABASE_URL") or _env("HASURA_GRAPHQL_DATABASE_URL")
    if explicit:
        return explicit
    # Tapis database pod endpoints are exposed through the Pods TLS/SNI tunnel on
    # :443, matching the pattern used by the STAC and SUBSIDE services.
    host = f"{PODS['postgres']}.pods.{_pods_domain(base_url)}"
    return (
        f"postgres://{_postgres_user()}:{_postgres_password()}@"
        f"{host}:443/{_postgres_db()}?sslmode=require"
    )


def _redacted(value: str) -> str:
    if not value:
        return value
    return "***"


def redact_spec(spec: dict[str, Any]) -> dict[str, Any]:
    clone = json.loads(json.dumps(spec))
    env = clone.get("environment_variables")
    if isinstance(env, dict):
        for key in list(env):
            upper = key.upper()
            if upper in SECRET_KEYS or any(part in upper for part in ("SECRET", "PASSWORD", "TOKEN", "KEY")):
                env[key] = _redacted(str(env[key]))
    return clone


def _ensemble_config(urls: dict[str, str]) -> str:
    explicit = _env("ENSEMBLE_MANAGER_CONFIG_JSON") or _env("MINTDEV_ENSEMBLE_MANAGER_CONFIG_JSON")
    if explicit:
        return explicit
    config = {
        "data_catalog_api": _env("DATA_CATALOG_API", "https://ckan.tacc.utexas.edu"),
        "data_catalog_type": _env("DATA_CATALOG_TYPE", "CKAN"),
        "ensemble_manager_api": f"{urls['ensemble']}/v1",
        "tapis_webhook_base_url": urls["ensemble"],
        "graphql": {
            "endpoint": f"{urls['graphql']}/v1/graphql",
            "enable_ssl": True,
            "use_secret": True,
        },
        "execution_engine": "tapis",
        "tapis": {
            "parallelism": int(_env("MINTDEV_TAPIS_PARALLELISM", "2")),
            "basePath": _env("TAPIS_BASE_URL", "https://portals.tapis.io"),
        },
        "auth_server": _env("AUTH_SERVER", "https://portals.tapis.io"),
        "auth_client_id": _env("MINTDEV_AUTH_CLIENT_ID", "mint_dev"),
        "visualization_url": "",
        "ingestion_api": "",
        "auth": {
            "client_id": _env("MINTDEV_AUTH_CLIENT_ID", "mint_dev"),
            "authorization_url": _env(
                "MINTDEV_AUTHORIZATION_URL",
                "https://portals.tapis.io/v3/oauth2/authorize",
            ),
            "public_key": _env("MINTDEV_TAPIS_PUBLIC_KEY", ""),
            "algorithms": ["RS256"],
        },
        "openapi": {
            "servers": [
                {"url": f"{urls['ensemble']}/v1", "description": "MINT dev Tapis Pods"}
            ]
        },
    }
    if _env("DATA_CATALOG_KEY"):
        config["data_catalog_key"] = _env("DATA_CATALOG_KEY")
    return json.dumps(config, separators=(",", ":"))


def build_specs(owner: str, tag: str, base_url: str) -> dict[str, dict[str, Any]]:
    urls = pod_urls(base_url)
    graphql_endpoint = f"{urls['graphql']}/v1/graphql"
    admin_secret = _admin_secret()

    specs: dict[str, dict[str, Any]] = {
        "postgres": {
            "pod_id": PODS["postgres"],
            "image": POSTGRES_IMAGE,
            "description": "MINT dev PostgreSQL database",
            "networking": {"default": {"protocol": "tcp", "port": 5432}},
            "environment_variables": {
                "POSTGRES_USER": _postgres_user(),
                "POSTGRES_PASSWORD": _postgres_password(),
                "POSTGRES_DB": _postgres_db(),
                "PGDATA": POSTGRES_DATA,
            },
            "volume_mounts": {
                POSTGRES_MOUNT: {
                    "type": "tapisvolume",
                    "source_id": POSTGRES_VOLUME,
                    "sub_path": "",
                },
            },
            "time_to_stop_default": -1,
        },
        "redis": {
            "pod_id": PODS["redis"],
            "image": "docker.io/redis:7-alpine",
            "description": "MINT dev Redis queue backend",
            "networking": {"default": {"protocol": "tcp", "port": 6379}},
            "time_to_stop_default": -1,
        },
        "graphql": {
            "pod_id": PODS["graphql"],
            "image": f"ghcr.io/{owner}/graphql-engine:{tag}",
            "description": "MINT dev Hasura GraphQL Engine",
            # Tapis pod-level CORS settings require APPROVEDADMIN permission.
            # Configure browser access in Hasura instead so ordinary dev deploy
            # identities can create/recreate the stateless GraphQL pod.
            "networking": {"default": {"protocol": "http", "port": 8080}},
            "resources": {"cpu_request": 250, "cpu_limit": 1000, "mem_request": 512, "mem_limit": 2048},
            "environment_variables": {
                "HASURA_GRAPHQL_DATABASE_URL": _database_url(base_url),
                "HASURA_GRAPHQL_ADMIN_SECRET": admin_secret,
                "HASURA_GRAPHQL_ENABLE_CONSOLE": _env("HASURA_GRAPHQL_ENABLE_CONSOLE", "true"),
                "HASURA_GRAPHQL_DEV_MODE": _env("HASURA_GRAPHQL_DEV_MODE", "false"),
                "HASURA_GRAPHQL_UNAUTHORIZED_ROLE": _env("HASURA_GRAPHQL_UNAUTHORIZED_ROLE", "anonymous"),
                "HASURA_GRAPHQL_CORS_DOMAIN": _env(
                    "HASURA_GRAPHQL_CORS_DOMAIN",
                    "https://mintdevui.pods.portals.tapis.io,http://localhost:3000",
                ),
                **_hasura_auth_env(),
            },
            "time_to_stop_default": -1,
        },
        "api": {
            "pod_id": PODS["api"],
            "image": f"ghcr.io/{owner}/model-catalog-api:{tag}",
            "description": "MINT dev Model Catalog API",
            "networking": {"default": {"protocol": "http", "port": 3000}},
            "resources": {"cpu_request": 250, "cpu_limit": 1000, "mem_request": 512, "mem_limit": 2048},
            "environment_variables": {
                "PORT": "3000",
                "HASURA_GRAPHQL_URL": graphql_endpoint,
                "HASURA_ADMIN_SECRET": admin_secret,
                "LOG_LEVEL": _env("LOG_LEVEL", "info"),
            },
            "time_to_stop_default": -1,
        },
        "ensemble": {
            "pod_id": PODS["ensemble"],
            "image": f"ghcr.io/{owner}/ensemble-manager:{tag}",
            "description": "MINT dev Ensemble Manager",
            "networking": {"default": {"protocol": "http", "port": 3000}},
            "resources": {"cpu_request": 500, "cpu_limit": 2000, "mem_request": 1024, "mem_limit": 4096},
            "environment_variables": {
                "REDIS_URL": _env("MINTDEV_REDIS_URL", f"redis://{PODS['redis']}:6379"),
                "HASURA_GRAPHQL_ADMIN_SECRET": admin_secret,
                # The image entrypoint materializes this JSON into the config
                # file the application already knows how to read.
                "ENSEMBLE_MANAGER_CONFIG_JSON": _ensemble_config(urls),
            },
            "time_to_stop_default": -1,
        },
        "svo": {
            "pod_id": PODS["svo"],
            "image": f"ghcr.io/{owner}/svo-adapter:{tag}",
            "description": "MINT dev SVO Adapter service",
            "networking": {"default": {"protocol": "http", "port": 8090}},
            "resources": {"cpu_request": 250, "cpu_limit": 1000, "mem_request": 512, "mem_limit": 2048},
            "environment_variables": {
                "SVO_ADAPTER_HASURA_GRAPHQL_URL": graphql_endpoint,
                "SVO_ADAPTER_HASURA_ADMIN_SECRET": admin_secret,
                "SVO_ADAPTER_MINT_CATALOG_BASE_URL": urls["api"],
                "SVO_ADAPTER_TAPIS_BASE_URL": _env("TAPIS_BASE_URL", "https://portals.tapis.io"),
                "SVO_ADAPTER_DEMO_MODE": _env("SVO_ADAPTER_DEMO_MODE", "false"),
                "SVO_ADAPTER_MINT_SYNC_ON_STARTUP": _env("SVO_ADAPTER_MINT_SYNC_ON_STARTUP", "false"),
                "SVO_ADAPTER_CKAN_SYNC_ON_STARTUP": _env("SVO_ADAPTER_CKAN_SYNC_ON_STARTUP", "false"),
                "SVO_ADAPTER_CKAN_URL": _env("SVO_ADAPTER_CKAN_URL", "https://ckan.tacc.utexas.edu"),
                "SVO_ADAPTER_STAC_API_URL": _env("SVO_ADAPTER_STAC_API_URL", "https://stacapi.pods.portals.tapis.io/api/v1"),
                "SVO_ADAPTER_GEO_ACTOR_ID": _env("SVO_ADAPTER_GEO_ACTOR_ID", ""),
            },
            "time_to_stop_default": -1,
        },
        "ui": {
            "pod_id": PODS["ui"],
            "image": f"ghcr.io/{owner}/ui:{tag}",
            "description": "MINT dev React UI",
            "networking": {
                "default": {
                    "protocol": "http",
                    "port": 80,
                    "tapis_auth": True,
                    "tapis_auth_return_path": "/",
                    "tapis_auth_allowed_users": [
                        user.strip()
                        for user in _env("MINTDEV_UI_AUTH_ALLOWED_USERS", "wmobley,mosoriob").split(",")
                        if user.strip()
                    ],
                }
            },
            "resources": {"cpu_request": 250, "cpu_limit": 1000, "mem_request": 256, "mem_limit": 512},
            "environment_variables": {
                "HASURA_ENDPOINT": graphql_endpoint,
                "AUTH_PROVIDER": _env("AUTH_PROVIDER", "tapis"),
                "AUTH_SERVER": _env("AUTH_SERVER", "https://portals.tapis.io"),
                "AUTH_CLIENT_ID": _env("MINTDEV_AUTH_CLIENT_ID", "mint_dev"),
                "AUTH_CALLBACK_ORIGIN": urls["ui"],
                "ENSEMBLE_MANAGER_API": urls["ensemble"],
                "DATA_CATALOG_API": _env("DATA_CATALOG_API", "https://ckan.tacc.utexas.edu"),
                "DATA_CATALOG_BROWSE_URL": _env("DATA_CATALOG_BROWSE_URL", "https://ckan.tacc.utexas.edu"),
                "EXECUTION_ENGINE": _env("EXECUTION_ENGINE", "tapis"),
                "WELCOME_MESSAGE": _env("WELCOME_MESSAGE", "MINT dev"),
            },
            "time_to_stop_default": -1,
        },
    }
    specs["_urls"] = urls
    return specs


def parse_pods(value: str) -> list[str]:
    if value == "all":
        return ORDER
    selected = [part.strip() for part in value.split(",") if part.strip()]
    invalid = [part for part in selected if part not in PODS]
    if invalid:
        raise SystemExit(f"Unknown pod selector(s): {', '.join(invalid)}")
    return [name for name in ORDER if name in selected]


def resolve_restart_pods(selected: list[str], *, restart: bool, restart_pods: str | None) -> list[str]:
    """Resolve the pods to restart independently from the pods to update."""
    if restart and restart_pods is not None:
        raise SystemExit("--restart and --restart-pods cannot be combined")
    if restart_pods is None:
        return selected if restart else []
    requested = parse_pods(restart_pods)
    return [name for name in requested if name in selected]


def _field(value: Any, key: str, default: Any = None) -> Any:
    return value.get(key, default) if isinstance(value, dict) else getattr(value, key, default)


def _get_or_missing(operation: Any, **kwargs: Any) -> Any:
    """Only a confirmed HTTP 404 permits creation; other errors must abort."""
    try:
        return operation(**kwargs)
    except Exception as exc:
        if getattr(getattr(exc, "response", None), "status_code", None) == 404:
            return None
        raise RuntimeError("Tapis lookup failed; refusing to assume the resource is absent") from None


class PodImageMismatchError(RuntimeError):
    """The Tapis pod definition did not converge to the requested image."""


class TransientPodLookupError(RuntimeError):
    """A pod lookup failed because the transport may be retried safely."""


def _is_transient_lookup_error(exc: Exception) -> bool:
    if isinstance(exc, (ConnectionError, TimeoutError, RemoteDisconnected, OSError)):
        return True
    if exc.__class__.__name__ in {
        "ConnectTimeout",
        "ReadTimeout",
        "ConnectionError",
    }:
        return True
    # Tapipy wraps transport exceptions in BaseTapyException without an HTTP
    # response. Keep this narrow so auth and service HTTP errors still fail fast.
    return getattr(exc, "response", None) is None and "unable to make request" in str(exc).lower()


def _pod_lookup_for_verification(t: Any, pod_id: str) -> Any:
    """Read a pod for verification without treating errors as absence."""
    try:
        return t.pods.get_pod(pod_id=pod_id)
    except Exception as exc:
        if _is_transient_lookup_error(exc):
            raise TransientPodLookupError from None
        status_code = getattr(getattr(exc, "response", None), "status_code", None)
        if status_code is not None:
            raise RuntimeError(f"Tapis pod verification failed for {pod_id} (HTTP {status_code}); deployment stopped") from None
        raise RuntimeError(f"Tapis pod verification failed for {pod_id}; deployment stopped") from None


def wait_for_pod_image(t: Any, pod_id: str, expected_image: str, *, timeout: float = POD_IMAGE_VERIFY_TIMEOUT) -> Any:
    """Wait until Tapis reports the exact requested image in the pod definition."""
    deadline = time.monotonic() + timeout
    observed = None
    while time.monotonic() < deadline:
        try:
            pod = _pod_lookup_for_verification(t, pod_id)
        except TransientPodLookupError:
            time.sleep(min(5, max(0, deadline - time.monotonic())))
            continue
        observed = _field(pod, "image")
        if observed == expected_image:
            return pod
        time.sleep(min(5, max(0, deadline - time.monotonic())))
    raise PodImageMismatchError(
        f"[{pod_id}] image did not converge; expected {expected_image!r}, observed {observed!r}"
    )


def wait_for_pod_absent(t: Any, pod_id: str, *, timeout: float = POD_IMAGE_VERIFY_TIMEOUT) -> None:
    """Wait for a deleted pod to be confirmed absent before recreating it."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            t.pods.get_pod(pod_id=pod_id)
        except Exception as exc:
            if getattr(getattr(exc, "response", None), "status_code", None) == 404:
                return
            if _is_transient_lookup_error(exc):
                time.sleep(min(5, max(0, deadline - time.monotonic())))
                continue
            raise RuntimeError("Tapis pod deletion verification failed; deployment stopped") from None
        time.sleep(min(5, max(0, deadline - time.monotonic())))
    raise RuntimeError(f"[{pod_id}] deletion did not complete; refusing to create a duplicate pod")


def wait_for_pod_restart(
    t: Any,
    pod_id: str,
    expected_image: str,
    previous_start: Any = None,
    *,
    timeout: float = POD_RESTART_TIMEOUT,
) -> Any:
    """Confirm an application pod is available on a new container instance."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            pod = _pod_lookup_for_verification(t, pod_id)
        except TransientPodLookupError:
            time.sleep(min(5, max(0, deadline - time.monotonic())))
            continue
        started = _field(_field(pod, "status_container", {}), "start_time")
        if (
            _field(pod, "status") == "AVAILABLE"
            and _field(pod, "image") == expected_image
            and (not previous_start or (started and started != previous_start))
        ):
            return pod
        time.sleep(min(5, max(0, deadline - time.monotonic())))
    raise RuntimeError(f"[{pod_id}] did not become AVAILABLE on the requested image after restart")


def check_postgres_storage(pod: Any, *, recreate: bool) -> None:
    if pod is None:
        return
    if recreate:
        raise RuntimeError("PostgreSQL recreation is disabled; use the documented preservation/recovery procedure")
    mounts = _field(pod, "volume_mounts", {})
    if not isinstance(mounts, dict) and not hasattr(mounts, "__dict__"):
        raise RuntimeError("Cannot verify PostgreSQL volume mounts; deployment stopped")
    mount = _field(mounts, POSTGRES_MOUNT)
    mount_paths = mounts.keys() if isinstance(mounts, dict) else vars(mounts).keys()
    env = _field(pod, "environment_variables", {})
    if (
        _field(mount, "type") != "tapisvolume"
        or _field(mount, "source_id") != POSTGRES_VOLUME
        or _field(mount, "sub_path") != ""
        or _field(mount, "read_only", False) is not False
        or any(path.startswith(POSTGRES_MOUNT + "/") for path in mount_paths)
        or _field(env, "PGDATA") != POSTGRES_DATA
        or _field(pod, "image") != POSTGRES_IMAGE
    ):
        raise RuntimeError("PostgreSQL image/storage differs; preserve data and perform a deliberate migration before deploying")


def ensure_postgres_volume(t: Any, *, allow_create: bool = False, timeout: float = 600) -> None:
    volume = _get_or_missing(t.pods.get_volume, volume_id=POSTGRES_VOLUME)
    if volume is None:
        if not allow_create:
            raise RuntimeError("Existing PostgreSQL volume is missing; refusing to replace it with empty storage")
        t.pods.create_volume(volume_id=POSTGRES_VOLUME, description="Persistent MINT dev PostgreSQL data", size_limit=10240)
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        volume = t.pods.get_volume(volume_id=POSTGRES_VOLUME)
        if _field(volume, "status") == "AVAILABLE":
            return
        time.sleep(5)
    raise RuntimeError("PostgreSQL volume did not become AVAILABLE; deployment stopped")


def wait_for_postgres(
    t: Any,
    previous_start: Any = None,
    *,
    restarted: bool = False,
    expected_image: str | None = None,
    timeout: float = 600,
) -> None:
    if restarted and not previous_start:
        raise RuntimeError("Cannot verify PostgreSQL restart without its previous container start time")
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            pod = _pod_lookup_for_verification(t, PODS["postgres"])
        except TransientPodLookupError:
            time.sleep(min(5, max(0, deadline - time.monotonic())))
            continue
        started = _field(_field(pod, "status_container", {}), "start_time")
        if (
            _field(pod, "status") == "AVAILABLE"
            and (not expected_image or _field(pod, "image") == expected_image)
            and (not restarted or (started and started != previous_start))
        ):
            result = t.pods.exec_pod_commands(
                pod_id=PODS["postgres"],
                commands=[["sh", "-c", 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -v ON_ERROR_STOP=1 -Atc "SELECT 1"']],
                command_timeout=10, total_timeout=15,
            )
            results = _field(result, "execution_results", [])
            if results and _field(results[0], "exit_code") == 0 and _field(results[0], "stdout", "").strip() == "1":
                return
        time.sleep(5)
    raise RuntimeError("PostgreSQL did not become SQL-ready; dependent deployment stopped")


def validate_live_requirements(selected: list[str]) -> None:
    missing = []
    if any(p in selected for p in ("postgres", "graphql")) and not _postgres_password():
        missing.append("MINTDEV_POSTGRES_PASSWORD (or PGPASSWORD)")
    if any(p in selected for p in ("graphql", "api", "ensemble", "svo")) and not _admin_secret():
        missing.append("HASURA_GRAPHQL_ADMIN_SECRET (or HASURA_ADMIN_SECRET)")
    if missing:
        print("Missing required live-deploy secret(s): " + ", ".join(missing), file=sys.stderr)
        raise SystemExit(2)


def set_pod_owners(t: Any, pod_id: str, owners: list[str]) -> None:
    """Add owners to a pod with ADMIN permissions."""
    for owner in owners:
        try:
            t.pods.set_pod_permission(pod_id=pod_id, user=owner, level="ADMIN")
            print(f"  [{pod_id}] added owner: {owner}")
        except Exception as exc:  # noqa: BLE001
            print(f"  [{pod_id}] failed to add owner {owner}: {exc}", file=sys.stderr)


def _start_pod_if_needed(t: Any, pod_id: str) -> None:
    try:
        status = _field(t.pods.get_pod(pod_id=pod_id), "status")
    except Exception:
        raise RuntimeError(f"[{pod_id}] could not verify pod status before start") from None
    if status and status != "STOPPED":
        print(f"  [{pod_id}] already {status}; not starting")
        return
    try:
        t.pods.start_pod(pod_id=pod_id)
    except Exception:
        raise RuntimeError(f"[{pod_id}] start request failed") from None
    print(f"  [{pod_id}] start requested")


def _recreate_pod(t: Any, spec: dict[str, Any], *, start: bool, owners: list[str] | None = None) -> None:
    pid = spec["pod_id"]
    pod_name = next((name for name, pod_id in PODS.items() if pod_id == pid), None)
    if pod_name not in RECREATE_ON_IMAGE_MISMATCH_PODS:
        raise RuntimeError(f"[{pid}] image mismatch; automatic recreation is disabled for this protected pod")
    if pid == PODS["postgres"]:
        raise RuntimeError("PostgreSQL recreation is disabled; image mismatch requires deliberate recovery")
    print(f"  [{pid}] deleting before image-mismatch recovery…")
    t.pods.delete_pod(pod_id=pid)
    wait_for_pod_absent(t, pid)
    print(f"  [{pid}] creating with requested image…")
    t.pods.create_pod(**spec)
    if owners:
        set_pod_owners(t, pid, owners)
    if start:
        _start_pod_if_needed(t, pid)
    wait_for_pod_image(t, pid, spec["image"])
    if start:
        wait_for_pod_restart(t, pid, spec["image"])


def upsert_pod(
    t: Any,
    spec: dict[str, Any],
    *,
    recreate: bool,
    recreate_on_image_mismatch: bool = False,
    start: bool,
    restart: bool,
    owners: list[str] | None = None,
) -> None:
    pid = spec["pod_id"]
    existing = _get_or_missing(t.pods.get_pod, pod_id=pid)
    exists = existing is not None
    if pid == PODS["postgres"]:
        check_postgres_storage(existing, recreate=recreate)

    if exists and recreate:
        print(f"  [{pid}] deleting existing pod (--recreate)…")
        t.pods.delete_pod(pod_id=pid)
        wait_for_pod_absent(t, pid)
        exists = False

    if exists:
        previous_start = _field(_field(existing, "status_container", {}), "start_time")
        print(f"  [{pid}] updating…")
        update = dict(spec)
        if pid == PODS["postgres"]:
            # The image was verified above; older Tapipy update schemas omit it.
            update.pop("image")
        t.pods.update_pod(**update)
        try:
            wait_for_pod_image(t, pid, spec["image"])
        except PodImageMismatchError:
            if not recreate_on_image_mismatch:
                raise
            _recreate_pod(t, spec, start=start, owners=owners)
            return
        if restart:
            t.pods.restart_pod(pod_id=pid)
            print(f"  [{pid}] restart requested")
            if pid != PODS["postgres"]:
                wait_for_pod_restart(t, pid, spec["image"], previous_start)
        # Set owners on existing pods too
        if owners:
            set_pod_owners(t, pid, owners)
        return

    print(f"  [{pid}] creating…")
    t.pods.create_pod(**spec)
    # Set owners immediately after creation
    if owners:
        set_pod_owners(t, pid, owners)
    if start:
        _start_pod_if_needed(t, pid)
    wait_for_pod_image(t, pid, spec["image"])


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Register/update the MINT dev Tapis Pods stack.")
    parser.add_argument("--base-url", default=_env("TAPIS_BASE_URL", "https://portals.tapis.io"))
    parser.add_argument("--owner", default=_env("GHCR_OWNER", "mintproject"))
    parser.add_argument("--image-tag", default=_env("IMAGE_TAG", "latest"))
    parser.add_argument("--pods", default="all", help="all or comma-separated: postgres,redis,graphql,api,ensemble,svo,ui")
    parser.add_argument("--owners", default="wmobley,mosoriob", help="comma-separated list of pod owners (ADMIN permission)")
    parser.add_argument("--recreate", action="store_true")
    parser.add_argument(
        "--recreate-on-image-mismatch",
        action="store_true",
        help="recreate only stateless application pods if the requested image does not converge",
    )
    parser.add_argument("--restart", action="store_true")
    parser.add_argument(
        "--restart-pods",
        help="comma-separated pods to restart after updating; limits restarts without changing the update set",
    )
    parser.add_argument("--no-start", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    if args.no_start and (args.restart or args.restart_pods is not None or args.recreate_on_image_mismatch):
        parser.error("--no-start cannot be combined with --restart, --restart-pods, or --recreate-on-image-mismatch")
    if args.recreate and args.recreate_on_image_mismatch:
        parser.error("--recreate and --recreate-on-image-mismatch cannot be combined")

    _load_dotenv()
    selected = parse_pods(args.pods)
    restart_selected = resolve_restart_pods(
        selected,
        restart=args.restart,
        restart_pods=args.restart_pods,
    )
    specs = build_specs(args.owner, args.image_tag, args.base_url)
    urls = specs.pop("_urls")

    if args.dry_run:
        if "postgres" in selected:
            print(f"Persistent volume: {POSTGRES_VOLUME} (create if absent; retain on pod restart)")
        for key in selected:
            print(f"--- {PODS[key]} ({key}) ---")
            print(json.dumps(redact_spec(specs[key]), indent=2, sort_keys=True))
        print("\nDev URLs:")
        for key in ORDER:
            print(f"  {key:8} {urls[key]}")
        return 0

    validate_live_requirements(selected)

    try:
        from tapipy.tapis import Tapis
    except ImportError:
        raise SystemExit("tapipy is not installed (pip install tapipy).")

    username = _env("TAPIS_USERNAME") or _env("TAPIS_ID") or input("Tapis username: ")
    password = _env("TAPIS_PASSWORD") or getpass("Tapis password: ")
    t = Tapis(base_url=args.base_url.rstrip("/"), username=username, password=password)
    t.requests_session.send = partial(t.requests_session.send, timeout=30)
    t.get_tokens()

    # Parse owners list
    owners = [o.strip() for o in args.owners.split(",") if o.strip()] if args.owners else []

    previous_start = None
    postgres_restarted = False
    if "postgres" in selected:
        postgres = _get_or_missing(t.pods.get_pod, pod_id=PODS["postgres"])
        check_postgres_storage(postgres, recreate=args.recreate)
        if postgres is not None and "postgres" in restart_selected:
            previous_start = _field(_field(postgres, "status_container", {}), "start_time")
            if not previous_start:
                raise RuntimeError("Cannot verify PostgreSQL restart; previous container start time is missing")
            postgres_restarted = True
        ensure_postgres_volume(t, allow_create=postgres is None)

    for key in selected:
        upsert_pod(
            t,
            specs[key],
            recreate=args.recreate,
            recreate_on_image_mismatch=args.recreate_on_image_mismatch,
            start=not args.no_start,
            restart=key in restart_selected,
            owners=owners,
        )
        if key == "postgres" and not args.no_start:
            wait_for_postgres(
                t,
                previous_start,
                restarted=postgres_restarted,
                expected_image=specs[key]["image"],
            )

    print("\nMINT dev stack updated:")
    for key in ORDER:
        print(f"  {key:8} {urls[key]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
