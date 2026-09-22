from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.ckan_sync import _resource_to_data_object, sync_ckan_to_adapter  # noqa: E402


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


@pytest.mark.parametrize("fmt", ["ZIP", "ZIPX", "7Z"])
def test_ckan_sync_keeps_model_archives_distinct_from_shapefile_zips(fmt):
    warnings: list[str] = []
    obj = _resource_to_data_object(
        {
            "id": "model-archive",
            "name": "Groundwater Availability Model — Model",
            "url": f"https://example.test/model.{fmt.lower()}",
            "format": fmt,
            "resource_type": "model_archive",
            "mint_standard_variables": "groundwater__hydraulic_head",
        },
        warnings,
        pkg_name="groundwater-model",
    )

    assert warnings == []
    assert obj is not None
    assert obj["format"] == "zip"


@pytest.mark.parametrize(
    ("stdvar", "fmt", "expected_uri", "expected_format"),
    [
        (
            "groundwater__initial_head",
            "BAS",
            "https://w3id.org/okn/i/mint/GROUNDWATER__INITIAL_HEAD",
            "modflow-bas",
        ),
        (
            "groundwater__drawdown",
            "DDN",
            "https://w3id.org/okn/i/mint/wmobley-standard-variable-groundwater-drawdown",
            "hds-mfusg",
        ),
        (
            "groundwater_well__volume_flow_rate",
            "WEL",
            "https://w3id.org/okn/i/mint/61e86974-f1bb-406c-ae52-f6c6eccb6c59",
            "modflow-wel",
        ),
        (
            "model_grid_layer~topmost_top__elevation",
            "DIS",
            "https://w3id.org/okn/i/mint/MODEL_GRID_LAYER~TOPMOST_TOP__ELEVATION",
            "modflow-dis",
        ),
        (
            "land_surface_water__evapotranspiration_flux",
            "EVT",
            "https://w3id.org/okn/i/mint/0bce8a6e-9df5-4272-88cd-41af089a3684",
            "modflow-evt",
        ),
    ],
)
def test_ckan_sync_maps_canonical_modflow_variables(stdvar, fmt, expected_uri, expected_format):
    warnings: list[str] = []
    obj = _resource_to_data_object(
        {
            "id": "resource-id",
            "name": "MODFLOW resource",
            "url": "https://example.test/resource",
            "format": fmt,
            "mint_standard_variables": stdvar,
        },
        warnings,
        pkg_name="capitan-reef-complex-gam",
    )

    assert warnings == []
    assert obj is not None
    assert obj["format"] == expected_format
    assert obj["variables"]["data"][0]["standard_variable_uri"] == expected_uri


def test_ckan_sync_skips_resource_when_every_variable_is_unmapped():
    warnings: list[str] = []
    obj = _resource_to_data_object(
        {
            "id": "resource-id",
            "url": "https://example.test/resource",
            "mint_standard_variables": "unknown_one, unknown_two",
        },
        warnings,
    )

    assert obj is None
    assert len(warnings) == 2


@pytest.mark.asyncio
async def test_ckan_sync_reconciles_variables_and_deletes_stale_objects(monkeypatch):
    resources = [
        {
            "id": "active",
            "name": "Heads",
            "url": "https://example.test/active.hds",
            "format": "HDS",
            "mint_standard_variables": "groundwater__hydraulic_head",
            "_pkg_name": "gam",
        },
        {
            "id": "stale",
            "name": "Archive",
            "url": "https://example.test/archive.zip",
            "format": "ZIP",
            "mint_standard_variables": "",
            "_pkg_name": "gam",
        },
    ]

    async def fake_fetch(*args, **kwargs):
        return resources

    monkeypatch.setattr("app.ckan_sync._fetch_all_resources", fake_fetch)

    class FakeHasura:
        def __init__(self):
            self.operations: list[str] = []

        async def execute(self, query, variables):
            operation = query.split()[1].split("(")[0]
            self.operations.append(operation)
            if operation == "ExistingCkanDataObjects":
                return {"adapter_data_object": [{"id": "ckan-stale"}]}
            if operation == "ReconcileCkanDataObject":
                return {
                    "delete_adapter_data_object_variable": {"affected_rows": 0},
                    "insert_adapter_data_object_one": {"id": variables["id"]},
                }
            if operation == "DeleteCkanDataObject":
                return {"delete_adapter_data_object_by_pk": {"id": variables["id"]}}
            raise AssertionError(operation)

    hasura = FakeHasura()
    result = await sync_ckan_to_adapter(
        hasura,
        ckan_url="https://ckan.example.test",
    )

    assert result.upserted == 1
    assert result.deleted == 1
    assert result.skipped == 1
    assert result.warnings == []
    assert hasura.operations == [
        "ExistingCkanDataObjects",
        "ReconcileCkanDataObject",
        "DeleteCkanDataObject",
    ]
