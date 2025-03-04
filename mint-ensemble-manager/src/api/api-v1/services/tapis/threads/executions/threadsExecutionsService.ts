import {
    getThreadModelByThreadIdExecutionId,
    incrementThreadModelRegisteredRuns,
    incrementThreadModelSuccessfulRuns
} from "@/classes/graphql/graphql_functions";
import { Status } from "@/interfaces/IExecutionService";

export interface ThreadsExecutionsService {
    updateStatus(threadId: string, executionId: string, status: Status): Promise<void>;
}

const threadsExecutionsService: ThreadsExecutionsService = {
    /**
     * Update the status of a thread execution
     * @param id The execution ID
     * @param status The new status
     * @param auth Authorization header
     * @returns Promise<void>
     * @throws BadRequestError if status is invalid
     */
    async updateStatus(threadId: string, executionId: string, status: Status): Promise<void> {
        // Validate status
        const threadModel = await getThreadModelByThreadIdExecutionId(threadId, executionId);
        if (!status || !Object.values(Status).includes(status)) {
            throw new Error("Invalid status provided");
        }

        try {
            incrementThreadModelSuccessfulRuns(threadModel[0].id, 1);
        } catch (error) {
            console.error("Error updating execution status:", error);
            throw error;
        }
    }
};

export default threadsExecutionsService;
