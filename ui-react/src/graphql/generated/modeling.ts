/**
 * GraphQL types, hooks, and documents for the modeling workflow.
 *
 * Covers: problem_statement, task, thread (public schema tables).
 * Hand-authored to match the Hasura schema defined in
 * graphql_engine/migrations/1662641297914_init/up.sql and
 * graphql_engine/metadata/tables.yaml.
 *
 * Regenerate via `npm run codegen` if the Hasura endpoint is accessible.
 */
import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';

// ─── Scalar types (reused from graphql.ts) ───────────────────────────────────

export type Maybe<T> = T | null;

const defaultOptions = {} as const;

// ─── Enums ───────────────────────────────────────────────────────────────────

export type ProblemStatementEvents =
  | 'CREATE'
  | 'UPDATE'
  | 'ADD_TASK'
  | 'DELETE_TASK';

export type TaskEvents = 'CREATE' | 'UPDATE' | 'ADD_THREAD' | 'DELETE_THREAD';

export type ThreadEvents =
  | 'CREATE'
  | 'UPDATE'
  | 'SELECT_DATA'
  | 'SELECT_MODELS'
  | 'SELECT_PARAMETERS'
  | 'EXECUTE'
  | 'INGEST'
  | 'VISUALIZE';

// ─── Entity types ────────────────────────────────────────────────────────────

export type ProblemStatementProvenance = {
  __typename?: 'problem_statement_provenance';
  event: ProblemStatementEvents;
  userid: string;
  timestamp: string;
  notes?: Maybe<string>;
};

export type ProblemStatementPermission = {
  __typename?: 'problem_statement_permission';
  user_id: string;
  read: boolean;
  write: boolean;
};

export type ProblemStatement = {
  __typename?: 'problem_statement';
  id: string;
  name?: Maybe<string>;
  start_date: string;
  end_date: string;
  region_id: string;
  events: ProblemStatementProvenance[];
  permissions: ProblemStatementPermission[];
  tasks: Task[];
};

export type TaskProvenance = {
  __typename?: 'task_provenance';
  event: TaskEvents;
  userid: string;
  timestamp: string;
  notes?: Maybe<string>;
};

export type TaskPermission = {
  __typename?: 'task_permission';
  user_id: string;
  read: boolean;
  write: boolean;
};

export type ThreadPermission = {
  __typename?: 'thread_permission';
  user_id: string;
  read: boolean;
  write: boolean;
};

export type ThreadProvenance = {
  __typename?: 'thread_provenance';
  event: ThreadEvents;
  userid: string;
  timestamp: string;
  notes?: Maybe<string>;
};

export type Thread = {
  __typename?: 'thread';
  id: string;
  name?: Maybe<string>;
  task_id: string;
  start_date: string;
  end_date: string;
  region_id?: Maybe<string>;
  driving_variable_id?: Maybe<string>;
  response_variable_id?: Maybe<string>;
  events: ThreadProvenance[];
  permissions: ThreadPermission[];
};

export type Task = {
  __typename?: 'task';
  id: string;
  name: string;
  problem_statement_id: string;
  start_date: string;
  end_date: string;
  region_id?: Maybe<string>;
  driving_variable_id?: Maybe<string>;
  response_variable_id?: Maybe<string>;
  events: TaskProvenance[];
  permissions: TaskPermission[];
  threads: Thread[];
};

// ─── Permission utils ─────────────────────────────────────────────────────────

export interface UserPermissions {
  owner: boolean;
  write: boolean;
  read: boolean;
}

/**
 * Derive effective permissions for the current user from the permissions array
 * and provenance events.  Mirrors the legacy getUserPermission() logic.
 */
