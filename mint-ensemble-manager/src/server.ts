import bodyParser from "body-parser";
import express from "express";
import path from "path";
import cors from "cors";
import swaggerUi from "swagger-ui-express";

import v1ApiDoc from './api/api-doc';
import v1ExecutionsService from './api/api-v1/services/executionsService';
import v1ExecutionsLocalService from './api/api-v1/services/executionsLocalService';
import v1MonitorsService from './api/api-v1/services/monitorsService';
import v1LogsService from './api/api-v1/services/logsService';
import v1ThreadsService from './api/api-v1/services/threadsService';

import { initialize } from "express-openapi";
import { getResource } from "./classes/wings/xhr-requests";

const app = express();
const port = 3000; // default port to listen
const version = 'v1';

app.use(bodyParser.json());
app.use(cors());

initialize({
    app,    
    apiDoc: v1ApiDoc,
    dependencies: {
        executionsService: v1ExecutionsService,
        executionsLocalService: v1ExecutionsLocalService,
        monitorsService: v1MonitorsService,
        logsService: v1LogsService,
        threadsService: v1ThreadsService
    },
    paths: path.resolve(__dirname, './api/api-v1/paths'),
    routesGlob: '**/*.{ts,js}',
    routesIndexFileRegExp: /(?:index)?\.[tj]s$/
});
 
app.use(((err, req, res, next) => {
    res.status(err.status).json(err);
}) as express.ErrorRequestHandler);

app.listen(port, () => {
    getResource({
        url: 'http://localhost:' + port + '/' + version + '/api-docs',
        onError: () => {},
        onLoad: (resp:any) => {
            var apidoc = JSON.parse(resp.target.responseText);
            app.use('/' + version + '/ui', swaggerUi.serve, swaggerUi.setup(apidoc));
        }
    })
});


