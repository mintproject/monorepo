import { Model, Pathway, DataEnsembleMap, ExecutableEnsemble, DataResource, Scenario, MintPreferences } from "./mint-types";
import { Md5 } from 'ts-md5/dist/md5'
import { db } from "../../config/firebase";
import { isObject } from "util";
import { WriteResult, QuerySnapshot, DocumentSnapshot } from "@google-cloud/firestore";

export const fetchMintConfig = (): Promise<MintPreferences> => {
    return new Promise<MintPreferences>((resolve, reject) => {
        db.doc("configs/main").get().then((doc) => {
            let prefs = doc.data() as MintPreferences;
            if(prefs.execution_engine == "wings") {
              fetch(prefs.wings.server + "/config").then((res) => {
                res.json().then((wdata) => {
                  prefs.wings.export_url = wdata["internal_server"]
                  prefs.wings.storage = wdata["storage"];
                  prefs.wings.dotpath = wdata["dotpath"];
                  prefs.wings.onturl = wdata["ontology"];
                  resolve(prefs);
                })
              })
            }
            else {
              resolve(prefs);
            }
          })
    })
};

export const getScenario = async(scenarioid: string) : Promise<Scenario> => {
    let doc = await db.doc("scenarios/"+scenarioid).get();
    return doc.data() as Scenario;
}

export const getPathway = async(scenarioid: string, pathwayid: string) : Promise<Pathway> => {
    let doc = await db.doc("scenarios/"+scenarioid+"/pathways/"+pathwayid).get();
    return doc.data() as Pathway;
}

export const getExecutableEnsemble = async(ensembleid: string) : Promise<ExecutableEnsemble> => {
    let doc = await db.doc("ensembles/"+ensembleid).get();
    return doc.data() as ExecutableEnsemble;
}

export const getModelInputEnsembles = (model: Model, pathway: Pathway) => {
    let dataEnsemble = Object.assign({}, pathway.model_ensembles[model.id]);
    let inputIds : any[] = [];

    model.input_files.map((io) => {
        inputIds.push(io.id);
        if(!io.value) {
            // Expand a dataset to it's constituent resources
            // FIXME: Create a collection if the model input has dimensionality of 1
            if(dataEnsemble[io.id]) {
                let nensemble : any[] = [];
                dataEnsemble[io.id].map((dsid) => {
                    let ds = pathway.datasets[dsid];
                    let selected_resources = ds.resources.filter((res) => res.selected);
                    // Fix for older saved resources
                    if(selected_resources.length == 0) 
                        selected_resources = ds.resources;
                    nensemble = nensemble.concat(selected_resources);
                });
                dataEnsemble[io.id] = nensemble;
            }
        }
        else {
            dataEnsemble[io.id] = io.value.resources as any[];
        }
    })
    
    // Add adjustable parameters to the input ids
    model.input_parameters.map((io) => {
        if(!io.value) inputIds.push(io.id);
    })
    // Get cartesian product of inputs to get all model configurations

    return [dataEnsemble, inputIds];
};

const MAX_CONFIGURATIONS = 1000000;
export const getModelInputConfigurations = (
        dataEnsemble: DataEnsembleMap,
        inputIds: string[]) => {
    let inputBindings : any[] = [];
    let totalproducts = 1;
    inputIds.map((inputid) => {
        inputBindings.push(dataEnsemble[inputid]);
        if(dataEnsemble[inputid])
            totalproducts *= dataEnsemble[inputid].length;
    });
    if(totalproducts < MAX_CONFIGURATIONS) {
        return cartProd(inputBindings);
    }
    else {
        return null;
    }
}

const cartProd = (lists : any[]) => {
    let ps : any[] = [],
        acc : any [][] = [
            []
        ],
        i = lists.length;
    while (i--) {
        let subList = lists[i],
            j = subList.length;
        while (j--) {
            let x = subList[j],
                k = acc.length;
            while (k--) ps.push([x].concat(acc[k]))
        };
        acc = ps;
        ps = [];
    };
    return acc.reverse();
};