export function getUserPermission(
  permissions: Array<{ user_id: string; read: boolean; write: boolean }> | undefined | null,
  events: Array<{ event: string; userid: string }> | undefined | null,
  currentUserId?: string | null,
): UserPermissions {
  if (!currentUserId) {
    return { owner: false, write: false, read: false };
  }

  // Owner = created the resource
  const isOwner = (events ?? []).some(
    (e) => e.event === 'CREATE' && e.userid === currentUserId,
  );
  if (isOwner) {
    return { owner: true, write: true, read: true };
  }

  // Wildcard write permission
  const wildcardWrite = (permissions ?? []).some(
    (p) => p.user_id === '*' && p.write,
  );
  if (wildcardWrite) {
    return { owner: false, write: true, read: true };
  }

  // User-specific permission
  const userPerm = (permissions ?? []).find((p) => p.user_id === currentUserId);
  if (userPerm) {
    return { owner: false, write: userPerm.write, read: userPerm.read };
  }

  return { owner: false, write: false, read: false };
}

/**
 * Return the most-recent event from a provenance array.
 */
export function getLatestEvent<T extends { timestamp: string }>(
  events?: T[] | null,
): T | null {
  if (!events || events.length === 0) return null;
  return [...events].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))[0] ?? null;
}

/**
 * Return the most-recent event of the given types.
 */
export function getLatestEventOfType<T extends { event: string; timestamp: string }>(
  types: string[],
  events?: T[] | null,
): T | null {
  const filtered = (events ?? []).filter((e) => types.includes(e.event));
  return getLatestEvent(filtered);
}

// ─── Fragments ────────────────────────────────────────────────────────────────

const PROBLEM_STATEMENT_INFO = gql`
  fragment problem_statement_info on problem_statement {
    id
    name
    start_date
    end_date
    region_id
    events {
      event
      timestamp
      userid
      notes
    }
    permissions {
      user_id
      read
      write
    }
  }
`;

const TASK_INFO = gql`
  fragment task_info on task {
    id
    name
    problem_statement_id
    start_date
    end_date
    region_id
    driving_variable_id
    response_variable_id
    events {
      event
      timestamp
      userid
      notes
    }
    permissions {
      user_id
      read
      write
    }
  }
`;

const THREAD_INFO = gql`
  fragment thread_info on thread {
    id
    name
    task_id
    start_date
    end_date
    region_id
    driving_variable_id
    response_variable_id
    events {
      event
      timestamp
      userid
      notes
    }
    permissions {
      user_id
      read
      write
    }
  }
`;

// ─── Query: ListProblemStatements ────────────────────────────────────────────

export type ListProblemStatementsQueryVariables = {
  regionId: string;
};

export type ListProblemStatementsQuery = {
  __typename?: 'query_root';
  problem_statement: ProblemStatement[];
};

export const ListProblemStatementsDocument = gql`
  ${PROBLEM_STATEMENT_INFO}
  query ListProblemStatements($regionId: String!) {
    problem_statement(
      where: { region_id: { _eq: $regionId } }
      order_by: { id: desc }
    ) {
      ...problem_statement_info
    }
  }
`;

export function useListProblemStatementsQuery(
  baseOptions: Apollo.QueryHookOptions<
    ListProblemStatementsQuery,
    ListProblemStatementsQueryVariables
  > & { variables: ListProblemStatementsQueryVariables },
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<
    ListProblemStatementsQuery,
    ListProblemStatementsQueryVariables
  >(ListProblemStatementsDocument, options);
}

// ─── Query: GetProblemStatement ──────────────────────────────────────────────

export type GetProblemStatementQueryVariables = {
  id: string;
};

export type GetProblemStatementQuery = {
  __typename?: 'query_root';
  problem_statement_by_pk?: ProblemStatement & { tasks: (Task & { threads: Thread[] })[] } | null;
};

export const GetProblemStatementDocument = gql`
  ${PROBLEM_STATEMENT_INFO}
  ${TASK_INFO}
  ${THREAD_INFO}
  query GetProblemStatement($id: String!) {
    problem_statement_by_pk(id: $id) {
      ...problem_statement_info
      tasks {
        ...task_info
        threads {
          ...thread_info
        }
      }
    }
  }
`;

export function useGetProblemStatementQuery(
  baseOptions: Apollo.QueryHookOptions<
    GetProblemStatementQuery,
    GetProblemStatementQueryVariables
  > & { variables: GetProblemStatementQueryVariables },
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<GetProblemStatementQuery, GetProblemStatementQueryVariables>(
    GetProblemStatementDocument,
    options,
  );
}

