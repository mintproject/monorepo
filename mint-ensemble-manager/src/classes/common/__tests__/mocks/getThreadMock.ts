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
                    modelcatalog_configuration: {
                        id: "https://w3id.org/okn/i/mint/d2792424-fb9d-461c-9470-4bc87ca2f05f",
                        label: "MODFLOW 2005 model setup calibrated for the Barton Springs region. Well can be customized (the rest of inputs are average conditions, pre-selected)",
                        description:
                            "The Barton Springs groundwater model completed in 2001 by Scanlon with others was constructed to match water levels and spring flow from a period of wetter than normal rainfall conditions. An assessment of the model post completion revealed that it overestimates spring flow and underpredicts water-level elevations generally, but it does capture general aquifer behaviors and response.",
                        model_configuration_id: "https://w3id.org/okn/i/mint/modflow_2005_cfg",
                        has_software_image: "mintproject/modflow-2005:latest",
                        has_component_location:
                            "https://raw.githubusercontent.com/mosoriob/cookbook-modflow/refs/heads/main/app.json",
                        inputs: [
                            {
                                input: {
                                    id: "https://w3id.org/okn/i/mint/7157b310-3074-4329-be4f-80fb37190833",
                                    label: "bas6",
                                    has_format: "ba6",
                                    position: 1
                                }
                            },
                            {
                                input: {
                                    id: "https://w3id.org/okn/i/mint/59e4d2f2-f3cc-4912-8f6f-5b37fa6dad9e",
                                    label: "dis",
                                    has_format: "dis",
                                    position: 2
                                }
                            },
                            {
                                input: {
                                    id: "https://w3id.org/okn/i/mint/87594b88-1ddd-4c97-a722-3112f8cd0834",
                                    label: "bcf6",
                                    has_format: "bc6",
                                    position: 3
                                }
                            },
                            {
                                input: {
                                    id: "https://w3id.org/okn/i/mint/0df236f7-39de-434b-b38b-1a6e36b4144e",
                                    label: "oc",
                                    has_format: "dat",
                                    position: 4
                                }
                            },
                            {
                                input: {
                                    id: "https://w3id.org/okn/i/mint/d2fe235a-a758-4b5d-9768-1ad8e8f0d1a9",
                                    label: "wel",
                                    has_format: "dat",
                                    position: 5
                                }
                            },
                            {
                                input: {
                                    id: "https://w3id.org/okn/i/mint/97431b1b-fef3-416d-ba8a-447d7a3ed6fb",
                                    label: "drn",
                                    has_format: "dat",
                                    position: 6
                                }
                            },
                            {
                                input: {
                                    id: "https://w3id.org/okn/i/mint/73fefad0-54b1-497d-adab-9f9b0f63293b",
                                    label: "rch",
                                    has_format: "dat",
                                    position: 7
                                }
                            },
                            {
                                input: {
                                    id: "https://w3id.org/okn/i/mint/28461c48-0ebf-4b8e-bcb2-aa31406baeab",
                                    label: "hfb6",
                                    has_format: "hf6",
                                    position: 8
                                }
                            },
                            {
                                input: {
                                    id: "https://w3id.org/okn/i/mint/b24c528e-e5ed-4561-a4f4-bd700f253752",
                                    label: "sip",
                                    has_format: "dat",
                                    position: 9
                                }
                            }
                        ],
                        outputs: [
                            {
                                output: {
                                    id: "https://w3id.org/okn/i/mint/f9d3e8f7-3aef-48ff-9f9b-f8430a36a26c",
                                    label: "lst",
                                    has_format: "lst",
                                    position: 1
                                }
                            },
                            {
                                output: {
                                    id: "https://w3id.org/okn/i/mint/e4b4c822-12af-47e0-b440-fc4d0d3ae81e",
                                    label: "cbb",
                                    has_format: "cbb",
                                    position: 2
                                }
                            },
                            {
                                output: {
                                    id: "https://w3id.org/okn/i/mint/ab88d8d0-2b35-467f-828c-b6c60669cec1",
                                    label: "hds",
                                    has_format: "hds",
                                    position: 3
                                }
                            },
                            {
                                output: {
                                    id: "https://w3id.org/okn/i/mint/3d19e5e1-35e7-4059-9b8c-b32a73e1e653",
                                    label: "ddn",
                                    has_format: "ddn",
                                    position: 4
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
