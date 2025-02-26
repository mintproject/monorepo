import { Region } from "@/classes/mint/mint-types";

import { Model } from "@/classes/mint/mint-types";

import { Execution } from "@/classes/mint/mint-types";
import { TapisComponent } from "@/classes/tapis/typing";

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
    submitExecutions(
        executions: Execution[],
        model: Model,
        region: Region,
        component: TapisComponent
    ): Promise<string[]>;
}