// ─── Mutation: InsertProblemStatement ────────────────────────────────────────

export type InsertProblemStatementMutationVariables = {
  id: string;
  name: string;
  regionId: string;
  startDate: string;
  endDate: string;
};

export type InsertProblemStatementMutation = {
  __typename?: 'mutation_root';
  insert_problem_statement?: {
    returning: { id: string }[];
  } | null;
};

export const InsertProblemStatementDocument = gql`
  mutation InsertProblemStatement(
    $id: String!
    $name: String!
    $regionId: String!
    $startDate: date!
    $endDate: date!
  ) {
    insert_problem_statement(
      objects: [
        {
          id: $id
          name: $name
          region_id: $regionId
          start_date: $startDate
          end_date: $endDate
        }
      ]
    ) {
      returning {
        id
      }
    }
  }
`;

export function useInsertProblemStatementMutation(
  baseOptions?: Apollo.MutationHookOptions<
    InsertProblemStatementMutation,
    InsertProblemStatementMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useMutation<
    InsertProblemStatementMutation,
    InsertProblemStatementMutationVariables
  >(InsertProblemStatementDocument, options);
}

// ─── Mutation: UpdateProblemStatement ────────────────────────────────────────

export type UpdateProblemStatementMutationVariables = {
  id: string;
  name: string;
  regionId: string;
  startDate: string;
  endDate: string;
};

export type UpdateProblemStatementMutation = {
  __typename?: 'mutation_root';
  update_problem_statement_by_pk?: { id: string } | null;
};

export const UpdateProblemStatementDocument = gql`
  mutation UpdateProblemStatement(
    $id: String!
    $name: String!
    $regionId: String!
    $startDate: date!
    $endDate: date!
  ) {
    update_problem_statement_by_pk(
      pk_columns: { id: $id }
      _set: {
        name: $name
        region_id: $regionId
        start_date: $startDate
        end_date: $endDate
      }
    ) {
      id
    }
  }
`;

export function useUpdateProblemStatementMutation(
  baseOptions?: Apollo.MutationHookOptions<
    UpdateProblemStatementMutation,
    UpdateProblemStatementMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useMutation<
    UpdateProblemStatementMutation,
    UpdateProblemStatementMutationVariables
  >(UpdateProblemStatementDocument, options);
}

// ─── Mutation: InsertProblemStatementProvenance ───────────────────────────────

export type InsertProblemStatementProvenanceMutationVariables = {
  problemStatementId: string;
  event: ProblemStatementEvents;
  userid: string;
  notes?: Maybe<string>;
};

export const InsertProblemStatementProvenanceDocument = gql`
  mutation InsertProblemStatementProvenance(
    $problemStatementId: String!
    $event: problem_statement_events!
    $userid: String!
    $notes: String
  ) {
    insert_problem_statement_provenance_one(
      object: {
        problem_statement_id: $problemStatementId
        event: $event
        userid: $userid
        notes: $notes
      }
    ) {
      problem_statement_id
    }
  }
`;

export function useInsertProblemStatementProvenanceMutation(
  baseOptions?: Apollo.MutationHookOptions<unknown, InsertProblemStatementProvenanceMutationVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useMutation<unknown, InsertProblemStatementProvenanceMutationVariables>(
    InsertProblemStatementProvenanceDocument,
    options,
  );
}

// ─── Mutation: DeleteProblemStatement ────────────────────────────────────────

export type DeleteProblemStatementMutationVariables = {
  id: string;
};

export type DeleteProblemStatementMutation = {
  __typename?: 'mutation_root';
  delete_problem_statement_by_pk?: { id: string } | null;
};

