import { Model, MintPreferences, ModelIO, Dataset, ModelParameter, Dataslice } from "./mint-types";
import * as rp from "request-promise-native";

// Query Model Catalog By Variables, 
// - Filter by driving variables and model id/name (match with calibration)
// - Return only 1 model
export const fetchModelFromCatalog = (response_variables: string[], 
        driving_variables: string[], modelid: string,
        prefs: MintPreferences) : Promise<Model> => {

    return new Promise<any>((resolve, reject) => {
        rp.get({
            url: prefs.model_catalog_api + "/getCalibratedModelConfigurationsForVariable",
            qs: { std: response_variables.join(",") },
            json: true
        }).then((obj) => {
            let rows = obj.results.bindings;
            let found = false;
            for(var i=0; i<rows.length; i++) {
                let row = rows[i];
                let calibid : string = row.calibration.value;
                let calibname = calibid.replace(/.*\//, '');
                if (calibname == modelid) {
                    // Match !
                    found = true;
                    console.log("We found a matching model: " + calibid + ". Get details");

                    Promise.all([
                        rp.get({
                            url: prefs.model_catalog_api + "/getModelConfigurationMetadata_NoIO",
                            qs: { modelConfig: calibid },
                            json: true
                        }),
                        rp.get({
                            url: prefs.model_catalog_api + "/getConfigI_OVariablesAndStandardNames",
                            qs: { config: calibid },
                            json: true
                        }),
                        rp.get({
                            url: prefs.model_catalog_api + "/getConfigIParameters",
                            qs: { config: calibid },
                            json: true
                        }),
                    ]).then((values: any) => {
                        let meta:any = values[0].results.bindings[0];
                        let iovalues = values[1].results.bindings;
                        let paramvalues = values[2].results.bindings;

                        // Get model config input and output files
                        let fileio: any = {};
                        let inputs:ModelIO[] = [];
                        let outputs:ModelIO[] = [];
                        iovalues.map((value: any) => {
                            let io: ModelIO = fileio[value.io.value];
                            if(!io) {
                                io = {
                                    id: value.io.value,
                                    name: value.iolabel.value,
                                    type: value.type.value,
                                    variables: []
                                };
                                if(value.fixedValueURL) {
                                    let dcids = value.fixedValueDCId.value.split(/\s*,\s*/);
                                    let urls = value.fixedValueURL.value.split(/\s*,\s*/);
                                    let resources = urls.map((url: any) => {
                                        let fname = url.replace(/.*[#\/]/, '');
                                        return { 
                                            url: url,
                                            id: fname,
                                            name: fname,
                                            selected: true
                                        };
                                    });
                                    io.value = {
                                        dataset: {
                                            id: dcids[0],
                                        },
                                        resources: resources
                                    } as Dataslice;
                                }
                                fileio[value.io.value] = io;
                                if(value.prop) {
                                    if(value.prop.value.match(/#hasInput$/)) {
                                        inputs.push(io);
                                    } else {
                                        outputs.push(io);
                                    }
                                }
                            }
                            if(value.st) {
                                io.variables.push(value.st.value);
                            }
                        });
                        
                        // Get model config input/output parameters
                        let params: any = {};
                        let parameters:ModelParameter[] = [];
                        let matched_driving_variable = false;
                        paramvalues.map((value: any) => {
                            if(params[value.p.value]) {
                                // Do not add duplicate parameters
                                return;
                            }
                            let adjustment_variable = value.standardV ? value.standardV.value : null;
                            let accepted_values = value.acceptedValues ? value.acceptedValues.value.split(/\s*;\s*/) : null;
                            let param: ModelParameter =  {
                                id: value.p.value,
                                name: value.paramlabel.value,
                                type: value.pdatatype.value,
                                min: value.minVal ? value.minVal.value : "",
                                max: value.maxVal ? value.maxVal.value : "",
                                unit: value.unit ? value.unit.value : "",
                                default: value.defaultvalue ? value.defaultvalue.value : "",
                                description: value.description ? value.description.value : "",
                                adjustment_variable: adjustment_variable,
                                position: value.position ? parseInt(value.position.value) : 0,
                                accepted_values: accepted_values
                            };
                            if(value.fixedValue)
                                param.value = value.fixedValue.value;
                            // Hack to fix FALSE to false
                            if(param.value == "FALSE")
                                param.value = "false";
                            params[value.p.value] = param;
                            parameters.push(param);
    
                            // If some driving/adjustment variables are passed, make sure they are matched
                            if (!param.value && driving_variables && driving_variables.indexOf(adjustment_variable) >= 0) {
                                matched_driving_variable = true;
                            }
                        });
    
                        if(!driving_variables || !driving_variables.length || matched_driving_variable) {
                            // If this model matches the adjustment/driving variable
    
                            let input_parameters = parameters
                                .sort((a, b) => a.name.localeCompare(b.name));
                            let input_files = inputs
                                .sort((a, b) => a.name.localeCompare(b.name));
                            let output_files = outputs
                                .sort((a, b) => a.name.localeCompare(b.name));

                            let model: Model = {
                                id: calibid,
                                localname: calibid.substr(modelid.lastIndexOf("/") + 1),
                                name: meta['label'] ? meta['label']['value'] : "",
                                region_name: meta['regionName'] ? meta['regionName']['value'] : "",
                                description: row['desc'] ? row['desc']['value'] : "",
                                category: row['category'] ? row['category']['value'] : "",
                                code_url: row['compLoc'] ? row['compLoc']['value'] : "",
                                input_files: input_files,
                                input_parameters: input_parameters,
                                output_files: output_files,
                                model_name: row["model"]["value"].replace(/.*\//, ""),
                                model_version: row["version"]["value"].replace(/.*\//, ""),
                                model_configuration: row["configuration"]["value"].replace(/.*\//, ""),
                                model_type: "",
                                parameter_assignment: meta["paramAssignMethod"] ? meta['paramAssignMethod']['value'] : "",
                                parameter_assignment_details: "",
                                calibration_target_variable: (meta["targetVariables"] || []).join(", "),
                                modeled_processes: meta['processes'] ? meta['processes']['value'] : "",
                                dimensionality: meta['gridDim'] ? meta['gridDim']['value'] : "",
                                spatial_grid_type: (meta['gridType'] ? meta['gridType']['value'] : "").replace(/.*#/, ''),
                                spatial_grid_resolution: meta['gridSpatial'] ? meta['gridSpatial']['value'] : "",
                                output_time_interval: "",
                                usage_notes: meta['usageNotes'] ? meta['usageNotes']['value'] : "",
                            };
                            resolve(model);
                        }
                    });
                    break; // Return only 1 match
                }
            }
            if(!found) {
                reject();
            }
        })
    });
};