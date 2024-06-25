export default [
    {
        component: {
            id: "modflow-2005",
            version: "0.0.4",
            rundir: "/tmp/mintproject/data/code/ad311d1e248d7802d1adbb6618c19e7a/MODFLOW2005/src",
            softwareImage: "mintproject/modflow-2005:latest",
            inputs: [
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Bas",
                    role: "bas6",
                    prefix: "-i1",
                    isParam: false,
                    type: "https://w3id.org/wings/export/MINT#MODFLOWBas6"
                },
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Dis",
                    role: "dis",
                    prefix: "-i2",
                    isParam: false,
                    type: "https://w3id.org/wings/export/MINT#MODFLOWdis"
                },
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Bcf",
                    role: "bcf6",
                    prefix: "-i3",
                    isParam: false,
                    type: "https://w3id.org/wings/export/MINT#MODFLOWbcf6"
                },
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Oc",
                    role: "oc",
                    prefix: "-i4",
                    isParam: false,
                    type: "https://w3id.org/wings/export/MINT#MODFLOWoc"
                },
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Well",
                    role: "wel",
                    prefix: "-i5",
                    isParam: false,
                    type: ""
                },
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Drn",
                    role: "drn",
                    prefix: "-i6",
                    isParam: false,
                    type: "https://w3id.org/wings/export/MINT#MODFLOWdrn"
                },
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Rech",
                    role: "rch",
                    prefix: "-i7",
                    isParam: false,
                    type: "https://w3id.org/wings/export/MINT#MODFLOWrch"
                },
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Hfb",
                    role: "hfb6",
                    prefix: "-i8",
                    isParam: false,
                    type: "https://w3id.org/wings/export/MINT#MODFLOWhfb6"
                },
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Sip",
                    role: "sip",
                    prefix: "-i9",
                    isParam: false,
                    type: "https://w3id.org/wings/export/MINT#MODFLOWsip"
                }
            ],
            outputs: [
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_list",
                    role: "lst",
                    prefix: "-o1",
                    isParam: false,
                    type: "https://w3id.org/wings/export/MINT#MODFLOWlst"
                },
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_cbb",
                    role: "cbb",
                    prefix: "-o2",
                    isParam: false,
                    type: "https://w3id.org/wings/export/MINT#MODFLOWcbb"
                },
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_heads",
                    role: "hds",
                    prefix: "-o3",
                    isParam: false,
                    type: "https://w3id.org/wings/export/MINT#MODFLOWhds"
                },
                {
                    id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_ddown",
                    role: "ddn",
                    prefix: "-o4",
                    isParam: false,
                    type: "https://w3id.org/wings/export/MINT#MODFLOWddn"
                }
            ]
        },
        execution: {
            modelid: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg",
            bindings: {
                "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Bas": {
                    id: "6a40bdbdbb72888c539fdd4b39d50bba",
                    name: "BARTON_SPRINGS_2001_2010AVERAGE.ba6",
                    url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.ba6",
                    __typename: "resource"
                },
                "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Dis": {
                    id: "1a877fc86732dd3417c3860fabec2293",
                    name: "BARTON_SPRINGS_2001_2010AVERAGE.dis",
                    url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.dis",
                    __typename: "resource"
                },
                "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Bcf": {
                    id: "2460cc306c2a2626c1351bfa7b8841e2",
                    name: "BARTON_SPRINGS_2001_2010AVERAGE.bc6",
                    url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.bc6",
                    __typename: "resource"
                },
                "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Oc": {
                    id: "267050c6917de1a03ad613f25a740b07",
                    name: "BARTON_SPRINGS_2001_2010AVERAGE.oc",
                    url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.oc",
                    __typename: "resource"
                },
                "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Well": {
                    id: "d6adc55ebd982fd8f578ce08dd8ca530",
                    name: "BARTON_SPRINGS_2001_2010AVERAGE.wel",
                    url: "'ttps://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.wel",
                    __typename: "resource"
                },
                "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Drn": {
                    id: "de654e2ee95d5245d9326b730e46c965",
                    name: "BARTON_SPRINGS_2001_2010AVERAGE.drn",
                    url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.drn",
                    __typename: "resource"
                },
                "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Rech": {
                    id: "04a614e0714c3823940acdd77780fb3a",
                    name: "BARTON_SPRINGS_2001_2010AVERAGE.rch",
                    url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.rch",
                    __typename: "resource"
                },
                "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Hfb": {
                    id: "88a5e09bd6db2751e86df787acdf4700",
                    name: "BARTON_SPRINGS_2001_2010AVERAGE.hf6",
                    url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.hf6",
                    __typename: "resource"
                },
                "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Sip": {
                    id: "632093c3356570a96f60aa448f43e2f7",
                    name: "BARTON_SPRINGS_2001_2010AVERAGE.sip",
                    url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.sip",
                    __typename: "resource"
                }
            },
            // execution_engine: "localex",
            runid: null,
            status: null,
            results: [],
            start_time: new Date("2024-06-07T21:30:30.510Z"),
            selected: true,
            id: "bae0f0be6dbee791f1841c20f9903afc"
        },
        datasets: {
            "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Bas": [
                {
                    id: "6a40bdbdbb72888c539fdd4b39d50bba",
                    url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.ba6",
                    name: "BARTON_SPRINGS_2001_2010AVERAGE.ba6",
                    type: "MODFLOWBas6"
                }
            ],
            "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Dis": [
                {
                    id: "1a877fc86732dd3417c3860fabec2293",
                    url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.dis",
                    name: "BARTON_SPRINGS_2001_2010AVERAGE.dis",
                    type: "MODFLOWdis"
                }
            ],
            "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Bcf": [
                {
                    id: "2460cc306c2a2626c1351bfa7b8841e2",
                    url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.bc6",
                    name: "BARTON_SPRINGS_2001_2010AVERAGE.bc6",
                    type: "MODFLOWbcf6"
                }
            ],
            "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Oc": [
                {
                    id: "267050c6917de1a03ad613f25a740b07",
                    url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.oc",
                    name: "BARTON_SPRINGS_2001_2010AVERAGE.oc",
                    type: "MODFLOWoc"
                }
            ],
            "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Well": [
                {
                    id: "d6adc55ebd982fd8f578ce08dd8ca530",
                    url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.wel",
                    name: "BARTON_SPRINGS_2001_2010AVERAGE.wel",
                    type: ""
                }
            ],
            "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Drn": [
                {
                    id: "de654e2ee95d5245d9326b730e46c965",
                    url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.drn",
                    name: "BARTON_SPRINGS_2001_2010AVERAGE.drn",
                    type: "MODFLOWdrn"
                }
            ],
            "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Rech": [
                {
                    id: "04a614e0714c3823940acdd77780fb3a",
                    url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.rch",
                    name: "BARTON_SPRINGS_2001_2010AVERAGE.rch",
                    type: "MODFLOWrch"
                }
            ],
            "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Hfb": [
                {
                    id: "88a5e09bd6db2751e86df787acdf4700",
                    url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.hf6",
                    name: "BARTON_SPRINGS_2001_2010AVERAGE.hf6",
                    type: "MODFLOWhfb6"
                }
            ],
            "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Sip": [
                {
                    id: "632093c3356570a96f60aa448f43e2f7",
                    url: "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.sip",
                    name: "BARTON_SPRINGS_2001_2010AVERAGE.sip",
                    type: "MODFLOWsip"
                }
            ]
        },
        parameters: {},
        paramtypes: {}
    }
];