export const DeleteProblemStatementDocument = gql`
  mutation DeleteProblemStatement($id: String!) {
    delete_thread_permission(
      where: { thread: { task: { problem_statement_id: { _eq: $id } } } }
    ) { affected_rows }
    delete_thread_provenance(
      where: { thread: { task: { problem_statement_id: { _eq: $id } } } }
    ) { affected_rows }
    delete_task_permission(
      where: { task: { problem_statement_id: { _eq: $id } } }
    ) { affected_rows }
    delete_task_provenance(
      where: { task: { problem_statement_id: { _eq: $id } } }
    ) { affected_rows }
    delete_problem_statement_permission(
      where: { problem_statement_id: { _eq: $id } }
    ) { affected_rows }
    delete_problem_statement_provenance(
      where: { problem_statement_id: { _eq: $id } }
    ) { affected_rows }
    delete_thread_model_execution_summary(
      where: { thread_model: { thread: { task: { problem_statement_id: { _eq: $id } } } } }
    ) { affected_rows }
    delete_thread_model_execution(
      where: { thread_model: { thread: { task: { problem_statement_id: { _eq: $id } } } } }
    ) { affected_rows }
    delete_thread_model_io(
      where: { thread_model: { thread: { task: { problem_statement_id: { _eq: $id } } } } }
    ) { affected_rows }
    delete_thread_model_parameter(
      where: { thread_model: { thread: { task: { problem_statement_id: { _eq: $id } } } } }
    ) { affected_rows }
    delete_thread_model(
      where: { thread: { task: { problem_statement_id: { _eq: $id } } } }
    ) { affected_rows }
    delete_thread(where: { task: { problem_statement_id: { _eq: $id } } }) {
      affected_rows
    }
    delete_task(where: { problem_statement_id: { _eq: $id } }) {
      affected_rows
    }
    delete_problem_statement_by_pk(id: $id) {
      id
    }
  }
`;

export function useDeleteProblemStatementMutation(
  baseOptions?: Apollo.MutationHookOptions<
    DeleteProblemStatementMutation,
    DeleteProblemStatementMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useMutation<
    DeleteProblemStatementMutation,
    DeleteProblemStatementMutationVariables
  >(DeleteProblemStatementDocument, options);
}

// ─── Mutation: InsertTask ─────────────────────────────────────────────────────

export type InsertTaskMutationVariables = {
  id: string;
  name: string;
  problemStatementId: string;
  startDate: string;
  endDate: string;
  regionId?: Maybe<string>;
};

export type InsertTaskMutation = {
  __typename?: 'mutation_root';
  insert_task?: {
    returning: { id: string; threads: { id: string }[] }[];
  } | null;
};

export const InsertTaskDocument = gql`
  mutation InsertTask(
    $id: String!
    $name: String!
    $problemStatementId: String!
    $startDate: date!
    $endDate: date!
    $regionId: String
  ) {
    insert_task(
      objects: [
        {
          id: $id
          name: $name
          problem_statement_id: $problemStatementId
          start_date: $startDate
          end_date: $endDate
          region_id: $regionId
        }
      ]
    ) {
      returning {
        id
        threads {
          id
        }
      }
    }
  }
`;

export function useInsertTaskMutation(
  baseOptions?: Apollo.MutationHookOptions<
    InsertTaskMutation,
    InsertTaskMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useMutation<InsertTaskMutation, InsertTaskMutationVariables>(
    InsertTaskDocument,
    options,
  );
}

// ─── Mutation: UpdateTask ─────────────────────────────────────────────────────

export type UpdateTaskMutationVariables = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  regionId?: Maybe<string>;
};

export type UpdateTaskMutation = {
  __typename?: 'mutation_root';
  update_task_by_pk?: { id: string } | null;
};

export const UpdateTaskDocument = gql`
  mutation UpdateTask(
    $id: String!
    $name: String!
    $startDate: date!
    $endDate: date!
    $regionId: String
  ) {
    update_task_by_pk(
      pk_columns: { id: $id }
      _set: {
        name: $name
        start_date: $startDate
        end_date: $endDate
        region_id: $regionId
      }
    ) {
      id
    }
  }
`;

export function useUpdateTaskMutation(
  baseOptions?: Apollo.MutationHookOptions<
    UpdateTaskMutation,
    UpdateTaskMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useMutation<UpdateTaskMutation, UpdateTaskMutationVariables>(
    UpdateTaskDocument,
    options,
  );
}

// ─── Mutation: DeleteTask ─────────────────────────────────────────────────────

export type DeleteTaskMutationVariables = {
  id: string;
};

