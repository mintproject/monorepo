import MintOutputs from "@/classes/tapis/jobs/tests/fixtures/getMintOutputByModel";
import TapisOutputs from "@/classes/tapis/jobs/tests/fixtures/getJobOutputsResult";
import { matchTapisOutputsToMintOutputs } from "@/classes/tapis/jobs";
import { Jobs } from "@mfosorio/tapis-typescript";

it("Test matchTapisOutputsToMintOutputs", async () => {
    const files = TapisOutputs.result as Jobs.FileInfo[];
    const executionResults = matchTapisOutputsToMintOutputs(files, MintOutputs);
    //length of executionResults should be the same as the length of MintOutputs
    expect(executionResults.length).toBe(MintOutputs.length);
    const mintOutputsName: string[] = MintOutputs.map((output) =>
        output.model_io.name.toLowerCase()
    );
    const fileNames: string[] = files.map((file) => file.name.toLowerCase());
    //all the names of the mintOutputs should be in the fileNames
    mintOutputsName.forEach((name) => {
        expect(fileNames).toContain(name);
    });
});
