#!/usr/bin/env python3
"""Register an isolated MINT test stack using the normal Tapis implementation.

The production/develop stack uses fixed ``mintdev*`` pod IDs. This wrapper
rewrites those IDs and the PostgreSQL volume before delegating to
``register_mint_stack`` so staged integration tests cannot overwrite the
shared dev stack. It is intended for the manual test workflow, not for normal
deployments.
"""

from __future__ import annotations

import os
import re

import register_mint_stack as stack

BASE_PODS = dict(stack.PODS)
BASE_POSTGRES_VOLUME = stack.POSTGRES_VOLUME


def configure_isolated_stack(prefix: str) -> None:
    """Apply a validated pod/volume prefix to the imported stack module."""
    clean_prefix = re.sub(r"[^a-z0-9-]", "-", prefix.lower()).strip("-")
    if not clean_prefix or len(clean_prefix) > 18:
        raise SystemExit("MINT_TEST_STACK_PREFIX must be 1-18 letters, numbers, or hyphens")

    stack.PODS = {
        name: f"{clean_prefix}{pod_id.removeprefix('mintdev')}"
        for name, pod_id in BASE_PODS.items()
    }
    stack.POSTGRES_VOLUME = f"{clean_prefix}{BASE_POSTGRES_VOLUME.removeprefix('mintdev')}"


def main(argv: list[str] | None = None) -> int:
    configure_isolated_stack(os.environ.get("MINT_TEST_STACK_PREFIX", "minttest"))
    return stack.main(argv)


if __name__ == "__main__":
    raise SystemExit(main())
