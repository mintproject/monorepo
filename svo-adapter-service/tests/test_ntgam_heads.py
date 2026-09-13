from __future__ import annotations

from pathlib import Path

from app import ntgam


def test_list_heads_accepts_tacc_geotiff_metadata(monkeypatch):
    resources = [
        {
            "id": "head-1939",
            "name": "Hydraulic head - Outcrop (layer 1) - 1939",
            "url": "https://ckan.tacc.utexas.edu/dataset/pkg/resource/head-1939/download/cog_hds_lyr1_sp52.tif",
            "format": "GeoTIFF",
            "mint_standard_variables": "groundwater__hydraulic_head",
            "model_layer": 1,
            "temporal_resolution": "predevelopment",
            "year": 1939,
            "unit": "ft",
        },
        {
            "id": "head-2019",
            "name": "Hydraulic head - Outcrop (layer 1) - 2019",
            "url": "https://ckan.tacc.utexas.edu/dataset/pkg/resource/head-2019/download/cog_hds_lyr1_sp132.tif",
            "format": "GeoTIFF",
            "mint_standard_variables": "groundwater__hydraulic_head",
            "model_layer": 1,
            "temporal_resolution": "current",
            "year": 2019,
            "unit": "ft",
        },
        {
            "id": "contour",
            "name": "Hydraulic Head - contour",
            "url": "https://ckan.tacc.utexas.edu/dataset/pkg/resource/contour/download/head.geojson",
            "format": "GeoJSON",
            "mint_standard_variables": "groundwater__hydraulic_head",
            "model_layer": 1,
            "stress_period": "132",
        },
    ]

    monkeypatch.setattr(ntgam, "_ckan", lambda action, **params: {"resources": resources})

    heads = ntgam.list_heads()

    assert [h["id"] for h in heads] == ["head-1939", "head-2019"]
    assert [h["stress_period"] for h in heads] == [52, 132]
    assert [h["temporal_resolution"] for h in heads] == ["predevelopment", "current"]
    assert {h["extent"] for h in heads} == {"full"}


def test_materialized_aquifer_branch_samples_cached_raster(monkeypatch):
    cached = Path("/tmp/aquifer-top.tif")

    def fake_materialize(uri, transform_name, model_layer):
        assert uri == "https://ckan.tacc.utexas.edu/resource/ntgam_dis_geometry.zip"
        assert transform_name == "derive-ntgam-aquifer-top-grid"
        assert model_layer == 2
        return cached

    def fake_sample(uri, lon, lat, token):
        assert uri == str(cached)
        assert (lat, lon) == (32.7767, -96.797)
        return 101.25

    monkeypatch.setattr(ntgam, "_materialize_aquifer_grid", fake_materialize)
    monkeypatch.setattr(ntgam, "sample_raster", fake_sample)

    value, provenance = ntgam.execute_branch({
        "standard_variable": "aquifer__top_elevation",
        "source": "https://ckan.tacc.utexas.edu/resource/ntgam_dis_geometry.zip",
        "etl": ["derive-ntgam-aquifer-top-grid", "sample-raster-at-point"],
    }, 32.7767, -96.797, model_layer=2)

    assert value == 101.25
    assert provenance["source"] == "adapter_materialized_raster"
    assert provenance["raw_resource_uri"].endswith("ntgam_dis_geometry.zip")
    assert provenance["materialized_uri"] == str(cached)


def test_materialized_sdr_branch_samples_cached_geojson(monkeypatch):
    cached = Path("/tmp/sdr-clay.geojson")

    def fake_materialize(uri):
        assert uri == "https://www.twdb.texas.gov/groundwater/data/SDRDownload.zip"
        return cached

    def fake_nearest(uri, lat, lon):
        assert uri == str(cached)
        assert (lat, lon) == (32.7767, -96.797)
        return 1.4, 27.5, {"station": "123", "confidence": "estimated"}

    monkeypatch.setattr(ntgam, "_materialize_sdr_clay_points", fake_materialize)
    monkeypatch.setattr(ntgam, "_nearest_in_geojson", fake_nearest)

    value, provenance = ntgam.execute_branch({
        "standard_variable": "aquitard__clay_thickness",
        "source": "https://www.twdb.texas.gov/groundwater/data/SDRDownload.zip",
        "etl": ["derive-sdr-clay-thickness-points", "nearest-point-sample"],
    }, 32.7767, -96.797, model_layer=2)

    assert value == 27.5
    assert provenance["source"] == "adapter_materialized_point_collection"
    assert provenance["distance_mi"] == 1.4
    assert provenance["confidence"] == "estimated"
