/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path");
const NodemonPlugin = require("nodemon-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const NodeExternals = require("webpack-node-externals");

module.exports = {
    mode: "development",
    target: "node",
    resolve: {
        extensions: [".js", ".json", ".ts", ".graphql"],
        alias: {
            "@/api": path.resolve(__dirname, "src/api"),
            "@/classes": path.resolve(__dirname, "src/classes"),
            "@/config": path.resolve(__dirname, "src/config"),
            "@/utils": path.resolve(__dirname, "src/utils"),
            "@/interfaces": path.resolve(__dirname, "src/interfaces")
        }
    },
    entry: {
        execution: "./src/classes/localex/seed-execution.ts",
        server: "./src/server.ts"
    },
    output: {
        library: "ensemble-manager",
        libraryTarget: "umd",
        filename: "[name].js",
        path: path.resolve(__dirname, "dist")
    },
    externals: [NodeExternals()],
    module: {
        rules: [
            {
                test: /\.graphql$/,
                exclude: /node_modules/,
                loader: "graphql-tag/loader"
            },
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                loader: "ts-loader"
            }
        ]
    },
    plugins: [
        new NodemonPlugin({
            script: "./dist/server.js"
        }),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: "./src/api",
                    to: "api"
                },
                {
                    from: "./src/utils",
                    to: "utils"
                },
                {
                    from: "./src/config",
                    to: "config"
                }
            ]
        })
    ],
    node: {
        __dirname: false
    }
};
