import { Router, Request, Response } from "express";
import subTasksService from "@/api/api-v1/services/subTasksService";
import { HttpError } from "@/classes/common/errors";
import { executionsRouter } from "./executions";
import { getTokenFromAuthorizationHeader } from "@/utils/authUtils";
import { getThread } from "@/classes/graphql/graphql_functions_v2";
import { Thread } from "@/classes/graphql/types";
import executionOutputsService from "@/api/api-v1/services/tapis/executionOutputsService";
import { threadFromGQL } from "@/classes/graphql/graphql_adapter";

interface SubtaskRequest extends Request {
    params: {
        problemStatementId: string;
        taskId: string;
        subtaskId?: string;
    };
}

export interface DataInput {
    id: string;
    dataset: {
        id: string;
        resources: {
            id: string;
            url: string;
        }[];
    };
}

export interface AddDataRequest {
    model_id: string;
    data: DataInput[];
}

export interface ParameterInput {
    id: string;
    value: string | string[];
}

export interface AddParametersRequest {
    model_id: string;
    parameters: ParameterInput[];
}

export interface SetupModelConfigurationAndBindingsRequest {
    model_id: string;
    parameters?: ParameterInput[];
    data?: DataInput[];
}

const subtasksRouter = (): Router => {
    const router = Router({ mergeParams: true });

    /**
     * @openapi
     * /problemStatements/{problemStatementId}/tasks/{taskId}/subtasks:
     *   get:
     *     summary: Get all subtasks for a task
     *     description: Returns a list of all subtasks associated with a specific task
     *     security:
     *       - BearerAuth: []
     *         oauth2: []
     *     tags:
     *       - Subtasks
     *     parameters:
     *       - in: path
     *         name: problemStatementId
     *         required: true
     *         schema:
     *           type: string
     *         description: The problem statement ID
     *       - in: path
     *         name: taskId
     *         required: true
     *         schema:
     *           type: string
     *         description: The task ID
     *     responses:
     *       200:
     *         description: A list of subtasks
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Subtask'
     *       default:
     *         description: Default error response
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     */
    router.get("/", async (req: SubtaskRequest, res: Response) => {
        try {
            const authorizationHeader = req.headers.authorization;
            if (!authorizationHeader) {
                return res.status(401).json({ message: "Authorization header is required" });
            }

            const { problemStatementId, taskId } = req.params;
            const subtasks = await subTasksService.getSubtasksByTaskId(
                problemStatementId,
                taskId,
                authorizationHeader
            );
            res.status(200).json(subtasks);
        } catch (error) {
            if (error.message.includes("not found")) {
                return res.status(404).json({ message: error.message });
            }
            res.status(500).json({ message: error.message });
        }
    });

    /**
     * @openapi
     * /problemStatements/{problemStatementId}/tasks/{taskId}/subtasks/{subtaskId}:
     *   get:
     *     summary: Get a specific subtask
     *     description: Returns details of a specific subtask
     *     security:
     *       - BearerAuth: []
     *         oauth2: []
     *     tags:
     *       - Subtasks
     *     parameters:
     *       - in: path
     *         name: problemStatementId
     *         required: true
     *         schema:
     *           type: string
     *         description: The problem statement ID
     *       - in: path
     *         name: taskId
     *         required: true
     *         schema:
     *           type: string
     *         description: The task ID
     *       - in: path
     *         name: subtaskId
     *         required: true
     *         schema:
     *           type: string
     *         description: The subtask ID
     *     responses:
     *       200:
     *         description: Subtask details
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Subtask'
     *       default:
     *         description: Default error response
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     */
    router.get("/:subtaskId", async (req: SubtaskRequest, res: Response) => {
        try {
            const authorizationHeader = req.headers.authorization;
            if (!authorizationHeader) {
                return res.status(401).json({ message: "Authorization header is required" });
            }

            const { problemStatementId, taskId, subtaskId } = req.params;
            const subtask = await subTasksService.getSubtaskById(
                problemStatementId,
                taskId,
                subtaskId,
                authorizationHeader
            );
            res.status(200).json(subtask);
        } catch (error) {
            if (error.message.includes("not found")) {
                return res.status(404).json({ message: error.message });
            }
            res.status(500).json({ message: error.message });
        }
    });

    /**
     * @openapi
     * /problemStatements/{problemStatementId}/tasks/{taskId}/subtasks:
     *   post:
     *     summary: Create a new subtask
     *     description: Creates a new subtask for a specific task
     *     security:
     *       - BearerAuth: []
     *         oauth2: []
     *     tags:
     *       - Subtasks
     *     parameters:
     *       - in: path
     *         name: problemStatementId
     *         required: true
     *         schema:
     *           type: string
     *         description: The problem statement ID
     *       - in: path
     *         name: taskId
     *         required: true
     *         schema:
     *           type: string
     *         description: The task ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/CreateSubtaskRequest'
     *     responses:
     *       200:
     *         description: Subtask created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Subtask'
     *       default:
     *         description: Default error response
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     */
    router.post("/", async (req: SubtaskRequest, res: Response) => {
        try {
            const authorizationHeader = req.headers.authorization;
            if (!authorizationHeader) {
                return res.status(401).json({ message: "Authorization header is required" });
            }

            const { problemStatementId, taskId } = req.params;
            const subtaskId = await subTasksService.createSubtask(
                problemStatementId,
                taskId,
                req.body,
                authorizationHeader
            );
            const subtask = await subTasksService.getSubtaskById(
                problemStatementId,
                taskId,
                subtaskId,
                authorizationHeader
            );
            res.status(200).json(subtask);
        } catch (error) {
            if (error.message.includes("not found")) {
                return res.status(404).json({ message: error.message });
            }
            res.status(500).json({ message: error.message });
        }
    });

    /**
     * @openapi
     * /problemStatements/{problemStatementId}/tasks/{taskId}/subtasks/{subtaskId}/models:
     *   post:
     *     summary: Select model configurations for a subtask
     *     description: Select and add ModelConfiguration or ModelConfigurationSetup instances to use in this subtask for execution
     *     security:
     *       - BearerAuth: []
     *         oauth2: []
     *     tags:
     *       - Subtasks
     *     parameters:
     *       - in: path
     *         name: problemStatementId
     *         required: true
     *         schema:
     *           type: string
     *         description: The problem statement ID
     *       - in: path
     *         name: taskId
     *         required: true
     *         schema:
     *           type: string
     *         description: The task ID
     *       - in: path
     *         name: subtaskId
     *         required: true
     *         schema:
     *           type: string
     *         description: The subtask ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/AddModelsRequest'
     *     responses:
     *       200:
     *         description: Model configurations selected and added to subtask successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Thread'
     *       default:
     *         description: Default error response
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     */
    router.post(
        "/:subtaskId/models",
        async (
            req: Request<
                { problemStatementId: string; taskId: string; subtaskId: string },
                unknown,
                { modelIds: string[] }
            >,
            res: Response
        ) => {
            try {
                const authorizationHeader = req.headers.authorization;
                if (!authorizationHeader) {
                    return res.status(401).json({ message: "Authorization header is required" });
                }
                const { subtaskId } = req.params;
                const { modelIds } = req.body;
                const subtask = await subTasksService.addModels(
                    subtaskId,
                    modelIds,
                    authorizationHeader
                );
                res.status(200).json(subtask);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }
    );

    /**
     * @openapi
     * /problemStatements/{problemStatementId}/tasks/{taskId}/subtasks/{subtaskId}/data:
     *   post:
     *     summary: Select data for a subtask
     *     description: Select the data to use in the subtask per ModelConfiguration/ModelConfigurationSetup. You can obtain a blueprint from the blueprint endpoint to see available data inputs
     *     security:
     *       - BearerAuth: []
     *         oauth2: []
     *     tags:
     *       - Subtasks
     *     parameters:
     *       - in: path
     *         name: problemStatementId
     *         required: true
     *         schema:
     *           type: string
     *         description: The problem statement ID
     *       - in: path
     *         name: taskId
     *         required: true
     *         schema:
     *           type: string
     *         description: The task ID
     *       - in: path
     *         name: subtaskId
     *         required: true
     *         schema:
     *           type: string
     *         description: The subtask ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/AddDataRequest'
     *     responses:
     *       200:
     *         description: Data selected and configured for subtask successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Thread'
     *       default:
     *         description: Default error response
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     */
    router.post(
        "/:subtaskId/data",
        async (req: Request<{ subtaskId: string }, unknown, AddDataRequest>, res: Response) => {
            const authorizationHeader = req.headers.authorization;
            if (!authorizationHeader) {
                return res.status(401).json({ message: "Authorization header is required" });
            }
            const { subtaskId } = req.params;
            try {
                const subtask = await subTasksService.addData(
                    subtaskId,
                    req.body,
                    authorizationHeader
                );
                res.status(200).json(subtask);
            } catch (error) {
                if (error instanceof HttpError) {
                    return res.status(error.statusCode).json({ message: error.message });
                }
                res.status(500).json({ message: error.message });
            }
        }
    );

    /**
     * @openapi
     * /problemStatements/{problemStatementId}/tasks/{taskId}/subtasks/{subtaskId}/parameters:
     *   post:
     *     summary: Add parameters to a subtask
     *     description: Adds parameters to a subtask
     *     security:
     *       - BearerAuth: []
     *         oauth2: []
     *     tags:
     *       - Subtasks
     *     parameters:
     *       - in: path
     *         name: problemStatementId
     *         required: true
     *         schema:
     *           type: string
     *         description: The problem statement ID
     *       - in: path
     *         name: taskId
     *         required: true
     *         schema:
     *           type: string
     *         description: The task ID
     *       - in: path
     *         name: subtaskId
     *         required: true
     *         schema:
     *           type: string
     *         description: The subtask ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/AddParametersRequest'
     *     responses:
     *       200:
     *         description: Parameters added successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Thread'
     *       default:
     *         description: Default error response
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     */

    router.post(
        "/:subtaskId/parameters",
        async (
            req: Request<{ subtaskId: string }, unknown, AddParametersRequest>,
            res: Response
        ) => {
            const authorizationHeader = req.headers.authorization;
            if (!authorizationHeader) {
                return res.status(401).json({ message: "Authorization header is required" });
            }
            const { subtaskId } = req.params;
            try {
                const subtask = await subTasksService.addParameters(
                    subtaskId,
                    req.body,
                    authorizationHeader
                );
                res.status(200).json(subtask);
            } catch (error) {
                if (error instanceof HttpError) {
                    return res.status(error.statusCode).json({ message: error.message });
                }
                res.status(500).json({ message: error.message });
            }
        }
    );

    /**
     * @openapi
     * /problemStatements/{problemStatementId}/tasks/{taskId}/subtasks/{subtaskId}/setup:
     *   post:
     *     summary: Setup complete model configuration for a subtask
     *     description: Sets up a complete model configuration including the model (if not present), parameters, and data inputs in a single call.
     *     security:
     *       - BearerAuth: []
     *         oauth2: []
     *     tags:
     *       - Subtasks
     *     parameters:
     *       - in: path
     *         name: problemStatementId
     *         required: true
     *         schema:
     *           type: string
     *         description: The problem statement ID
     *       - in: path
     *         name: taskId
     *         required: true
     *         schema:
     *           type: string
     *         description: The task ID
     *       - in: path
     *         name: subtaskId
     *         required: true
     *         schema:
     *           type: string
     *         description: The subtask ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/SetupModelConfigurationAndBindingsRequest'
     *     responses:
     *       200:
     *         description: Complete model configuration setup successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Thread'
     *       default:
     *         description: Default error response
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     */
    router.post(
        "/:subtaskId/setup",
        async (
            req: Request<{ subtaskId: string }, unknown, SetupModelConfigurationAndBindingsRequest>,
            res: Response
        ) => {
            const authorizationHeader = req.headers.authorization;
            if (!authorizationHeader) {
                return res.status(401).json({ message: "Authorization header is required" });
            }
            const { subtaskId } = req.params;
            try {
                const subtask = await subTasksService.setupModelConfigurationAndBindings(
                    subtaskId,
                    req.body,
                    authorizationHeader
                );
                res.status(200).json(subtask);
            } catch (error) {
                if (error instanceof HttpError) {
                    return res.status(error.statusCode).json({ message: error.message });
                }
                res.status(500).json({ message: error.message });
            }
        }
    );

    /**
     * @openapi
     * /problemStatements/{problemStatementId}/tasks/{taskId}/subtasks/{subtaskId}/submit:
     *   post:
     *     summary: Submit a subtask
     *     description: Submits a subtask for execution
     *     security:
     *       - BearerAuth: []
     *         oauth2: []
     *     tags:
     *       - Subtasks
     *     parameters:
     *       - in: path
     *         name: problemStatementId
     *         required: true
     *         schema:
     *           type: string
     *         description: The problem statement ID
     *       - in: path
     *         name: taskId
     *         required: true
     *         schema:
     *           type: string
     *         description: The task ID
     *       - in: path
     *         name: subtaskId
     *         required: true
     *         schema:
     *           type: string
     *         description: The subtask ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/SubmitSubtaskRequest'
     *     responses:
     *       200:
     *         description: Subtask submitted successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SubmitSubtaskResponse'
     *       default:
     *         description: Default error response
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     */
    router.post(
        "/:subtaskId/submit",
        async (
            req: Request<
                { subtaskId: string },
                unknown,
                {
                    model_id: string;
                }
            >,
            res: Response
        ) => {
            const authorizationHeader = req.headers.authorization;
            if (!authorizationHeader) {
                return res.status(401).json({ message: "Authorization header is required" });
            }
            const { subtaskId } = req.params;
            const { model_id } = req.body;
            try {
                const result = await subTasksService.submitSubtask(
                    subtaskId,
                    model_id,
                    authorizationHeader
                );
                res.status(200).json(result);
            } catch (error) {
                if (error instanceof HttpError) {
                    return res.status(error.statusCode).json({ message: error.message });
                }
                res.status(500).json({ message: error.message });
            }
        }
    );

    /**
     * @openapi
     * /problemStatements/{problemStatementId}/tasks/{taskId}/subtasks/{subtaskId}/data-bindings:
     *   get:
     *     summary: Get data bindings for a subtask
     *     description: Returns the data bindings for a subtask
     *     security:
     *       - BearerAuth: []
     *         oauth2: []
     *     tags:
     *       - Subtasks
     *     parameters:
     *       - in: path
     *         name: problemStatementId
     *         required: true
     *         schema:
     *           type: string
     *         description: The problem statement ID
     *       - in: path
     *         name: taskId
     *         required: true
     *         schema:
     *           type: string
     *         description: The task ID
     *       - in: path
     *         name: subtaskId
     *         required: true
     *         schema:
     *           type: string
     *         description: The subtask ID
     *       - in: query
     *         name: model_id
     *         required: true
     *         schema:
     *           type: string
     *         description: The model id to use format https://w3id.org/okn/i/mint/c07a6f98-6339-4033-84b0-6cd7daca6284
     *         example: https://w3id.org/okn/i/mint/c07a6f98-6339-4033-84b0-6cd7daca6284
     *     responses:
     *       200:
     *         description: Data bindings
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/DatasetSpecification'
     *       default:
     *         description: Default error response
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     */
    router.get(
        "/:subtaskId/data-bindings",
        async (
            req: Request<{ subtaskId: string }, unknown, unknown, { model_id: string }>,
            res: Response
        ) => {
            const authorizationHeader = req.headers.authorization;
            if (!authorizationHeader) {
                return res.status(401).json({ message: "Authorization header is required" });
            }
            const { model_id } = req.query;
            if (!model_id) {
                return res.status(400).json({ message: "model_id is required" });
            }
            try {
                const dataBindings = await subTasksService.getModelDataBindings(
                    model_id,
                    authorizationHeader
                );
                res.status(200).json(dataBindings);
            } catch (error) {
                if (error instanceof HttpError) {
                    return res.status(error.statusCode).json({ message: error.message });
                }
                res.status(500).json({ message: error.message });
            }
        }
    );

    /**
     * @openapi
     * /problemStatements/{problemStatementId}/tasks/{taskId}/subtasks/{subtaskId}/blueprint:
     *   get:
     *     summary: Get blueprint (parameters and inputs) for a subtask
     *     description: Returns the complete model configuration blueprint for all models in a subtask
     *     security:
     *       - BearerAuth: []
     *         oauth2: []
     *     tags:
     *       - Subtasks
     *     parameters:
     *       - in: path
     *         name: problemStatementId
     *         required: true
     *         schema:
     *           type: string
     *         description: The problem statement ID
     *       - in: path
     *         name: taskId
     *         required: true
     *         schema:
     *           type: string
     *         description: The task ID
     *       - in: path
     *         name: subtaskId
     *         required: true
     *         schema:
     *           type: string
     *         description: The subtask ID
     *       - in: query
     *         name: detailed
     *         required: false
     *         schema:
     *           type: boolean
     *           default: false
     *         description: If true, returns full ModelParameter details. If false, returns basic info (id, value) only.
     *     responses:
     *       200:
     *         description: Complete blueprint for the subtask
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: object
     *                 properties:
     *                   model_id:
     *                     type: string
     *                     description: The model identifier
     *                     example: "https://w3id.org/okn/i/mint/c07a6f98-6339-4033-84b0-6cd7daca6284"
     *                   parameters:
     *                     type: array
     *                     description: Returns BasicModelParameter (id, value) by default, or full ModelParameter when detailed=true
     *                     items:
     *                       anyOf:
     *                         - $ref: '#/components/schemas/BasicModelParameter'
     *                         - $ref: '#/components/schemas/ModelParameter'
     *                   inputs:
     *                     type: array
     *                     items:
     *                       type: object
     *                       properties:
     *                         id:
     *                           type: string
     *                           description: Input identifier
     *                           example: "https://w3id.org/okn/i/mint/ce32097e-641d-42af-b3f1-477a24cf015a"
     *                         dataset:
     *                           type: object
     *                           properties:
     *                             id:
     *                               type: string
     *                               description: Dataset identifier
     *                               example: "18400624-423c-42b5-ad56-6c73322584bd"
     *                             resources:
     *                               type: array
     *                               items:
     *                                 type: object
     *                                 properties:
     *                                   id:
     *                                     type: string
     *                                     description: Resource identifier
     *                                     example: "9c7b25c4-8cea-4965-a07a-d9b3867f18a9"
     *                                   url:
     *                                     type: string
     *                                     description: Resource URL
     *                                     example: "https://ckan.tacc.utexas.edu/dataset/18400624-423c-42b5-ad56-6c73322584bd/resource/9c7b25c4-8cea-4965-a07a-d9b3867f18a9/download/barton_springs_2001_2010average.wel"
     *       default:
     *         description: Default error response
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     */
    router.get(
        "/:subtaskId/blueprint",
        async (
            req: Request<{ subtaskId: string }, unknown, unknown, { detailed?: string | boolean }>,
            res: Response
        ) => {
            const authorizationHeader = req.headers.authorization;
            if (!authorizationHeader) {
                return res.status(401).json({ message: "Authorization header is required" });
            }
            const { subtaskId } = req.params;
            const { detailed } = req.query;
            const isDetailed = detailed === true || detailed === "true";
            try {
                const blueprint = await subTasksService.getBlueprint(
                    subtaskId,
                    authorizationHeader,
                    isDetailed
                );
                res.status(200).json(blueprint);
            } catch (error) {
                if (error instanceof HttpError) {
                    return res.status(error.statusCode).json({ message: error.message });
                }
                res.status(500).json({ message: error.message });
            }
        }
    );

    router.use("/:subtaskId/executions", executionsRouter());

    /**
     * @swagger
     * /problemStatements/{problemStatementId}/tasks/{taskId}/subtasks/{subtaskId}/outputs:
     *   post:
     *     summary: Publish all executions for a subtask
     *     description: Publishes all executions for a subtask by looping through all thread models and their executions
     *     operationId: publishAllExecutions
     *     tags:
     *       - Subtasks
     *     security:
     *       - BearerAuth: []
     *       - oauth2: []
     *     parameters:
     *       - name: problemStatementId
     *         in: path
     *         required: true
     *         schema:
     *           type: string
     *       - name: taskId
     *         in: path
     *         required: true
     *         schema:
     *           type: string
     *       - name: subtaskId
     *         in: path
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: All executions published successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *       404:
     *         description: Subtask not found
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *       400:
     *         description: No executions found to publish
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *       default:
     *         description: Default error response
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     */
    router.post("/:subtaskId/outputs", async (req: Request, res: Response) => {
        const authorizationHeader = req.headers.authorization;
        if (!authorizationHeader) {
            return res.status(401).json({ message: "Authorization header is required" });
        }
        const access_token = getTokenFromAuthorizationHeader(authorizationHeader);
        const { subtaskId } = req.params;

        const subtaskGraphql: Thread = await getThread(subtaskId, access_token);
        if (!subtaskGraphql) {
            return res.status(404).json({ message: "Subtask not found" });
        }

        if (subtaskGraphql.thread_models.length === 0) {
            return res.status(404).json({ message: "Thread models not found" });
        }
        const subtask = threadFromGQL(subtaskGraphql);

        let executionsSubmitted = 0;
        const thread_models = subtaskGraphql.thread_models;
        for (const thread_model of thread_models) {
            for (const execution of thread_model.executions) {
                try {
                    await executionOutputsService.registerOutputs(
                        execution.execution.id,
                        access_token,
                        subtask,
                        req.headers.origin,
                        subtask.dataset_id
                    );
                    executionsSubmitted += 1;
                } catch (error) {
                    console.error(`Error publishing execution ${execution.execution.id}:`, error);
                    // Continue with other executions even if one fails
                }
            }
        }
        if (executionsSubmitted === 0) {
            return res.status(400).json({ message: "No executions found to publish" });
        }
        return res.status(200).json({ message: "Outputs registered successfully" });
    });

    return router;
};

export default subtasksRouter;
