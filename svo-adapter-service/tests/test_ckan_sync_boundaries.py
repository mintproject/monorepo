from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.ckan_sync import _resource_to_data_object  # noqa: E402


def test_ckan_sync_maps_arcgis_boundary_resource_to_data_object():
    warnings: list[str] = []
    obj = _resource_to_data_object(
        {
            "id": "e5f12940-d08f-4a66-900f-d45805a35e59",
            "name": "TWDB Statewide GMA Boundaries (FeatureServer Layer 4)",
            "url": "https://services1.arcgis.com/7DRakJXKPEhwv0fM/arcgis/rest/services/Z_Statewide_gdb/FeatureServer/4",
            "format": "Esri REST",
            "mint_standard_variables": "groundwater_management_area__boundary",
            "boundary_type": "gma",
            "arcgis_query_field": "GMAnum",
            "feature_count": "16",
            "source_authority": "TWDB",
        },
        warnings,
        pkg_name="twdb-gis-datasets",
        pkg_title="TWDB GIS Datasets",
    )

    assert warnings == []
    assert obj is not None
    assert obj["id"] == "ckan-e5f12940-d08f-4a66-900f-d45805a35e59"
    assert obj["format"] == "arcgis-layer"
    assert obj["source_catalog"] == "ckan:twdb-gis-datasets"

    variable = obj["variables"]["data"][0]
    assert variable["standard_variable_uri"] == (
        "https://w3id.org/okn/i/mint/groundwater_management_area__boundary"
    )
    assert variable["local_name"] == "groundwater_management_area__boundary"
    assert variable["spatial_type"] == "polygon"
    assert variable["crs"] == "EPSG:4326"
    assert variable["metadata_json"] == {
        "boundary_type": "gma",
        "arcgis_query_field": "GMAnum",
        "feature_count": "16",
        "source_authority": "TWDB",
        "service_type": "arcgis",
    }


def test_ckan_sync_maps_boundary_aliases_and_shapefile_zip_format():
    warnings: list[str] = []
    obj = _resource_to_data_object(
        {
            "id": "97b3a512-ae16-4e51-aa24-09c68d369d41",
            "name": "Groundwater Management Areas (GMA) Shapefile",
            "url": "https://www.twdb.texas.gov/mapping/gisdata/doc/gma.zip",
            "format": "ZIP",
            "mint_standard_variables": "gma__boundary",
            "boundary_type": "gma",
            "source_updated": "2021-05-24",
        },
        warnings,
        pkg_name="twdb-gis-datasets",
    )

    assert warnings == []
    assert obj is not None
    assert obj["format"] == "shapefile-zip"

    variable = obj["variables"]["data"][0]
    assert variable["standard_variable_uri"] == (
        "https://w3id.org/okn/i/mint/groundwater_management_area__boundary"
    )
    assert variable["spatial_type"] == "polygon"
    assert variable["crs"] == "EPSG:4326"
    assert variable["metadata_json"] == {
        "boundary_type": "gma",
        "source_updated": "2021-05-24",
    }
