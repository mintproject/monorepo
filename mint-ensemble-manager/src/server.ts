import bodyParser from "body-parser";
import express from "express";
import path from "path";
import cors from "cors";

import v1ApiDoc from './api/api-doc';
import v1ExecutionsService from './api/api-v1/services/executionsService';
import v1ExecutionsLocalService from './api/api-v1/services/executionsLocalService';
import v1MonitorsService from './api/api-v1/services/monitorsService';

import { initialize } from "express-openapi";

const app = express();
const port = 3000; // default port to listen

app.use(bodyParser.json());
app.use(cors());

initialize({
    app,    
    apiDoc: v1ApiDoc,
    dependencies: {
        executionsService: v1ExecutionsService,
        executionsLocalService: v1ExecutionsLocalService,
        monitorsService: v1MonitorsService
    },
    paths: path.resolve(__dirname, './api/api-v1/paths'),
    routesGlob: '**/*.{ts,js}',
    routesIndexFileRegExp: /(?:index)?\.[tj]s$/
});
 
app.use(((err, req, res, next) => {
    res.status(err.status).json(err);
}) as express.ErrorRequestHandler);

app.listen(port);
