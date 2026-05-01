import seeds from "./fixtures/seeds";
import app, { appWithOptionalInput, appWithUnknownRequiredInput } from "./fixtures/app";
import model, { modelWithOptionalInput } from "./fixtures/model";
import jobFileInputsExpected from "./expected/jobFileInputs";
import { expectedJobParameterSetNonDefault } from "./expected/jobParameterSet";
import { TapisJobService } from "@/classes/tapis/adapters/TapisJobService";
import { Jobs } from "@tapis/tapis-typescript";

test("test create job file inputs from seed", () => {
    const jobService = new TapisJobService(
        new Jobs.JobsApi(),
        new Jobs.SubscriptionsApi(),
        new Jobs.ShareApi()
    );
    const jobInputs = jobService.createJobFileInputsFromSeed(seeds[0], app, model);
    const jobParameterSet = jobService.createJobParameterSetFromSeed(seeds[0], app, model);
    expect(jobInputs).toEqual(jobFileInputsExpected);
    expect(jobParameterSet).toEqual(expectedJobParameterSetNonDefault);
});

const seedWithMissingOptionalInput = {
    ...seeds[0],
    datasets: {}
};

const seedWithOptionalInputBound = {
    ...seeds[0],
    datasets: {
        "https://w3id.org/okn/i/mint/optional-ds": [
            { id: "ds1", url: "https://example.com/optional.dat", name: "optional.dat", type: "" }
        ]
    }
};

test("optional input with no datasets is skipped", () => {
    const jobService = new TapisJobService(
        new Jobs.JobsApi(),
        new Jobs.SubscriptionsApi(),
        new Jobs.ShareApi()
    );
    const jobInputs = jobService.createJobFileInputsFromSeed(
        seedWithMissingOptionalInput,
        appWithOptionalInput,
        modelWithOptionalInput
    );
    expect(jobInputs.find((i) => i.name === "optional_file")).toBeUndefined();
    expect(jobInputs).toHaveLength(0);
});

test("throws when app fileInput name is not found in model.input_files", () => {
    const jobService = new TapisJobService(
        new Jobs.JobsApi(),
        new Jobs.SubscriptionsApi(),
        new Jobs.ShareApi()
    );
    expect(() =>
        jobService.createJobFileInputsFromSeed(
            { ...seeds[0], datasets: {} },
            appWithUnknownRequiredInput,
            model
        )
    ).toThrow("Component input not found");
});

test("optional input with datasets present is included", () => {
    const jobService = new TapisJobService(
        new Jobs.JobsApi(),
        new Jobs.SubscriptionsApi(),
        new Jobs.ShareApi()
    );
    const jobInputs = jobService.createJobFileInputsFromSeed(
        seedWithOptionalInputBound,
        appWithOptionalInput,
        modelWithOptionalInput
    );
    expect(jobInputs.find((i) => i.name === "optional_file")).toBeDefined();
});