export type DeleteTaskMutation = {
  __typename?: 'mutation_root';
  delete_task_by_pk?: { id: string } | null;
};

export const DeleteTaskDocument = gql`
  mutation DeleteTask($id: String!) {
    delete_thread_permission(
      where: { thread: { task_id: { _eq: $id } } }
    ) { affected_rows }
    delete_thread_provenance(
      where: { thread: { task_id: { _eq: $id } } }
    ) { affected_rows }
    delete_task_permission(where: { task_id: { _eq: $id } }) {
      affected_rows
    }
    delete_task_provenance(where: { task_id: { _eq: $id } }) {
      affected_rows
    }
    delete_thread_model_execution_summary(
      where: { thread_model: { thread: { task_id: { _eq: $id } } } }
    ) { affected_rows }
    delete_thread_model_execution(
      where: { thread_model: { thread: { task_id: { _eq: $id } } } }
    ) { affected_rows }
    delete_thread_model_io(
      where: { thread_model: { thread: { task_id: { _eq: $id } } } }
    ) { affected_rows }
    delete_thread_model_parameter(
      where: { thread_model: { thread: { task_id: { _eq: $id } } } }
    ) { affected_rows }
    delete_thread_model(
      where: { thread: { task_id: { _eq: $id } } }
    ) { affected_rows }
    delete_thread(where: { task_id: { _eq: $id } }) { affected_rows }
    delete_task_by_pk(id: $id) {
      id
    }
  }
`;

export function useDeleteTaskMutation(
  baseOptions?: Apollo.MutationHookOptions<
    DeleteTaskMutation,
    DeleteTaskMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useMutation<DeleteTaskMutation, DeleteTaskMutationVariables>(
    DeleteTaskDocument,
    options,
  );
}

// ─── Mutation: InsertTaskProvenance ──────────────────────────────────────────

export type InsertTaskProvenanceMutationVariables = {
  taskId: string;
  event: TaskEvents;
  userid: string;
  notes?: Maybe<string>;
};

export const InsertTaskProvenanceDocument = gql`
  mutation InsertTaskProvenance(
    $taskId: String!
    $event: task_events!
    $userid: String!
    $notes: String
  ) {
    insert_task_provenance_one(
      object: {
        task_id: $taskId
        event: $event
        userid: $userid
        notes: $notes
      }
    ) {
      task_id
    }
  }
`;

export function useInsertTaskProvenanceMutation(
  baseOptions?: Apollo.MutationHookOptions<unknown, InsertTaskProvenanceMutationVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useMutation<unknown, InsertTaskProvenanceMutationVariables>(
    InsertTaskProvenanceDocument,
    options,
  );
}

// ─── Mutation: InsertThread ───────────────────────────────────────────────────

export type InsertThreadMutationVariables = {
  id: string;
  name?: Maybe<string>;
  taskId: string;
  startDate: string;
  endDate: string;
  regionId?: Maybe<string>;
};

export type InsertThreadMutation = {
  __typename?: 'mutation_root';
  insert_thread?: {
    returning: { id: string }[];
  } | null;
};

export const InsertThreadDocument = gql`
  mutation InsertThread(
    $id: String!
    $name: String
    $taskId: String!
    $startDate: date!
    $endDate: date!
    $regionId: String
  ) {
    insert_thread(
      objects: [
        {
          id: $id
          name: $name
          task_id: $taskId
          start_date: $startDate
          end_date: $endDate
          region_id: $regionId
        }
      ]
    ) {
      returning {
        id
      }
    }
  }
`;

export function useInsertThreadMutation(
  baseOptions?: Apollo.MutationHookOptions<
    InsertThreadMutation,
    InsertThreadMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useMutation<InsertThreadMutation, InsertThreadMutationVariables>(
    InsertThreadDocument,
    options,
  );
}

// ─── Mutation: DeleteThread ───────────────────────────────────────────────────

export type DeleteThreadMutationVariables = {
  id: string;
};

export type DeleteThreadMutation = {
  __typename?: 'mutation_root';
  delete_thread_by_pk?: { id: string } | null;
};

