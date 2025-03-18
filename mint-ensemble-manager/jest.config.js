/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

/** @type {import('jest').Config} */
const config = {
    coverageProvider: "v8",
    testRegex: [".*\\.test\\.ts$"],
    transform: {
        "\\.(gql|graphql)$": "@graphql-tools/jest-transform",
        ".*": "babel-jest"
    },
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1"
    }
};

module.exports = config;
