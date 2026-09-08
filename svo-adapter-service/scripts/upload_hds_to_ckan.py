#!/usr/bin/env python3
"""
Upload HDS file to CKAN as a new resource in the NTGAM v3.01 dataset.
"""

import os
import sys
import requests
import argparse
from pathlib import Path

CKAN_BASE = "https://ckan.tacc.utexas.edu"
DATASET_ID = "dd7ae765-3789-4c3c-8d2c-04df49f34ba5"  # ntgam-v301-outputs


def upload_to_ckan(file_path: str, ckan_token: str, layer: int = 8, 
                   stress_period: int = 92, year: int = 2019,
                   name_suffix: str = "") -> dict:
    """
    Upload HDS file to CKAN as a new resource in the NTGAM dataset.
    
    Returns the created resource dict.
    """
    file_path = Path(file_path)
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    
    file_size = file_path.stat().st_size
    
    # Build resource metadata
    year_str = str(year)
    sp_str = f"SP{str(stress_period).zfill(3)}"
    layer_str = f"Layer {layer}"
    
    name = f"Hydraulic Head — Hosston ({layer_str}) — {year}"
    if name_suffix:
        name += f" — {name_suffix}"
    
    resource_data = {
        "package_id": DATASET_ID,
        "name": name,
        "description": f"MODFLOW HDS binary — Hosston (Layer {layer}) — Stress Period {stress_period} — {year}",
        "format": "HDS",
        "mimetype": "application/octet-stream",
        "url_type": "upload",
        "size": file_size,
        # NTGAM-specific metadata fields
        "gam_version": "3.01",
        "model_layer": str(layer),
        "stress_period": str(stress_period),
        "temporal_coverage_start": "1890-01-01",
        "temporal_coverage_end": "2024-12-31",
        "unit": "ft",
        "standard_variable_uri": "https://w3id.org/okn/i/mint/groundwater__hydraulic_head",
        "mint_standard_variables": "groundwater__hydraulic_head",
        "ntgam_theme": "hds",
        "source_path": f"NTGAM_Geodatabase/HDS/hds_lyr{layer}_sp{stress_period}.hds",
    }
    
    # Upload
    url = f"{CKAN_BASE}/api/action/resource_create"
    headers = {"Authorization": ckan_token}
    
    with open(file_path, 'rb') as f:
        files = {'upload': (file_path.name, f, 'application/octet-stream')}
        response = requests.post(url, headers=headers, data=resource_data, files=files, timeout=120)
    
    response.raise_for_status()
    result = response.json()
    
    if not result.get('success'):
        raise RuntimeError(f"CKAN upload failed: {result.get('error')}")
    
    return result['result']


def main():
    parser = argparse.ArgumentParser(description='Upload HDS file to CKAN NTGAM dataset')
    parser.add_argument('file_path', help='Path to HDS file')
    parser.add_argument('--token', required=True, help='CKAN API token')
    parser.add_argument('--layer', type=int, default=8, help='Model layer')
    parser.add_argument('--stress-period', type=int, default=92, help='Stress period')
    parser.add_argument('--year', type=int, default=2019, help='Year')
    parser.add_argument('--name-suffix', default='', help='Optional name suffix')
    args = parser.parse_args()
    
    print(f"Uploading {args.file_path} to CKAN...")
    print(f"  Layer: {args.layer}")
    print(f"  Stress Period: {args.stress_period}")
    print(f"  Year: {args.year}")
    
    result = upload_to_ckan(
        args.file_path, args.token,
        layer=args.layer,
        stress_period=args.stress_period,
        year=args.year
    )
    
    resource = result
    print(f"\n✅ Upload successful!")
    print(f"  Resource ID: {resource['id']}")
    print(f"  Name: {resource['name']}")
    print(f"  Download URL: {CKAN_BASE}/dataset/{DATASET_ID}/resource/{resource['id']}/download/{resource['name']}.hds")
    print(f"  Direct download: {resource.get('url', 'N/A')}")
    
    return resource


if __name__ == '__main__':
    main()