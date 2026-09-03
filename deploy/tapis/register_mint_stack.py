#!/usr/bin/env python3
"""Register or update the MINT dev stack on Tapis Pods.

This script is intentionally safe for local inspection: use ``--dry-run`` to
print redacted pod specs without calling Tapis. Live create/update/start/restart
operations are intended to run from the GitHub Actions dev deployment workflow.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from getpass import getpass
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]

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
        f"{host}:443/{_postgres_db()}?sslmode=require&sslnegotiation=direct"
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
        "auth_client_id": _env("MINTDEV_AUTH_CLIENT_ID", "mintdev-ui"),
        "visualization_url": "",
        "ingestion_api": "",
        "auth": {
            "client_id": _env("MINTDEV_AUTH_CLIENT_ID", "mintdev-ui"),
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
            "pod_template": "template/postgres",
            "description": "MINT dev PostgreSQL database",
            "networking": {"default": {"protocol": "tcp", "port": 5432}},
            "environment_variables": {
                "POSTGRES_USER": _postgres_user(),
                "POSTGRES_PASSWORD": _postgres_password(),
                "POSTGRES_DB": _postgres_db(),
            },
            "time_to_stop_default": -1,
        },
        "redis": {
            "pod_id": PODS["redis"],
            "pod_template": "template/redis",
            "description": "MINT dev Redis queue backend",
            "networking": {"default": {"protocol": "tcp", "port": 6379}},
            "time_to_stop_default": -1,
        },
        "graphql": {
            "pod_id": PODS["graphql"],
            "image": f"ghcr.io/{owner}/graphql-engine:{tag}",
            "description": "MINT dev Hasura GraphQL Engine",
            "networking": {"default": {"protocol": "http", "port": 8080}},
            "resources": {"cpu_request": 250, "cpu_limit": 1000, "mem_request": 512, "mem_limit": 2048},
            "environment_variables": {
                "HASURA_GRAPHQL_DATABASE_URL": _database_url(base_url),
                "HASURA_GRAPHQL_ADMIN_SECRET": admin_secret,
                "HASURA_GRAPHQL_ENABLE_CONSOLE": _env("HASURA_GRAPHQL_ENABLE_CONSOLE", "true"),
                "HASURA_GRAPHQL_DEV_MODE": _env("HASURA_GRAPHQL_DEV_MODE", "false"),
                "HASURA_GRAPHQL_UNAUTHORIZED_ROLE": _env("HASURA_GRAPHQL_UNAUTHORIZED_ROLE", "anonymous"),
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
            "networking": {"default": {"protocol": "http", "port": 80}},
            "resources": {"cpu_request": 250, "cpu_limit": 1000, "mem_request": 256, "mem_limit": 512},
            "environment_variables": {
                "HASURA_ENDPOINT": graphql_endpoint,
                "AUTH_PROVIDER": _env("AUTH_PROVIDER", "tapis"),
                "AUTH_SERVER": _env("AUTH_SERVER", "https://portals.tapis.io"),
                "AUTH_CLIENT_ID": _env("MINTDEV_AUTH_CLIENT_ID", "mintdev-ui"),
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
    return selected


def validate_live_requirements(selected: list[str]) -> None:
    missing = []
    if any(p in selected for p in ("postgres", "graphql")) and not _postgres_password():
        missing.append("MINTDEV_POSTGRES_PASSWORD (or PGPASSWORD)")
    if any(p in selected for p in ("graphql", "api", "ensemble", "svo")) and not _admin_secret():
        missing.append("HASURA_GRAPHQL_ADMIN_SECRET (or HASURA_ADMIN_SECRET)")
    if missing:
        print("Missing required live-deploy secret(s): " + ", ".join(missing), file=sys.stderr)
        raise SystemExit(2)


def upsert_pod(t: Any, spec: dict[str, Any], *, recreate: bool, start: bool, restart: bool) -> None:
    pid = spec["pod_id"]
    exists = True
    try:
        t.pods.get_pod(pod_id=pid)
    except Exception:
        exists = False

    if exists and recreate:
        print(f"  [{pid}] deleting existing pod (--recreate)…")
        t.pods.delete_pod(pod_id=pid)
        exists = False
        time.sleep(2)

    if exists:
        print(f"  [{pid}] updating…")
        t.pods.update_pod(**spec)
        if restart:
            try:
                t.pods.restart_pod(pod_id=pid)
                print(f"  [{pid}] restart requested")
            except Exception as exc:  # noqa: BLE001
                print(f"  [{pid}] restart failed: {exc}", file=sys.stderr)
        return

    print(f"  [{pid}] creating…")
    t.pods.create_pod(**spec)
    if not start:
        return
    try:
        status = getattr(t.pods.get_pod(pod_id=pid), "status", None)
    except Exception:
        status = None
    if status and status != "STOPPED":
        print(f"  [{pid}] already {status}; not starting")
        return
    try:
        t.pods.start_pod(pod_id=pid)
        print(f"  [{pid}] start requested")
    except Exception as exc:  # noqa: BLE001
        print(f"  [{pid}] start skipped: {exc}", file=sys.stderr)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Register/update the MINT dev Tapis Pods stack.")
    parser.add_argument("--base-url", default=_env("TAPIS_BASE_URL", "https://portals.tapis.io"))
    parser.add_argument("--owner", default=_env("GHCR_OWNER", "mintproject"))
    parser.add_argument("--image-tag", default=_env("IMAGE_TAG", "latest"))
    parser.add_argument("--pods", default="all", help="all or comma-separated: postgres,redis,graphql,api,ensemble,svo,ui")
    parser.add_argument("--recreate", action="store_true")
    parser.add_argument("--restart", action="store_true")
    parser.add_argument("--no-start", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)

    _load_dotenv()
    selected = parse_pods(args.pods)
    specs = build_specs(args.owner, args.image_tag, args.base_url)
    urls = specs.pop("_urls")

    if args.dry_run:
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
    t.get_tokens()

    for key in selected:
        upsert_pod(t, specs[key], recreate=args.recreate, start=not args.no_start, restart=args.restart)

    print("\nMINT dev stack updated:")
    for key in ORDER:
        print(f"  {key:8} {urls[key]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
