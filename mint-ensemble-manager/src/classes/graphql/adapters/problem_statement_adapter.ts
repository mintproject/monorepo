import { MintEvent, MintPermission, ProblemStatement, Task } from "@/classes/mint/mint-types";
import {
    Problem_Statement,
    Problem_Statement_Provenance,
    Problem_Statement_Permission,
    Task as TaskGQL
} from "../types";

export const eventFromGQL = (eventobj: Problem_Statement_Provenance): MintEvent => {
    return {
        event: eventobj.event,
        userid: eventobj.userid,
        timestamp: new Date(eventobj.timestamp),
        notes: eventobj.notes
    } as MintEvent;
};

export const permissionFromGQL = (permobj: Problem_Statement_Permission): MintPermission => {
    return {
        userid: permobj.user_id,
        read: permobj.read ?? false,
        write: permobj.write ?? false
    } as MintPermission;
};

export const taskFromGQL = (task: TaskGQL): Task => {
    return {
        id: task.id,
        name: task.name,
        response_variables: task.response_variable ? [task.response_variable.id] : [],
        driving_variables: task.driving_variable ? [task.driving_variable.id] : [],
        problem_statement_id: task.problem_statement_id
    } as Task;
};

export const problemStatementFromGQL = (problem: Problem_Statement): ProblemStatement => {
    return {
        id: problem.id,
        name: problem.name,
        dates: {
            start_date: new Date(problem.start_date),
            end_date: new Date(problem.end_date)
        },
        events: problem.events.map(eventFromGQL),
        permissions: problem.permissions.map(permissionFromGQL),
        tasks: problem.tasks.map(taskFromGQL),
        regionid: problem.region_id
    } as ProblemStatement;
};
