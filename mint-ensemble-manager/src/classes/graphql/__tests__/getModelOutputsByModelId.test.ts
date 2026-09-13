import { getModelOutputsByModelId } from "@/classes/graphql/graphql_functions";
import { GraphQL } from "@/config/graphql";
import { InternalServerError, NotFoundError } from "@/classes/common/errors";

jest.mock("@/config/graphql", () => ({
    GraphQL: {
        instance: jest.fn()
    }
}));

jest.mock("@/config/keycloak-adapter", () => ({
    KeycloakAdapter: {
        getUser: jest.fn().mockReturnValue({ email: "test@mint.local" })
    }
}));

const MODEL_ID = "https://w3id.org/okn/i/mint/configuration-1";

const mockQuery = (implementation: () => unknown) => {
    const query = jest.fn().mockImplementation(implementation);
    (GraphQL.instance as jest.Mock).mockReturnValue({ query });
    return query;
};

describe("getModelOutputsByModelId", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("returns the declared outputs", async () => {
        mockQuery(async () => ({
            data: {
                modelcatalog_configuration_by_pk: {
                    id: MODEL_ID,
                    outputs: [
                        {
                            output: {
                                id: "https://w3id.org/okn/i/mint/cdd558dc",
                                label: "out.txt",
                                has_format: "txt"
                            }
                        }
                    ]
                }
            }
        }));

        const outputs = await getModelOutputsByModelId(MODEL_ID);

        expect(outputs).toHaveLength(1);
        expect(outputs[0].model_io.name).toBe("out.txt");
    });

    it("returns [] when the model configuration declares no outputs", async () => {
        mockQuery(async () => ({
            data: {
                modelcatalog_configuration_by_pk: { id: MODEL_ID, outputs: [] }
            }
        }));

        await expect(getModelOutputsByModelId(MODEL_ID)).resolves.toEqual([]);
    });

    it("throws on a GraphQL error, and names the cause", async () => {
        mockQuery(async () => ({
            data: null,
            errors: [{ message: "field 'outputs' not found in type: 'configuration'" }]
        }));

        await expect(getModelOutputsByModelId(MODEL_ID)).rejects.toThrow(InternalServerError);
        await expect(getModelOutputsByModelId(MODEL_ID)).rejects.toThrow(
            /field 'outputs' not found in type: 'configuration'/
        );
    });

    it("throws when the query rejects", async () => {
        mockQuery(async () => {
            throw new Error("Network error: connect ECONNREFUSED");
        });

        await expect(getModelOutputsByModelId(MODEL_ID)).rejects.toThrow(
            "Network error: connect ECONNREFUSED"
        );
    });

    it("throws when the model configuration does not exist", async () => {
        mockQuery(async () => ({
            data: { modelcatalog_configuration_by_pk: null }
        }));

        await expect(getModelOutputsByModelId(MODEL_ID)).rejects.toThrow(NotFoundError);
    });

    it("throws when Hasura returns no response", async () => {
        mockQuery(async () => undefined);

        await expect(getModelOutputsByModelId(MODEL_ID)).rejects.toThrow(InternalServerError);
    });
});
