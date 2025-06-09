import { Router } from "express";
import threadsRouter from "./threads";
import modelEnsemblesRouter from "./modelEnsembles";
import jobsRouter from "./jobs";
import executionsRouter from "./executions";

export default function () {
    const router = Router();
    router.use("/executions", executionsRouter());
    router.use("/jobs", jobsRouter());
    router.use("/modelEnsembles", modelEnsemblesRouter());
    router.use("/threads", threadsRouter()); // TODO: remove this
    return router;
}
