#!/usr/bin/env python3
"""Backward-compatible entry point for the retired writable Workshop check.

T-109 froze Workshop as a read-only history archive.  Keep this filename so
older runbooks fail forward to the current archive contract instead of trying
to exercise removed write/confirm/export-change-request controls.
"""
from __future__ import annotations

from verify_t109_public_internal_ia_browser import main


if __name__ == "__main__":
    main()
