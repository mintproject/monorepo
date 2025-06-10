import { createJobFileInputsFromSeed } from "@/classes/tapis/adapters/jobs";
import seeds from "./fixtures/seeds";
import app from "./fixtures/app";
import model from "./fixtures/model";
import jobFileInputsExpected from "./expected/jobFileInputs";

test("test create job file inputs from seed", () => {
    const jobInputs = createJobFileInputsFromSeed(seeds[0], app, model);
    expect(jobInputs).toEqual(jobFileInputsExpected);
});
