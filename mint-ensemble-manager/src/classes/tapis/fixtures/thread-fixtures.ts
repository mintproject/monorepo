export default {
    id: "htB3zuUquzsbXCqSNbqq",
    task_id: "uvzizt5HMAVutsnJ7v7l",
    regionid: "texas",
    name: "Average condition",
    dates: {
        start_date: "2022-02-20T00:00:00.000Z",
        end_date: "2022-02-28T00:00:00.000Z"
    },
    driving_variables: [],
    response_variables: [],
    execution_summary: {
        "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg": {
            total_runs: 1,
            submitted_runs: 0,
            successful_runs: 0,
            failed_runs: 0,
            ingested_runs: 0,
            registered_runs: 0,
            published_runs: 0,
            submission_time: "2024-06-05T14:25:44.654",
            submitted_for_execution: true,
            submitted_for_ingestion: false,
            submitted_for_publishing: false,
            submitted_for_registration: false
        }
    },
    events: [
        {
            event: "CREATE",
            userid: "mint@isi.edu",
            timestamp: "2024-06-04T15:12:05.908Z",
            notes: "Default Thread Created"
        },
        {
            event: "SELECT_MODELS",
            userid: "mint@isi.edu",
            timestamp: "2024-06-04T15:12:28.816Z",
            notes: ""
        },
        {
            event: "SELECT_DATA",
            userid: "mint@isi.edu",
            timestamp: "2024-06-04T15:12:33.935Z",
            notes: ""
        },
        {
            event: "UPDATE",
            userid: "mint@isi.edu",
            timestamp: "2024-06-04T15:12:44.276Z",
            notes: "Default Thread Created"
        },
        {
            event: "SELECT_PARAMETERS",
            userid: "mint@isi.edu",
            timestamp: "2024-06-04T15:52:25.244Z",
            notes: ""
        }
    ],
    models: {
        "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg": {
            id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg",
            name: "MODFLOW 2005 model setup calibrated for the Barton Springs region. Files for average conditions have been pre-selected",
            description:
                "The Barton Springs groundwater model completed in 2001 by Scanlon with others was constructed to match water levels and spring flow from a period of wetter than normal rainfall conditions. An assessment of the model post completion revealed that it overestimates spring flow and underpredicts water-level elevations generally, but it does capture general aquifer behaviors and response.",
            category: "Hydrology",
            region_name: "Barton Springs (Texas)",
            dimensionality: "3D",
            type: "Theory-Guided Model",
            model_version: "https://w3id.org/okn/i/mint/modflow_2005",
            model_name: "https://w3id.org/okn/i/mint/MODFLOW",
            model_configuration: "https://w3id.org/okn/i/mint/modflow_2005_cfg",
            parameter_assignment: "Calibration",
            parameter_assignment_details: "",
            calibration_target_variable: "",
            spatial_grid_type: "SpatiallyDistributedGrid",
            spatial_grid_resolution: "variable range",
            code_url:
                "https://github.com/mintproject/MINT-WorkflowDomain/raw/master/WINGSWorkflowComponents/MODFLOW2005/MODFLOW2005.zip",
            software_image: "mintproject/modflow-2005:latest",
            __typename: "model",
            input_files: [
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Bas",
                    name: "bas6",
                    type: "https://w3id.org/wings/export/MINT#MODFLOWBas6",
                    value: {
                        id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Bas_fixed_dataset",
                        name: "bas6_fixed_dataset",
                        resources: [
                            {
                                id: "6a40bdbdbb72888c539fdd4b39d50bba",
                                name: "BARTON_SPRINGS_2001_2010AVERAGE.ba6",
                                url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.ba6",
                                __typename: "resource"
                            }
                        ]
                    },
                    position: 1,
                    variables: ["groundwater__initial_head"]
                },
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Dis",
                    name: "dis",
                    type: "https://w3id.org/wings/export/MINT#MODFLOWdis",
                    value: {
                        id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Dis_fixed_dataset",
                        name: "dis_fixed_dataset",
                        resources: [
                            {
                                id: "1a877fc86732dd3417c3860fabec2293",
                                name: "BARTON_SPRINGS_2001_2010AVERAGE.dis",
                                url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.dis",
                                __typename: "resource"
                            }
                        ]
                    },
                    position: 2,
                    variables: [
                        "model_grid_row__count",
                        "model_grid_cell_edge~along-column__length",
                        "model_grid_cell_edge~along-row__length",
                        "model_grid_layer__count",
                        "model_grid_column__count",
                        "model__stress_period_time_step_count",
                        "model__stress_period_count",
                        "model__stress_period_duration",
                        "model__successive_time_step_multiplier",
                        "model_grid_layer_bottom__elevation",
                        "model_grid_layer~topmost_top__elevation"
                    ]
                },
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Bcf",
                    name: "bcf6",
                    type: "https://w3id.org/wings/export/MINT#MODFLOWbcf6",
                    value: {
                        id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Bcf_fixed_dataset",
                        name: "bcf6_fixed_dataset",
                        resources: [
                            {
                                id: "2460cc306c2a2626c1351bfa7b8841e2",
                                name: "BARTON_SPRINGS_2001_2010AVERAGE.bc6",
                                url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.bc6",
                                __typename: "resource"
                            }
                        ]
                    },
                    position: 3,
                    variables: [
                        "groundwater__horizontal_hydraulic_conductivity",
                        "groundwater__secondary_storage_coefficient",
                        "groundwater__vertical_hydraulic_conductivity",
                        "groundwater__horizontal_transmissivity",
                        "groundwater__primary_storage_coefficient",
                        "groundwater__horizontal_anisotropy_factor"
                    ]
                },
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Oc",
                    name: "oc",
                    type: "https://w3id.org/wings/export/MINT#MODFLOWoc",
                    value: {
                        id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Oc_fixed_dataset",
                        name: "oc_fixed_dataset",
                        resources: [
                            {
                                id: "267050c6917de1a03ad613f25a740b07",
                                name: "BARTON_SPRINGS_2001_2010AVERAGE.oc",
                                url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.oc",
                                __typename: "resource"
                            }
                        ]
                    },
                    position: 4,
                    variables: []
                },
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Well",
                    name: "wel",
                    type: "",
                    value: {
                        id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Well_fixed_dataset",
                        name: "wel_fixed_dataset",
                        resources: [
                            {
                                id: "d6adc55ebd982fd8f578ce08dd8ca530",
                                name: "BARTON_SPRINGS_2001_2010AVERAGE.wel",
                                url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.wel",
                                __typename: "resource"
                            }
                        ]
                    },
                    position: 5,
                    variables: ["groundwater_well__recharge_volume_flux"]
                },
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Drn",
                    name: "drn",
                    type: "https://w3id.org/wings/export/MINT#MODFLOWdrn",
                    value: {
                        id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Drn_fixed_dataset",
                        name: "drn_fixed_dataset",
                        resources: [
                            {
                                id: "de654e2ee95d5245d9326b730e46c965",
                                name: "BARTON_SPRINGS_2001_2010AVERAGE.drn",
                                url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.drn",
                                __typename: "resource"
                            }
                        ]
                    },
                    position: 6,
                    variables: []
                },
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Rech",
                    name: "rch",
                    type: "https://w3id.org/wings/export/MINT#MODFLOWrch",
                    value: {
                        id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Rech_fixed_dataset",
                        name: "rch_fixed_dataset",
                        resources: [
                            {
                                id: "04a614e0714c3823940acdd77780fb3a",
                                name: "BARTON_SPRINGS_2001_2010AVERAGE.rch",
                                url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.rch",
                                __typename: "resource"
                            }
                        ]
                    },
                    position: 7,
                    variables: ["groundwater__recharge_volume_flux"]
                },
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Hfb",
                    name: "hfb6",
                    type: "https://w3id.org/wings/export/MINT#MODFLOWhfb6",
                    value: {
                        id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Hfb_fixed_dataset",
                        name: "hfb6_fixed_dataset",
                        resources: [
                            {
                                id: "88a5e09bd6db2751e86df787acdf4700",
                                name: "BARTON_SPRINGS_2001_2010AVERAGE.hf6",
                                url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.hf6",
                                __typename: "resource"
                            }
                        ]
                    },
                    position: 8,
                    variables: []
                },
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Sip",
                    name: "sip",
                    type: "https://w3id.org/wings/export/MINT#MODFLOWsip",
                    value: {
                        id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Sip_fixed_dataset",
                        name: "sip_fixed_dataset",
                        resources: [
                            {
                                id: "632093c3356570a96f60aa448f43e2f7",
                                name: "BARTON_SPRINGS_2001_2010AVERAGE.sip",
                                url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.sip",
                                __typename: "resource"
                            }
                        ]
                    },
                    position: 9,
                    variables: []
                }
            ],
            output_files: [
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_list",
                    name: "lst",
                    type: "https://w3id.org/wings/export/MINT#MODFLOWlst",
                    value: null,
                    position: 1,
                    variables: []
                },
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_cbb",
                    name: "cbb",
                    type: "https://w3id.org/wings/export/MINT#MODFLOWcbb",
                    value: null,
                    position: 2,
                    variables: []
                },
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_heads",
                    name: "hds",
                    type: "https://w3id.org/wings/export/MINT#MODFLOWhds",
                    value: null,
                    position: 3,
                    variables: [
                        "ground_interbed~delay_water__critical_head",
                        "model_grid_layer_groundwater__vertical_displacement",
                        "ground_interbed~no-delay__compaction_length",
                        "ground_interbed~no-delay_water__critical_head",
                        "ground__subsidence_length",
                        "model_layer_ground__compaction_length",
                        "ground_interbed~delay__compaction_length"
                    ]
                },
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_ddown",
                    name: "ddn",
                    type: "https://w3id.org/wings/export/MINT#MODFLOWddn",
                    value: null,
                    position: 4,
                    variables: ["groundwater_surface__reduction_of_elevation"]
                }
            ],
            input_parameters: []
        }
    },
    data: {},
    model_ensembles: {
        "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg": {
            id: "cd35ee19-dbc4-40dc-b176-f7bed047856c",
            bindings: {}
        }
    }
};
