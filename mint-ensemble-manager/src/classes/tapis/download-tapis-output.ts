import { Job } from "bull";
import { Execution, Execution_Result } from "../mint/mint-types";
import { getJobOutputDownloadFile } from "./jobs";
import { writeFile, existsSync, mkdirSync } from "fs";
import { getConfiguration } from "../mint/mint-functions";
import {
    incrementThreadModelRegisteredRunsByExecutionId,
    updateExecutionStatusAndResultsv2
} from "../graphql/graphql_functions";
const prefs = getConfiguration();

interface JobDataProps {
    execution: Execution;
    jobUuid: string;
}

module.exports = async (job: Job<JobDataProps>) => {
    const execution = job.data.execution;
    const tapisJobUuid = job.data.jobUuid;
    const results = execution.results as Execution_Result[];
    const dataUrl = prefs.tapis.dataurl;
    const executionDirectoryName = job.data.execution.id;
    const executionDirectoryPath = prefs.tapis.datadir + "/" + executionDirectoryName;
    await downloadData(executionDirectoryPath, results, tapisJobUuid);
    execution.results.map((result) => {
        result.resource.url = dataUrl + "/" + executionDirectoryName + "/" + result.resource.name;
    });
    execution.status = "SUCCESS";
    updateExecutionStatusAndResultsv2(execution);
    await incrementThreadModelRegisteredRunsByExecutionId(execution.modelid, execution.id, 1);
};

const saveBlobToFile = async (blob: Blob, filePath: string) => {
    // Convert Blob to Buffer
    blob.arrayBuffer()
        .then((buffer) => {
            const nodeBuffer = Buffer.from(buffer);
            // Write Buffer to file
            writeFile(filePath, nodeBuffer, (err) => {
                if (err) {
                    console.error("Error writing file:", err);
                } else {
                    console.log("File written successfully:", filePath);
                }
            });
        })
        .catch((err) => {
            console.error("Error converting Blob to Buffer:", err);
        });
};

const downloadData = async (
    executionDirectory: string,
    results: Execution_Result[],
    tapisJobUuid: string
) => {
    if (!existsSync(executionDirectory)) {
        mkdirSync(executionDirectory, { recursive: true });
    }
    const promises = results.map((result) => {
        // join the execution directory with the file name
        const filePath = `${executionDirectory}/${result.resource.name}`;
        return getJobOutputDownloadFile(tapisJobUuid, result.resource.name)
            .then((blob) => {
                saveBlobToFile(blob, filePath);
            })
            .catch((err) => {
                console.error("Error downloading file:", err);
                throw err;
            });
    });
    await Promise.all(promises);
};
