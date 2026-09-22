#!/usr/bin/env python3
"""Build the read-only TWDB GAM engine evidence matrix.

The CKAN snapshot is the source of package/resource identity.  Engine decisions
are deliberately kept in this file as an auditable override map: a missing or
ambiguous override becomes ``hold`` and never receives a guessed archive SVO.
No CKAN or MINT API is called by this command.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

CKAN = "https://ckan.tacc.utexas.edu"
ORG = "twdb-gams"

ARCHIVE_SVOS = {
    "MODFLOW-6": "groundwater_model_modflow6_simulation_archive",
    "MODFLOW-2000": "groundwater_model_modflow2000_simulation_archive",
    "MODFLOW-2005": "groundwater_model_modflow2005_simulation_archive",
    "MODFLOW-96": "groundwater_model_modflow96_simulation_archive",
}

# resource_id: reviewed engine decision.  The evidence URLs are intentionally
# direct official reports/pages where available; CKAN package metadata is used
# only where the live resource annotation is the reviewed source.
ENGINE_EVIDENCE: dict[str, dict[str, Any]] = {
    "0c31d94f-e626-4719-95c9-101b80b44f2d": {
        "engine": "MODFLOW-2000", "status": "confirmed", "confidence": "high",
        "evidence_level": "curator_reviewed_ckan", "evidence_basis": "Explicit CKAN modflow_variant=modflow-2000 extra on the live package.",
    },
    "6d1b68ac-c3c4-4630-8f30-3715b1759c9f": {
        "engine": "MODFLOW-96", "status": "confirmed", "confidence": "high",
        "evidence_level": "curator_reviewed_ckan", "evidence_basis": "Explicit CKAN modflow_variant=modflow-96 extra on the live package; official TWDB model page identifies the release.",
    },
    "89a8d761-d9ab-4cdb-9370-ea1ca44eb71e": {
        "engine": "MODFLOW-6", "status": "confirmed", "confidence": "high",
        "evidence_level": "curator_reviewed_ckan", "evidence_basis": "Explicit CKAN modflow_variant=modflow6 extra on the live package.",
    },
    "322a568f-b2d0-45be-a8cc-c9033a54f073": {
        "engine": "MODFLOW-2000", "status": "confirmed", "confidence": "high",
        "evidence_level": "curator_reviewed_ckan", "evidence_basis": "Live CKAN resource abstract identifies this unversioned Seymour archive as native MODFLOW-2000.",
    },
    "3d3a9061-cb24-4c6d-808c-310bf5f0ed88": {
        "engine": "MODFLOW-6", "status": "confirmed", "confidence": "high",
        "evidence_level": "official_page", "evidence_basis": "Official TWDB Seymour/Blaine page identifies v2.01 as coded using MODFLOW 6.",
        "evidence_url": "https://www.twdb.texas.gov/groundwater/models/gam/symr/symr.asp",
    },
    "b0b28282-05ee-4413-9bb1-d9ed5b850214": {
        "engine": "MODFLOW-2000", "status": "confirmed", "confidence": "high",
        "evidence_level": "official_report", "evidence_basis": "Nacatoch numerical model report identifies MODFLOW-2000.",
        "evidence_url": "https://www.twdb.texas.gov/groundwater/models/gam/nctc/NCTC_Model_Report.pdf",
    },
    "59abce6e-6aba-4a85-b4b1-ae82a310ef7d": {
        "engine": "MODFLOW-96", "status": "confirmed", "confidence": "high",
        "evidence_level": "official_report", "evidence_basis": "TWDB GAM run report identifies the Lipan model as MODFLOW-96.",
        "evidence_url": "https://www.twdb.texas.gov/groundwater/docs/GAMruns/GR23-023.pdf",
    },
    "69f17ab8-462f-4344-8229-a5edb71c5186": {
        "engine": "MODFLOW-NWT", "status": "confirmed", "confidence": "high",
        "evidence_level": "official_report", "evidence_basis": "High Plains numerical report identifies MODFLOW-NWT; this is not interchangeable with MODFLOW-2005.",
        "evidence_url": "https://www.twdb.texas.gov/groundwater/models/gam/hpas/HPAS_GAM_Numerical_Report.pdf",
    },
    "0885d036-b73b-4373-aa4c-16ca96d61ef1": {
        "engine": "MODFLOW-NWT", "status": "confirmed", "confidence": "high",
        "evidence_level": "official_report", "evidence_basis": "Blossom model report identifies MODFLOW-NWT; this is not interchangeable with MODFLOW-2005.",
        "evidence_url": "https://www.twdb.texas.gov/groundwater/models/gam/blsm/BlossomModelReport_Final_012422.pdf",
    },
    "88c0b495-1b7d-4f99-ba65-8e1165bf649c": {
        "engine": "MODFLOW-6", "status": "confirmed", "confidence": "high",
        "evidence_level": "official_report", "evidence_basis": "Cross Timbers SAF summary identifies MODFLOW-6.",
        "evidence_url": "https://www.twdb.texas.gov/groundwater/models/gam/cstb/CrossTimbersGAM_SAF2_Summary_FinalMemo.pdf",
    },
    "d58dd792-ff36-4e50-9936-83dcffaa8295": {
        "engine": "MODFLOW-6", "status": "confirmed", "confidence": "medium",
        "evidence_level": "curator_reviewed_ckan", "evidence_basis": "Live CKAN resource abstract identifies MODFLOW 6 for the northern Gulf Coast archive.",
    },
    "e318e313-12e1-4e92-a811-bf0fb085214e": {
        "engine": "MODFLOW-USG", "status": "confirmed", "confidence": "medium",
        "evidence_level": "curator_reviewed_ckan", "evidence_basis": "Live CKAN resource abstract identifies MODFLOW-USG; requires a distinct MINT contract.",
    },
    "908fa07e-5c6f-49bc-af23-d658e3b435d7": {
        "engine": "MODFLOW-2000", "status": "confirmed", "confidence": "high",
        "evidence_level": "official_report", "evidence_basis": "GMA16 model report identifies MODFLOW-2000.",
        "evidence_url": "https://www.twdb.texas.gov/groundwater/models/alt/gma16/GMA16_Model_Report_DRAFT.pdf",
    },
    "d63a3c99-7633-47ed-b897-75df156e5719": {
        "engine": "MODFLOW-2000", "status": "candidate", "confidence": "medium",
        "evidence_level": "official_page", "evidence_basis": "Official Edwards-Trinity alternative page distinguishes an updated MODFLOW-2000 model from the original MODFLOW-96; release-to-archive correspondence still needs confirmation.",
        "evidence_url": "https://www.twdb.texas.gov/groundwater/models/alt/eddt_p_2011/alt1_eddt_p.asp",
    },
    "5097bb8b-0624-48e6-a3d8-6e1b70bec545": {
        "engine": "GWSIM", "status": "confirmed", "confidence": "high",
        "evidence_level": "curator_reviewed_ckan", "evidence_basis": "Live CKAN package identifies GWSIM as the TWDB-maintained alternative; do not map it to MODFLOW.",
    },
    "12a42603-f17b-4d35-9c5e-a7a7e2ee7307": {
        "engine": "MODFLOW-USG", "status": "confirmed", "confidence": "medium",
        "evidence_level": "curator_reviewed_ckan", "evidence_basis": "Live CKAN resource abstract identifies MODFLOW-USG beta; requires a distinct MINT contract.",
    },
    "3a9a635f-6330-46a3-84bc-579cd557ae5c": {
        "engine": "MODFLOW-2000", "status": "confirmed", "confidence": "medium",
        "evidence_level": "curator_reviewed_ckan", "evidence_basis": "Live CKAN resource abstract identifies MODFLOW-2000 for Barton Springs.",
    },
    "48fbf141-fbfa-4c88-9e8a-96b1e4f5aa31": {
        "engine": "MODFLOW-6", "status": "candidate", "confidence": "medium",
        "evidence_level": "curator_reviewed_ckan", "evidence_basis": "Live CKAN landing metadata says the southern Carrizo-Wilcox model was developed using MODFLOW 6; archive/release confirmation remains required.",
    },
    "91900e12-978a-4896-93c5-12a8fe851d02": {
        "engine": "MODFLOW-USG", "status": "confirmed", "confidence": "high",
        "evidence_level": "curator_reviewed_ckan", "evidence_basis": "Explicit CKAN modflow_variant=modflow-usg extra on the live package; requires a distinct MINT contract.",
    },
    "925114fc-625c-46a0-a366-bcb3224ca54d": {
        "engine": "MODFLOW-2005", "status": "confirmed", "confidence": "high",
        "evidence_level": "archive_member", "evidence_basis": "The live CKAN package exposes mf2005.nam and mf2005.in alongside the Capitan archive, directly identifying the executable family.",
    },
    "c76c6801-dbc0-4567-b285-2dbfa165223d": {
        "engine": "MODFLOW-2000", "status": "confirmed", "confidence": "high",
        "evidence_level": "official_report", "evidence_basis": "Bone Spring-Victorio Peak report identifies MODFLOW-2000.",
        "evidence_url": "https://www.twdb.texas.gov/groundwater/models/gam/bsvp/bsvp_report.pdf",
    },
    "7b5e6cee-b68f-40e1-9105-1700bf54b1ed": {
        "engine": "MODFLOW-6", "status": "confirmed", "confidence": "high",
        "evidence_level": "tapis_remote_tree", "evidence_basis": "Tapis cloud.data.exec tree contains the model run README specifying MODFLOW 6 version 6.0.5 (mf6.exe) for the northern Carrizo-Wilcox model.",
        "evidence_url": "https://portals.tapis.io/v3/files/ops/cloud.data.exec/corral-repl/tacc/aci/PT2050/projects/PTDATAX-272/Carrizo-Wilcox_Aquifer_northern_portion_GAM_version_3.01/Model_File/czwx_n_qcsp_v3.01/0_readme_to_run_model.txt",
    },
    "e5ec33c6-f389-4477-9798-ea5843e9d98b": {
        "engine": "MODFLOW-96", "status": "confirmed", "confidence": "high",
        "evidence_level": "tapis_remote_tree", "evidence_basis": "Tapis cloud.data.exec tree contains mf96hueco.exe beside the Hueco steady-state and transient namefiles.",
        "evidence_url": "https://portals.tapis.io/v3/files/ops/cloud.data.exec/corral-repl/tacc/aci/PT2050/projects/PTDATAX-272/Hueco_Bolsons_Aquifer_GAM/Model_File/Hueco_Bolson_Model_Only/SourceCode/mf96hueco.exe",
    },
    "a4e5fde3-16a9-4dd2-ac41-fa236dcc0b8f": {
        "engine": "MODFLOW-96", "status": "confirmed", "confidence": "high",
        "evidence_level": "tapis_remote_tree", "evidence_basis": "Tapis cloud.data.exec tree contains mf96canu.exe beside the Mesilla MODFLOW namefiles.",
        "evidence_url": "https://portals.tapis.io/v3/files/ops/cloud.data.exec/corral-repl/tacc/aci/PT2050/projects/PTDATAX-272/Mesilla_Bolsons_Aquifer_GAM/Model_File/Mesilla_Bolson_Model_Only/modflow/input/mf96canu.exe",
    },
    "08d07247-380d-4f54-b545-5b69f091b2a6": {
        "engine": "MODFLOW-96", "status": "confirmed", "confidence": "high",
        "evidence_level": "tapis_remote_tree", "evidence_basis": "Tapis cloud.data.exec tree contains Modflw96v.exe and the directory README explicitly identifies MODFLOW-96 ASCII array format and the USGS MODFLOW-96 executable.",
        "evidence_url": "https://portals.tapis.io/v3/files/ops/cloud.data.exec/corral-repl/tacc/aci/PT2050/projects/PTDATAX-272/Igneous_and_West_Texas_Bolsons_Wild_Horse_Flat_Michigan_Flat_Ryan_Flat_and_Lobo_Flat_aquifers_GAM/Geodatabase/Igneous_WTBL/CD-2_model/modflow/trans/readme.txt",
    },
    "4363e24a-50b3-4adb-8133-3d0c505092d6": {
        "engine": "MODFLOW-USG", "status": "confirmed", "confidence": "high",
        "evidence_level": "tapis_remote_tree", "evidence_basis": "Tapis cloud.data.exec tree contains MFUSGs.exe and the Llano input directory is explicitly named modflow-usg.",
        "evidence_url": "https://portals.tapis.io/v3/files/ops/cloud.data.exec/corral-repl/tacc/aci/PT2050/projects/PTDATAX-272/Llano_Uplift_Aquifer_System_GAM/Model_File/Llano_v1.01_model_reports/Model/Model/MFUSGs.exe",
    },
    "a4d6ef2e-7c95-4883-8578-392bcc183171": {
        "engine": "MODFLOW-2000", "status": "confirmed", "confidence": "high",
        "evidence_level": "tapis_remote_tree", "evidence_basis": "Tapis cloud.data.exec tree contains the Presidio/Redford README, which instructs users to run the model with the USGS mf2k executable.",
        "evidence_url": "https://portals.tapis.io/v3/files/ops/cloud.data.exec/corral-repl/tacc/aci/PT2050/projects/PTDATAX-272/West_Texas_Bolsons_Presidio_and_Redford_Bolsons_Aquifer_GAM/Model_File/West_Texas_Bolsons_Presidio_Redford_Model_only/CD1-Report_Model/00_Readme.txt",
    },
    "156c24a2-c87e-4d6f-915b-4df40e7d5673": {
        "engine": "MODFLOW-NWT", "status": "confirmed", "confidence": "high",
        "evidence_level": "tapis_remote_tree", "evidence_basis": "Tapis cloud.data.exec tree contains the Rustler README, which identifies MODFLOW-NWT executables in the calibrated, official 200 AFY, and low-Kv model directories.",
        "evidence_url": "https://portals.tapis.io/v3/files/ops/cloud.data.exec/corral-repl/tacc/aci/PT2050/projects/PTDATAX-272/Rustler_Aquifer_GAM/Model_File/rslr_model/model/00_readme.txt",
    },
    "06ef0c24-3714-47ad-b246-ebf4a5cc8a97": {
        "engine": "MODFLOW-2000", "status": "confirmed", "confidence": "high",
        "evidence_level": "tapis_remote_tree", "evidence_basis": "Tapis cloud.data.exec tree contains mf2k.exe beside the West Texas Bolsons Red Light/Green River/Eagle Flat steady-state and transient namefiles.",
        "evidence_url": "https://portals.tapis.io/v3/files/ops/cloud.data.exec/corral-repl/tacc/aci/PT2050/projects/PTDATAX-272/West_Texas_Bolsons_Red_Light_Green_River_and_Eagle_Flat_Aquifer_GAM/Model_File/West_Texas_Bolsons_Model_Only/CD-2_wtbl_model/Modflow/Transient/mf2k.exe",
    },
    "5f5a6b12-be32-44f8-8a83-e651abd90589": {
        "engine": "MODFLOW-USG", "status": "confirmed", "confidence": "high",
        "evidence_level": "archive_member", "evidence_basis": "The remote BRAA101_01_Model_Report.zipx member directory contains Model_and_Utilities/bin/mfusg-beta.exe and a README referring to importing USG into GWV.",
        "evidence_url": "https://gw-models.s3.amazonaws.com/Download_GAMs/bzrv/BRAA101_01_Model_Report.zipx",
    },
    "fc6f3783-aaed-437a-a5ea-746cf22ac97a": {
        "engine": "MODFLOW-2000", "status": "confirmed", "confidence": "high",
        "evidence_level": "official_report", "evidence_basis": "The official Kinney County Groundwater Flow Model report identifies the new model as USGS MODFLOW-2000 Version 1.19.01, released in 2010.",
        "evidence_url": "https://www.twdb.texas.gov/groundwater/models/alt/knny/Kinney_County_Model_Report.pdf",
    },
    "405aa21a-8b1f-4a61-80da-e4ef04753c67": {
        "engine": "MODFLOW-USG", "status": "confirmed", "confidence": "high",
        "evidence_level": "archive_member", "evidence_basis": "The remote lrgv1.01_model_files.zipx member directory contains USGs_lrgv.exe in the calibrated flow and density-dependent model directories.",
        "evidence_url": "https://gw-models.s3.amazonaws.com/Download_GAMs/lrgv/lrgv1.01_model_files.zipx",
    },
    "2265a241-d194-432c-afa7-131937e31439": {
        "engine": "MODFLOW-2000", "status": "confirmed", "confidence": "high",
        "evidence_level": "official_report", "evidence_basis": "The official Seymour Haskell/Knox/Baylor GAM report identifies the flow model as USGS MODFLOW-2000.",
        "evidence_url": "https://www.twdb.texas.gov/groundwater/models/gam/symr_hkb/Seymour_HKB_GAM_Report_Sealed_021414.pdf",
    },
}

PACKAGE_OVERRIDES: dict[str, dict[str, Any]] = {
    "gulf-coast-southern-superseded-gam": {"disposition": "historical", "reason": "Superseded landing page only; no model_archive resource."},
    "ntgam-v301-outputs": {"disposition": "derived", "reason": "Published hydraulic-head outputs and geometry; no model_archive resource."},
    "ntgam-trinity-woodbine-v301": {"disposition": "derived", "reason": "Published outputs, geometry, and lithology; no model_archive resource."},
    "swp22-groundwater-management-area-model-files": {"disposition": "not_executable", "reason": "Planning documents and a BIN resource; no model_archive resource."},
    "twdb-knny-model-archives": {"disposition": "alternative/research", "reason": "TWDB alternative-model collection; exact executable engine still needs confirmation."},
    "twdb-gma16-model-archives": {"disposition": "alternative/research", "reason": "TWDB alternative-model collection; archive engine is confirmed MODFLOW-2000."},
    "twdb-lrgv-model-archives": {"disposition": "alternative/research", "reason": "TWDB research transport model; exact executable engine and MINT contract still need confirmation."},
}


def _extras(package: dict[str, Any]) -> dict[str, str]:
    return {item["key"]: item["value"] for item in package.get("extras", []) if item.get("key") and item.get("value") is not None}


def build(snapshot: dict[str, Any]) -> dict[str, Any]:
    packages = snapshot.get("result", {}).get("results", [])
    if len(packages) != 36:
        raise ValueError(f"Expected 36 twdb-gams packages, found {len(packages)}")

    package_rows: list[dict[str, Any]] = []
    resource_rows: list[dict[str, Any]] = []
    seen_resources: set[str] = set()

    for package in sorted(packages, key=lambda item: item["name"]):
        package_name = package["name"]
        archives = [resource for resource in package.get("resources", []) if resource.get("resource_type") == "model_archive"]
        override = PACKAGE_OVERRIDES.get(package_name, {})
        package_row = {
            "package_id": package["id"],
            "package_name": package_name,
            "title": package.get("title"),
            "package_url": f"{CKAN}/dataset/{package_name}",
            "model_code": _extras(package).get("twdb_model_code"),
            "model_archive_resource_ids": [resource["id"] for resource in archives],
            "model_archive_count": len(archives),
            "disposition": override.get("disposition"),
            "reason": override.get("reason"),
        }
        package_rows.append(package_row)

        for resource in archives:
            resource_id = resource["id"]
            if resource_id in seen_resources:
                raise ValueError(f"Duplicate model_archive resource ID: {resource_id}")
            seen_resources.add(resource_id)
            decision = ENGINE_EVIDENCE.get(resource_id, {})
            engine = decision.get("engine")
            engine_status = decision.get("status", "unresolved")
            supports_mint_archive_svo = engine in ARCHIVE_SVOS and engine_status == "confirmed"
            if supports_mint_archive_svo:
                registration = "register"
                target_svo = ARCHIVE_SVOS[engine]
            elif engine_status == "confirmed":
                registration = "hold_missing_mint_contract"
                target_svo = None
            else:
                registration = "hold_evidence"
                target_svo = None
            resource_rows.append({
                "package_id": package["id"],
                "package_name": package_name,
                "resource_id": resource_id,
                "resource_name": resource.get("name"),
                "resource_url": resource.get("url"),
                "engine": engine,
                "engine_status": engine_status,
                "confidence": decision.get("confidence", "none"),
                "registration": registration,
                "target_archive_svo": target_svo,
                "evidence_level": decision.get("evidence_level", "unresolved_catalog"),
                "evidence_url": decision.get("evidence_url", package_row["package_url"]),
                "evidence_basis": decision.get("evidence_basis", "No unique engine evidence was recorded; fail closed."),
            })

    if len(seen_resources) != 33:
        raise ValueError(f"Expected 33 model_archive resources, found {len(seen_resources)}")

    resources_by_package = {}
    for row in resource_rows:
        resources_by_package.setdefault(row["package_id"], []).append(row)
    for package_row in package_rows:
        if package_row["disposition"]:
            continue
        package_resources = resources_by_package.get(package_row["package_id"], [])
        if package_resources and all(row["registration"] == "register" for row in package_resources):
            package_row["disposition"] = "register"
            package_row["reason"] = "Every executable archive in this package has confirmed evidence and an existing exact-engine archive SVO contract."
        elif package_resources:
            package_row["disposition"] = "hold"
            package_row["reason"] = "Executable archive exists; exact engine evidence is incomplete or the MINT contract is not yet approved."
        else:
            package_row["disposition"] = "not_executable"
            package_row["reason"] = "No model_archive resource is present in the live CKAN package."

    register_count = sum(row["registration"] == "register" for row in resource_rows)
    hold_count = len(resource_rows) - register_count
    return {
        "matrix_version": "2026-09-22.3",
        "generated_from": "https://ckan.tacc.utexas.edu/api/3/action/package_search?fq=organization:twdb-gams&rows=1000&start=0",
        "scope": {"organization": ORG, "package_count": len(package_rows), "model_archive_resource_count": len(resource_rows)},
        "policy": {
            "evidence_precedence": ["archive_member", "official_report", "official_page", "curator_reviewed_ckan"],
            "unknown_or_conflicting": "hold",
            "unsupported_engine": "hold_missing_mint_contract",
            "archive_svo_labels": ARCHIVE_SVOS,
        },
        "summary": {
            "package_dispositions": {disposition: sum(row["disposition"] == disposition for row in package_rows) for disposition in sorted({row["disposition"] for row in package_rows})},
            "resource_registrations": {"register": register_count, "hold": hold_count},
            "engines": {engine or "unresolved": sum(row["engine"] == engine for row in resource_rows) for engine in sorted({row["engine"] for row in resource_rows}, key=lambda value: value or "")},
        },
        "packages": package_rows,
        "resources": sorted(resource_rows, key=lambda row: (row["package_name"], row["resource_id"])),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshot", type=Path, help="read-only CKAN package_search JSON snapshot")
    parser.add_argument("output", type=Path, help="matrix JSON output path")
    args = parser.parse_args()
    matrix = build(json.loads(args.snapshot.read_text()))
    args.output.write_text(json.dumps(matrix, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(matrix["summary"], indent=2))


if __name__ == "__main__":
    main()
