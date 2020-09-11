import bodyParser from "body-parser";
import express from "express";
import path from "path";
import cors from "cors";
import swaggerUi from "swagger-ui-express";

import v1ExecutionsService from './api/api-v1/services/executionsService';
import v1ExecutionsLocalService from './api/api-v1/services/executionsLocalService';
import v1ExecutionQueService from './api/api-v1/services/executionQueueService';
import v1MonitorsService from './api/api-v1/services/monitorsService';
import v1LogsService from './api/api-v1/services/logsService';


import { initialize } from "express-openapi";
import { getResource } from "./classes/wings/xhr-requests";

import Queue from "bull";
import { UI, setQueues } from "bull-board";
import { EXECUTION_QUEUE_NAME, REDIS_URL, MONITOR_QUEUE_NAME } from "./config/redis";
import { PORT, VERSION } from "./config/app";

import * as webpack from "webpack";
import * as webpackDevMiddleware from "webpack-dev-middleware";

const config = require('../webpack.config.js');
const compiler = webpack.default(config);

// Main Express Server
const app = express();
const port = PORT; 
const version = VERSION;

// Setup API
var v1ApiDoc = require('./api/api-doc');
app.use(bodyParser.json());
app.use(cors());

// Use webpack middleware
//app.use(webpackDevMiddleware.default(compiler, {publicPath: config.output.publicPath}));

initialize({
    app,    
    apiDoc: v1ApiDoc,
    dependencies: {
        executionsService: v1ExecutionsService,
        executionsLocalService: v1ExecutionsLocalService,
        executionQueueService: v1ExecutionQueService,
        monitorsService: v1MonitorsService,
        logsService: v1LogsService
    },
    paths: path.resolve(__dirname, './api/api-v1/paths'),
    routesGlob: '**/*.{ts,js}',
    routesIndexFileRegExp: /(?:index)?\.[tj]s$/
});

// Setup Error Handler
app.use(((err, req, res, next) => {
    console.log(err);
    const status = err.status || 500;
    res.status(status).json(err);
}) as express.ErrorRequestHandler);

// Setup Bull Queue Dashboard
let executionQueue = new Queue(EXECUTION_QUEUE_NAME, REDIS_URL);
let monitorQueue = new Queue(MONITOR_QUEUE_NAME, REDIS_URL);
setQueues([executionQueue, monitorQueue]);
app.use('/admin/queues', UI)

// Express start
app.listen(port, () => {
    // Serve Swagger UI
    getResource({
        url: 'http://localhost:' + port + '/' + version + '/api-docs',
        onError: () => {},
        onLoad: (resp:any) => {
            var apidoc = JSON.parse(resp.target.responseText);
            app.use('/' + version + '/ui', swaggerUi.serve, swaggerUi.setup(apidoc));
        }
    })
});


