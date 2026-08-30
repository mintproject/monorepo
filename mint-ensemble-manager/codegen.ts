import { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
    schema: {
        "http://graphql.mint.local/v1/graphql": {
            headers: {
                "x-hasura-admin-secret": "CHANGEME"
            }
        }
    },
    // this assumes that all your source files are in a top-level `src/` directory - you might need to adjust this to your file structure
    documents: ["src/**/*.{ts,tsx}"],
    generates: {
        "./src/classes/graphql/": {
            preset: "client",
            plugins: [],
            presetConfig: {
                gqlTagName: "gql"
            }
        },
        "./src/classes/graphql/types.ts": {
            plugins: ["typescript", "typescript-operations"]
        }
    },
    ignoreNoDocuments: true
};

export default config;