export const DeleteThreadDocument = gql`
  mutation DeleteThread($id: String!) {
    delete_thread_permission(where: { thread_id: { _eq: $id } }) {
      affected_rows
    }
    delete_thread_provenance(where: { thread_id: { _eq: $id } }) {
      affected_rows
    }
    delete_thread_model_execution_summary(
      where: { thread_model: { thread_id: { _eq: $id } } }
    ) { affected_rows }
    delete_thread_model_execution(
      where: { thread_model: { thread_id: { _eq: $id } } }
    ) { affected_rows }
    delete_thread_model_io(
      where: { thread_model: { thread_id: { _eq: $id } } }
    ) { affected_rows }
    delete_thread_model_parameter(
      where: { thread_model: { thread_id: { _eq: $id } } }
    ) { affected_rows }
    delete_thread_model(where: { thread_id: { _eq: $id } }) {
      affected_rows
    }
    delete_thread_by_pk(id: $id) {
      id
    }
  }
`;

export function useDeleteThreadMutation(
  baseOptions?: Apollo.MutationHookOptions<
    DeleteThreadMutation,
    DeleteThreadMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useMutation<DeleteThreadMutation, DeleteThreadMutationVariables>(
    DeleteThreadDocument,
    options,
  );
}

// ─── Query: GetThread ─────────────────────────────────────────────────────────

export type GetThreadQueryVariables = {
  id: string;
};

export type GetThreadQuery = {
  __typename?: 'query_root';
  thread_by_pk?: Thread | null;
};

export const GetThreadDocument = gql`
  ${THREAD_INFO}
  query GetThread($id: String!) {
    thread_by_pk(id: $id) {
      ...thread_info
    }
  }
`;

export function useGetThreadQuery(
  baseOptions: Apollo.QueryHookOptions<GetThreadQuery, GetThreadQueryVariables> & {
    variables: GetThreadQueryVariables;
  },
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<GetThreadQuery, GetThreadQueryVariables>(
    GetThreadDocument,
    options,
  );
}

// ─── Mutation: UpdateThread ───────────────────────────────────────────────────

export type UpdateThreadMutationVariables = {
  id: string;
  name?: string | null;
  startDate: string;
  endDate: string;
  regionId?: string | null;
  drivingVariableId?: string | null;
  responseVariableId?: string | null;
};

export type UpdateThreadMutation = {
  update_thread_by_pk?: Pick<Thread, 'id'> | null;
};

export const UpdateThreadDocument = gql`
  mutation UpdateThread(
    $id: String!
    $name: String
    $startDate: date!
    $endDate: date!
    $regionId: String
    $drivingVariableId: String
    $responseVariableId: String
  ) {
    update_thread_by_pk(
      pk_columns: { id: $id }
      _set: {
        name: $name
        start_date: $startDate
        end_date: $endDate
        region_id: $regionId
        driving_variable_id: $drivingVariableId
        response_variable_id: $responseVariableId
      }
    ) {
      id
    }
  }
`;

export function useUpdateThreadMutation(
  baseOptions?: Apollo.MutationHookOptions<UpdateThreadMutation, UpdateThreadMutationVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useMutation<UpdateThreadMutation, UpdateThreadMutationVariables>(
    UpdateThreadDocument,
    options,
  );
}

// ─── Mutation: InsertThreadProvenance ─────────────────────────────────────────

export type InsertThreadProvenanceMutationVariables = {
  threadId: string;
  event: ThreadEvents;
  userid: string;
  notes?: string | null;
};

export type InsertThreadProvenanceMutation = {
  insert_thread_provenance_one?: { thread_id: string } | null;
};

export const InsertThreadProvenanceDocument = gql`
  mutation InsertThreadProvenance(
    $threadId: String!
    $event: thread_events_enum!
    $userid: String!
    $notes: String
  ) {
    insert_thread_provenance_one(
      object: {
        thread_id: $threadId
        event: $event
        userid: $userid
        notes: $notes
      }
    ) {
      thread_id
    }
  }
`;

