/**
 * Represents the status and details of an execution job
 */
export interface ExecutionJob {
    id: string;
    status: "pending" | "running" | "completed" | "failed";
    result?: any;
    error?: string;
}

/**
 * Interface defining the contract for execution service adapters
 */
export interface IExecutionService {
    /**
     * Submits a new job for execution
     * @param code The code or configuration to be executed
     * @param params Additional parameters needed for execution
     * @returns Promise resolving to the job ID
     */
    submitJob(code: string, params: Record<string, any>): Promise<string>;

    /**
     * Retrieves the current status of a job
     * @param jobId The ID of the job to check
     * @returns Promise resolving to the job status and details
     * @throws Error if the job is not found
     */
    getJobStatus(jobId: string): Promise<ExecutionJob>;

    /**
     * Attempts to cancel a running job
     * @param jobId The ID of the job to cancel
     * @returns Promise resolving to true if cancellation was successful, false otherwise
     */
    cancelJob(jobId: string): Promise<boolean>;
}
