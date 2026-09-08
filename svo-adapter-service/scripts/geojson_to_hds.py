#!/usr/bin/env python3
"""
Convert CKAN GeoJSON hydraulic head points to MODFLOW HDS binary format.

MODFLOW HDS format (per time step):
- Header (44 bytes): kstp (int), kper (int), pertim (float), totim (float), 
  text (16 bytes), nc (int), nr (int)
- Data: nc * nr float32 values in row-major order (row 1 to nr, col 1 to nc)
- Multiple time steps concatenated

For a minimal demo, we create a single time step, single layer grid.
"""

import struct
import json
import numpy as np
from pathlib import Path
import requests
from scipy.interpolate import griddata
import argparse


HDS_HEADER_FMT = '<iiff16sii'  # kstp, kper, pertim, totim, text(16), nc, nr
HDS_HEADER_SIZE = struct.calcsize(HDS_HEADER_FMT)


def download_geojson(url: str) -> dict:
    """Download GeoJSON from URL."""
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    return response.json()


def create_grid_from_geojson(geojson: dict, nc: int, nr: int, 
                              target_crs: str = "EPSG:4326") -> tuple:
    """
    Create a regular grid from GeoJSON points using interpolation.
    
    Returns:
        (grid_array, x_coords, y_coords, bounds)
    """
    features = geojson.get('features', [])
    if not features:
        raise ValueError("No features in GeoJSON")
    
    points = []
    values = []
    
    for feat in features:
        geom = feat.get('geometry')
        props = feat.get('properties', {})
        if geom is None or geom['type'] != 'Point':
            continue
        coords = geom['coordinates']
        # Find head value in properties
        head_val = None
        for key, val in props.items():
            if 'head' in key.lower() or 'hydraulic' in key.lower() or key.lower() == 'hd':
                if isinstance(val, (int, float)):
                    head_val = float(val)
                    break
        if head_val is not None:
            points.append(coords)
            values.append(head_val)
    
    if len(points) < 3:
        raise ValueError("Insufficient points for interpolation")
    
    points = np.array(points)  # (n, 2) [x, y] = [lon, lat]
    values = np.array(values)
    
    # Determine bounds
    minx, miny = points[:, 0].min(), points[:, 1].min()
    maxx, maxy = points[:, 0].max(), points[:, 1].max()
    
    # Create regular grid
    x_coords = np.linspace(minx, maxx, nc)
    y_coords = np.linspace(maxy, miny, nr)  # Note: row 1 is top (max y)
    
    # Interpolate
    grid_x, grid_y = np.meshgrid(x_coords, y_coords)
    grid_points = np.column_stack([grid_x.ravel(), grid_y.ravel()])
    
    grid_values = griddata(points, values, grid_points, method='linear')
    
    # Fill NaN with nearest
    nan_mask = np.isnan(grid_values)
    if np.any(nan_mask):
        grid_values[nan_mask] = griddata(points, values, grid_points[nan_mask], method='nearest')
    
    # Reshape to (nr, nc)
    grid_array = grid_values.reshape((nr, nc)).astype(np.float32)
    
    return grid_array, x_coords, y_coords, (minx, miny, maxx, maxy)


def write_hds(grid_array: np.ndarray, output_path: Path, 
              kstp: int = 1, kper: int = 1, 
              pertim: float = 0.0, totim: float = 0.0,
              text: str = "HEAD"):
    """
    Write a single-layer, single-time-step HDS file.
    
    grid_array shape: (nr, nc)
    """
    nr, nc = int(grid_array.shape[0]), int(grid_array.shape[1])
    
    with open(output_path, 'wb') as f:
        # Write header
        text_bytes = text.encode('ascii')[:16].ljust(16, b' ')
        header = struct.pack(HDS_HEADER_FMT, 1, 1, 0.0, 0.0, text_bytes, nc, nr)
        f.write(header)
        
        # Write data (row-major, row 1 = top = first row of array)
        # MODFLOW expects row 1 = top, so we write rows in order
        grid_array.tofile(f)
    
    print(f"Wrote HDS file: {output_path}")
    print(f"  Grid: {grid_array.shape[1]} cols x {grid_array.shape[0]} rows")
    print(f"  Value range: {grid_array.min():.2f} to {grid_array.max():.2f}")


def main():
    parser = argparse.ArgumentParser(description='Convert CKAN GeoJSON to MODFLOW HDS')
    parser.add_argument('geojson_url', help='URL of CKAN GeoJSON resource')
    parser.add_argument('-o', '--output', default='head.hds', help='Output HDS file path')
    parser.add_argument('--nc', type=int, default=100, help='Number of columns')
    parser.add_argument('--nr', type=int, default=100, help='Number of rows')
    parser.add_argument('--layer', type=int, default=1, help='Model layer number')
    parser.add_argument('--stress-period', type=int, default=1, help='Stress period')
    parser.add_argument('--timestep', type=int, default=1, help='Time step')
    args = parser.parse_args()
    
    print(f"Downloading GeoJSON from {args.geojson_url}...")
    geojson = download_geojson(args.geojson_url)
    
    print(f"Creating grid ({args.nc}x{args.nr})...")
    grid, x_coords, y_coords, bounds = create_grid_from_geojson(
        geojson, args.nc, args.nr
    )
    
    print(f"  Bounds: {bounds}")
    print(f"  Grid stats: min={grid.min():.2f}, max={grid.max():.2f}, mean={grid.mean():.2f}")
    
    write_hds(grid, Path(args.output), 
              kstp=args.timestep, kper=args.stress_period,
              text=f"LAYER{args.layer:02d}")
    
    print(f"\nDone! HDS file written to {args.output}")
    print(f"To stage to Tapis Files, use: tapis files upload --system ls6 {args.output} /modflow/...")


if __name__ == '__main__':
    main()