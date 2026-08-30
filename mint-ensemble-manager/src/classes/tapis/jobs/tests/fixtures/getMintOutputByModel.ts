import { ModelOutput } from "@/classes/mint/mint-types";

export default [
    {
        position: 1,
        model_io: {
            id: "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_list",
            name: "flame_length",
            type: "https://w3id.org/wings/export/MINT#FlameLength",
            format: "tif",
            variables: []
        }
    },
    {
        position: 2,
        model_io: {
            id: "https://w3id.org/okn/i/mint/time_of_arrival_0000001_0048011",
            name: "time_of_arrival",
            type: "https://w3id.org/wings/export/MINT#TimeOfArrival",
            format: "tif",
            variables: []
        }
    },
    {
        position: 3,
        model_io: {
            id: "https://w3id.org/okn/i/mint/flin_0000001_0048011",
            name: "flin",
            type: "https://w3id.org/wings/export/MINT#FlameLength",
            format: "tif",
            variables: []
        }
    }
] as ModelOutput[];
