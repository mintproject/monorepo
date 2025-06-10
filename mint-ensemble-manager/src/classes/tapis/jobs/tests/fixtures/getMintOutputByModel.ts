import { ModelOutput } from "../../../../../classes/mint/mint-types";

export default [
    {
        position: 1,
        model_io: {
            __typename: "model_io",
            id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_list",
            name: "lst",
            type: "https://w3id.org/wings/export/MINT#MODFLOWlst",
            format: "lst",
            variables: []
        }
    },
    {
        __typename: "model_output",
        position: 2,
        model_io: {
            __typename: "model_io",
            id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_cbb",
            name: "cbb",
            type: "https://w3id.org/wings/export/MINT#MODFLOWcbb",
            format: "cbb",
            variables: []
        }
    },
    {
        position: 3,
        model_io: {
            id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_heads",
            name: "hds",
            type: "https://w3id.org/wings/export/MINT#MODFLOWhds",
            format: "hds",
            variables: []
        }
    },
    {
        position: 4,
        model_io: {
            id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_ddown",
            name: "ddn",
            type: "https://w3id.org/wings/export/MINT#MODFLOWddn",
            format: "ddn",
            variables: []
        }
    }
] as ModelOutput[];