export const setPathwayEnsembleIds = (scenarioid: string, pathwayid: string, 
    modelid: string, batchid: number, ensembleids: string[]) : Promise<WriteResult> => {
    let pathwayEnsembleIdsRef = db.collection("scenarios").doc(scenarioid).collection("pathways").doc(pathwayid).collection("ensembleids");
    let docid = modelid.replace(/.+\//, '') + "_" + batchid;
    let data = {
        modelid: modelid,
        ensemble_ids: ensembleids
    }
    return pathwayEnsembleIdsRef.doc(docid).set(data);
}

export const deleteAllPathwayEnsembleIds = async (scenarioid: string, pathwayid: string, modelid: string) => {
    let pathwayEnsembleIdsRef = db.collection("scenarios").doc(scenarioid).collection("pathways").doc(pathwayid).collection("ensembleids");
    let queryRef = null;
    if(modelid) {
        queryRef = pathwayEnsembleIdsRef.where("modelid", "==", modelid);
    }
    else {
        queryRef = pathwayEnsembleIdsRef;
    }
    queryRef.get().then((snapshot) => {
        snapshot.forEach((doc) => {
            doc.ref.delete();
        })
    })
}

export const getAllPathwayEnsembleIds = async (scenarioid: string, pathwayid: string,
    modelid: string) : Promise<string[]> => {
    let pathwayEnsembleIdsRef = db.collection("scenarios").doc(scenarioid).collection("pathways").doc(pathwayid).collection("ensembleids")
        .where("modelid", "==", modelid);

    return pathwayEnsembleIdsRef.get().then((snapshot: QuerySnapshot) => {
        let ensembleids : string[] = [];
        snapshot.forEach((doc) => {
            ensembleids = ensembleids.concat(doc.data().ensemble_ids);
        })
        return ensembleids;
    });
}

// List Ensembles
export const listEnsembles = (ensembleids: string[]) : Promise<ExecutableEnsemble[]> => {
    let ensemblesRef = db.collection("ensembles");
    return Promise.all(ensembleids.map((ensembleid) => {
        return ensemblesRef.doc(ensembleid).get().then((sdoc) => {
            let ensemble = sdoc.data() as ExecutableEnsemble;
            ensemble.id = sdoc.id;
            return ensemble;
        })
    }));
};

// List Ensemble Ids (i.e. which ensemble ids exist)
export const listExistingEnsembleIds = (ensembleids: string[]) : Promise<string[]> => {
    let ensemblesRef = db.collection("ensembles");
    return Promise.all(ensembleids.map((ensembleid) => {
        return ensemblesRef.doc(ensembleid).get().then((sdoc) => {
            if(sdoc.exists)
                return ensembleid;
        })
    }));
};

// List Ensemble Ids (i.e. which ensemble ids exist)
export const listAlreadyRunEnsembleIds = (ensembleids: string[]) : Promise<string[]> => {
    let ensemblesRef = db.collection("ensembles");
    return Promise.all(ensembleids.map((ensembleid) => {
        return ensemblesRef.doc(ensembleid).get().then((sdoc) => {
            if(sdoc.exists) {
                let ensemble = sdoc.data() as ExecutableEnsemble;
                if(ensemble.status == "SUCCESS" && ensemble.results) {
                    return ensembleid;
                }
            }
        })
    }));
};

export const getEnsembleHash = (ensemble: ExecutableEnsemble) : string => {
    let str = ensemble.modelid;
    let varids = Object.keys(ensemble.bindings).sort();
    varids.map((varid) => {
        let binding = ensemble.bindings[varid];
        let bindingid = isObject(binding) ? (binding as DataResource).id : binding;
        str += varid + "=" + bindingid + "&";
    })
    return Md5.hashStr(str).toString();
}

// Set Ensembles
export const setPathwayEnsembles = (ensembles: ExecutableEnsemble[]) => {
    let ensemblesRef = db.collection("ensembles");
    let batch = db.batch();
    let i = 0;
    ensembles.map((ensemble) => {
        batch.set(ensemblesRef.doc(ensemble.id), ensemble);
    })
    return batch.commit();
}

export const addPathwayEnsembles = (ensembles: ExecutableEnsemble[]) => {
    let ensemblesRef = db.collection("ensembles");
    // Read all docs (to check if they exist or not)
    let readpromises : any = [];
    ensembles.map((ensemble) => {
        readpromises.push(ensemblesRef.doc(ensemble.id).get());
    });
    let batch = db.batch();
    let i = 0;
    return Promise.all(readpromises).then((docs) => {
        docs.map((curdoc: DocumentSnapshot) => {
            // If doc doesn't exist, write ensemble
            let ensemble = ensembles[i++];
            //if(!curdoc.exists)
            batch.set(curdoc.ref, ensemble);
        })
        return batch.commit();
    })
}

// Update Pathway Ensembles
export const updatePathwayEnsembles = (ensembles: ExecutableEnsemble[]) => {
    let ensemblesRef = db.collection("ensembles");
    let batch = db.batch();
    let i = 0;
    ensembles.map((ensemble) => {
        batch.update(ensemblesRef.doc(ensemble.id), ensemble);
    })
    return batch.commit();
}

// Delete Pathway Ensembles
export const deletePathwayEnsembles = (ensembleids: string[]) => {
    let ensemblesRef = db.collection("ensembles");
    let batch = db.batch();
    let i = 0;
    ensembleids.map((ensembleid) => {
        batch.delete(ensemblesRef.doc(ensembleid));
    })
    return batch.commit();
}

export const updatePathway = (scenario: Scenario, pathway: Pathway) =>  {
    let npathway = Object.assign({}, pathway);
    delete npathway.unsubscribe;
    let pathwayRef = db.collection("scenarios/"+scenario.id+"/pathways").doc(pathway.id);
    console.log(scenario.id + " ---- update pathway: " + pathway.id);
    //console.log(pathway);
    return pathwayRef.set(npathway); //.then(() => updateScenario(scenario));
};