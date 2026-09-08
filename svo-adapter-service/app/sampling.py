"""Point-sampling of CKAN-hosted rasters for the NTGAM location->forecast tab.

We sample a raster at a WGS84 lat/lon using GDAL's ``gdallocationinfo`` (already
installed; lets the adapter venv stay light — no rasterio/pyproj). ``-wgs84`` makes
GDAL reproject the query point into the raster CRS (here NAD83 Albers "GAM", ft),
so callers pass plain lon/lat. Coords go in on stdin to avoid the negative-longitude
being parsed as a CLI flag.

Downloaded rasters are cached on disk by URL for the process lifetime, so sampling
several stress periods at one location does not re-download.
"""
from __future__ import annotations

import hashlib
import subprocess
import tempfile
from pathlib import Path

import httpx

# GDAL writes the float32 nodata sentinel (~ -3.4e38) for out-of-extent / nodata
# cells; anything this large in magnitude is "no data here", not a real head.
_NODATA_MAGNITUDE = 1e30

_CACHE_DIR = Path(tempfile.gettempdir()) / "ntgam-raster-cache"


class SampleError(RuntimeError):
    """Raised when a raster cannot be fetched or sampled."""


def _cache_path(url: str) -> Path:
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha1(url.encode()).hexdigest()[:16]
    suffix = Path(url.split("?", 1)[0]).suffix or ".tif"
    return _CACHE_DIR / f"{key}{suffix}"


def _download(url: str, token: str | None, timeout: float) -> Path:
    if url.startswith("file://"):
        path = Path(url[7:])
        if path.exists():
            return path
    if "://" not in url:
        path = Path(url)
        if path.exists():
            return path

    dest = _cache_path(url)
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    headers = {"Authorization": token} if token else {}
    try:
        with httpx.stream("GET", url, headers=headers, timeout=timeout,
                          follow_redirects=True) as r:
            r.raise_for_status()
            tmp = dest.with_suffix(dest.suffix + ".part")
            with tmp.open("wb") as fh:
                for chunk in r.iter_bytes():
                    fh.write(chunk)
            tmp.replace(dest)
    except httpx.HTTPError as exc:  # network / auth / 404
        raise SampleError(f"could not download raster: {exc}") from exc
    return dest


def sample_raster(url: str, lon: float, lat: float, token: str | None = None,
                  timeout: float = 60.0) -> float | None:
    """Return the raster value at (lon, lat) in WGS84, or ``None`` if the point is
    outside the raster / on a nodata cell. Raises SampleError on fetch/tool failure."""
    path = _download(url, token, timeout)
    try:
        proc = subprocess.run(
            ["gdallocationinfo", "-valonly", "-wgs84", str(path)],
            input=f"{lon} {lat}\n", capture_output=True, text=True, timeout=60,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise SampleError(f"gdallocationinfo failed: {exc}") from exc
    out = (proc.stdout or "").strip().split()
    if proc.returncode != 0 or not out:
        return None
    try:
        val = float(out[0])
    except ValueError:
        return None
    if abs(val) >= _NODATA_MAGNITUDE:
        return None
    return val
