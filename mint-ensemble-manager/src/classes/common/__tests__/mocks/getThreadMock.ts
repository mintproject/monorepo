export const getThreadMock = {
    data: {
        thread_by_pk: {
            id: "lXmryYdX6AQeUIb9I0Kg",
            name: "test",
            task_id: "X1sw3POVnbHAn4A71Wu9",
            start_date: "2024-12-31",
            end_date: "2025-12-31",
            region_id: "texas",
            driving_variable_id: null,
            response_variable_id: null,
            events: [
                {
                    event: "CREATE",
                    timestamp: "2025-03-07T15:34:46.333+00:00",
                    userid: "mosorio",
                    notes: ""
                },
                {
                    event: "SELECT_MODELS",
                    timestamp: "2025-03-07T15:34:59.342+00:00",
                    userid: "mosorio",
                    notes: ""
                },
                {
                    event: "SELECT_DATA",
                    timestamp: "2025-03-07T15:35:06.867+00:00",
                    userid: "mosorio",
                    notes: ""
                },
                {
                    event: "SELECT_PARAMETERS",
                    timestamp: "2025-03-07T15:35:10.024+00:00",
                    userid: "mosorio",
                    notes: ""
                },
                {
                    event: "SELECT_PARAMETERS",
                    timestamp: "2025-03-07T15:40:32.475+00:00",
                    userid: "mosorio",
                    notes: ""
                },
                {
                    event: "SELECT_PARAMETERS",
                    timestamp: "2025-03-07T15:40:40.652+00:00",
                    userid: "mosorio",
                    notes: ""
                },
                {
                    event: "SELECT_PARAMETERS",
                    timestamp: "2025-03-07T15:43:47.722+00:00",
                    userid: "mosorio",
                    notes: ""
                },
                {
                    event: "SELECT_PARAMETERS",
                    timestamp: "2025-03-07T15:44:41.323+00:00",
                    userid: "mosorio",
                    notes: ""
                },
                {
                    event: "SELECT_PARAMETERS",
                    timestamp: "2025-03-07T15:45:12.217+00:00",
                    userid: "mosorio",
                    notes: ""
                },
                {
                    event: "SELECT_DATA",
                    timestamp: "2025-03-11T12:37:17.42+00:00",
                    userid: "mosorio",
                    notes: ""
                }
            ],
            thread_data: [
                {
                    dataslice: {
                        id: "9bab5605-d590-437d-9302-a8c688800a26",
                        dataset: {
                            id: "f3a9feb3-b9ad-494d-b892-34cc1920e5d1",
                            name: "Barton Springs Edwards Aquifer - Well Package (WEL)"
                        },
                        start_date: "2024-12-31",
                        end_date: "2025-12-31",
                        resources: [
                            {
                                selected: true,
                                resource: {
                                    id: "d41d8cd98f00b204e9800998ecf8427e",
                                    name: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.wel",
                                    url: "",
                                    start_date: null,
                                    end_date: null
                                }
                            }
                        ]
                    }
                }
            ],
            thread_models: [
                {
                    id: "4ed9fe06-d29a-4caa-a2c9-00c3e09338c2",
                    execution_summary: [],
                    model: {
                        id: "https://w3id.org/okn/i/mint/d2792424-fb9d-461c-9470-4bc87ca2f05f",
                        name: "MODFLOW 2005 model setup calibrated for the Barton Springs region. Well can be customized (the rest of inputs are average conditions, pre-selected)",
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
                            "https://raw.githubusercontent.com/mosoriob/cookbook-modflow/refs/heads/main/app.json",
                        software_image: "mintproject/modflow-2005:latest",
                        inputs: [
                            {
                                position: 1,
                                model_io: {
                                    id: "https://w3id.org/okn/i/mint/7157b310-3074-4329-be4f-80fb37190833",
                                    name: "bas6",
                                    type: "https://w3id.org/wings/export/MINT#MODFLOWBas6",
                                    format: "ba6",
                                    variables: [
                                        {
                                            variable: {
                                                id: "groundwater__initial_head"
                                            }
                                        }
                                    ],
                                    fixed_bindings: [
                                        {
                                            resource: {
                                                id: "6a40bdbdbb72888c539fdd4b39d50bba",
                                                name: "BARTON_SPRINGS_2001_2010AVERAGE.ba6",
                                                url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.ba6"
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                position: 2,
                                model_io: {
                                    id: "https://w3id.org/okn/i/mint/59e4d2f2-f3cc-4912-8f6f-5b37fa6dad9e",
                                    name: "dis",
                                    type: "https://w3id.org/wings/export/MINT#MODFLOWdis",
                                    format: "dis",
                                    variables: [
                                        {
                                            variable: {
                                                id: "model__stress_period_time_step_count"
                                            }
                                        },
                                        {
                                            variable: {
                                                id: "model_grid_layer~topmost_top__elevation"
                                            }
                                        },
                                        {
                                            variable: {
                                                id: "model_grid_cell_edge~along-row__length"
                                            }
                                        },
                                        {
                                            variable: {
                                                id: "model__stress_period_duration"
                                            }
                                        },
                                        {
                                            variable: {
                                                id: "model_grid_cell_edge~along-column__length"
                                            }
                                        },
                                        {
                                            variable: {
                                                id: "model_grid_layer_bottom__elevation"
                                            }
                                        },
                                        {
                                            variable: {
                                                id: "model__successive_time_step_multiplier"
                                            }
                                        },
                                        {
                                            variable: {
                                                id: "model_grid_row__count"
                                            }
                                        },
                                        {
                                            variable: {
                                                id: "model_grid_column__count"
                                            }
                                        },
                                        {
                                            variable: {
                                                id: "model_grid_layer__count"
                                            }
                                        },
                                        {
                                            variable: {
                                                id: "model__stress_period_count"
                                            }
                                        }
                                    ],
                                    fixed_bindings: [
                                        {
                                            resource: {
                                                id: "1a877fc86732dd3417c3860fabec2293",
                                                name: "BARTON_SPRINGS_2001_2010AVERAGE.dis",
                                                url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.dis"
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                position: 3,
                                model_io: {
                                    id: "https://w3id.org/okn/i/mint/87594b88-1ddd-4c97-a722-3112f8cd0834",
                                    name: "bcf6",
                                    type: "https://w3id.org/wings/export/MINT#MODFLOWbcf6",
                                    format: "bc6",
                                    variables: [
                                        {
                                            variable: {
                                                id: "groundwater__horizontal_transmissivity"
                                            }
                                        },
                                        {
                                            variable: {
                                                id: "groundwater__primary_storage_coefficient"
                                            }
                                        },
                                        {
                                            variable: {
                                                id: "groundwater__horizontal_anisotropy_factor"
                                            }
                                        },
                                        {
                                            variable: {
                                                id: "groundwater__vertical_hydraulic_conductivity"
                                            }
                                        },
                                        {
                                            variable: {
                                                id: "groundwater__secondary_storage_coefficient"
                                            }
                                        },
                                        {
                                            variable: {
                                                id: "groundwater__horizontal_hydraulic_conductivity"
                                            }
                                        }
                                    ],
                                    fixed_bindings: [
                                        {
                                            resource: {
                                                id: "2460cc306c2a2626c1351bfa7b8841e2",
                                                name: "BARTON_SPRINGS_2001_2010AVERAGE.bc6",
                                                url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.bc6"
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                position: 4,
                                model_io: {
                                    id: "https://w3id.org/okn/i/mint/0df236f7-39de-434b-b38b-1a6e36b4144e",
                                    name: "oc",
                                    type: "https://w3id.org/wings/export/MINT#MODFLOWoc",
                                    format: "dat",
                                    variables: [],
                                    fixed_bindings: [
                                        {
                                            resource: {
                                                id: "267050c6917de1a03ad613f25a740b07",
                                                name: "BARTON_SPRINGS_2001_2010AVERAGE.oc",
                                                url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.oc"
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                position: 5,
                                model_io: {
                                    id: "https://w3id.org/okn/i/mint/d2fe235a-a758-4b5d-9768-1ad8e8f0d1a9",
                                    name: "wel",
                                    type: "",
                                    format: "dat",
                                    variables: [
                                        {
                                            variable: {
                                                id: "groundwater_well__recharge_volume_flux"
                                            }
                                        }
                                    ],
                                    fixed_bindings: []
                                }
                            },
                            {
                                position: 6,
                                model_io: {
                                    id: "https://w3id.org/okn/i/mint/97431b1b-fef3-416d-ba8a-447d7a3ed6fb",
                                    name: "drn",
                                    type: "https://w3id.org/wings/export/MINT#MODFLOWdrn",
                                    format: "dat",
                                    variables: [],
                                    fixed_bindings: [
                                        {
                                            resource: {
                                                id: "de654e2ee95d5245d9326b730e46c965",
                                                name: "BARTON_SPRINGS_2001_2010AVERAGE.drn",
                                                url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.drn"
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                position: 7,
                                model_io: {
                                    id: "https://w3id.org/okn/i/mint/73fefad0-54b1-497d-adab-9f9b0f63293b",
                                    name: "rch",
                                    type: "https://w3id.org/wings/export/MINT#MODFLOWrch",
                                    format: "dat",
                                    variables: [
                                        {
                                            variable: {
                                                id: "groundwater__recharge_volume_flux"
                                            }
                                        }
                                    ],
                                    fixed_bindings: [
                                        {
                                            resource: {
                                                id: "04a614e0714c3823940acdd77780fb3a",
                                                name: "BARTON_SPRINGS_2001_2010AVERAGE.rch",
                                                url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.rch"
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                position: 8,
                                model_io: {
                                    id: "https://w3id.org/okn/i/mint/28461c48-0ebf-4b8e-bcb2-aa31406baeab",
                                    name: "hfb6",
                                    type: "https://w3id.org/wings/export/MINT#MODFLOWhfb6",
                                    format: "hf6",
                                    variables: [],
                                    fixed_bindings: [
                                        {
                                            resource: {
                                                id: "88a5e09bd6db2751e86df787acdf4700",
                                                name: "BARTON_SPRINGS_2001_2010AVERAGE.hf6",
                                                url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.hf6"
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                position: 9,
                                model_io: {
                                    id: "https://w3id.org/okn/i/mint/b24c528e-e5ed-4561-a4f4-bd700f253752",
                                    name: "sip",
                                    type: "https://w3id.org/wings/export/MINT#MODFLOWsip",
                                    format: "dat",
                                    variables: [],
                                    fixed_bindings: [
                                        {
                                            resource: {
                                                id: "632093c3356570a96f60aa448f43e2f7",
                                                name: "BARTON_SPRINGS_2001_2010AVERAGE.sip",
                                                url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.sip"
                                            }
                                        }
                                    ]
                                }
                            }
                        ],
                        outputs: [
                            {
                                position: 1,
                                model_io: {
                                    id: "https://w3id.org/okn/i/mint/f9d3e8f7-3aef-48ff-9f9b-f8430a36a26c",
                                    name: "lst",
                                    type: "https://w3id.org/wings/export/MINT#MODFLOWlst",
                                    format: "lst",
                                    variables: []
                                }
                            },
                            {
                                position: 2,
                                model_io: {
                                    id: "https://w3id.org/okn/i/mint/e4b4c822-12af-47e0-b440-fc4d0d3ae81e",
                                    name: "cbb",
                                    type: "https://w3id.org/wings/export/MINT#MODFLOWcbb",
                                    format: "cbb",
                                    variables: []
                                }
                            },
                            {
                                position: 3,
                                model_io: {
                                    id: "https://w3id.org/okn/i/mint/ab88d8d0-2b35-467f-828c-b6c60669cec1",
                                    name: "hds",
                                    type: "https://w3id.org/wings/export/MINT#MODFLOWhds",
                                    format: "hds",
                                    variables: [
                                        {
                                            variable: {
                                                id: "ground_interbed~delay__compaction_length"
                                            }
                                        },
                                        {
                                            variable: {
                                                id: "ground_interbed~no-delay__compaction_length"
                                            }
                                        },
                                        {
                                            variable: {
                                                id: "model_grid_layer_groundwater__vertical_displacement"
                                            }
                                        },
                                        {
                                            variable: {
                                                id: "model_layer_ground__compaction_length"
                                            }
                                        },
                                        {
                                            variable: {
                                                id: "ground__subsidence_length"
                                            }
                                        },
                                        {
                                            variable: {
                                                id: "ground_interbed~no-delay_water__critical_head"
                                            }
                                        },
                                        {
                                            variable: {
                                                id: "ground_interbed~delay_water__critical_head"
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                position: 4,
                                model_io: {
                                    id: "https://w3id.org/okn/i/mint/3d19e5e1-35e7-4059-9b8c-b32a73e1e653",
                                    name: "ddn",
                                    type: "",
                                    format: "ddn",
                                    variables: [
                                        {
                                            variable: {
                                                id: "total_water_storage"
                                            }
                                        },
                                        {
                                            variable: {
                                                id: "groundwater_surface__reduction_of_elevation"
                                            }
                                        }
                                    ]
                                }
                            }
                        ],
                        parameters: []
                    },
                    data_bindings: [
                        {
                            model_io: {
                                id: "https://w3id.org/okn/i/mint/d2fe235a-a758-4b5d-9768-1ad8e8f0d1a9",
                                name: "wel",
                                format: "dat"
                            },
                            dataslice_id: "9bab5605-d590-437d-9302-a8c688800a26"
                        }
                    ],
                    parameter_bindings: []
                }
            ]
        }
    }
};
