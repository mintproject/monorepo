import { ProblemStatement, ProblemStatementInfo } from "@/classes/mint/mint-types";
import {
    getProblemStatements,
    getProblemStatement,
    addProblemStatement
} from "@/classes/graphql/graphql_functions";
import { getTokenFromAuthorizationHeader } from "@/utils/authUtils";
import { UnauthorizedError, InternalServerError, NotFoundError } from "@/classes/common/errors";

export interface ProblemStatementsService {
    getProblemStatements(authorizationHeader: string): Promise<ProblemStatement[]>;
    getProblemStatementById(id: string, authorizationHeader: string): Promise<ProblemStatement>;
    createProblemStatement(
        problemStatement: ProblemStatementInfo,
        authorizationHeader: string
    ): Promise<string>;
}

const problemStatementsService: ProblemStatementsService = {
    async getProblemStatements(authorizationHeader: string) {
        return await getProblemStatements(authorizationHeader);
    },

    async getProblemStatementById(id: string, authorizationHeader: string) {
        const access_token = getTokenFromAuthorizationHeader(authorizationHeader);
        if (!access_token) {
            throw new UnauthorizedError("Invalid authorization header");
        }

        const problemStatement = await getProblemStatement(id, access_token);
        if (!problemStatement) {
            throw new NotFoundError("Problem statement not found");
        }
        return problemStatement;
    },

    async createProblemStatement(
        problemStatement: ProblemStatementInfo,
        authorizationHeader: string
    ) {
        const access_token = getTokenFromAuthorizationHeader(authorizationHeader);
        if (!access_token) {
            throw new UnauthorizedError("Invalid authorization header");
        }

        try {
            const id = await addProblemStatement(problemStatement, access_token);
            if (!id) {
                throw new InternalServerError("Failed to create problem statement");
            }
            return id;
        } catch (error) {
            console.error("Error creating problem statement:", error);
            throw new InternalServerError("Error creating problem statement: " + error.message);
        }
    }
};

export default problemStatementsService;
