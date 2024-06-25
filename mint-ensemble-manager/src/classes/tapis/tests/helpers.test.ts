import model from "../fixtures/model";
import bindings from "../fixtures/input-bindings";
import { getInputDatasets } from "../helpers";
test("get inputs datasets", () => {
    const key = "https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_Bas";
    const datasets = getInputDatasets(model, bindings);
    const datasets_keys = Object.keys(datasets);
    expect(datasets_keys).toHaveLength(9);
    expect(datasets_keys).toContain(key);
    expect(datasets[key]).toHaveLength(1);
    expect(datasets[key][0].id).toBe("6a40bdbdbb72888c539fdd4b39d50bba");
    expect(datasets[key][0].name).toBe("BARTON_SPRINGS_2001_2010AVERAGE.ba6");
    expect(datasets[key][0].url).toBe(
        "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.ba6"
    );
});
