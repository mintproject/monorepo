import MintOutputs from "@/classes/tapis/jobs/tests/fixtures/getMintOutputByModel";
import TapisOutputs from "@/classes/tapis/jobs/tests/fixtures/getJobOutputsResult";
import { matchTapisOutputsToMintOutputs } from "@/classes/tapis/jobs";
import { ModelOutput } from "@/classes/mint/mint-types";
import { Jobs } from "@tapis/tapis-typescript";

const fileInfo = (name: string): Jobs.FileInfo =>
    ({
        name,
        path: `job/${name}`,
        url: `tapis://cloud.data/job/${name}`,
        type: "file",
        size: 1
    }) as Jobs.FileInfo;

const modelOutput = (position: number, name: string, format: string): ModelOutput => ({
    position,
    model_io: {
        id: `https://w3id.org/okn/i/mint/${name}`,
        name,
        type: "https://w3id.org/wings/export/MINT#Output",
        format,
        variables: []
    }
});

it("Test matchTapisOutputsToMintOutputs", async () => {
    const files = TapisOutputs.result as Jobs.FileInfo[];
    const executionResults = matchTapisOutputsToMintOutputs(files, MintOutputs);
    const executionResultsMatched = executionResults.filter((result) => result.model_io !== null);

    expect(executionResultsMatched.length).toBe(3);
});

it("gives one file to at most one declared output", () => {
    // Both declared outputs are close to the single file. Only one may take it.
    const files = [fileInfo("flame_length_00000051.tif")];
    const mintOutputs = [
        modelOutput(1, "flame_length", "tif"),
        modelOutput(2, "flame_lengths", "tif")
    ];

    const executionResults = matchTapisOutputsToMintOutputs(files, mintOutputs);

    expect(executionResults.length).toBe(1);
    expect(executionResults[0].resource.url).toBe(files[0].url);
});

it("does not publish the same file twice when every output matches it", () => {
    const files = TapisOutputs.result as Jobs.FileInfo[];
    const mintOutputs = [
        modelOutput(1, "time_of_arrival", "tif"),
        modelOutput(2, "time_of_arrival", "tif"),
        modelOutput(3, "time_of_arrival", "tif")
    ];

    const executionResults = matchTapisOutputsToMintOutputs(files, mintOutputs);

    const urls = executionResults.map((result) => result.resource.url);
    expect(new Set(urls).size).toBe(urls.length);
});

it("puts the format of the declared output in resource.type", () => {
    // TACC_CKAN_Datacatalog.registerResource sends resource.type to CKAN as format.
    const files = [fileInfo("time_of_arrival_0000001.tif")];
    const mintOutputs = [modelOutput(1, "time_of_arrival", "tif")];

    const executionResults = matchTapisOutputsToMintOutputs(files, mintOutputs);

    expect(executionResults.length).toBe(1);
    expect(executionResults[0].resource.type).toBe("tif");
});

it("keeps the format of each declared output when the formats differ", () => {
    const files = [fileInfo("flame_length.tif"), fileInfo("summary.csv")];
    const mintOutputs = [modelOutput(1, "flame_length", "tif"), modelOutput(2, "summary", "csv")];

    const executionResults = matchTapisOutputsToMintOutputs(files, mintOutputs);

    const formatByName = new Map(
        executionResults.map((result) => [result.model_io.name, result.resource.type])
    );
    expect(formatByName.get("flame_length")).toBe("tif");
    expect(formatByName.get("summary")).toBe("csv");
});

it("reports a declared output that matches no file", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const files = [fileInfo("time_of_arrival_0000001.tif")];
    const mintOutputs = [
        modelOutput(1, "time_of_arrival", "tif"),
        modelOutput(2, "soil_moisture", "tif")
    ];

    const executionResults = matchTapisOutputsToMintOutputs(files, mintOutputs);

    expect(executionResults.length).toBe(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("soil_moisture"));
    warn.mockRestore();
});
