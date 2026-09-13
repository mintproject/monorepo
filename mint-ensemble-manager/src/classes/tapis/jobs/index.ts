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

// One candidate pair of a declared output and an archived file.
// `score` comes from Fuse. A lower score is a better match.
interface MatchCandidate {
    outputIndex: number;
    fileIndex: number;
    score: number;
}

// Sort the candidates so that the best match comes first.
// Fuse gives a lower score to a better match. The two index
// comparisons keep the order stable when the scores are equal.
const byBestScore = (a: MatchCandidate, b: MatchCandidate): number =>
    a.score - b.score || a.outputIndex - b.outputIndex || a.fileIndex - b.fileIndex;

/**
 * Match the files of a finished Tapis job to the declared outputs of a model
 * configuration.
 *
 * One file belongs to at most one declared output, and one declared output
 * takes at most one file. The pair with the best score wins, so two declared
 * outputs with similar labels cannot publish the same file twice.
 *
 * The result carries the format of the declared output in `resource.type`.
 * `TACC_CKAN_Datacatalog.registerResource` sends that field to CKAN as
 * `format`.
 *
 * A declared output that matches no file is written to the log. It produces no
 * execution result.
 */
const matchTapisOutputsToMintOutputs = (
    files: Jobs.FileInfo[],
    mintOutputs: ModelOutput[]
): Execution_Result[] => {
    const filesForMatch: TapisFileForMatch[] = files.map((file) => ({
        name: file.name,
        extension: file.name.split(".").pop() || "",
        url: file.url
    }));

    const fuse = new Fuse(filesForMatch, fuseOptions);

    // Collect every possible pair first. A greedy loop over the outputs alone
    // lets an early output take a file that a later output matches better.
    const candidates: MatchCandidate[] = [];
    mintOutputs.forEach((mintOutput, outputIndex) => {
        for (const result of fuse.search(mintOutput.model_io.name)) {
            candidates.push({
                outputIndex,
                fileIndex: result.refIndex,
                score: result.score ?? 1
            });
        }
    });
    candidates.sort(byBestScore);

    const usedOutputs = new Set<number>();
    const usedFiles = new Set<number>();
    const resultByOutputIndex = new Map<number, Execution_Result>();

    for (const candidate of candidates) {
        if (usedOutputs.has(candidate.outputIndex) || usedFiles.has(candidate.fileIndex)) {
            continue;
        }
        usedOutputs.add(candidate.outputIndex);
        usedFiles.add(candidate.fileIndex);

        const mintOutput = mintOutputs[candidate.outputIndex];
        const file = filesForMatch[candidate.fileIndex];
        resultByOutputIndex.set(candidate.outputIndex, {
            resource: {
                name: file.name,
                url: file.url,
                id: getMd5Hash(file.url),
                type: mintOutput.model_io.format
            },
            model_io: mintOutput.model_io
        });
    }

    const unmatchedOutputs = mintOutputs
        .filter((_mintOutput, outputIndex) => !usedOutputs.has(outputIndex))
        .map((mintOutput) => mintOutput.model_io.name);
    if (unmatchedOutputs.length > 0) {
        console.warn(
            `No archived file matches these declared outputs: ${unmatchedOutputs.join(", ")}`
        );
    }

    // Return the results in the order of the declared outputs, not in the
    // order in which the matcher found them.
    return mintOutputs
        .map((_mintOutput, outputIndex) => resultByOutputIndex.get(outputIndex))
        .filter((executionResult): executionResult is Execution_Result => Boolean(executionResult));
};

export { matchTapisOutputsToMintOutputs };
