import { Jobs } from "@tapis/tapis-typescript";
import { getMd5Hash } from "@/classes/graphql/graphql_adapter";
import { Execution_Result, ModelOutput } from "@/classes/mint/mint-types";
import Fuse from "fuse.js";

const fuseOptions = {
    isCaseSensitive: false,
    useExtendedSearch: true,
    includeScore: true,
    threshold: 0.5,
    ignoreLocation: true,
    keys: [
        {
            name: "name",
            weight: 0.8
        },
        {
            name: "extension",
            weight: 0.2
        }
    ]
};

interface TapisFileForMatch {
    name: string;
    extension: string;
    url: string;
}

const matchTapisOutputsToMintOutputs = (
    files: Jobs.FileInfo[],
    mintOutputs: ModelOutput[]
): Execution_Result[] => {
    console.log(files);
    console.log(mintOutputs);
    const executionResults: Execution_Result[] = [];
    const filesForMatch: TapisFileForMatch[] = files.map((file) => ({
        name: file.name,
        extension: file.name.split(".").pop() || "",
        url: file.url
    }));

    const fuse = new Fuse(filesForMatch, fuseOptions);
    for (const mintOutput of mintOutputs) {
        const results = fuse.search(mintOutput.model_io.name);
        if (results.length > 0) {
            const tapisUrl = results[0].item.url;
            const executionResult: Execution_Result = {
                resource: {
                    name: results[0].item.name,
                    url: tapisUrl,
                    id: getMd5Hash(tapisUrl)
                },
                model_io: mintOutput.model_io
            };
            executionResults.push(executionResult);
        }
    }
    // const filesNotMatched = filesForMatch.filter((file) => !filesMatched.includes(file.name));
    // for (const file of filesNotMatched) {
    //     const executionResult: Execution_Result = {
    //         resource: {
    //             name: file.name,
    //             url: file.url,
    //             id: getMd5Hash(file.url)
    //         },
    //         model_io: null
    //     };
    //     executionResults.push(executionResult);
    // }
    console.log(executionResults);
    return executionResults;
};

// const matchTapisOutputsToMintOutputs = (
//     files: Jobs.FileInfo[],
//     mintOutputs: ModelOutput[]
// ): Execution_Result[] => {
//     const PORTAL_URL = "https://ptdatax.tacc.utexas.edu/workbench/data/tapis/private/cloud.data";
//     const executionResults: Execution_Result[] = [];

//     const mintOutputsForMatch: MintOutputsForMatch[] = mintOutputs.map((output) => ({
//         name: output.model_io.name,
//         id: output.model_io.id,
//         extension: output.model_io.format,
//         model_io: output.model_io
//     }));
//     const fuse = new Fuse(mintOutputsForMatch, fuseOptions);
//     console.log(files);
//     console.log(mintOutputsForMatch);
//     for (const file of files) {
//         const results = fuse.search(file.name);
//         const publicUrl = file.url.replace("tapis://ls6", PORTAL_URL);
//         const executionResult: Execution_Result = {
//             resource: {
//                 name: file.name,
//                 url: publicUrl,
//                 id: getMd5Hash(publicUrl)
//             },
//             model_io: results.length > 0 ? results[0].item.model_io : null
//         };
//         executionResults.push(executionResult);
//     }
//     return executionResults;
// };

export { matchTapisOutputsToMintOutputs };