export function useInsertThreadProvenanceMutation(
  baseOptions?: Apollo.MutationHookOptions<
    InsertThreadProvenanceMutation,
    InsertThreadProvenanceMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useMutation<InsertThreadProvenanceMutation, InsertThreadProvenanceMutationVariables>(
    InsertThreadProvenanceDocument,
    options,
  );
}

// ─── Thread data binding mutations ───────────────────────────────────────────
//
// Used by the MintDatasets step to write dataset selections into the database.
// Mirrors: ui/src/queries/thread/update-datasets.graphql

export type UpdateThreadDataMutationVariables = {
  threadId: string;
  event: {
    thread_id: string;
    event: string;
    userid: string;
    notes?: string | null;
  };
  data: Array<{
    thread_id: string;
    dataslice: {
      data: {
        id: string;
        name: string;
        region_id: string;
        start_date: string | null;
        end_date: string | null;
        resource_count: number;
        dataset: {
          data: { id: string; name: string };
          on_conflict: { constraint: string; update_columns: string[] };
        };
        resources: {
          data: Array<{
            resource: {
              data: {
                id: string;
                dcid?: string | null;
                name: string;
                url: string;
                start_date?: string | null;
                end_date?: string | null;
              };
              on_conflict: { constraint: string; update_columns: string[] };
            };
            selected: boolean;
          }>;
          on_conflict: { constraint: string; update_columns: string[] };
        };
      };
      on_conflict: { constraint: string; update_columns: string[] };
    };
  }>;
  modelIO: Array<{
    thread_model_id: string;
    model_io_id: string;
    dataslice_id: string;
  }>;
};

export type UpdateThreadDataMutation = {
  insert_thread_data?: { returning: Array<{ thread_id: string }> } | null;
  insert_thread_model_io?: { returning: Array<{ model_io_id: string }> } | null;
  insert_thread_provenance_one?: { thread_id: string } | null;
};

export const UpdateThreadDataDocument = gql`
  mutation UpdateThreadData(
    $threadId: String!
    $event: thread_provenance_insert_input!
    $data: [thread_data_insert_input!]!
    $modelIO: [thread_model_io_insert_input!]!
  ) {
    delete_thread_model_execution_summary(
      where: { thread_model: { thread_id: { _eq: $threadId } } }
    ) {
      affected_rows
    }
    delete_thread_model_execution(
      where: { thread_model: { thread_id: { _eq: $threadId } } }
    ) {
      affected_rows
    }
    delete_thread_model_io(
      where: { thread_model: { thread_id: { _eq: $threadId } } }
    ) {
      affected_rows
    }
    delete_thread_model_parameter(
      where: { thread_model: { thread_id: { _eq: $threadId } } }
    ) {
      affected_rows
    }
    delete_dataslice_resource(
      where: { dataslice: { thread_data: { thread_id: { _eq: $threadId } } } }
    ) {
      affected_rows
    }
    delete_dataslice(
      where: { thread_data: { thread_id: { _eq: $threadId } } }
    ) {
      affected_rows
    }
    delete_thread_data(where: { thread_id: { _eq: $threadId } }) {
      affected_rows
    }
    insert_thread_data(objects: $data) {
      returning {
        thread_id
      }
    }
    insert_thread_model_io(objects: $modelIO) {
      returning {
        model_io_id
      }
    }
    insert_thread_provenance_one(object: $event) {
      thread_id
    }
  }
`;

export function useUpdateThreadDataMutation(
  baseOptions?: Apollo.MutationHookOptions<
    UpdateThreadDataMutation,
    UpdateThreadDataMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useMutation<UpdateThreadDataMutation, UpdateThreadDataMutationVariables>(
    UpdateThreadDataDocument,
    options,
  );
}

// ─── ID generator (mirrors legacy GraphQL adapter) ────────────────────────────

/**
 * Generate a unique ID for new resources, matching the legacy format.
 * Legacy code used: `mint://` + type + `/` + random prefix
 */
export function generateModelingId(type: 'problem_statement' | 'task' | 'thread'): string {
  const rand = Math.random().toString(36).substring(2, 10);
  const ts = Date.now().toString(36);
  return `mint://${type}/${rand}${ts}`;
}
