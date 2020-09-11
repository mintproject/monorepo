import Queue from "bull";
import { EXECUTION_QUEUE_NAME, REDIS_URL, MONITOR_QUEUE_NAME } from "../../../config/redis";

// ./api-v1/services/executionsLocalService.js

const createResponse = (result: string, message: string) => {
    return {
        result: result,
        message: message
    };
}

const cleanQueue = (queue: Queue.Queue) => {
    queue.empty();
    queue.clean(0, 'delayed');
    queue.clean(0, 'wait');
    queue.clean(0, 'active');
    queue.clean(0, 'completed');
    queue.clean(0, 'failed');

    let multi = queue.multi();
    multi.del(queue.toKey('repeat'));
    multi.exec();
}

const executionQueueService = {
    async emptyExecutionQueue() {
        let executionQueue = new Queue(EXECUTION_QUEUE_NAME, REDIS_URL);
        let monitorQueue = new Queue(MONITOR_QUEUE_NAME, REDIS_URL);        
        cleanQueue(executionQueue);
        cleanQueue(monitorQueue);
        return createResponse("success", "Queues emptied");
    },
    async getExecutionQueue(thread: any) {
        let executionQueue = new Queue(EXECUTION_QUEUE_NAME, REDIS_URL);
        let count = await executionQueue.getActiveCount();
        return createResponse("success", "Number of Active Jobs: " + count);
    }
};

export default executionQueueService;