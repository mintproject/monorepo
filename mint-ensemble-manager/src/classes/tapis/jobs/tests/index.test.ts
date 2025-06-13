import MintOutputs from "@/classes/tapis/jobs/tests/fixtures/getMintOutputByModel";
import TapisOutputs from "@/classes/tapis/jobs/tests/fixtures/getJobOutputsResult";
import { matchTapisOutputsToMintOutputs } from "@/classes/tapis/jobs";
import { Jobs } from "@tapis/tapis-typescript";

it("Test matchTapisOutputsToMintOutputs", async () => {
    const files = TapisOutputs.result as Jobs.FileInfo[];
    const executionResults = matchTapisOutputsToMintOutputs(files, MintOutputs);
    //length of executionResults should be the same as the length of MintOutputs
    const executionResultsMatched = executionResults.filter((result) => result.model_io !== null);

    // const filesNoMatchWithIO = executionResults
    //     .map((result) => result.model_io)
    //     .filter((model_io) => model_io === null);
    expect(executionResultsMatched.length).toBe(3);
    // expect(filesNoMatchWithIO.length).toBe(3);
});
