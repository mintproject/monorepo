/* eslint-disable */
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  date: { input: any; output: any; }
  float8: { input: any; output: any; }
  geography: { input: any; output: any; }
  geometry: { input: any; output: any; }
  problem_statement_events: { input: any; output: any; }
  task_events: { input: any; output: any; }
  thread_events: { input: any; output: any; }
  timestamp: { input: any; output: any; }
  timestamptz: { input: any; output: any; }
  uuid: { input: any; output: any; }
};

/** Boolean expression to compare columns of type "Boolean". All fields are combined with logical 'AND'. */
export type Boolean_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['Boolean']['input']>;
  _gt?: InputMaybe<Scalars['Boolean']['input']>;
  _gte?: InputMaybe<Scalars['Boolean']['input']>;
  _in?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['Boolean']['input']>;
  _lte?: InputMaybe<Scalars['Boolean']['input']>;
  _neq?: InputMaybe<Scalars['Boolean']['input']>;
  _nin?: InputMaybe<Array<Scalars['Boolean']['input']>>;
};

/** Boolean expression to compare columns of type "Int". All fields are combined with logical 'AND'. */
export type Int_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['Int']['input']>;
  _gt?: InputMaybe<Scalars['Int']['input']>;
  _gte?: InputMaybe<Scalars['Int']['input']>;
  _in?: InputMaybe<Array<Scalars['Int']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['Int']['input']>;
  _lte?: InputMaybe<Scalars['Int']['input']>;
  _neq?: InputMaybe<Scalars['Int']['input']>;
  _nin?: InputMaybe<Array<Scalars['Int']['input']>>;
};

/** Boolean expression to compare columns of type "String". All fields are combined with logical 'AND'. */
export type String_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['String']['input']>;
  _gt?: InputMaybe<Scalars['String']['input']>;
  _gte?: InputMaybe<Scalars['String']['input']>;
  /** does the column match the given case-insensitive pattern */
  _ilike?: InputMaybe<Scalars['String']['input']>;
  _in?: InputMaybe<Array<Scalars['String']['input']>>;
  /** does the column match the given POSIX regular expression, case insensitive */
  _iregex?: InputMaybe<Scalars['String']['input']>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  /** does the column match the given pattern */
  _like?: InputMaybe<Scalars['String']['input']>;
  _lt?: InputMaybe<Scalars['String']['input']>;
  _lte?: InputMaybe<Scalars['String']['input']>;
  _neq?: InputMaybe<Scalars['String']['input']>;
  /** does the column NOT match the given case-insensitive pattern */
  _nilike?: InputMaybe<Scalars['String']['input']>;
  _nin?: InputMaybe<Array<Scalars['String']['input']>>;
  /** does the column NOT match the given POSIX regular expression, case insensitive */
  _niregex?: InputMaybe<Scalars['String']['input']>;
  /** does the column NOT match the given pattern */
  _nlike?: InputMaybe<Scalars['String']['input']>;
  /** does the column NOT match the given POSIX regular expression, case sensitive */
  _nregex?: InputMaybe<Scalars['String']['input']>;
  /** does the column NOT match the given SQL regular expression */
  _nsimilar?: InputMaybe<Scalars['String']['input']>;
  /** does the column match the given POSIX regular expression, case sensitive */
  _regex?: InputMaybe<Scalars['String']['input']>;
  /** does the column match the given SQL regular expression */
  _similar?: InputMaybe<Scalars['String']['input']>;
};

/** columns and relationships of "dataset" */
export type Dataset = {
  __typename?: 'dataset';
  categories?: Maybe<Scalars['String']['output']>;
  /** An array relationship */
  dataslices: Array<Dataslice>;
  /** An aggregate relationship */
  dataslices_aggregate: Dataslice_Aggregate;
  datatype?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  end_date?: Maybe<Scalars['date']['output']>;
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
  spatial_coverage?: Maybe<Scalars['geometry']['output']>;
  start_date?: Maybe<Scalars['date']['output']>;
};


/** columns and relationships of "dataset" */
export type DatasetDataslicesArgs = {
  distinct_on?: InputMaybe<Array<Dataslice_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Dataslice_Order_By>>;
  where?: InputMaybe<Dataslice_Bool_Exp>;
};


/** columns and relationships of "dataset" */
export type DatasetDataslices_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Dataslice_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Dataslice_Order_By>>;
  where?: InputMaybe<Dataslice_Bool_Exp>;
};

/** aggregated selection of "dataset" */
export type Dataset_Aggregate = {
  __typename?: 'dataset_aggregate';
  aggregate?: Maybe<Dataset_Aggregate_Fields>;
  nodes: Array<Dataset>;
};

/** aggregate fields of "dataset" */
export type Dataset_Aggregate_Fields = {
  __typename?: 'dataset_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Dataset_Max_Fields>;
  min?: Maybe<Dataset_Min_Fields>;
};


/** aggregate fields of "dataset" */
export type Dataset_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Dataset_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "dataset". All fields are combined with a logical 'AND'. */
export type Dataset_Bool_Exp = {
  _and?: InputMaybe<Array<Dataset_Bool_Exp>>;
  _not?: InputMaybe<Dataset_Bool_Exp>;
  _or?: InputMaybe<Array<Dataset_Bool_Exp>>;
  categories?: InputMaybe<String_Comparison_Exp>;
  dataslices?: InputMaybe<Dataslice_Bool_Exp>;
  datatype?: InputMaybe<String_Comparison_Exp>;
  description?: InputMaybe<String_Comparison_Exp>;
  end_date?: InputMaybe<Date_Comparison_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  spatial_coverage?: InputMaybe<Geometry_Comparison_Exp>;
  start_date?: InputMaybe<Date_Comparison_Exp>;
};

/** unique or primary key constraints on table "dataset" */
export enum Dataset_Constraint {
  /** unique or primary key constraint on columns "id" */
  DatasetPkey = 'dataset_pkey'
}

/** input type for inserting data into table "dataset" */
export type Dataset_Insert_Input = {
  categories?: InputMaybe<Scalars['String']['input']>;
  dataslices?: InputMaybe<Dataslice_Arr_Rel_Insert_Input>;
  datatype?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  end_date?: InputMaybe<Scalars['date']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  spatial_coverage?: InputMaybe<Scalars['geometry']['input']>;
  start_date?: InputMaybe<Scalars['date']['input']>;
};

/** aggregate max on columns */
export type Dataset_Max_Fields = {
  __typename?: 'dataset_max_fields';
  categories?: Maybe<Scalars['String']['output']>;
  datatype?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  end_date?: Maybe<Scalars['date']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  start_date?: Maybe<Scalars['date']['output']>;
};

/** aggregate min on columns */
export type Dataset_Min_Fields = {
  __typename?: 'dataset_min_fields';
  categories?: Maybe<Scalars['String']['output']>;
  datatype?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  end_date?: Maybe<Scalars['date']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  start_date?: Maybe<Scalars['date']['output']>;
};

/** response of any mutation on the table "dataset" */
export type Dataset_Mutation_Response = {
  __typename?: 'dataset_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Dataset>;
};

/** input type for inserting object relation for remote table "dataset" */
export type Dataset_Obj_Rel_Insert_Input = {
  data: Dataset_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Dataset_On_Conflict>;
};

/** on_conflict condition type for table "dataset" */
export type Dataset_On_Conflict = {
  constraint: Dataset_Constraint;
  update_columns?: Array<Dataset_Update_Column>;
  where?: InputMaybe<Dataset_Bool_Exp>;
};

/** Ordering options when selecting data from "dataset". */
export type Dataset_Order_By = {
  categories?: InputMaybe<Order_By>;
  dataslices_aggregate?: InputMaybe<Dataslice_Aggregate_Order_By>;
  datatype?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  end_date?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  spatial_coverage?: InputMaybe<Order_By>;
  start_date?: InputMaybe<Order_By>;
};

/** primary key columns input for table: dataset */
export type Dataset_Pk_Columns_Input = {
  id: Scalars['String']['input'];
};

/** select columns of table "dataset" */
export enum Dataset_Select_Column {
  /** column name */
  Categories = 'categories',
  /** column name */
  Datatype = 'datatype',
  /** column name */
  Description = 'description',
  /** column name */
  EndDate = 'end_date',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  SpatialCoverage = 'spatial_coverage',
  /** column name */
  StartDate = 'start_date'
}

/** input type for updating data in table "dataset" */
export type Dataset_Set_Input = {
  categories?: InputMaybe<Scalars['String']['input']>;
  datatype?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  end_date?: InputMaybe<Scalars['date']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  spatial_coverage?: InputMaybe<Scalars['geometry']['input']>;
  start_date?: InputMaybe<Scalars['date']['input']>;
};

/** update columns of table "dataset" */
export enum Dataset_Update_Column {
  /** column name */
  Categories = 'categories',
  /** column name */
  Datatype = 'datatype',
  /** column name */
  Description = 'description',
  /** column name */
  EndDate = 'end_date',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  SpatialCoverage = 'spatial_coverage',
  /** column name */
  StartDate = 'start_date'
}

export type Dataset_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Dataset_Set_Input>;
  where: Dataset_Bool_Exp;
};

/** columns and relationships of "dataslice" */
export type Dataslice = {
  __typename?: 'dataslice';
  /** An object relationship */
  dataset: Dataset;
  dataset_id: Scalars['String']['output'];
  end_date: Scalars['date']['output'];
  id: Scalars['uuid']['output'];
  name: Scalars['String']['output'];
  /** An object relationship */
  region: Region;
  region_id: Scalars['String']['output'];
  resource_count: Scalars['Int']['output'];
  /** An array relationship */
  resources: Array<Dataslice_Resource>;
  /** An aggregate relationship */
  resources_aggregate: Dataslice_Resource_Aggregate;
  start_date: Scalars['date']['output'];
  /** An array relationship */
  thread_data: Array<Thread_Data>;
  /** An aggregate relationship */
  thread_data_aggregate: Thread_Data_Aggregate;
  /** An array relationship */
  thread_model_ios: Array<Thread_Model_Io>;
  /** An aggregate relationship */
  thread_model_ios_aggregate: Thread_Model_Io_Aggregate;
};


/** columns and relationships of "dataslice" */
export type DatasliceResourcesArgs = {
  distinct_on?: InputMaybe<Array<Dataslice_Resource_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Dataslice_Resource_Order_By>>;
  where?: InputMaybe<Dataslice_Resource_Bool_Exp>;
};


/** columns and relationships of "dataslice" */
export type DatasliceResources_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Dataslice_Resource_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Dataslice_Resource_Order_By>>;
  where?: InputMaybe<Dataslice_Resource_Bool_Exp>;
};


/** columns and relationships of "dataslice" */
export type DatasliceThread_DataArgs = {
  distinct_on?: InputMaybe<Array<Thread_Data_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Data_Order_By>>;
  where?: InputMaybe<Thread_Data_Bool_Exp>;
};


/** columns and relationships of "dataslice" */
export type DatasliceThread_Data_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Data_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Data_Order_By>>;
  where?: InputMaybe<Thread_Data_Bool_Exp>;
};


/** columns and relationships of "dataslice" */
export type DatasliceThread_Model_IosArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Io_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Io_Order_By>>;
  where?: InputMaybe<Thread_Model_Io_Bool_Exp>;
};


/** columns and relationships of "dataslice" */
export type DatasliceThread_Model_Ios_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Io_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Io_Order_By>>;
  where?: InputMaybe<Thread_Model_Io_Bool_Exp>;
};

/** aggregated selection of "dataslice" */
export type Dataslice_Aggregate = {
  __typename?: 'dataslice_aggregate';
  aggregate?: Maybe<Dataslice_Aggregate_Fields>;
  nodes: Array<Dataslice>;
};

/** aggregate fields of "dataslice" */
export type Dataslice_Aggregate_Fields = {
  __typename?: 'dataslice_aggregate_fields';
  avg?: Maybe<Dataslice_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Dataslice_Max_Fields>;
  min?: Maybe<Dataslice_Min_Fields>;
  stddev?: Maybe<Dataslice_Stddev_Fields>;
  stddev_pop?: Maybe<Dataslice_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Dataslice_Stddev_Samp_Fields>;
  sum?: Maybe<Dataslice_Sum_Fields>;
  var_pop?: Maybe<Dataslice_Var_Pop_Fields>;
  var_samp?: Maybe<Dataslice_Var_Samp_Fields>;
  variance?: Maybe<Dataslice_Variance_Fields>;
};


/** aggregate fields of "dataslice" */
export type Dataslice_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Dataslice_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "dataslice" */
export type Dataslice_Aggregate_Order_By = {
  avg?: InputMaybe<Dataslice_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Dataslice_Max_Order_By>;
  min?: InputMaybe<Dataslice_Min_Order_By>;
  stddev?: InputMaybe<Dataslice_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Dataslice_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Dataslice_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Dataslice_Sum_Order_By>;
  var_pop?: InputMaybe<Dataslice_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Dataslice_Var_Samp_Order_By>;
  variance?: InputMaybe<Dataslice_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "dataslice" */
export type Dataslice_Arr_Rel_Insert_Input = {
  data: Array<Dataslice_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Dataslice_On_Conflict>;
};

/** aggregate avg on columns */
export type Dataslice_Avg_Fields = {
  __typename?: 'dataslice_avg_fields';
  resource_count?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "dataslice" */
export type Dataslice_Avg_Order_By = {
  resource_count?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "dataslice". All fields are combined with a logical 'AND'. */
export type Dataslice_Bool_Exp = {
  _and?: InputMaybe<Array<Dataslice_Bool_Exp>>;
  _not?: InputMaybe<Dataslice_Bool_Exp>;
  _or?: InputMaybe<Array<Dataslice_Bool_Exp>>;
  dataset?: InputMaybe<Dataset_Bool_Exp>;
  dataset_id?: InputMaybe<String_Comparison_Exp>;
  end_date?: InputMaybe<Date_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  region?: InputMaybe<Region_Bool_Exp>;
  region_id?: InputMaybe<String_Comparison_Exp>;
  resource_count?: InputMaybe<Int_Comparison_Exp>;
  resources?: InputMaybe<Dataslice_Resource_Bool_Exp>;
  start_date?: InputMaybe<Date_Comparison_Exp>;
  thread_data?: InputMaybe<Thread_Data_Bool_Exp>;
  thread_model_ios?: InputMaybe<Thread_Model_Io_Bool_Exp>;
};

/** unique or primary key constraints on table "dataslice" */
export enum Dataslice_Constraint {
  /** unique or primary key constraint on columns "id" */
  DataslicePkey = 'dataslice_pkey'
}

/** input type for incrementing numeric columns in table "dataslice" */
export type Dataslice_Inc_Input = {
  resource_count?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "dataslice" */
export type Dataslice_Insert_Input = {
  dataset?: InputMaybe<Dataset_Obj_Rel_Insert_Input>;
  dataset_id?: InputMaybe<Scalars['String']['input']>;
  end_date?: InputMaybe<Scalars['date']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  region?: InputMaybe<Region_Obj_Rel_Insert_Input>;
  region_id?: InputMaybe<Scalars['String']['input']>;
  resource_count?: InputMaybe<Scalars['Int']['input']>;
  resources?: InputMaybe<Dataslice_Resource_Arr_Rel_Insert_Input>;
  start_date?: InputMaybe<Scalars['date']['input']>;
  thread_data?: InputMaybe<Thread_Data_Arr_Rel_Insert_Input>;
  thread_model_ios?: InputMaybe<Thread_Model_Io_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type Dataslice_Max_Fields = {
  __typename?: 'dataslice_max_fields';
  dataset_id?: Maybe<Scalars['String']['output']>;
  end_date?: Maybe<Scalars['date']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  region_id?: Maybe<Scalars['String']['output']>;
  resource_count?: Maybe<Scalars['Int']['output']>;
  start_date?: Maybe<Scalars['date']['output']>;
};

/** order by max() on columns of table "dataslice" */
export type Dataslice_Max_Order_By = {
  dataset_id?: InputMaybe<Order_By>;
  end_date?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  region_id?: InputMaybe<Order_By>;
  resource_count?: InputMaybe<Order_By>;
  start_date?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Dataslice_Min_Fields = {
  __typename?: 'dataslice_min_fields';
  dataset_id?: Maybe<Scalars['String']['output']>;
  end_date?: Maybe<Scalars['date']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  region_id?: Maybe<Scalars['String']['output']>;
  resource_count?: Maybe<Scalars['Int']['output']>;
  start_date?: Maybe<Scalars['date']['output']>;
};

/** order by min() on columns of table "dataslice" */
export type Dataslice_Min_Order_By = {
  dataset_id?: InputMaybe<Order_By>;
  end_date?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  region_id?: InputMaybe<Order_By>;
  resource_count?: InputMaybe<Order_By>;
  start_date?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "dataslice" */
export type Dataslice_Mutation_Response = {
  __typename?: 'dataslice_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Dataslice>;
};

/** input type for inserting object relation for remote table "dataslice" */
export type Dataslice_Obj_Rel_Insert_Input = {
  data: Dataslice_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Dataslice_On_Conflict>;
};

/** on_conflict condition type for table "dataslice" */
export type Dataslice_On_Conflict = {
  constraint: Dataslice_Constraint;
  update_columns?: Array<Dataslice_Update_Column>;
  where?: InputMaybe<Dataslice_Bool_Exp>;
};

/** Ordering options when selecting data from "dataslice". */
export type Dataslice_Order_By = {
  dataset?: InputMaybe<Dataset_Order_By>;
  dataset_id?: InputMaybe<Order_By>;
  end_date?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  region?: InputMaybe<Region_Order_By>;
  region_id?: InputMaybe<Order_By>;
  resource_count?: InputMaybe<Order_By>;
  resources_aggregate?: InputMaybe<Dataslice_Resource_Aggregate_Order_By>;
  start_date?: InputMaybe<Order_By>;
  thread_data_aggregate?: InputMaybe<Thread_Data_Aggregate_Order_By>;
  thread_model_ios_aggregate?: InputMaybe<Thread_Model_Io_Aggregate_Order_By>;
};

/** primary key columns input for table: dataslice */
export type Dataslice_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** columns and relationships of "dataslice_resource" */
export type Dataslice_Resource = {
  __typename?: 'dataslice_resource';
  /** An object relationship */
  dataslice: Dataslice;
  dataslice_id: Scalars['uuid']['output'];
  /** An object relationship */
  resource: Resource;
  resource_id: Scalars['String']['output'];
  selected: Scalars['Boolean']['output'];
};

/** aggregated selection of "dataslice_resource" */
export type Dataslice_Resource_Aggregate = {
  __typename?: 'dataslice_resource_aggregate';
  aggregate?: Maybe<Dataslice_Resource_Aggregate_Fields>;
  nodes: Array<Dataslice_Resource>;
};

/** aggregate fields of "dataslice_resource" */
export type Dataslice_Resource_Aggregate_Fields = {
  __typename?: 'dataslice_resource_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Dataslice_Resource_Max_Fields>;
  min?: Maybe<Dataslice_Resource_Min_Fields>;
};


/** aggregate fields of "dataslice_resource" */
export type Dataslice_Resource_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Dataslice_Resource_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "dataslice_resource" */
export type Dataslice_Resource_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Dataslice_Resource_Max_Order_By>;
  min?: InputMaybe<Dataslice_Resource_Min_Order_By>;
};

/** input type for inserting array relation for remote table "dataslice_resource" */
export type Dataslice_Resource_Arr_Rel_Insert_Input = {
  data: Array<Dataslice_Resource_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Dataslice_Resource_On_Conflict>;
};

/** Boolean expression to filter rows from the table "dataslice_resource". All fields are combined with a logical 'AND'. */
export type Dataslice_Resource_Bool_Exp = {
  _and?: InputMaybe<Array<Dataslice_Resource_Bool_Exp>>;
  _not?: InputMaybe<Dataslice_Resource_Bool_Exp>;
  _or?: InputMaybe<Array<Dataslice_Resource_Bool_Exp>>;
  dataslice?: InputMaybe<Dataslice_Bool_Exp>;
  dataslice_id?: InputMaybe<Uuid_Comparison_Exp>;
  resource?: InputMaybe<Resource_Bool_Exp>;
  resource_id?: InputMaybe<String_Comparison_Exp>;
  selected?: InputMaybe<Boolean_Comparison_Exp>;
};

/** unique or primary key constraints on table "dataslice_resource" */
export enum Dataslice_Resource_Constraint {
  /** unique or primary key constraint on columns "dataslice_id", "resource_id" */
  DatasliceResourcePkey = 'dataslice_resource_pkey'
}

/** input type for inserting data into table "dataslice_resource" */
export type Dataslice_Resource_Insert_Input = {
  dataslice?: InputMaybe<Dataslice_Obj_Rel_Insert_Input>;
  dataslice_id?: InputMaybe<Scalars['uuid']['input']>;
  resource?: InputMaybe<Resource_Obj_Rel_Insert_Input>;
  resource_id?: InputMaybe<Scalars['String']['input']>;
  selected?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate max on columns */
export type Dataslice_Resource_Max_Fields = {
  __typename?: 'dataslice_resource_max_fields';
  dataslice_id?: Maybe<Scalars['uuid']['output']>;
  resource_id?: Maybe<Scalars['String']['output']>;
};

/** order by max() on columns of table "dataslice_resource" */
export type Dataslice_Resource_Max_Order_By = {
  dataslice_id?: InputMaybe<Order_By>;
  resource_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Dataslice_Resource_Min_Fields = {
  __typename?: 'dataslice_resource_min_fields';
  dataslice_id?: Maybe<Scalars['uuid']['output']>;
  resource_id?: Maybe<Scalars['String']['output']>;
};

/** order by min() on columns of table "dataslice_resource" */
export type Dataslice_Resource_Min_Order_By = {
  dataslice_id?: InputMaybe<Order_By>;
  resource_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "dataslice_resource" */
export type Dataslice_Resource_Mutation_Response = {
  __typename?: 'dataslice_resource_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Dataslice_Resource>;
};

/** on_conflict condition type for table "dataslice_resource" */
export type Dataslice_Resource_On_Conflict = {
  constraint: Dataslice_Resource_Constraint;
  update_columns?: Array<Dataslice_Resource_Update_Column>;
  where?: InputMaybe<Dataslice_Resource_Bool_Exp>;
};

/** Ordering options when selecting data from "dataslice_resource". */
export type Dataslice_Resource_Order_By = {
  dataslice?: InputMaybe<Dataslice_Order_By>;
  dataslice_id?: InputMaybe<Order_By>;
  resource?: InputMaybe<Resource_Order_By>;
  resource_id?: InputMaybe<Order_By>;
  selected?: InputMaybe<Order_By>;
};

/** primary key columns input for table: dataslice_resource */
export type Dataslice_Resource_Pk_Columns_Input = {
  dataslice_id: Scalars['uuid']['input'];
  resource_id: Scalars['String']['input'];
};

/** select columns of table "dataslice_resource" */
export enum Dataslice_Resource_Select_Column {
  /** column name */
  DatasliceId = 'dataslice_id',
  /** column name */
  ResourceId = 'resource_id',
  /** column name */
  Selected = 'selected'
}

/** input type for updating data in table "dataslice_resource" */
export type Dataslice_Resource_Set_Input = {
  dataslice_id?: InputMaybe<Scalars['uuid']['input']>;
  resource_id?: InputMaybe<Scalars['String']['input']>;
  selected?: InputMaybe<Scalars['Boolean']['input']>;
};

/** update columns of table "dataslice_resource" */
export enum Dataslice_Resource_Update_Column {
  /** column name */
  DatasliceId = 'dataslice_id',
  /** column name */
  ResourceId = 'resource_id',
  /** column name */
  Selected = 'selected'
}

export type Dataslice_Resource_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Dataslice_Resource_Set_Input>;
  where: Dataslice_Resource_Bool_Exp;
};

/** select columns of table "dataslice" */
export enum Dataslice_Select_Column {
  /** column name */
  DatasetId = 'dataset_id',
  /** column name */
  EndDate = 'end_date',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  RegionId = 'region_id',
  /** column name */
  ResourceCount = 'resource_count',
  /** column name */
  StartDate = 'start_date'
}

/** input type for updating data in table "dataslice" */
export type Dataslice_Set_Input = {
  dataset_id?: InputMaybe<Scalars['String']['input']>;
  end_date?: InputMaybe<Scalars['date']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  region_id?: InputMaybe<Scalars['String']['input']>;
  resource_count?: InputMaybe<Scalars['Int']['input']>;
  start_date?: InputMaybe<Scalars['date']['input']>;
};

/** aggregate stddev on columns */
export type Dataslice_Stddev_Fields = {
  __typename?: 'dataslice_stddev_fields';
  resource_count?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "dataslice" */
export type Dataslice_Stddev_Order_By = {
  resource_count?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Dataslice_Stddev_Pop_Fields = {
  __typename?: 'dataslice_stddev_pop_fields';
  resource_count?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "dataslice" */
export type Dataslice_Stddev_Pop_Order_By = {
  resource_count?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Dataslice_Stddev_Samp_Fields = {
  __typename?: 'dataslice_stddev_samp_fields';
  resource_count?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "dataslice" */
export type Dataslice_Stddev_Samp_Order_By = {
  resource_count?: InputMaybe<Order_By>;
};

/** aggregate sum on columns */
export type Dataslice_Sum_Fields = {
  __typename?: 'dataslice_sum_fields';
  resource_count?: Maybe<Scalars['Int']['output']>;
};

/** order by sum() on columns of table "dataslice" */
export type Dataslice_Sum_Order_By = {
  resource_count?: InputMaybe<Order_By>;
};

/** update columns of table "dataslice" */
export enum Dataslice_Update_Column {
  /** column name */
  DatasetId = 'dataset_id',
  /** column name */
  EndDate = 'end_date',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  RegionId = 'region_id',
  /** column name */
  ResourceCount = 'resource_count',
  /** column name */
  StartDate = 'start_date'
}

export type Dataslice_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Dataslice_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Dataslice_Set_Input>;
  where: Dataslice_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Dataslice_Var_Pop_Fields = {
  __typename?: 'dataslice_var_pop_fields';
  resource_count?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "dataslice" */
export type Dataslice_Var_Pop_Order_By = {
  resource_count?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Dataslice_Var_Samp_Fields = {
  __typename?: 'dataslice_var_samp_fields';
  resource_count?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "dataslice" */
export type Dataslice_Var_Samp_Order_By = {
  resource_count?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Dataslice_Variance_Fields = {
  __typename?: 'dataslice_variance_fields';
  resource_count?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "dataslice" */
export type Dataslice_Variance_Order_By = {
  resource_count?: InputMaybe<Order_By>;
};

/** Boolean expression to compare columns of type "date". All fields are combined with logical 'AND'. */
export type Date_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['date']['input']>;
  _gt?: InputMaybe<Scalars['date']['input']>;
  _gte?: InputMaybe<Scalars['date']['input']>;
  _in?: InputMaybe<Array<Scalars['date']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['date']['input']>;
  _lte?: InputMaybe<Scalars['date']['input']>;
  _neq?: InputMaybe<Scalars['date']['input']>;
  _nin?: InputMaybe<Array<Scalars['date']['input']>>;
};

/** columns and relationships of "execution" */
export type Execution = {
  __typename?: 'execution';
  /** An array relationship */
  data_bindings: Array<Execution_Data_Binding>;
  /** An aggregate relationship */
  data_bindings_aggregate: Execution_Data_Binding_Aggregate;
  end_time?: Maybe<Scalars['timestamp']['output']>;
  execution_engine?: Maybe<Scalars['String']['output']>;
  id: Scalars['uuid']['output'];
  /** An object relationship */
  model: Model;
  model_id: Scalars['String']['output'];
  /** An array relationship */
  parameter_bindings: Array<Execution_Parameter_Binding>;
  /** An aggregate relationship */
  parameter_bindings_aggregate: Execution_Parameter_Binding_Aggregate;
  /** An array relationship */
  results: Array<Execution_Result>;
  /** An aggregate relationship */
  results_aggregate: Execution_Result_Aggregate;
  run_id?: Maybe<Scalars['String']['output']>;
  run_progress: Scalars['float8']['output'];
  start_time?: Maybe<Scalars['timestamp']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  /** An array relationship */
  thread_model_executions: Array<Thread_Model_Execution>;
  /** An aggregate relationship */
  thread_model_executions_aggregate: Thread_Model_Execution_Aggregate;
};


/** columns and relationships of "execution" */
export type ExecutionData_BindingsArgs = {
  distinct_on?: InputMaybe<Array<Execution_Data_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Data_Binding_Order_By>>;
  where?: InputMaybe<Execution_Data_Binding_Bool_Exp>;
};


/** columns and relationships of "execution" */
export type ExecutionData_Bindings_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Execution_Data_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Data_Binding_Order_By>>;
  where?: InputMaybe<Execution_Data_Binding_Bool_Exp>;
};


/** columns and relationships of "execution" */
export type ExecutionParameter_BindingsArgs = {
  distinct_on?: InputMaybe<Array<Execution_Parameter_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Parameter_Binding_Order_By>>;
  where?: InputMaybe<Execution_Parameter_Binding_Bool_Exp>;
};


/** columns and relationships of "execution" */
export type ExecutionParameter_Bindings_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Execution_Parameter_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Parameter_Binding_Order_By>>;
  where?: InputMaybe<Execution_Parameter_Binding_Bool_Exp>;
};


/** columns and relationships of "execution" */
export type ExecutionResultsArgs = {
  distinct_on?: InputMaybe<Array<Execution_Result_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Result_Order_By>>;
  where?: InputMaybe<Execution_Result_Bool_Exp>;
};


/** columns and relationships of "execution" */
export type ExecutionResults_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Execution_Result_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Result_Order_By>>;
  where?: InputMaybe<Execution_Result_Bool_Exp>;
};


/** columns and relationships of "execution" */
export type ExecutionThread_Model_ExecutionsArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Execution_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Execution_Order_By>>;
  where?: InputMaybe<Thread_Model_Execution_Bool_Exp>;
};


/** columns and relationships of "execution" */
export type ExecutionThread_Model_Executions_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Execution_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Execution_Order_By>>;
  where?: InputMaybe<Thread_Model_Execution_Bool_Exp>;
};

/** aggregated selection of "execution" */
export type Execution_Aggregate = {
  __typename?: 'execution_aggregate';
  aggregate?: Maybe<Execution_Aggregate_Fields>;
  nodes: Array<Execution>;
};

/** aggregate fields of "execution" */
export type Execution_Aggregate_Fields = {
  __typename?: 'execution_aggregate_fields';
  avg?: Maybe<Execution_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Execution_Max_Fields>;
  min?: Maybe<Execution_Min_Fields>;
  stddev?: Maybe<Execution_Stddev_Fields>;
  stddev_pop?: Maybe<Execution_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Execution_Stddev_Samp_Fields>;
  sum?: Maybe<Execution_Sum_Fields>;
  var_pop?: Maybe<Execution_Var_Pop_Fields>;
  var_samp?: Maybe<Execution_Var_Samp_Fields>;
  variance?: Maybe<Execution_Variance_Fields>;
};


/** aggregate fields of "execution" */
export type Execution_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Execution_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "execution" */
export type Execution_Aggregate_Order_By = {
  avg?: InputMaybe<Execution_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Execution_Max_Order_By>;
  min?: InputMaybe<Execution_Min_Order_By>;
  stddev?: InputMaybe<Execution_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Execution_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Execution_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Execution_Sum_Order_By>;
  var_pop?: InputMaybe<Execution_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Execution_Var_Samp_Order_By>;
  variance?: InputMaybe<Execution_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "execution" */
export type Execution_Arr_Rel_Insert_Input = {
  data: Array<Execution_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Execution_On_Conflict>;
};

/** aggregate avg on columns */
export type Execution_Avg_Fields = {
  __typename?: 'execution_avg_fields';
  run_progress?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "execution" */
export type Execution_Avg_Order_By = {
  run_progress?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "execution". All fields are combined with a logical 'AND'. */
export type Execution_Bool_Exp = {
  _and?: InputMaybe<Array<Execution_Bool_Exp>>;
  _not?: InputMaybe<Execution_Bool_Exp>;
  _or?: InputMaybe<Array<Execution_Bool_Exp>>;
  data_bindings?: InputMaybe<Execution_Data_Binding_Bool_Exp>;
  end_time?: InputMaybe<Timestamp_Comparison_Exp>;
  execution_engine?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  model?: InputMaybe<Model_Bool_Exp>;
  model_id?: InputMaybe<String_Comparison_Exp>;
  parameter_bindings?: InputMaybe<Execution_Parameter_Binding_Bool_Exp>;
  results?: InputMaybe<Execution_Result_Bool_Exp>;
  run_id?: InputMaybe<String_Comparison_Exp>;
  run_progress?: InputMaybe<Float8_Comparison_Exp>;
  start_time?: InputMaybe<Timestamp_Comparison_Exp>;
  status?: InputMaybe<String_Comparison_Exp>;
  thread_model_executions?: InputMaybe<Thread_Model_Execution_Bool_Exp>;
};

/** unique or primary key constraints on table "execution" */
export enum Execution_Constraint {
  /** unique or primary key constraint on columns "id" */
  ExecutionPkey = 'execution_pkey'
}

/** columns and relationships of "execution_data_binding" */
export type Execution_Data_Binding = {
  __typename?: 'execution_data_binding';
  /** An object relationship */
  execution: Execution;
  execution_id: Scalars['uuid']['output'];
  /** An object relationship */
  model_io: Model_Io;
  model_io_id: Scalars['String']['output'];
  /** An object relationship */
  resource: Resource;
  resource_id: Scalars['String']['output'];
};

/** aggregated selection of "execution_data_binding" */
export type Execution_Data_Binding_Aggregate = {
  __typename?: 'execution_data_binding_aggregate';
  aggregate?: Maybe<Execution_Data_Binding_Aggregate_Fields>;
  nodes: Array<Execution_Data_Binding>;
};

/** aggregate fields of "execution_data_binding" */
export type Execution_Data_Binding_Aggregate_Fields = {
  __typename?: 'execution_data_binding_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Execution_Data_Binding_Max_Fields>;
  min?: Maybe<Execution_Data_Binding_Min_Fields>;
};


/** aggregate fields of "execution_data_binding" */
export type Execution_Data_Binding_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Execution_Data_Binding_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "execution_data_binding" */
export type Execution_Data_Binding_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Execution_Data_Binding_Max_Order_By>;
  min?: InputMaybe<Execution_Data_Binding_Min_Order_By>;
};

/** input type for inserting array relation for remote table "execution_data_binding" */
export type Execution_Data_Binding_Arr_Rel_Insert_Input = {
  data: Array<Execution_Data_Binding_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Execution_Data_Binding_On_Conflict>;
};

/** Boolean expression to filter rows from the table "execution_data_binding". All fields are combined with a logical 'AND'. */
export type Execution_Data_Binding_Bool_Exp = {
  _and?: InputMaybe<Array<Execution_Data_Binding_Bool_Exp>>;
  _not?: InputMaybe<Execution_Data_Binding_Bool_Exp>;
  _or?: InputMaybe<Array<Execution_Data_Binding_Bool_Exp>>;
  execution?: InputMaybe<Execution_Bool_Exp>;
  execution_id?: InputMaybe<Uuid_Comparison_Exp>;
  model_io?: InputMaybe<Model_Io_Bool_Exp>;
  model_io_id?: InputMaybe<String_Comparison_Exp>;
  resource?: InputMaybe<Resource_Bool_Exp>;
  resource_id?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "execution_data_binding" */
export enum Execution_Data_Binding_Constraint {
  /** unique or primary key constraint on columns "execution_id", "resource_id", "model_io_id" */
  ExecutionDataBindingPkey = 'execution_data_binding_pkey'
}

/** input type for inserting data into table "execution_data_binding" */
export type Execution_Data_Binding_Insert_Input = {
  execution?: InputMaybe<Execution_Obj_Rel_Insert_Input>;
  execution_id?: InputMaybe<Scalars['uuid']['input']>;
  model_io?: InputMaybe<Model_Io_Obj_Rel_Insert_Input>;
  model_io_id?: InputMaybe<Scalars['String']['input']>;
  resource?: InputMaybe<Resource_Obj_Rel_Insert_Input>;
  resource_id?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Execution_Data_Binding_Max_Fields = {
  __typename?: 'execution_data_binding_max_fields';
  execution_id?: Maybe<Scalars['uuid']['output']>;
  model_io_id?: Maybe<Scalars['String']['output']>;
  resource_id?: Maybe<Scalars['String']['output']>;
};

/** order by max() on columns of table "execution_data_binding" */
export type Execution_Data_Binding_Max_Order_By = {
  execution_id?: InputMaybe<Order_By>;
  model_io_id?: InputMaybe<Order_By>;
  resource_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Execution_Data_Binding_Min_Fields = {
  __typename?: 'execution_data_binding_min_fields';
  execution_id?: Maybe<Scalars['uuid']['output']>;
  model_io_id?: Maybe<Scalars['String']['output']>;
  resource_id?: Maybe<Scalars['String']['output']>;
};

/** order by min() on columns of table "execution_data_binding" */
export type Execution_Data_Binding_Min_Order_By = {
  execution_id?: InputMaybe<Order_By>;
  model_io_id?: InputMaybe<Order_By>;
  resource_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "execution_data_binding" */
export type Execution_Data_Binding_Mutation_Response = {
  __typename?: 'execution_data_binding_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Execution_Data_Binding>;
};

/** on_conflict condition type for table "execution_data_binding" */
export type Execution_Data_Binding_On_Conflict = {
  constraint: Execution_Data_Binding_Constraint;
  update_columns?: Array<Execution_Data_Binding_Update_Column>;
  where?: InputMaybe<Execution_Data_Binding_Bool_Exp>;
};

/** Ordering options when selecting data from "execution_data_binding". */
export type Execution_Data_Binding_Order_By = {
  execution?: InputMaybe<Execution_Order_By>;
  execution_id?: InputMaybe<Order_By>;
  model_io?: InputMaybe<Model_Io_Order_By>;
  model_io_id?: InputMaybe<Order_By>;
  resource?: InputMaybe<Resource_Order_By>;
  resource_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: execution_data_binding */
export type Execution_Data_Binding_Pk_Columns_Input = {
  execution_id: Scalars['uuid']['input'];
  model_io_id: Scalars['String']['input'];
  resource_id: Scalars['String']['input'];
};

/** select columns of table "execution_data_binding" */
export enum Execution_Data_Binding_Select_Column {
  /** column name */
  ExecutionId = 'execution_id',
  /** column name */
  ModelIoId = 'model_io_id',
  /** column name */
  ResourceId = 'resource_id'
}

/** input type for updating data in table "execution_data_binding" */
export type Execution_Data_Binding_Set_Input = {
  execution_id?: InputMaybe<Scalars['uuid']['input']>;
  model_io_id?: InputMaybe<Scalars['String']['input']>;
  resource_id?: InputMaybe<Scalars['String']['input']>;
};

/** update columns of table "execution_data_binding" */
export enum Execution_Data_Binding_Update_Column {
  /** column name */
  ExecutionId = 'execution_id',
  /** column name */
  ModelIoId = 'model_io_id',
  /** column name */
  ResourceId = 'resource_id'
}

export type Execution_Data_Binding_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Execution_Data_Binding_Set_Input>;
  where: Execution_Data_Binding_Bool_Exp;
};

/** input type for incrementing numeric columns in table "execution" */
export type Execution_Inc_Input = {
  run_progress?: InputMaybe<Scalars['float8']['input']>;
};

/** input type for inserting data into table "execution" */
export type Execution_Insert_Input = {
  data_bindings?: InputMaybe<Execution_Data_Binding_Arr_Rel_Insert_Input>;
  end_time?: InputMaybe<Scalars['timestamp']['input']>;
  execution_engine?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  model?: InputMaybe<Model_Obj_Rel_Insert_Input>;
  model_id?: InputMaybe<Scalars['String']['input']>;
  parameter_bindings?: InputMaybe<Execution_Parameter_Binding_Arr_Rel_Insert_Input>;
  results?: InputMaybe<Execution_Result_Arr_Rel_Insert_Input>;
  run_id?: InputMaybe<Scalars['String']['input']>;
  run_progress?: InputMaybe<Scalars['float8']['input']>;
  start_time?: InputMaybe<Scalars['timestamp']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  thread_model_executions?: InputMaybe<Thread_Model_Execution_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type Execution_Max_Fields = {
  __typename?: 'execution_max_fields';
  end_time?: Maybe<Scalars['timestamp']['output']>;
  execution_engine?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  model_id?: Maybe<Scalars['String']['output']>;
  run_id?: Maybe<Scalars['String']['output']>;
  run_progress?: Maybe<Scalars['float8']['output']>;
  start_time?: Maybe<Scalars['timestamp']['output']>;
  status?: Maybe<Scalars['String']['output']>;
};

/** order by max() on columns of table "execution" */
export type Execution_Max_Order_By = {
  end_time?: InputMaybe<Order_By>;
  execution_engine?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  model_id?: InputMaybe<Order_By>;
  run_id?: InputMaybe<Order_By>;
  run_progress?: InputMaybe<Order_By>;
  start_time?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Execution_Min_Fields = {
  __typename?: 'execution_min_fields';
  end_time?: Maybe<Scalars['timestamp']['output']>;
  execution_engine?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  model_id?: Maybe<Scalars['String']['output']>;
  run_id?: Maybe<Scalars['String']['output']>;
  run_progress?: Maybe<Scalars['float8']['output']>;
  start_time?: Maybe<Scalars['timestamp']['output']>;
  status?: Maybe<Scalars['String']['output']>;
};

/** order by min() on columns of table "execution" */
export type Execution_Min_Order_By = {
  end_time?: InputMaybe<Order_By>;
  execution_engine?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  model_id?: InputMaybe<Order_By>;
  run_id?: InputMaybe<Order_By>;
  run_progress?: InputMaybe<Order_By>;
  start_time?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "execution" */
export type Execution_Mutation_Response = {
  __typename?: 'execution_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Execution>;
};

/** input type for inserting object relation for remote table "execution" */
export type Execution_Obj_Rel_Insert_Input = {
  data: Execution_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Execution_On_Conflict>;
};

/** on_conflict condition type for table "execution" */
export type Execution_On_Conflict = {
  constraint: Execution_Constraint;
  update_columns?: Array<Execution_Update_Column>;
  where?: InputMaybe<Execution_Bool_Exp>;
};

/** Ordering options when selecting data from "execution". */
export type Execution_Order_By = {
  data_bindings_aggregate?: InputMaybe<Execution_Data_Binding_Aggregate_Order_By>;
  end_time?: InputMaybe<Order_By>;
  execution_engine?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  model?: InputMaybe<Model_Order_By>;
  model_id?: InputMaybe<Order_By>;
  parameter_bindings_aggregate?: InputMaybe<Execution_Parameter_Binding_Aggregate_Order_By>;
  results_aggregate?: InputMaybe<Execution_Result_Aggregate_Order_By>;
  run_id?: InputMaybe<Order_By>;
  run_progress?: InputMaybe<Order_By>;
  start_time?: InputMaybe<Order_By>;
  status?: InputMaybe<Order_By>;
  thread_model_executions_aggregate?: InputMaybe<Thread_Model_Execution_Aggregate_Order_By>;
};

/** columns and relationships of "execution_parameter_binding" */
export type Execution_Parameter_Binding = {
  __typename?: 'execution_parameter_binding';
  /** An object relationship */
  execution: Execution;
  execution_id: Scalars['uuid']['output'];
  /** An object relationship */
  model_parameter: Model_Parameter;
  model_parameter_id: Scalars['String']['output'];
  parameter_value: Scalars['String']['output'];
};

/** aggregated selection of "execution_parameter_binding" */
export type Execution_Parameter_Binding_Aggregate = {
  __typename?: 'execution_parameter_binding_aggregate';
  aggregate?: Maybe<Execution_Parameter_Binding_Aggregate_Fields>;
  nodes: Array<Execution_Parameter_Binding>;
};

/** aggregate fields of "execution_parameter_binding" */
export type Execution_Parameter_Binding_Aggregate_Fields = {
  __typename?: 'execution_parameter_binding_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Execution_Parameter_Binding_Max_Fields>;
  min?: Maybe<Execution_Parameter_Binding_Min_Fields>;
};


/** aggregate fields of "execution_parameter_binding" */
export type Execution_Parameter_Binding_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Execution_Parameter_Binding_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "execution_parameter_binding" */
export type Execution_Parameter_Binding_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Execution_Parameter_Binding_Max_Order_By>;
  min?: InputMaybe<Execution_Parameter_Binding_Min_Order_By>;
};

/** input type for inserting array relation for remote table "execution_parameter_binding" */
export type Execution_Parameter_Binding_Arr_Rel_Insert_Input = {
  data: Array<Execution_Parameter_Binding_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Execution_Parameter_Binding_On_Conflict>;
};

/** Boolean expression to filter rows from the table "execution_parameter_binding". All fields are combined with a logical 'AND'. */
export type Execution_Parameter_Binding_Bool_Exp = {
  _and?: InputMaybe<Array<Execution_Parameter_Binding_Bool_Exp>>;
  _not?: InputMaybe<Execution_Parameter_Binding_Bool_Exp>;
  _or?: InputMaybe<Array<Execution_Parameter_Binding_Bool_Exp>>;
  execution?: InputMaybe<Execution_Bool_Exp>;
  execution_id?: InputMaybe<Uuid_Comparison_Exp>;
  model_parameter?: InputMaybe<Model_Parameter_Bool_Exp>;
  model_parameter_id?: InputMaybe<String_Comparison_Exp>;
  parameter_value?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "execution_parameter_binding" */
export enum Execution_Parameter_Binding_Constraint {
  /** unique or primary key constraint on columns "model_parameter_id", "execution_id" */
  ExecutionParameterBindingPkey = 'execution_parameter_binding_pkey'
}

/** input type for inserting data into table "execution_parameter_binding" */
export type Execution_Parameter_Binding_Insert_Input = {
  execution?: InputMaybe<Execution_Obj_Rel_Insert_Input>;
  execution_id?: InputMaybe<Scalars['uuid']['input']>;
  model_parameter?: InputMaybe<Model_Parameter_Obj_Rel_Insert_Input>;
  model_parameter_id?: InputMaybe<Scalars['String']['input']>;
  parameter_value?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Execution_Parameter_Binding_Max_Fields = {
  __typename?: 'execution_parameter_binding_max_fields';
  execution_id?: Maybe<Scalars['uuid']['output']>;
  model_parameter_id?: Maybe<Scalars['String']['output']>;
  parameter_value?: Maybe<Scalars['String']['output']>;
};

/** order by max() on columns of table "execution_parameter_binding" */
export type Execution_Parameter_Binding_Max_Order_By = {
  execution_id?: InputMaybe<Order_By>;
  model_parameter_id?: InputMaybe<Order_By>;
  parameter_value?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Execution_Parameter_Binding_Min_Fields = {
  __typename?: 'execution_parameter_binding_min_fields';
  execution_id?: Maybe<Scalars['uuid']['output']>;
  model_parameter_id?: Maybe<Scalars['String']['output']>;
  parameter_value?: Maybe<Scalars['String']['output']>;
};

/** order by min() on columns of table "execution_parameter_binding" */
export type Execution_Parameter_Binding_Min_Order_By = {
  execution_id?: InputMaybe<Order_By>;
  model_parameter_id?: InputMaybe<Order_By>;
  parameter_value?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "execution_parameter_binding" */
export type Execution_Parameter_Binding_Mutation_Response = {
  __typename?: 'execution_parameter_binding_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Execution_Parameter_Binding>;
};

/** on_conflict condition type for table "execution_parameter_binding" */
export type Execution_Parameter_Binding_On_Conflict = {
  constraint: Execution_Parameter_Binding_Constraint;
  update_columns?: Array<Execution_Parameter_Binding_Update_Column>;
  where?: InputMaybe<Execution_Parameter_Binding_Bool_Exp>;
};

/** Ordering options when selecting data from "execution_parameter_binding". */
export type Execution_Parameter_Binding_Order_By = {
  execution?: InputMaybe<Execution_Order_By>;
  execution_id?: InputMaybe<Order_By>;
  model_parameter?: InputMaybe<Model_Parameter_Order_By>;
  model_parameter_id?: InputMaybe<Order_By>;
  parameter_value?: InputMaybe<Order_By>;
};

/** primary key columns input for table: execution_parameter_binding */
export type Execution_Parameter_Binding_Pk_Columns_Input = {
  execution_id: Scalars['uuid']['input'];
  model_parameter_id: Scalars['String']['input'];
};

/** select columns of table "execution_parameter_binding" */
export enum Execution_Parameter_Binding_Select_Column {
  /** column name */
  ExecutionId = 'execution_id',
  /** column name */
  ModelParameterId = 'model_parameter_id',
  /** column name */
  ParameterValue = 'parameter_value'
}

/** input type for updating data in table "execution_parameter_binding" */
export type Execution_Parameter_Binding_Set_Input = {
  execution_id?: InputMaybe<Scalars['uuid']['input']>;
  model_parameter_id?: InputMaybe<Scalars['String']['input']>;
  parameter_value?: InputMaybe<Scalars['String']['input']>;
};

/** update columns of table "execution_parameter_binding" */
export enum Execution_Parameter_Binding_Update_Column {
  /** column name */
  ExecutionId = 'execution_id',
  /** column name */
  ModelParameterId = 'model_parameter_id',
  /** column name */
  ParameterValue = 'parameter_value'
}

export type Execution_Parameter_Binding_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Execution_Parameter_Binding_Set_Input>;
  where: Execution_Parameter_Binding_Bool_Exp;
};

/** primary key columns input for table: execution */
export type Execution_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** columns and relationships of "execution_result" */
export type Execution_Result = {
  __typename?: 'execution_result';
  /** An object relationship */
  execution: Execution;
  execution_id: Scalars['uuid']['output'];
  model_io_id: Scalars['String']['output'];
  /** An object relationship */
  model_output: Model_Io;
  /** An object relationship */
  resource: Resource;
  resource_id: Scalars['String']['output'];
};

/** aggregated selection of "execution_result" */
export type Execution_Result_Aggregate = {
  __typename?: 'execution_result_aggregate';
  aggregate?: Maybe<Execution_Result_Aggregate_Fields>;
  nodes: Array<Execution_Result>;
};

/** aggregate fields of "execution_result" */
export type Execution_Result_Aggregate_Fields = {
  __typename?: 'execution_result_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Execution_Result_Max_Fields>;
  min?: Maybe<Execution_Result_Min_Fields>;
};


/** aggregate fields of "execution_result" */
export type Execution_Result_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Execution_Result_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "execution_result" */
export type Execution_Result_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Execution_Result_Max_Order_By>;
  min?: InputMaybe<Execution_Result_Min_Order_By>;
};

/** input type for inserting array relation for remote table "execution_result" */
export type Execution_Result_Arr_Rel_Insert_Input = {
  data: Array<Execution_Result_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Execution_Result_On_Conflict>;
};

/** Boolean expression to filter rows from the table "execution_result". All fields are combined with a logical 'AND'. */
export type Execution_Result_Bool_Exp = {
  _and?: InputMaybe<Array<Execution_Result_Bool_Exp>>;
  _not?: InputMaybe<Execution_Result_Bool_Exp>;
  _or?: InputMaybe<Array<Execution_Result_Bool_Exp>>;
  execution?: InputMaybe<Execution_Bool_Exp>;
  execution_id?: InputMaybe<Uuid_Comparison_Exp>;
  model_io_id?: InputMaybe<String_Comparison_Exp>;
  model_output?: InputMaybe<Model_Io_Bool_Exp>;
  resource?: InputMaybe<Resource_Bool_Exp>;
  resource_id?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "execution_result" */
export enum Execution_Result_Constraint {
  /** unique or primary key constraint on columns "execution_id", "resource_id", "model_io_id" */
  ExecutionResultPkey = 'execution_result_pkey'
}

/** input type for inserting data into table "execution_result" */
export type Execution_Result_Insert_Input = {
  execution?: InputMaybe<Execution_Obj_Rel_Insert_Input>;
  execution_id?: InputMaybe<Scalars['uuid']['input']>;
  model_io_id?: InputMaybe<Scalars['String']['input']>;
  model_output?: InputMaybe<Model_Io_Obj_Rel_Insert_Input>;
  resource?: InputMaybe<Resource_Obj_Rel_Insert_Input>;
  resource_id?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Execution_Result_Max_Fields = {
  __typename?: 'execution_result_max_fields';
  execution_id?: Maybe<Scalars['uuid']['output']>;
  model_io_id?: Maybe<Scalars['String']['output']>;
  resource_id?: Maybe<Scalars['String']['output']>;
};

/** order by max() on columns of table "execution_result" */
export type Execution_Result_Max_Order_By = {
  execution_id?: InputMaybe<Order_By>;
  model_io_id?: InputMaybe<Order_By>;
  resource_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Execution_Result_Min_Fields = {
  __typename?: 'execution_result_min_fields';
  execution_id?: Maybe<Scalars['uuid']['output']>;
  model_io_id?: Maybe<Scalars['String']['output']>;
  resource_id?: Maybe<Scalars['String']['output']>;
};

/** order by min() on columns of table "execution_result" */
export type Execution_Result_Min_Order_By = {
  execution_id?: InputMaybe<Order_By>;
  model_io_id?: InputMaybe<Order_By>;
  resource_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "execution_result" */
export type Execution_Result_Mutation_Response = {
  __typename?: 'execution_result_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Execution_Result>;
};

/** on_conflict condition type for table "execution_result" */
export type Execution_Result_On_Conflict = {
  constraint: Execution_Result_Constraint;
  update_columns?: Array<Execution_Result_Update_Column>;
  where?: InputMaybe<Execution_Result_Bool_Exp>;
};

/** Ordering options when selecting data from "execution_result". */
export type Execution_Result_Order_By = {
  execution?: InputMaybe<Execution_Order_By>;
  execution_id?: InputMaybe<Order_By>;
  model_io_id?: InputMaybe<Order_By>;
  model_output?: InputMaybe<Model_Io_Order_By>;
  resource?: InputMaybe<Resource_Order_By>;
  resource_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: execution_result */
export type Execution_Result_Pk_Columns_Input = {
  execution_id: Scalars['uuid']['input'];
  model_io_id: Scalars['String']['input'];
  resource_id: Scalars['String']['input'];
};

/** select columns of table "execution_result" */
export enum Execution_Result_Select_Column {
  /** column name */
  ExecutionId = 'execution_id',
  /** column name */
  ModelIoId = 'model_io_id',
  /** column name */
  ResourceId = 'resource_id'
}

/** input type for updating data in table "execution_result" */
export type Execution_Result_Set_Input = {
  execution_id?: InputMaybe<Scalars['uuid']['input']>;
  model_io_id?: InputMaybe<Scalars['String']['input']>;
  resource_id?: InputMaybe<Scalars['String']['input']>;
};

/** update columns of table "execution_result" */
export enum Execution_Result_Update_Column {
  /** column name */
  ExecutionId = 'execution_id',
  /** column name */
  ModelIoId = 'model_io_id',
  /** column name */
  ResourceId = 'resource_id'
}

export type Execution_Result_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Execution_Result_Set_Input>;
  where: Execution_Result_Bool_Exp;
};

/** select columns of table "execution" */
export enum Execution_Select_Column {
  /** column name */
  EndTime = 'end_time',
  /** column name */
  ExecutionEngine = 'execution_engine',
  /** column name */
  Id = 'id',
  /** column name */
  ModelId = 'model_id',
  /** column name */
  RunId = 'run_id',
  /** column name */
  RunProgress = 'run_progress',
  /** column name */
  StartTime = 'start_time',
  /** column name */
  Status = 'status'
}

/** input type for updating data in table "execution" */
export type Execution_Set_Input = {
  end_time?: InputMaybe<Scalars['timestamp']['input']>;
  execution_engine?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  model_id?: InputMaybe<Scalars['String']['input']>;
  run_id?: InputMaybe<Scalars['String']['input']>;
  run_progress?: InputMaybe<Scalars['float8']['input']>;
  start_time?: InputMaybe<Scalars['timestamp']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate stddev on columns */
export type Execution_Stddev_Fields = {
  __typename?: 'execution_stddev_fields';
  run_progress?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "execution" */
export type Execution_Stddev_Order_By = {
  run_progress?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Execution_Stddev_Pop_Fields = {
  __typename?: 'execution_stddev_pop_fields';
  run_progress?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "execution" */
export type Execution_Stddev_Pop_Order_By = {
  run_progress?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Execution_Stddev_Samp_Fields = {
  __typename?: 'execution_stddev_samp_fields';
  run_progress?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "execution" */
export type Execution_Stddev_Samp_Order_By = {
  run_progress?: InputMaybe<Order_By>;
};

/** aggregate sum on columns */
export type Execution_Sum_Fields = {
  __typename?: 'execution_sum_fields';
  run_progress?: Maybe<Scalars['float8']['output']>;
};

/** order by sum() on columns of table "execution" */
export type Execution_Sum_Order_By = {
  run_progress?: InputMaybe<Order_By>;
};

/** update columns of table "execution" */
export enum Execution_Update_Column {
  /** column name */
  EndTime = 'end_time',
  /** column name */
  ExecutionEngine = 'execution_engine',
  /** column name */
  Id = 'id',
  /** column name */
  ModelId = 'model_id',
  /** column name */
  RunId = 'run_id',
  /** column name */
  RunProgress = 'run_progress',
  /** column name */
  StartTime = 'start_time',
  /** column name */
  Status = 'status'
}

export type Execution_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Execution_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Execution_Set_Input>;
  where: Execution_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Execution_Var_Pop_Fields = {
  __typename?: 'execution_var_pop_fields';
  run_progress?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "execution" */
export type Execution_Var_Pop_Order_By = {
  run_progress?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Execution_Var_Samp_Fields = {
  __typename?: 'execution_var_samp_fields';
  run_progress?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "execution" */
export type Execution_Var_Samp_Order_By = {
  run_progress?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Execution_Variance_Fields = {
  __typename?: 'execution_variance_fields';
  run_progress?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "execution" */
export type Execution_Variance_Order_By = {
  run_progress?: InputMaybe<Order_By>;
};

export type Find_Regions_Containing_Point_Args = {
  latitude?: InputMaybe<Scalars['float8']['input']>;
  longitude?: InputMaybe<Scalars['float8']['input']>;
};

export type Find_Regions_Containing_Point_Fuzzy_Args = {
  latitude?: InputMaybe<Scalars['float8']['input']>;
  longitude?: InputMaybe<Scalars['float8']['input']>;
};

/** Boolean expression to compare columns of type "float8". All fields are combined with logical 'AND'. */
export type Float8_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['float8']['input']>;
  _gt?: InputMaybe<Scalars['float8']['input']>;
  _gte?: InputMaybe<Scalars['float8']['input']>;
  _in?: InputMaybe<Array<Scalars['float8']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['float8']['input']>;
  _lte?: InputMaybe<Scalars['float8']['input']>;
  _neq?: InputMaybe<Scalars['float8']['input']>;
  _nin?: InputMaybe<Array<Scalars['float8']['input']>>;
};

export type Geography_Cast_Exp = {
  geometry?: InputMaybe<Geometry_Comparison_Exp>;
};

/** Boolean expression to compare columns of type "geography". All fields are combined with logical 'AND'. */
export type Geography_Comparison_Exp = {
  _cast?: InputMaybe<Geography_Cast_Exp>;
  _eq?: InputMaybe<Scalars['geography']['input']>;
  _gt?: InputMaybe<Scalars['geography']['input']>;
  _gte?: InputMaybe<Scalars['geography']['input']>;
  _in?: InputMaybe<Array<Scalars['geography']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['geography']['input']>;
  _lte?: InputMaybe<Scalars['geography']['input']>;
  _neq?: InputMaybe<Scalars['geography']['input']>;
  _nin?: InputMaybe<Array<Scalars['geography']['input']>>;
  /** is the column within a given distance from the given geography value */
  _st_d_within?: InputMaybe<St_D_Within_Geography_Input>;
  /** does the column spatially intersect the given geography value */
  _st_intersects?: InputMaybe<Scalars['geography']['input']>;
};

export type Geometry_Cast_Exp = {
  geography?: InputMaybe<Geography_Comparison_Exp>;
};

/** Boolean expression to compare columns of type "geometry". All fields are combined with logical 'AND'. */
export type Geometry_Comparison_Exp = {
  _cast?: InputMaybe<Geometry_Cast_Exp>;
  _eq?: InputMaybe<Scalars['geometry']['input']>;
  _gt?: InputMaybe<Scalars['geometry']['input']>;
  _gte?: InputMaybe<Scalars['geometry']['input']>;
  _in?: InputMaybe<Array<Scalars['geometry']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['geometry']['input']>;
  _lte?: InputMaybe<Scalars['geometry']['input']>;
  _neq?: InputMaybe<Scalars['geometry']['input']>;
  _nin?: InputMaybe<Array<Scalars['geometry']['input']>>;
  /** is the column within a given 3D distance from the given geometry value */
  _st_3d_d_within?: InputMaybe<St_D_Within_Input>;
  /** does the column spatially intersect the given geometry value in 3D */
  _st_3d_intersects?: InputMaybe<Scalars['geometry']['input']>;
  /** does the column contain the given geometry value */
  _st_contains?: InputMaybe<Scalars['geometry']['input']>;
  /** does the column cross the given geometry value */
  _st_crosses?: InputMaybe<Scalars['geometry']['input']>;
  /** is the column within a given distance from the given geometry value */
  _st_d_within?: InputMaybe<St_D_Within_Input>;
  /** is the column equal to given geometry value (directionality is ignored) */
  _st_equals?: InputMaybe<Scalars['geometry']['input']>;
  /** does the column spatially intersect the given geometry value */
  _st_intersects?: InputMaybe<Scalars['geometry']['input']>;
  /** does the column 'spatially overlap' (intersect but not completely contain) the given geometry value */
  _st_overlaps?: InputMaybe<Scalars['geometry']['input']>;
  /** does the column have atleast one point in common with the given geometry value */
  _st_touches?: InputMaybe<Scalars['geometry']['input']>;
  /** is the column contained in the given geometry value */
  _st_within?: InputMaybe<Scalars['geometry']['input']>;
};

/** columns and relationships of "intervention" */
export type Intervention = {
  __typename?: 'intervention';
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  name?: Maybe<Scalars['String']['output']>;
  /** An array relationship */
  variables: Array<Variable>;
  /** An aggregate relationship */
  variables_aggregate: Variable_Aggregate;
};


/** columns and relationships of "intervention" */
export type InterventionVariablesArgs = {
  distinct_on?: InputMaybe<Array<Variable_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Variable_Order_By>>;
  where?: InputMaybe<Variable_Bool_Exp>;
};


/** columns and relationships of "intervention" */
export type InterventionVariables_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Variable_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Variable_Order_By>>;
  where?: InputMaybe<Variable_Bool_Exp>;
};

/** aggregated selection of "intervention" */
export type Intervention_Aggregate = {
  __typename?: 'intervention_aggregate';
  aggregate?: Maybe<Intervention_Aggregate_Fields>;
  nodes: Array<Intervention>;
};

/** aggregate fields of "intervention" */
export type Intervention_Aggregate_Fields = {
  __typename?: 'intervention_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Intervention_Max_Fields>;
  min?: Maybe<Intervention_Min_Fields>;
};


/** aggregate fields of "intervention" */
export type Intervention_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Intervention_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "intervention". All fields are combined with a logical 'AND'. */
export type Intervention_Bool_Exp = {
  _and?: InputMaybe<Array<Intervention_Bool_Exp>>;
  _not?: InputMaybe<Intervention_Bool_Exp>;
  _or?: InputMaybe<Array<Intervention_Bool_Exp>>;
  description?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  variables?: InputMaybe<Variable_Bool_Exp>;
};

/** unique or primary key constraints on table "intervention" */
export enum Intervention_Constraint {
  /** unique or primary key constraint on columns "id" */
  InterventionPkey = 'intervention_pkey'
}

/** input type for inserting data into table "intervention" */
export type Intervention_Insert_Input = {
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  variables?: InputMaybe<Variable_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type Intervention_Max_Fields = {
  __typename?: 'intervention_max_fields';
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
};

/** aggregate min on columns */
export type Intervention_Min_Fields = {
  __typename?: 'intervention_min_fields';
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
};

/** response of any mutation on the table "intervention" */
export type Intervention_Mutation_Response = {
  __typename?: 'intervention_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Intervention>;
};

/** input type for inserting object relation for remote table "intervention" */
export type Intervention_Obj_Rel_Insert_Input = {
  data: Intervention_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Intervention_On_Conflict>;
};

/** on_conflict condition type for table "intervention" */
export type Intervention_On_Conflict = {
  constraint: Intervention_Constraint;
  update_columns?: Array<Intervention_Update_Column>;
  where?: InputMaybe<Intervention_Bool_Exp>;
};

/** Ordering options when selecting data from "intervention". */
export type Intervention_Order_By = {
  description?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  variables_aggregate?: InputMaybe<Variable_Aggregate_Order_By>;
};

/** primary key columns input for table: intervention */
export type Intervention_Pk_Columns_Input = {
  id: Scalars['String']['input'];
};

/** select columns of table "intervention" */
export enum Intervention_Select_Column {
  /** column name */
  Description = 'description',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name'
}

/** input type for updating data in table "intervention" */
export type Intervention_Set_Input = {
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

/** update columns of table "intervention" */
export enum Intervention_Update_Column {
  /** column name */
  Description = 'description',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name'
}

export type Intervention_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Intervention_Set_Input>;
  where: Intervention_Bool_Exp;
};

/** columns and relationships of "model" */
export type Model = {
  __typename?: 'model';
  calibration_target_variable?: Maybe<Scalars['String']['output']>;
  category?: Maybe<Scalars['String']['output']>;
  code_url?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  dimensionality?: Maybe<Scalars['String']['output']>;
  /** An array relationship */
  executions: Array<Execution>;
  /** An aggregate relationship */
  executions_aggregate: Execution_Aggregate;
  id: Scalars['String']['output'];
  /** An array relationship */
  inputs: Array<Model_Input>;
  /** An aggregate relationship */
  inputs_aggregate: Model_Input_Aggregate;
  model_configuration: Scalars['String']['output'];
  model_name: Scalars['String']['output'];
  model_version: Scalars['String']['output'];
  name: Scalars['String']['output'];
  output_time_interval?: Maybe<Scalars['String']['output']>;
  /** An array relationship */
  outputs: Array<Model_Output>;
  /** An aggregate relationship */
  outputs_aggregate: Model_Output_Aggregate;
  parameter_assignment?: Maybe<Scalars['String']['output']>;
  parameter_assignment_details?: Maybe<Scalars['String']['output']>;
  /** An array relationship */
  parameters: Array<Model_Parameter>;
  /** An aggregate relationship */
  parameters_aggregate: Model_Parameter_Aggregate;
  region_name?: Maybe<Scalars['String']['output']>;
  software_image?: Maybe<Scalars['String']['output']>;
  spatial_grid_resolution?: Maybe<Scalars['String']['output']>;
  spatial_grid_type?: Maybe<Scalars['String']['output']>;
  /** An array relationship */
  thread_models: Array<Thread_Model>;
  /** An aggregate relationship */
  thread_models_aggregate: Thread_Model_Aggregate;
  type: Scalars['String']['output'];
  usage_notes?: Maybe<Scalars['String']['output']>;
  user_id?: Maybe<Scalars['String']['output']>;
};


/** columns and relationships of "model" */
export type ModelExecutionsArgs = {
  distinct_on?: InputMaybe<Array<Execution_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Order_By>>;
  where?: InputMaybe<Execution_Bool_Exp>;
};


/** columns and relationships of "model" */
export type ModelExecutions_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Execution_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Order_By>>;
  where?: InputMaybe<Execution_Bool_Exp>;
};


/** columns and relationships of "model" */
export type ModelInputsArgs = {
  distinct_on?: InputMaybe<Array<Model_Input_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Input_Order_By>>;
  where?: InputMaybe<Model_Input_Bool_Exp>;
};


/** columns and relationships of "model" */
export type ModelInputs_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Model_Input_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Input_Order_By>>;
  where?: InputMaybe<Model_Input_Bool_Exp>;
};


/** columns and relationships of "model" */
export type ModelOutputsArgs = {
  distinct_on?: InputMaybe<Array<Model_Output_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Output_Order_By>>;
  where?: InputMaybe<Model_Output_Bool_Exp>;
};


/** columns and relationships of "model" */
export type ModelOutputs_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Model_Output_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Output_Order_By>>;
  where?: InputMaybe<Model_Output_Bool_Exp>;
};


/** columns and relationships of "model" */
export type ModelParametersArgs = {
  distinct_on?: InputMaybe<Array<Model_Parameter_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Parameter_Order_By>>;
  where?: InputMaybe<Model_Parameter_Bool_Exp>;
};


/** columns and relationships of "model" */
export type ModelParameters_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Model_Parameter_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Parameter_Order_By>>;
  where?: InputMaybe<Model_Parameter_Bool_Exp>;
};


/** columns and relationships of "model" */
export type ModelThread_ModelsArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Order_By>>;
  where?: InputMaybe<Thread_Model_Bool_Exp>;
};


/** columns and relationships of "model" */
export type ModelThread_Models_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Order_By>>;
  where?: InputMaybe<Thread_Model_Bool_Exp>;
};

/** aggregated selection of "model" */
export type Model_Aggregate = {
  __typename?: 'model_aggregate';
  aggregate?: Maybe<Model_Aggregate_Fields>;
  nodes: Array<Model>;
};

/** aggregate fields of "model" */
export type Model_Aggregate_Fields = {
  __typename?: 'model_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Model_Max_Fields>;
  min?: Maybe<Model_Min_Fields>;
};


/** aggregate fields of "model" */
export type Model_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Model_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "model". All fields are combined with a logical 'AND'. */
export type Model_Bool_Exp = {
  _and?: InputMaybe<Array<Model_Bool_Exp>>;
  _not?: InputMaybe<Model_Bool_Exp>;
  _or?: InputMaybe<Array<Model_Bool_Exp>>;
  calibration_target_variable?: InputMaybe<String_Comparison_Exp>;
  category?: InputMaybe<String_Comparison_Exp>;
  code_url?: InputMaybe<String_Comparison_Exp>;
  description?: InputMaybe<String_Comparison_Exp>;
  dimensionality?: InputMaybe<String_Comparison_Exp>;
  executions?: InputMaybe<Execution_Bool_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  inputs?: InputMaybe<Model_Input_Bool_Exp>;
  model_configuration?: InputMaybe<String_Comparison_Exp>;
  model_name?: InputMaybe<String_Comparison_Exp>;
  model_version?: InputMaybe<String_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  output_time_interval?: InputMaybe<String_Comparison_Exp>;
  outputs?: InputMaybe<Model_Output_Bool_Exp>;
  parameter_assignment?: InputMaybe<String_Comparison_Exp>;
  parameter_assignment_details?: InputMaybe<String_Comparison_Exp>;
  parameters?: InputMaybe<Model_Parameter_Bool_Exp>;
  region_name?: InputMaybe<String_Comparison_Exp>;
  software_image?: InputMaybe<String_Comparison_Exp>;
  spatial_grid_resolution?: InputMaybe<String_Comparison_Exp>;
  spatial_grid_type?: InputMaybe<String_Comparison_Exp>;
  thread_models?: InputMaybe<Thread_Model_Bool_Exp>;
  type?: InputMaybe<String_Comparison_Exp>;
  usage_notes?: InputMaybe<String_Comparison_Exp>;
  user_id?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "model" */
export enum Model_Constraint {
  /** unique or primary key constraint on columns "id" */
  ModelPkey = 'model_pkey'
}

/** columns and relationships of "model_input" */
export type Model_Input = {
  __typename?: 'model_input';
  /** An object relationship */
  model: Model;
  model_id: Scalars['String']['output'];
  /** An object relationship */
  model_io: Model_Io;
  model_io_id: Scalars['String']['output'];
  position?: Maybe<Scalars['Int']['output']>;
};

/** aggregated selection of "model_input" */
export type Model_Input_Aggregate = {
  __typename?: 'model_input_aggregate';
  aggregate?: Maybe<Model_Input_Aggregate_Fields>;
  nodes: Array<Model_Input>;
};

/** aggregate fields of "model_input" */
export type Model_Input_Aggregate_Fields = {
  __typename?: 'model_input_aggregate_fields';
  avg?: Maybe<Model_Input_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Model_Input_Max_Fields>;
  min?: Maybe<Model_Input_Min_Fields>;
  stddev?: Maybe<Model_Input_Stddev_Fields>;
  stddev_pop?: Maybe<Model_Input_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Model_Input_Stddev_Samp_Fields>;
  sum?: Maybe<Model_Input_Sum_Fields>;
  var_pop?: Maybe<Model_Input_Var_Pop_Fields>;
  var_samp?: Maybe<Model_Input_Var_Samp_Fields>;
  variance?: Maybe<Model_Input_Variance_Fields>;
};


/** aggregate fields of "model_input" */
export type Model_Input_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Model_Input_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "model_input" */
export type Model_Input_Aggregate_Order_By = {
  avg?: InputMaybe<Model_Input_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Model_Input_Max_Order_By>;
  min?: InputMaybe<Model_Input_Min_Order_By>;
  stddev?: InputMaybe<Model_Input_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Model_Input_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Model_Input_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Model_Input_Sum_Order_By>;
  var_pop?: InputMaybe<Model_Input_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Model_Input_Var_Samp_Order_By>;
  variance?: InputMaybe<Model_Input_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "model_input" */
export type Model_Input_Arr_Rel_Insert_Input = {
  data: Array<Model_Input_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Model_Input_On_Conflict>;
};

/** aggregate avg on columns */
export type Model_Input_Avg_Fields = {
  __typename?: 'model_input_avg_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "model_input" */
export type Model_Input_Avg_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "model_input". All fields are combined with a logical 'AND'. */
export type Model_Input_Bool_Exp = {
  _and?: InputMaybe<Array<Model_Input_Bool_Exp>>;
  _not?: InputMaybe<Model_Input_Bool_Exp>;
  _or?: InputMaybe<Array<Model_Input_Bool_Exp>>;
  model?: InputMaybe<Model_Bool_Exp>;
  model_id?: InputMaybe<String_Comparison_Exp>;
  model_io?: InputMaybe<Model_Io_Bool_Exp>;
  model_io_id?: InputMaybe<String_Comparison_Exp>;
  position?: InputMaybe<Int_Comparison_Exp>;
};

/** unique or primary key constraints on table "model_input" */
export enum Model_Input_Constraint {
  /** unique or primary key constraint on columns "model_io_id", "model_id" */
  ModelInputPkey = 'model_input_pkey'
}

/** columns and relationships of "model_input_fixed_binding" */
export type Model_Input_Fixed_Binding = {
  __typename?: 'model_input_fixed_binding';
  /** An object relationship */
  model_io: Model_Io;
  model_io_id: Scalars['String']['output'];
  /** An object relationship */
  resource: Resource;
  resource_id: Scalars['String']['output'];
};

/** aggregated selection of "model_input_fixed_binding" */
export type Model_Input_Fixed_Binding_Aggregate = {
  __typename?: 'model_input_fixed_binding_aggregate';
  aggregate?: Maybe<Model_Input_Fixed_Binding_Aggregate_Fields>;
  nodes: Array<Model_Input_Fixed_Binding>;
};

/** aggregate fields of "model_input_fixed_binding" */
export type Model_Input_Fixed_Binding_Aggregate_Fields = {
  __typename?: 'model_input_fixed_binding_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Model_Input_Fixed_Binding_Max_Fields>;
  min?: Maybe<Model_Input_Fixed_Binding_Min_Fields>;
};


/** aggregate fields of "model_input_fixed_binding" */
export type Model_Input_Fixed_Binding_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Model_Input_Fixed_Binding_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "model_input_fixed_binding" */
export type Model_Input_Fixed_Binding_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Model_Input_Fixed_Binding_Max_Order_By>;
  min?: InputMaybe<Model_Input_Fixed_Binding_Min_Order_By>;
};

/** input type for inserting array relation for remote table "model_input_fixed_binding" */
export type Model_Input_Fixed_Binding_Arr_Rel_Insert_Input = {
  data: Array<Model_Input_Fixed_Binding_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Model_Input_Fixed_Binding_On_Conflict>;
};

/** Boolean expression to filter rows from the table "model_input_fixed_binding". All fields are combined with a logical 'AND'. */
export type Model_Input_Fixed_Binding_Bool_Exp = {
  _and?: InputMaybe<Array<Model_Input_Fixed_Binding_Bool_Exp>>;
  _not?: InputMaybe<Model_Input_Fixed_Binding_Bool_Exp>;
  _or?: InputMaybe<Array<Model_Input_Fixed_Binding_Bool_Exp>>;
  model_io?: InputMaybe<Model_Io_Bool_Exp>;
  model_io_id?: InputMaybe<String_Comparison_Exp>;
  resource?: InputMaybe<Resource_Bool_Exp>;
  resource_id?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "model_input_fixed_binding" */
export enum Model_Input_Fixed_Binding_Constraint {
  /** unique or primary key constraint on columns "resource_id", "model_io_id" */
  ModelInputBindingsPkey = 'model_input_bindings_pkey'
}

/** input type for inserting data into table "model_input_fixed_binding" */
export type Model_Input_Fixed_Binding_Insert_Input = {
  model_io?: InputMaybe<Model_Io_Obj_Rel_Insert_Input>;
  model_io_id?: InputMaybe<Scalars['String']['input']>;
  resource?: InputMaybe<Resource_Obj_Rel_Insert_Input>;
  resource_id?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Model_Input_Fixed_Binding_Max_Fields = {
  __typename?: 'model_input_fixed_binding_max_fields';
  model_io_id?: Maybe<Scalars['String']['output']>;
  resource_id?: Maybe<Scalars['String']['output']>;
};

/** order by max() on columns of table "model_input_fixed_binding" */
export type Model_Input_Fixed_Binding_Max_Order_By = {
  model_io_id?: InputMaybe<Order_By>;
  resource_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Model_Input_Fixed_Binding_Min_Fields = {
  __typename?: 'model_input_fixed_binding_min_fields';
  model_io_id?: Maybe<Scalars['String']['output']>;
  resource_id?: Maybe<Scalars['String']['output']>;
};

/** order by min() on columns of table "model_input_fixed_binding" */
export type Model_Input_Fixed_Binding_Min_Order_By = {
  model_io_id?: InputMaybe<Order_By>;
  resource_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "model_input_fixed_binding" */
export type Model_Input_Fixed_Binding_Mutation_Response = {
  __typename?: 'model_input_fixed_binding_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Model_Input_Fixed_Binding>;
};

/** on_conflict condition type for table "model_input_fixed_binding" */
export type Model_Input_Fixed_Binding_On_Conflict = {
  constraint: Model_Input_Fixed_Binding_Constraint;
  update_columns?: Array<Model_Input_Fixed_Binding_Update_Column>;
  where?: InputMaybe<Model_Input_Fixed_Binding_Bool_Exp>;
};

/** Ordering options when selecting data from "model_input_fixed_binding". */
export type Model_Input_Fixed_Binding_Order_By = {
  model_io?: InputMaybe<Model_Io_Order_By>;
  model_io_id?: InputMaybe<Order_By>;
  resource?: InputMaybe<Resource_Order_By>;
  resource_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: model_input_fixed_binding */
export type Model_Input_Fixed_Binding_Pk_Columns_Input = {
  model_io_id: Scalars['String']['input'];
  resource_id: Scalars['String']['input'];
};

/** select columns of table "model_input_fixed_binding" */
export enum Model_Input_Fixed_Binding_Select_Column {
  /** column name */
  ModelIoId = 'model_io_id',
  /** column name */
  ResourceId = 'resource_id'
}

/** input type for updating data in table "model_input_fixed_binding" */
export type Model_Input_Fixed_Binding_Set_Input = {
  model_io_id?: InputMaybe<Scalars['String']['input']>;
  resource_id?: InputMaybe<Scalars['String']['input']>;
};

/** update columns of table "model_input_fixed_binding" */
export enum Model_Input_Fixed_Binding_Update_Column {
  /** column name */
  ModelIoId = 'model_io_id',
  /** column name */
  ResourceId = 'resource_id'
}

export type Model_Input_Fixed_Binding_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Model_Input_Fixed_Binding_Set_Input>;
  where: Model_Input_Fixed_Binding_Bool_Exp;
};

/** input type for incrementing numeric columns in table "model_input" */
export type Model_Input_Inc_Input = {
  position?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "model_input" */
export type Model_Input_Insert_Input = {
  model?: InputMaybe<Model_Obj_Rel_Insert_Input>;
  model_id?: InputMaybe<Scalars['String']['input']>;
  model_io?: InputMaybe<Model_Io_Obj_Rel_Insert_Input>;
  model_io_id?: InputMaybe<Scalars['String']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
};

/** aggregate max on columns */
export type Model_Input_Max_Fields = {
  __typename?: 'model_input_max_fields';
  model_id?: Maybe<Scalars['String']['output']>;
  model_io_id?: Maybe<Scalars['String']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
};

/** order by max() on columns of table "model_input" */
export type Model_Input_Max_Order_By = {
  model_id?: InputMaybe<Order_By>;
  model_io_id?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Model_Input_Min_Fields = {
  __typename?: 'model_input_min_fields';
  model_id?: Maybe<Scalars['String']['output']>;
  model_io_id?: Maybe<Scalars['String']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
};

/** order by min() on columns of table "model_input" */
export type Model_Input_Min_Order_By = {
  model_id?: InputMaybe<Order_By>;
  model_io_id?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "model_input" */
export type Model_Input_Mutation_Response = {
  __typename?: 'model_input_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Model_Input>;
};

/** on_conflict condition type for table "model_input" */
export type Model_Input_On_Conflict = {
  constraint: Model_Input_Constraint;
  update_columns?: Array<Model_Input_Update_Column>;
  where?: InputMaybe<Model_Input_Bool_Exp>;
};

/** Ordering options when selecting data from "model_input". */
export type Model_Input_Order_By = {
  model?: InputMaybe<Model_Order_By>;
  model_id?: InputMaybe<Order_By>;
  model_io?: InputMaybe<Model_Io_Order_By>;
  model_io_id?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
};

/** primary key columns input for table: model_input */
export type Model_Input_Pk_Columns_Input = {
  model_id: Scalars['String']['input'];
  model_io_id: Scalars['String']['input'];
};

/** select columns of table "model_input" */
export enum Model_Input_Select_Column {
  /** column name */
  ModelId = 'model_id',
  /** column name */
  ModelIoId = 'model_io_id',
  /** column name */
  Position = 'position'
}

/** input type for updating data in table "model_input" */
export type Model_Input_Set_Input = {
  model_id?: InputMaybe<Scalars['String']['input']>;
  model_io_id?: InputMaybe<Scalars['String']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
};

/** aggregate stddev on columns */
export type Model_Input_Stddev_Fields = {
  __typename?: 'model_input_stddev_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "model_input" */
export type Model_Input_Stddev_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Model_Input_Stddev_Pop_Fields = {
  __typename?: 'model_input_stddev_pop_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "model_input" */
export type Model_Input_Stddev_Pop_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Model_Input_Stddev_Samp_Fields = {
  __typename?: 'model_input_stddev_samp_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "model_input" */
export type Model_Input_Stddev_Samp_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate sum on columns */
export type Model_Input_Sum_Fields = {
  __typename?: 'model_input_sum_fields';
  position?: Maybe<Scalars['Int']['output']>;
};

/** order by sum() on columns of table "model_input" */
export type Model_Input_Sum_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** update columns of table "model_input" */
export enum Model_Input_Update_Column {
  /** column name */
  ModelId = 'model_id',
  /** column name */
  ModelIoId = 'model_io_id',
  /** column name */
  Position = 'position'
}

export type Model_Input_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Model_Input_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Model_Input_Set_Input>;
  where: Model_Input_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Model_Input_Var_Pop_Fields = {
  __typename?: 'model_input_var_pop_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "model_input" */
export type Model_Input_Var_Pop_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Model_Input_Var_Samp_Fields = {
  __typename?: 'model_input_var_samp_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "model_input" */
export type Model_Input_Var_Samp_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Model_Input_Variance_Fields = {
  __typename?: 'model_input_variance_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "model_input" */
export type Model_Input_Variance_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** input type for inserting data into table "model" */
export type Model_Insert_Input = {
  calibration_target_variable?: InputMaybe<Scalars['String']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  code_url?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  dimensionality?: InputMaybe<Scalars['String']['input']>;
  executions?: InputMaybe<Execution_Arr_Rel_Insert_Input>;
  id?: InputMaybe<Scalars['String']['input']>;
  inputs?: InputMaybe<Model_Input_Arr_Rel_Insert_Input>;
  model_configuration?: InputMaybe<Scalars['String']['input']>;
  model_name?: InputMaybe<Scalars['String']['input']>;
  model_version?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  output_time_interval?: InputMaybe<Scalars['String']['input']>;
  outputs?: InputMaybe<Model_Output_Arr_Rel_Insert_Input>;
  parameter_assignment?: InputMaybe<Scalars['String']['input']>;
  parameter_assignment_details?: InputMaybe<Scalars['String']['input']>;
  parameters?: InputMaybe<Model_Parameter_Arr_Rel_Insert_Input>;
  region_name?: InputMaybe<Scalars['String']['input']>;
  software_image?: InputMaybe<Scalars['String']['input']>;
  spatial_grid_resolution?: InputMaybe<Scalars['String']['input']>;
  spatial_grid_type?: InputMaybe<Scalars['String']['input']>;
  thread_models?: InputMaybe<Thread_Model_Arr_Rel_Insert_Input>;
  type?: InputMaybe<Scalars['String']['input']>;
  usage_notes?: InputMaybe<Scalars['String']['input']>;
  user_id?: InputMaybe<Scalars['String']['input']>;
};

/** columns and relationships of "model_io" */
export type Model_Io = {
  __typename?: 'model_io';
  description?: Maybe<Scalars['String']['output']>;
  /** An array relationship */
  execution_data_bindings: Array<Execution_Data_Binding>;
  /** An aggregate relationship */
  execution_data_bindings_aggregate: Execution_Data_Binding_Aggregate;
  /** An array relationship */
  execution_results: Array<Execution_Result>;
  /** An aggregate relationship */
  execution_results_aggregate: Execution_Result_Aggregate;
  /** An array relationship */
  fixed_bindings: Array<Model_Input_Fixed_Binding>;
  /** An aggregate relationship */
  fixed_bindings_aggregate: Model_Input_Fixed_Binding_Aggregate;
  format?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  /** An array relationship */
  model_inputs: Array<Model_Input>;
  /** An aggregate relationship */
  model_inputs_aggregate: Model_Input_Aggregate;
  /** An array relationship */
  model_outputs: Array<Model_Output>;
  /** An aggregate relationship */
  model_outputs_aggregate: Model_Output_Aggregate;
  name: Scalars['String']['output'];
  /** An array relationship */
  thread_model_ios: Array<Thread_Model_Io>;
  /** An aggregate relationship */
  thread_model_ios_aggregate: Thread_Model_Io_Aggregate;
  type?: Maybe<Scalars['String']['output']>;
  /** An array relationship */
  variables: Array<Model_Io_Variable>;
  /** An aggregate relationship */
  variables_aggregate: Model_Io_Variable_Aggregate;
};


/** columns and relationships of "model_io" */
export type Model_IoExecution_Data_BindingsArgs = {
  distinct_on?: InputMaybe<Array<Execution_Data_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Data_Binding_Order_By>>;
  where?: InputMaybe<Execution_Data_Binding_Bool_Exp>;
};


/** columns and relationships of "model_io" */
export type Model_IoExecution_Data_Bindings_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Execution_Data_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Data_Binding_Order_By>>;
  where?: InputMaybe<Execution_Data_Binding_Bool_Exp>;
};


/** columns and relationships of "model_io" */
export type Model_IoExecution_ResultsArgs = {
  distinct_on?: InputMaybe<Array<Execution_Result_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Result_Order_By>>;
  where?: InputMaybe<Execution_Result_Bool_Exp>;
};


/** columns and relationships of "model_io" */
export type Model_IoExecution_Results_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Execution_Result_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Result_Order_By>>;
  where?: InputMaybe<Execution_Result_Bool_Exp>;
};


/** columns and relationships of "model_io" */
export type Model_IoFixed_BindingsArgs = {
  distinct_on?: InputMaybe<Array<Model_Input_Fixed_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Input_Fixed_Binding_Order_By>>;
  where?: InputMaybe<Model_Input_Fixed_Binding_Bool_Exp>;
};


/** columns and relationships of "model_io" */
export type Model_IoFixed_Bindings_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Model_Input_Fixed_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Input_Fixed_Binding_Order_By>>;
  where?: InputMaybe<Model_Input_Fixed_Binding_Bool_Exp>;
};


/** columns and relationships of "model_io" */
export type Model_IoModel_InputsArgs = {
  distinct_on?: InputMaybe<Array<Model_Input_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Input_Order_By>>;
  where?: InputMaybe<Model_Input_Bool_Exp>;
};


/** columns and relationships of "model_io" */
export type Model_IoModel_Inputs_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Model_Input_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Input_Order_By>>;
  where?: InputMaybe<Model_Input_Bool_Exp>;
};


/** columns and relationships of "model_io" */
export type Model_IoModel_OutputsArgs = {
  distinct_on?: InputMaybe<Array<Model_Output_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Output_Order_By>>;
  where?: InputMaybe<Model_Output_Bool_Exp>;
};


/** columns and relationships of "model_io" */
export type Model_IoModel_Outputs_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Model_Output_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Output_Order_By>>;
  where?: InputMaybe<Model_Output_Bool_Exp>;
};


/** columns and relationships of "model_io" */
export type Model_IoThread_Model_IosArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Io_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Io_Order_By>>;
  where?: InputMaybe<Thread_Model_Io_Bool_Exp>;
};


/** columns and relationships of "model_io" */
export type Model_IoThread_Model_Ios_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Io_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Io_Order_By>>;
  where?: InputMaybe<Thread_Model_Io_Bool_Exp>;
};


/** columns and relationships of "model_io" */
export type Model_IoVariablesArgs = {
  distinct_on?: InputMaybe<Array<Model_Io_Variable_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Io_Variable_Order_By>>;
  where?: InputMaybe<Model_Io_Variable_Bool_Exp>;
};


/** columns and relationships of "model_io" */
export type Model_IoVariables_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Model_Io_Variable_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Io_Variable_Order_By>>;
  where?: InputMaybe<Model_Io_Variable_Bool_Exp>;
};

/** aggregated selection of "model_io" */
export type Model_Io_Aggregate = {
  __typename?: 'model_io_aggregate';
  aggregate?: Maybe<Model_Io_Aggregate_Fields>;
  nodes: Array<Model_Io>;
};

/** aggregate fields of "model_io" */
export type Model_Io_Aggregate_Fields = {
  __typename?: 'model_io_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Model_Io_Max_Fields>;
  min?: Maybe<Model_Io_Min_Fields>;
};


/** aggregate fields of "model_io" */
export type Model_Io_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Model_Io_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "model_io". All fields are combined with a logical 'AND'. */
export type Model_Io_Bool_Exp = {
  _and?: InputMaybe<Array<Model_Io_Bool_Exp>>;
  _not?: InputMaybe<Model_Io_Bool_Exp>;
  _or?: InputMaybe<Array<Model_Io_Bool_Exp>>;
  description?: InputMaybe<String_Comparison_Exp>;
  execution_data_bindings?: InputMaybe<Execution_Data_Binding_Bool_Exp>;
  execution_results?: InputMaybe<Execution_Result_Bool_Exp>;
  fixed_bindings?: InputMaybe<Model_Input_Fixed_Binding_Bool_Exp>;
  format?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  model_inputs?: InputMaybe<Model_Input_Bool_Exp>;
  model_outputs?: InputMaybe<Model_Output_Bool_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  thread_model_ios?: InputMaybe<Thread_Model_Io_Bool_Exp>;
  type?: InputMaybe<String_Comparison_Exp>;
  variables?: InputMaybe<Model_Io_Variable_Bool_Exp>;
};

/** unique or primary key constraints on table "model_io" */
export enum Model_Io_Constraint {
  /** unique or primary key constraint on columns "id" */
  ModelIoPkey = 'model_io_pkey'
}

/** input type for inserting data into table "model_io" */
export type Model_Io_Insert_Input = {
  description?: InputMaybe<Scalars['String']['input']>;
  execution_data_bindings?: InputMaybe<Execution_Data_Binding_Arr_Rel_Insert_Input>;
  execution_results?: InputMaybe<Execution_Result_Arr_Rel_Insert_Input>;
  fixed_bindings?: InputMaybe<Model_Input_Fixed_Binding_Arr_Rel_Insert_Input>;
  format?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  model_inputs?: InputMaybe<Model_Input_Arr_Rel_Insert_Input>;
  model_outputs?: InputMaybe<Model_Output_Arr_Rel_Insert_Input>;
  name?: InputMaybe<Scalars['String']['input']>;
  thread_model_ios?: InputMaybe<Thread_Model_Io_Arr_Rel_Insert_Input>;
  type?: InputMaybe<Scalars['String']['input']>;
  variables?: InputMaybe<Model_Io_Variable_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type Model_Io_Max_Fields = {
  __typename?: 'model_io_max_fields';
  description?: Maybe<Scalars['String']['output']>;
  format?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  type?: Maybe<Scalars['String']['output']>;
};

/** aggregate min on columns */
export type Model_Io_Min_Fields = {
  __typename?: 'model_io_min_fields';
  description?: Maybe<Scalars['String']['output']>;
  format?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  type?: Maybe<Scalars['String']['output']>;
};

/** response of any mutation on the table "model_io" */
export type Model_Io_Mutation_Response = {
  __typename?: 'model_io_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Model_Io>;
};

/** input type for inserting object relation for remote table "model_io" */
export type Model_Io_Obj_Rel_Insert_Input = {
  data: Model_Io_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Model_Io_On_Conflict>;
};

/** on_conflict condition type for table "model_io" */
export type Model_Io_On_Conflict = {
  constraint: Model_Io_Constraint;
  update_columns?: Array<Model_Io_Update_Column>;
  where?: InputMaybe<Model_Io_Bool_Exp>;
};

/** Ordering options when selecting data from "model_io". */
export type Model_Io_Order_By = {
  description?: InputMaybe<Order_By>;
  execution_data_bindings_aggregate?: InputMaybe<Execution_Data_Binding_Aggregate_Order_By>;
  execution_results_aggregate?: InputMaybe<Execution_Result_Aggregate_Order_By>;
  fixed_bindings_aggregate?: InputMaybe<Model_Input_Fixed_Binding_Aggregate_Order_By>;
  format?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  model_inputs_aggregate?: InputMaybe<Model_Input_Aggregate_Order_By>;
  model_outputs_aggregate?: InputMaybe<Model_Output_Aggregate_Order_By>;
  name?: InputMaybe<Order_By>;
  thread_model_ios_aggregate?: InputMaybe<Thread_Model_Io_Aggregate_Order_By>;
  type?: InputMaybe<Order_By>;
  variables_aggregate?: InputMaybe<Model_Io_Variable_Aggregate_Order_By>;
};

/** primary key columns input for table: model_io */
export type Model_Io_Pk_Columns_Input = {
  id: Scalars['String']['input'];
};

/** select columns of table "model_io" */
export enum Model_Io_Select_Column {
  /** column name */
  Description = 'description',
  /** column name */
  Format = 'format',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  Type = 'type'
}

/** input type for updating data in table "model_io" */
export type Model_Io_Set_Input = {
  description?: InputMaybe<Scalars['String']['input']>;
  format?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<Scalars['String']['input']>;
};

/** update columns of table "model_io" */
export enum Model_Io_Update_Column {
  /** column name */
  Description = 'description',
  /** column name */
  Format = 'format',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  Type = 'type'
}

export type Model_Io_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Model_Io_Set_Input>;
  where: Model_Io_Bool_Exp;
};

/** columns and relationships of "model_io_variable" */
export type Model_Io_Variable = {
  __typename?: 'model_io_variable';
  /** An object relationship */
  model_io: Model_Io;
  model_io_id: Scalars['String']['output'];
  /** An object relationship */
  variable: Variable;
  variable_id: Scalars['String']['output'];
};

/** aggregated selection of "model_io_variable" */
export type Model_Io_Variable_Aggregate = {
  __typename?: 'model_io_variable_aggregate';
  aggregate?: Maybe<Model_Io_Variable_Aggregate_Fields>;
  nodes: Array<Model_Io_Variable>;
};

/** aggregate fields of "model_io_variable" */
export type Model_Io_Variable_Aggregate_Fields = {
  __typename?: 'model_io_variable_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Model_Io_Variable_Max_Fields>;
  min?: Maybe<Model_Io_Variable_Min_Fields>;
};


/** aggregate fields of "model_io_variable" */
export type Model_Io_Variable_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Model_Io_Variable_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "model_io_variable" */
export type Model_Io_Variable_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Model_Io_Variable_Max_Order_By>;
  min?: InputMaybe<Model_Io_Variable_Min_Order_By>;
};

/** input type for inserting array relation for remote table "model_io_variable" */
export type Model_Io_Variable_Arr_Rel_Insert_Input = {
  data: Array<Model_Io_Variable_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Model_Io_Variable_On_Conflict>;
};

/** Boolean expression to filter rows from the table "model_io_variable". All fields are combined with a logical 'AND'. */
export type Model_Io_Variable_Bool_Exp = {
  _and?: InputMaybe<Array<Model_Io_Variable_Bool_Exp>>;
  _not?: InputMaybe<Model_Io_Variable_Bool_Exp>;
  _or?: InputMaybe<Array<Model_Io_Variable_Bool_Exp>>;
  model_io?: InputMaybe<Model_Io_Bool_Exp>;
  model_io_id?: InputMaybe<String_Comparison_Exp>;
  variable?: InputMaybe<Variable_Bool_Exp>;
  variable_id?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "model_io_variable" */
export enum Model_Io_Variable_Constraint {
  /** unique or primary key constraint on columns "variable_id", "model_io_id" */
  ModelIoVariablePkey = 'model_io_variable_pkey'
}

/** input type for inserting data into table "model_io_variable" */
export type Model_Io_Variable_Insert_Input = {
  model_io?: InputMaybe<Model_Io_Obj_Rel_Insert_Input>;
  model_io_id?: InputMaybe<Scalars['String']['input']>;
  variable?: InputMaybe<Variable_Obj_Rel_Insert_Input>;
  variable_id?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Model_Io_Variable_Max_Fields = {
  __typename?: 'model_io_variable_max_fields';
  model_io_id?: Maybe<Scalars['String']['output']>;
  variable_id?: Maybe<Scalars['String']['output']>;
};

/** order by max() on columns of table "model_io_variable" */
export type Model_Io_Variable_Max_Order_By = {
  model_io_id?: InputMaybe<Order_By>;
  variable_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Model_Io_Variable_Min_Fields = {
  __typename?: 'model_io_variable_min_fields';
  model_io_id?: Maybe<Scalars['String']['output']>;
  variable_id?: Maybe<Scalars['String']['output']>;
};

/** order by min() on columns of table "model_io_variable" */
export type Model_Io_Variable_Min_Order_By = {
  model_io_id?: InputMaybe<Order_By>;
  variable_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "model_io_variable" */
export type Model_Io_Variable_Mutation_Response = {
  __typename?: 'model_io_variable_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Model_Io_Variable>;
};

/** on_conflict condition type for table "model_io_variable" */
export type Model_Io_Variable_On_Conflict = {
  constraint: Model_Io_Variable_Constraint;
  update_columns?: Array<Model_Io_Variable_Update_Column>;
  where?: InputMaybe<Model_Io_Variable_Bool_Exp>;
};

/** Ordering options when selecting data from "model_io_variable". */
export type Model_Io_Variable_Order_By = {
  model_io?: InputMaybe<Model_Io_Order_By>;
  model_io_id?: InputMaybe<Order_By>;
  variable?: InputMaybe<Variable_Order_By>;
  variable_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: model_io_variable */
export type Model_Io_Variable_Pk_Columns_Input = {
  model_io_id: Scalars['String']['input'];
  variable_id: Scalars['String']['input'];
};

/** select columns of table "model_io_variable" */
export enum Model_Io_Variable_Select_Column {
  /** column name */
  ModelIoId = 'model_io_id',
  /** column name */
  VariableId = 'variable_id'
}

/** input type for updating data in table "model_io_variable" */
export type Model_Io_Variable_Set_Input = {
  model_io_id?: InputMaybe<Scalars['String']['input']>;
  variable_id?: InputMaybe<Scalars['String']['input']>;
};

/** update columns of table "model_io_variable" */
export enum Model_Io_Variable_Update_Column {
  /** column name */
  ModelIoId = 'model_io_id',
  /** column name */
  VariableId = 'variable_id'
}

export type Model_Io_Variable_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Model_Io_Variable_Set_Input>;
  where: Model_Io_Variable_Bool_Exp;
};

/** aggregate max on columns */
export type Model_Max_Fields = {
  __typename?: 'model_max_fields';
  calibration_target_variable?: Maybe<Scalars['String']['output']>;
  category?: Maybe<Scalars['String']['output']>;
  code_url?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  dimensionality?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  model_configuration?: Maybe<Scalars['String']['output']>;
  model_name?: Maybe<Scalars['String']['output']>;
  model_version?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  output_time_interval?: Maybe<Scalars['String']['output']>;
  parameter_assignment?: Maybe<Scalars['String']['output']>;
  parameter_assignment_details?: Maybe<Scalars['String']['output']>;
  region_name?: Maybe<Scalars['String']['output']>;
  software_image?: Maybe<Scalars['String']['output']>;
  spatial_grid_resolution?: Maybe<Scalars['String']['output']>;
  spatial_grid_type?: Maybe<Scalars['String']['output']>;
  type?: Maybe<Scalars['String']['output']>;
  usage_notes?: Maybe<Scalars['String']['output']>;
  user_id?: Maybe<Scalars['String']['output']>;
};

/** aggregate min on columns */
export type Model_Min_Fields = {
  __typename?: 'model_min_fields';
  calibration_target_variable?: Maybe<Scalars['String']['output']>;
  category?: Maybe<Scalars['String']['output']>;
  code_url?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  dimensionality?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  model_configuration?: Maybe<Scalars['String']['output']>;
  model_name?: Maybe<Scalars['String']['output']>;
  model_version?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  output_time_interval?: Maybe<Scalars['String']['output']>;
  parameter_assignment?: Maybe<Scalars['String']['output']>;
  parameter_assignment_details?: Maybe<Scalars['String']['output']>;
  region_name?: Maybe<Scalars['String']['output']>;
  software_image?: Maybe<Scalars['String']['output']>;
  spatial_grid_resolution?: Maybe<Scalars['String']['output']>;
  spatial_grid_type?: Maybe<Scalars['String']['output']>;
  type?: Maybe<Scalars['String']['output']>;
  usage_notes?: Maybe<Scalars['String']['output']>;
  user_id?: Maybe<Scalars['String']['output']>;
};

/** response of any mutation on the table "model" */
export type Model_Mutation_Response = {
  __typename?: 'model_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Model>;
};

/** input type for inserting object relation for remote table "model" */
export type Model_Obj_Rel_Insert_Input = {
  data: Model_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Model_On_Conflict>;
};

/** on_conflict condition type for table "model" */
export type Model_On_Conflict = {
  constraint: Model_Constraint;
  update_columns?: Array<Model_Update_Column>;
  where?: InputMaybe<Model_Bool_Exp>;
};

/** Ordering options when selecting data from "model". */
export type Model_Order_By = {
  calibration_target_variable?: InputMaybe<Order_By>;
  category?: InputMaybe<Order_By>;
  code_url?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  dimensionality?: InputMaybe<Order_By>;
  executions_aggregate?: InputMaybe<Execution_Aggregate_Order_By>;
  id?: InputMaybe<Order_By>;
  inputs_aggregate?: InputMaybe<Model_Input_Aggregate_Order_By>;
  model_configuration?: InputMaybe<Order_By>;
  model_name?: InputMaybe<Order_By>;
  model_version?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  output_time_interval?: InputMaybe<Order_By>;
  outputs_aggregate?: InputMaybe<Model_Output_Aggregate_Order_By>;
  parameter_assignment?: InputMaybe<Order_By>;
  parameter_assignment_details?: InputMaybe<Order_By>;
  parameters_aggregate?: InputMaybe<Model_Parameter_Aggregate_Order_By>;
  region_name?: InputMaybe<Order_By>;
  software_image?: InputMaybe<Order_By>;
  spatial_grid_resolution?: InputMaybe<Order_By>;
  spatial_grid_type?: InputMaybe<Order_By>;
  thread_models_aggregate?: InputMaybe<Thread_Model_Aggregate_Order_By>;
  type?: InputMaybe<Order_By>;
  usage_notes?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** columns and relationships of "model_output" */
export type Model_Output = {
  __typename?: 'model_output';
  /** An object relationship */
  model: Model;
  model_id: Scalars['String']['output'];
  /** An object relationship */
  model_io: Model_Io;
  model_io_id: Scalars['String']['output'];
  position?: Maybe<Scalars['Int']['output']>;
};

/** aggregated selection of "model_output" */
export type Model_Output_Aggregate = {
  __typename?: 'model_output_aggregate';
  aggregate?: Maybe<Model_Output_Aggregate_Fields>;
  nodes: Array<Model_Output>;
};

/** aggregate fields of "model_output" */
export type Model_Output_Aggregate_Fields = {
  __typename?: 'model_output_aggregate_fields';
  avg?: Maybe<Model_Output_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Model_Output_Max_Fields>;
  min?: Maybe<Model_Output_Min_Fields>;
  stddev?: Maybe<Model_Output_Stddev_Fields>;
  stddev_pop?: Maybe<Model_Output_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Model_Output_Stddev_Samp_Fields>;
  sum?: Maybe<Model_Output_Sum_Fields>;
  var_pop?: Maybe<Model_Output_Var_Pop_Fields>;
  var_samp?: Maybe<Model_Output_Var_Samp_Fields>;
  variance?: Maybe<Model_Output_Variance_Fields>;
};


/** aggregate fields of "model_output" */
export type Model_Output_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Model_Output_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "model_output" */
export type Model_Output_Aggregate_Order_By = {
  avg?: InputMaybe<Model_Output_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Model_Output_Max_Order_By>;
  min?: InputMaybe<Model_Output_Min_Order_By>;
  stddev?: InputMaybe<Model_Output_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Model_Output_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Model_Output_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Model_Output_Sum_Order_By>;
  var_pop?: InputMaybe<Model_Output_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Model_Output_Var_Samp_Order_By>;
  variance?: InputMaybe<Model_Output_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "model_output" */
export type Model_Output_Arr_Rel_Insert_Input = {
  data: Array<Model_Output_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Model_Output_On_Conflict>;
};

/** aggregate avg on columns */
export type Model_Output_Avg_Fields = {
  __typename?: 'model_output_avg_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "model_output" */
export type Model_Output_Avg_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "model_output". All fields are combined with a logical 'AND'. */
export type Model_Output_Bool_Exp = {
  _and?: InputMaybe<Array<Model_Output_Bool_Exp>>;
  _not?: InputMaybe<Model_Output_Bool_Exp>;
  _or?: InputMaybe<Array<Model_Output_Bool_Exp>>;
  model?: InputMaybe<Model_Bool_Exp>;
  model_id?: InputMaybe<String_Comparison_Exp>;
  model_io?: InputMaybe<Model_Io_Bool_Exp>;
  model_io_id?: InputMaybe<String_Comparison_Exp>;
  position?: InputMaybe<Int_Comparison_Exp>;
};

/** unique or primary key constraints on table "model_output" */
export enum Model_Output_Constraint {
  /** unique or primary key constraint on columns "model_io_id", "model_id" */
  ModelOutputPkey = 'model_output_pkey'
}

/** input type for incrementing numeric columns in table "model_output" */
export type Model_Output_Inc_Input = {
  position?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "model_output" */
export type Model_Output_Insert_Input = {
  model?: InputMaybe<Model_Obj_Rel_Insert_Input>;
  model_id?: InputMaybe<Scalars['String']['input']>;
  model_io?: InputMaybe<Model_Io_Obj_Rel_Insert_Input>;
  model_io_id?: InputMaybe<Scalars['String']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
};

/** aggregate max on columns */
export type Model_Output_Max_Fields = {
  __typename?: 'model_output_max_fields';
  model_id?: Maybe<Scalars['String']['output']>;
  model_io_id?: Maybe<Scalars['String']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
};

/** order by max() on columns of table "model_output" */
export type Model_Output_Max_Order_By = {
  model_id?: InputMaybe<Order_By>;
  model_io_id?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Model_Output_Min_Fields = {
  __typename?: 'model_output_min_fields';
  model_id?: Maybe<Scalars['String']['output']>;
  model_io_id?: Maybe<Scalars['String']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
};

/** order by min() on columns of table "model_output" */
export type Model_Output_Min_Order_By = {
  model_id?: InputMaybe<Order_By>;
  model_io_id?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "model_output" */
export type Model_Output_Mutation_Response = {
  __typename?: 'model_output_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Model_Output>;
};

/** on_conflict condition type for table "model_output" */
export type Model_Output_On_Conflict = {
  constraint: Model_Output_Constraint;
  update_columns?: Array<Model_Output_Update_Column>;
  where?: InputMaybe<Model_Output_Bool_Exp>;
};

/** Ordering options when selecting data from "model_output". */
export type Model_Output_Order_By = {
  model?: InputMaybe<Model_Order_By>;
  model_id?: InputMaybe<Order_By>;
  model_io?: InputMaybe<Model_Io_Order_By>;
  model_io_id?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
};

/** primary key columns input for table: model_output */
export type Model_Output_Pk_Columns_Input = {
  model_id: Scalars['String']['input'];
  model_io_id: Scalars['String']['input'];
};

/** select columns of table "model_output" */
export enum Model_Output_Select_Column {
  /** column name */
  ModelId = 'model_id',
  /** column name */
  ModelIoId = 'model_io_id',
  /** column name */
  Position = 'position'
}

/** input type for updating data in table "model_output" */
export type Model_Output_Set_Input = {
  model_id?: InputMaybe<Scalars['String']['input']>;
  model_io_id?: InputMaybe<Scalars['String']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
};

/** aggregate stddev on columns */
export type Model_Output_Stddev_Fields = {
  __typename?: 'model_output_stddev_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "model_output" */
export type Model_Output_Stddev_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Model_Output_Stddev_Pop_Fields = {
  __typename?: 'model_output_stddev_pop_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "model_output" */
export type Model_Output_Stddev_Pop_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Model_Output_Stddev_Samp_Fields = {
  __typename?: 'model_output_stddev_samp_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "model_output" */
export type Model_Output_Stddev_Samp_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate sum on columns */
export type Model_Output_Sum_Fields = {
  __typename?: 'model_output_sum_fields';
  position?: Maybe<Scalars['Int']['output']>;
};

/** order by sum() on columns of table "model_output" */
export type Model_Output_Sum_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** update columns of table "model_output" */
export enum Model_Output_Update_Column {
  /** column name */
  ModelId = 'model_id',
  /** column name */
  ModelIoId = 'model_io_id',
  /** column name */
  Position = 'position'
}

export type Model_Output_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Model_Output_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Model_Output_Set_Input>;
  where: Model_Output_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Model_Output_Var_Pop_Fields = {
  __typename?: 'model_output_var_pop_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "model_output" */
export type Model_Output_Var_Pop_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Model_Output_Var_Samp_Fields = {
  __typename?: 'model_output_var_samp_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "model_output" */
export type Model_Output_Var_Samp_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Model_Output_Variance_Fields = {
  __typename?: 'model_output_variance_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "model_output" */
export type Model_Output_Variance_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** columns and relationships of "model_parameter" */
export type Model_Parameter = {
  __typename?: 'model_parameter';
  accepted_values?: Maybe<Scalars['String']['output']>;
  adjustment_variable?: Maybe<Scalars['String']['output']>;
  datatype?: Maybe<Scalars['String']['output']>;
  default?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  /** An array relationship */
  execution_parameter_bindings: Array<Execution_Parameter_Binding>;
  /** An aggregate relationship */
  execution_parameter_bindings_aggregate: Execution_Parameter_Binding_Aggregate;
  fixed_value?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  max?: Maybe<Scalars['String']['output']>;
  min?: Maybe<Scalars['String']['output']>;
  /** An object relationship */
  model: Model;
  model_id: Scalars['String']['output'];
  name: Scalars['String']['output'];
  position?: Maybe<Scalars['Int']['output']>;
  /** An array relationship */
  thread_model_parameters: Array<Thread_Model_Parameter>;
  /** An aggregate relationship */
  thread_model_parameters_aggregate: Thread_Model_Parameter_Aggregate;
  type?: Maybe<Scalars['String']['output']>;
  unit?: Maybe<Scalars['String']['output']>;
};


/** columns and relationships of "model_parameter" */
export type Model_ParameterExecution_Parameter_BindingsArgs = {
  distinct_on?: InputMaybe<Array<Execution_Parameter_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Parameter_Binding_Order_By>>;
  where?: InputMaybe<Execution_Parameter_Binding_Bool_Exp>;
};


/** columns and relationships of "model_parameter" */
export type Model_ParameterExecution_Parameter_Bindings_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Execution_Parameter_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Parameter_Binding_Order_By>>;
  where?: InputMaybe<Execution_Parameter_Binding_Bool_Exp>;
};


/** columns and relationships of "model_parameter" */
export type Model_ParameterThread_Model_ParametersArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Parameter_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Parameter_Order_By>>;
  where?: InputMaybe<Thread_Model_Parameter_Bool_Exp>;
};


/** columns and relationships of "model_parameter" */
export type Model_ParameterThread_Model_Parameters_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Parameter_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Parameter_Order_By>>;
  where?: InputMaybe<Thread_Model_Parameter_Bool_Exp>;
};

/** aggregated selection of "model_parameter" */
export type Model_Parameter_Aggregate = {
  __typename?: 'model_parameter_aggregate';
  aggregate?: Maybe<Model_Parameter_Aggregate_Fields>;
  nodes: Array<Model_Parameter>;
};

/** aggregate fields of "model_parameter" */
export type Model_Parameter_Aggregate_Fields = {
  __typename?: 'model_parameter_aggregate_fields';
  avg?: Maybe<Model_Parameter_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Model_Parameter_Max_Fields>;
  min?: Maybe<Model_Parameter_Min_Fields>;
  stddev?: Maybe<Model_Parameter_Stddev_Fields>;
  stddev_pop?: Maybe<Model_Parameter_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Model_Parameter_Stddev_Samp_Fields>;
  sum?: Maybe<Model_Parameter_Sum_Fields>;
  var_pop?: Maybe<Model_Parameter_Var_Pop_Fields>;
  var_samp?: Maybe<Model_Parameter_Var_Samp_Fields>;
  variance?: Maybe<Model_Parameter_Variance_Fields>;
};


/** aggregate fields of "model_parameter" */
export type Model_Parameter_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Model_Parameter_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "model_parameter" */
export type Model_Parameter_Aggregate_Order_By = {
  avg?: InputMaybe<Model_Parameter_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Model_Parameter_Max_Order_By>;
  min?: InputMaybe<Model_Parameter_Min_Order_By>;
  stddev?: InputMaybe<Model_Parameter_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Model_Parameter_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Model_Parameter_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Model_Parameter_Sum_Order_By>;
  var_pop?: InputMaybe<Model_Parameter_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Model_Parameter_Var_Samp_Order_By>;
  variance?: InputMaybe<Model_Parameter_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "model_parameter" */
export type Model_Parameter_Arr_Rel_Insert_Input = {
  data: Array<Model_Parameter_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Model_Parameter_On_Conflict>;
};

/** aggregate avg on columns */
export type Model_Parameter_Avg_Fields = {
  __typename?: 'model_parameter_avg_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "model_parameter" */
export type Model_Parameter_Avg_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "model_parameter". All fields are combined with a logical 'AND'. */
export type Model_Parameter_Bool_Exp = {
  _and?: InputMaybe<Array<Model_Parameter_Bool_Exp>>;
  _not?: InputMaybe<Model_Parameter_Bool_Exp>;
  _or?: InputMaybe<Array<Model_Parameter_Bool_Exp>>;
  accepted_values?: InputMaybe<String_Comparison_Exp>;
  adjustment_variable?: InputMaybe<String_Comparison_Exp>;
  datatype?: InputMaybe<String_Comparison_Exp>;
  default?: InputMaybe<String_Comparison_Exp>;
  description?: InputMaybe<String_Comparison_Exp>;
  execution_parameter_bindings?: InputMaybe<Execution_Parameter_Binding_Bool_Exp>;
  fixed_value?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  max?: InputMaybe<String_Comparison_Exp>;
  min?: InputMaybe<String_Comparison_Exp>;
  model?: InputMaybe<Model_Bool_Exp>;
  model_id?: InputMaybe<String_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  position?: InputMaybe<Int_Comparison_Exp>;
  thread_model_parameters?: InputMaybe<Thread_Model_Parameter_Bool_Exp>;
  type?: InputMaybe<String_Comparison_Exp>;
  unit?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "model_parameter" */
export enum Model_Parameter_Constraint {
  /** unique or primary key constraint on columns "id" */
  ModelParameterPkey = 'model_parameter_pkey'
}

/** input type for incrementing numeric columns in table "model_parameter" */
export type Model_Parameter_Inc_Input = {
  position?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "model_parameter" */
export type Model_Parameter_Insert_Input = {
  accepted_values?: InputMaybe<Scalars['String']['input']>;
  adjustment_variable?: InputMaybe<Scalars['String']['input']>;
  datatype?: InputMaybe<Scalars['String']['input']>;
  default?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  execution_parameter_bindings?: InputMaybe<Execution_Parameter_Binding_Arr_Rel_Insert_Input>;
  fixed_value?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  max?: InputMaybe<Scalars['String']['input']>;
  min?: InputMaybe<Scalars['String']['input']>;
  model?: InputMaybe<Model_Obj_Rel_Insert_Input>;
  model_id?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  thread_model_parameters?: InputMaybe<Thread_Model_Parameter_Arr_Rel_Insert_Input>;
  type?: InputMaybe<Scalars['String']['input']>;
  unit?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Model_Parameter_Max_Fields = {
  __typename?: 'model_parameter_max_fields';
  accepted_values?: Maybe<Scalars['String']['output']>;
  adjustment_variable?: Maybe<Scalars['String']['output']>;
  datatype?: Maybe<Scalars['String']['output']>;
  default?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  fixed_value?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  max?: Maybe<Scalars['String']['output']>;
  min?: Maybe<Scalars['String']['output']>;
  model_id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  type?: Maybe<Scalars['String']['output']>;
  unit?: Maybe<Scalars['String']['output']>;
};

/** order by max() on columns of table "model_parameter" */
export type Model_Parameter_Max_Order_By = {
  accepted_values?: InputMaybe<Order_By>;
  adjustment_variable?: InputMaybe<Order_By>;
  datatype?: InputMaybe<Order_By>;
  default?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  fixed_value?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  max?: InputMaybe<Order_By>;
  min?: InputMaybe<Order_By>;
  model_id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  type?: InputMaybe<Order_By>;
  unit?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Model_Parameter_Min_Fields = {
  __typename?: 'model_parameter_min_fields';
  accepted_values?: Maybe<Scalars['String']['output']>;
  adjustment_variable?: Maybe<Scalars['String']['output']>;
  datatype?: Maybe<Scalars['String']['output']>;
  default?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  fixed_value?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  max?: Maybe<Scalars['String']['output']>;
  min?: Maybe<Scalars['String']['output']>;
  model_id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  type?: Maybe<Scalars['String']['output']>;
  unit?: Maybe<Scalars['String']['output']>;
};

/** order by min() on columns of table "model_parameter" */
export type Model_Parameter_Min_Order_By = {
  accepted_values?: InputMaybe<Order_By>;
  adjustment_variable?: InputMaybe<Order_By>;
  datatype?: InputMaybe<Order_By>;
  default?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  fixed_value?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  max?: InputMaybe<Order_By>;
  min?: InputMaybe<Order_By>;
  model_id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  type?: InputMaybe<Order_By>;
  unit?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "model_parameter" */
export type Model_Parameter_Mutation_Response = {
  __typename?: 'model_parameter_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Model_Parameter>;
};

/** input type for inserting object relation for remote table "model_parameter" */
export type Model_Parameter_Obj_Rel_Insert_Input = {
  data: Model_Parameter_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Model_Parameter_On_Conflict>;
};

/** on_conflict condition type for table "model_parameter" */
export type Model_Parameter_On_Conflict = {
  constraint: Model_Parameter_Constraint;
  update_columns?: Array<Model_Parameter_Update_Column>;
  where?: InputMaybe<Model_Parameter_Bool_Exp>;
};

/** Ordering options when selecting data from "model_parameter". */
export type Model_Parameter_Order_By = {
  accepted_values?: InputMaybe<Order_By>;
  adjustment_variable?: InputMaybe<Order_By>;
  datatype?: InputMaybe<Order_By>;
  default?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  execution_parameter_bindings_aggregate?: InputMaybe<Execution_Parameter_Binding_Aggregate_Order_By>;
  fixed_value?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  max?: InputMaybe<Order_By>;
  min?: InputMaybe<Order_By>;
  model?: InputMaybe<Model_Order_By>;
  model_id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  thread_model_parameters_aggregate?: InputMaybe<Thread_Model_Parameter_Aggregate_Order_By>;
  type?: InputMaybe<Order_By>;
  unit?: InputMaybe<Order_By>;
};

/** primary key columns input for table: model_parameter */
export type Model_Parameter_Pk_Columns_Input = {
  id: Scalars['String']['input'];
};

/** select columns of table "model_parameter" */
export enum Model_Parameter_Select_Column {
  /** column name */
  AcceptedValues = 'accepted_values',
  /** column name */
  AdjustmentVariable = 'adjustment_variable',
  /** column name */
  Datatype = 'datatype',
  /** column name */
  Default = 'default',
  /** column name */
  Description = 'description',
  /** column name */
  FixedValue = 'fixed_value',
  /** column name */
  Id = 'id',
  /** column name */
  Max = 'max',
  /** column name */
  Min = 'min',
  /** column name */
  ModelId = 'model_id',
  /** column name */
  Name = 'name',
  /** column name */
  Position = 'position',
  /** column name */
  Type = 'type',
  /** column name */
  Unit = 'unit'
}

/** input type for updating data in table "model_parameter" */
export type Model_Parameter_Set_Input = {
  accepted_values?: InputMaybe<Scalars['String']['input']>;
  adjustment_variable?: InputMaybe<Scalars['String']['input']>;
  datatype?: InputMaybe<Scalars['String']['input']>;
  default?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  fixed_value?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  max?: InputMaybe<Scalars['String']['input']>;
  min?: InputMaybe<Scalars['String']['input']>;
  model_id?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  type?: InputMaybe<Scalars['String']['input']>;
  unit?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate stddev on columns */
export type Model_Parameter_Stddev_Fields = {
  __typename?: 'model_parameter_stddev_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "model_parameter" */
export type Model_Parameter_Stddev_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Model_Parameter_Stddev_Pop_Fields = {
  __typename?: 'model_parameter_stddev_pop_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "model_parameter" */
export type Model_Parameter_Stddev_Pop_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Model_Parameter_Stddev_Samp_Fields = {
  __typename?: 'model_parameter_stddev_samp_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "model_parameter" */
export type Model_Parameter_Stddev_Samp_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate sum on columns */
export type Model_Parameter_Sum_Fields = {
  __typename?: 'model_parameter_sum_fields';
  position?: Maybe<Scalars['Int']['output']>;
};

/** order by sum() on columns of table "model_parameter" */
export type Model_Parameter_Sum_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** update columns of table "model_parameter" */
export enum Model_Parameter_Update_Column {
  /** column name */
  AcceptedValues = 'accepted_values',
  /** column name */
  AdjustmentVariable = 'adjustment_variable',
  /** column name */
  Datatype = 'datatype',
  /** column name */
  Default = 'default',
  /** column name */
  Description = 'description',
  /** column name */
  FixedValue = 'fixed_value',
  /** column name */
  Id = 'id',
  /** column name */
  Max = 'max',
  /** column name */
  Min = 'min',
  /** column name */
  ModelId = 'model_id',
  /** column name */
  Name = 'name',
  /** column name */
  Position = 'position',
  /** column name */
  Type = 'type',
  /** column name */
  Unit = 'unit'
}

export type Model_Parameter_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Model_Parameter_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Model_Parameter_Set_Input>;
  where: Model_Parameter_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Model_Parameter_Var_Pop_Fields = {
  __typename?: 'model_parameter_var_pop_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "model_parameter" */
export type Model_Parameter_Var_Pop_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Model_Parameter_Var_Samp_Fields = {
  __typename?: 'model_parameter_var_samp_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "model_parameter" */
export type Model_Parameter_Var_Samp_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Model_Parameter_Variance_Fields = {
  __typename?: 'model_parameter_variance_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "model_parameter" */
export type Model_Parameter_Variance_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** primary key columns input for table: model */
export type Model_Pk_Columns_Input = {
  id: Scalars['String']['input'];
};

/** select columns of table "model" */
export enum Model_Select_Column {
  /** column name */
  CalibrationTargetVariable = 'calibration_target_variable',
  /** column name */
  Category = 'category',
  /** column name */
  CodeUrl = 'code_url',
  /** column name */
  Description = 'description',
  /** column name */
  Dimensionality = 'dimensionality',
  /** column name */
  Id = 'id',
  /** column name */
  ModelConfiguration = 'model_configuration',
  /** column name */
  ModelName = 'model_name',
  /** column name */
  ModelVersion = 'model_version',
  /** column name */
  Name = 'name',
  /** column name */
  OutputTimeInterval = 'output_time_interval',
  /** column name */
  ParameterAssignment = 'parameter_assignment',
  /** column name */
  ParameterAssignmentDetails = 'parameter_assignment_details',
  /** column name */
  RegionName = 'region_name',
  /** column name */
  SoftwareImage = 'software_image',
  /** column name */
  SpatialGridResolution = 'spatial_grid_resolution',
  /** column name */
  SpatialGridType = 'spatial_grid_type',
  /** column name */
  Type = 'type',
  /** column name */
  UsageNotes = 'usage_notes',
  /** column name */
  UserId = 'user_id'
}

/** input type for updating data in table "model" */
export type Model_Set_Input = {
  calibration_target_variable?: InputMaybe<Scalars['String']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  code_url?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  dimensionality?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  model_configuration?: InputMaybe<Scalars['String']['input']>;
  model_name?: InputMaybe<Scalars['String']['input']>;
  model_version?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  output_time_interval?: InputMaybe<Scalars['String']['input']>;
  parameter_assignment?: InputMaybe<Scalars['String']['input']>;
  parameter_assignment_details?: InputMaybe<Scalars['String']['input']>;
  region_name?: InputMaybe<Scalars['String']['input']>;
  software_image?: InputMaybe<Scalars['String']['input']>;
  spatial_grid_resolution?: InputMaybe<Scalars['String']['input']>;
  spatial_grid_type?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<Scalars['String']['input']>;
  usage_notes?: InputMaybe<Scalars['String']['input']>;
  user_id?: InputMaybe<Scalars['String']['input']>;
};

/** update columns of table "model" */
export enum Model_Update_Column {
  /** column name */
  CalibrationTargetVariable = 'calibration_target_variable',
  /** column name */
  Category = 'category',
  /** column name */
  CodeUrl = 'code_url',
  /** column name */
  Description = 'description',
  /** column name */
  Dimensionality = 'dimensionality',
  /** column name */
  Id = 'id',
  /** column name */
  ModelConfiguration = 'model_configuration',
  /** column name */
  ModelName = 'model_name',
  /** column name */
  ModelVersion = 'model_version',
  /** column name */
  Name = 'name',
  /** column name */
  OutputTimeInterval = 'output_time_interval',
  /** column name */
  ParameterAssignment = 'parameter_assignment',
  /** column name */
  ParameterAssignmentDetails = 'parameter_assignment_details',
  /** column name */
  RegionName = 'region_name',
  /** column name */
  SoftwareImage = 'software_image',
  /** column name */
  SpatialGridResolution = 'spatial_grid_resolution',
  /** column name */
  SpatialGridType = 'spatial_grid_type',
  /** column name */
  Type = 'type',
  /** column name */
  UsageNotes = 'usage_notes',
  /** column name */
  UserId = 'user_id'
}

export type Model_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Model_Set_Input>;
  where: Model_Bool_Exp;
};

/** mutation root */
export type Mutation_Root = {
  __typename?: 'mutation_root';
  /** delete data from the table: "dataset" */
  delete_dataset?: Maybe<Dataset_Mutation_Response>;
  /** delete single row from the table: "dataset" */
  delete_dataset_by_pk?: Maybe<Dataset>;
  /** delete data from the table: "dataslice" */
  delete_dataslice?: Maybe<Dataslice_Mutation_Response>;
  /** delete single row from the table: "dataslice" */
  delete_dataslice_by_pk?: Maybe<Dataslice>;
  /** delete data from the table: "dataslice_resource" */
  delete_dataslice_resource?: Maybe<Dataslice_Resource_Mutation_Response>;
  /** delete single row from the table: "dataslice_resource" */
  delete_dataslice_resource_by_pk?: Maybe<Dataslice_Resource>;
  /** delete data from the table: "execution" */
  delete_execution?: Maybe<Execution_Mutation_Response>;
  /** delete single row from the table: "execution" */
  delete_execution_by_pk?: Maybe<Execution>;
  /** delete data from the table: "execution_data_binding" */
  delete_execution_data_binding?: Maybe<Execution_Data_Binding_Mutation_Response>;
  /** delete single row from the table: "execution_data_binding" */
  delete_execution_data_binding_by_pk?: Maybe<Execution_Data_Binding>;
  /** delete data from the table: "execution_parameter_binding" */
  delete_execution_parameter_binding?: Maybe<Execution_Parameter_Binding_Mutation_Response>;
  /** delete single row from the table: "execution_parameter_binding" */
  delete_execution_parameter_binding_by_pk?: Maybe<Execution_Parameter_Binding>;
  /** delete data from the table: "execution_result" */
  delete_execution_result?: Maybe<Execution_Result_Mutation_Response>;
  /** delete single row from the table: "execution_result" */
  delete_execution_result_by_pk?: Maybe<Execution_Result>;
  /** delete data from the table: "intervention" */
  delete_intervention?: Maybe<Intervention_Mutation_Response>;
  /** delete single row from the table: "intervention" */
  delete_intervention_by_pk?: Maybe<Intervention>;
  /** delete data from the table: "model" */
  delete_model?: Maybe<Model_Mutation_Response>;
  /** delete single row from the table: "model" */
  delete_model_by_pk?: Maybe<Model>;
  /** delete data from the table: "model_input" */
  delete_model_input?: Maybe<Model_Input_Mutation_Response>;
  /** delete single row from the table: "model_input" */
  delete_model_input_by_pk?: Maybe<Model_Input>;
  /** delete data from the table: "model_input_fixed_binding" */
  delete_model_input_fixed_binding?: Maybe<Model_Input_Fixed_Binding_Mutation_Response>;
  /** delete single row from the table: "model_input_fixed_binding" */
  delete_model_input_fixed_binding_by_pk?: Maybe<Model_Input_Fixed_Binding>;
  /** delete data from the table: "model_io" */
  delete_model_io?: Maybe<Model_Io_Mutation_Response>;
  /** delete single row from the table: "model_io" */
  delete_model_io_by_pk?: Maybe<Model_Io>;
  /** delete data from the table: "model_io_variable" */
  delete_model_io_variable?: Maybe<Model_Io_Variable_Mutation_Response>;
  /** delete single row from the table: "model_io_variable" */
  delete_model_io_variable_by_pk?: Maybe<Model_Io_Variable>;
  /** delete data from the table: "model_output" */
  delete_model_output?: Maybe<Model_Output_Mutation_Response>;
  /** delete single row from the table: "model_output" */
  delete_model_output_by_pk?: Maybe<Model_Output>;
  /** delete data from the table: "model_parameter" */
  delete_model_parameter?: Maybe<Model_Parameter_Mutation_Response>;
  /** delete single row from the table: "model_parameter" */
  delete_model_parameter_by_pk?: Maybe<Model_Parameter>;
  /** delete data from the table: "problem_statement" */
  delete_problem_statement?: Maybe<Problem_Statement_Mutation_Response>;
  /** delete single row from the table: "problem_statement" */
  delete_problem_statement_by_pk?: Maybe<Problem_Statement>;
  /** delete data from the table: "problem_statement_permission" */
  delete_problem_statement_permission?: Maybe<Problem_Statement_Permission_Mutation_Response>;
  /** delete single row from the table: "problem_statement_permission" */
  delete_problem_statement_permission_by_pk?: Maybe<Problem_Statement_Permission>;
  /** delete data from the table: "problem_statement_provenance" */
  delete_problem_statement_provenance?: Maybe<Problem_Statement_Provenance_Mutation_Response>;
  /** delete single row from the table: "problem_statement_provenance" */
  delete_problem_statement_provenance_by_pk?: Maybe<Problem_Statement_Provenance>;
  /** delete data from the table: "profile" */
  delete_profile?: Maybe<Profile_Mutation_Response>;
  /** delete single row from the table: "profile" */
  delete_profile_by_pk?: Maybe<Profile>;
  /** delete data from the table: "region" */
  delete_region?: Maybe<Region_Mutation_Response>;
  /** delete single row from the table: "region" */
  delete_region_by_pk?: Maybe<Region>;
  /** delete data from the table: "region_category" */
  delete_region_category?: Maybe<Region_Category_Mutation_Response>;
  /** delete single row from the table: "region_category" */
  delete_region_category_by_pk?: Maybe<Region_Category>;
  /** delete data from the table: "region_category_tree" */
  delete_region_category_tree?: Maybe<Region_Category_Tree_Mutation_Response>;
  /** delete single row from the table: "region_category_tree" */
  delete_region_category_tree_by_pk?: Maybe<Region_Category_Tree>;
  /** delete data from the table: "region_geometry" */
  delete_region_geometry?: Maybe<Region_Geometry_Mutation_Response>;
  /** delete single row from the table: "region_geometry" */
  delete_region_geometry_by_pk?: Maybe<Region_Geometry>;
  /** delete data from the table: "regions_containing_point" */
  delete_regions_containing_point?: Maybe<Regions_Containing_Point_Mutation_Response>;
  /** delete data from the table: "resource" */
  delete_resource?: Maybe<Resource_Mutation_Response>;
  /** delete single row from the table: "resource" */
  delete_resource_by_pk?: Maybe<Resource>;
  /** delete data from the table: "task" */
  delete_task?: Maybe<Task_Mutation_Response>;
  /** delete single row from the table: "task" */
  delete_task_by_pk?: Maybe<Task>;
  /** delete data from the table: "task_permission" */
  delete_task_permission?: Maybe<Task_Permission_Mutation_Response>;
  /** delete single row from the table: "task_permission" */
  delete_task_permission_by_pk?: Maybe<Task_Permission>;
  /** delete data from the table: "task_provenance" */
  delete_task_provenance?: Maybe<Task_Provenance_Mutation_Response>;
  /** delete single row from the table: "task_provenance" */
  delete_task_provenance_by_pk?: Maybe<Task_Provenance>;
  /** delete data from the table: "thread" */
  delete_thread?: Maybe<Thread_Mutation_Response>;
  /** delete single row from the table: "thread" */
  delete_thread_by_pk?: Maybe<Thread>;
  /** delete data from the table: "thread_data" */
  delete_thread_data?: Maybe<Thread_Data_Mutation_Response>;
  /** delete single row from the table: "thread_data" */
  delete_thread_data_by_pk?: Maybe<Thread_Data>;
  /** delete data from the table: "thread_model" */
  delete_thread_model?: Maybe<Thread_Model_Mutation_Response>;
  /** delete single row from the table: "thread_model" */
  delete_thread_model_by_pk?: Maybe<Thread_Model>;
  /** delete data from the table: "thread_model_execution" */
  delete_thread_model_execution?: Maybe<Thread_Model_Execution_Mutation_Response>;
  /** delete single row from the table: "thread_model_execution" */
  delete_thread_model_execution_by_pk?: Maybe<Thread_Model_Execution>;
  /** delete data from the table: "thread_model_execution_summary" */
  delete_thread_model_execution_summary?: Maybe<Thread_Model_Execution_Summary_Mutation_Response>;
  /** delete single row from the table: "thread_model_execution_summary" */
  delete_thread_model_execution_summary_by_pk?: Maybe<Thread_Model_Execution_Summary>;
  /** delete data from the table: "thread_model_io" */
  delete_thread_model_io?: Maybe<Thread_Model_Io_Mutation_Response>;
  /** delete single row from the table: "thread_model_io" */
  delete_thread_model_io_by_pk?: Maybe<Thread_Model_Io>;
  /** delete data from the table: "thread_model_parameter" */
  delete_thread_model_parameter?: Maybe<Thread_Model_Parameter_Mutation_Response>;
  /** delete single row from the table: "thread_model_parameter" */
  delete_thread_model_parameter_by_pk?: Maybe<Thread_Model_Parameter>;
  /** delete data from the table: "thread_permission" */
  delete_thread_permission?: Maybe<Thread_Permission_Mutation_Response>;
  /** delete single row from the table: "thread_permission" */
  delete_thread_permission_by_pk?: Maybe<Thread_Permission>;
  /** delete data from the table: "thread_provenance" */
  delete_thread_provenance?: Maybe<Thread_Provenance_Mutation_Response>;
  /** delete single row from the table: "thread_provenance" */
  delete_thread_provenance_by_pk?: Maybe<Thread_Provenance>;
  /** delete data from the table: "variable" */
  delete_variable?: Maybe<Variable_Mutation_Response>;
  /** delete single row from the table: "variable" */
  delete_variable_by_pk?: Maybe<Variable>;
  /** delete data from the table: "variable_category" */
  delete_variable_category?: Maybe<Variable_Category_Mutation_Response>;
  /** delete single row from the table: "variable_category" */
  delete_variable_category_by_pk?: Maybe<Variable_Category>;
  /** insert data into the table: "dataset" */
  insert_dataset?: Maybe<Dataset_Mutation_Response>;
  /** insert a single row into the table: "dataset" */
  insert_dataset_one?: Maybe<Dataset>;
  /** insert data into the table: "dataslice" */
  insert_dataslice?: Maybe<Dataslice_Mutation_Response>;
  /** insert a single row into the table: "dataslice" */
  insert_dataslice_one?: Maybe<Dataslice>;
  /** insert data into the table: "dataslice_resource" */
  insert_dataslice_resource?: Maybe<Dataslice_Resource_Mutation_Response>;
  /** insert a single row into the table: "dataslice_resource" */
  insert_dataslice_resource_one?: Maybe<Dataslice_Resource>;
  /** insert data into the table: "execution" */
  insert_execution?: Maybe<Execution_Mutation_Response>;
  /** insert data into the table: "execution_data_binding" */
  insert_execution_data_binding?: Maybe<Execution_Data_Binding_Mutation_Response>;
  /** insert a single row into the table: "execution_data_binding" */
  insert_execution_data_binding_one?: Maybe<Execution_Data_Binding>;
  /** insert a single row into the table: "execution" */
  insert_execution_one?: Maybe<Execution>;
  /** insert data into the table: "execution_parameter_binding" */
  insert_execution_parameter_binding?: Maybe<Execution_Parameter_Binding_Mutation_Response>;
  /** insert a single row into the table: "execution_parameter_binding" */
  insert_execution_parameter_binding_one?: Maybe<Execution_Parameter_Binding>;
  /** insert data into the table: "execution_result" */
  insert_execution_result?: Maybe<Execution_Result_Mutation_Response>;
  /** insert a single row into the table: "execution_result" */
  insert_execution_result_one?: Maybe<Execution_Result>;
  /** insert data into the table: "intervention" */
  insert_intervention?: Maybe<Intervention_Mutation_Response>;
  /** insert a single row into the table: "intervention" */
  insert_intervention_one?: Maybe<Intervention>;
  /** insert data into the table: "model" */
  insert_model?: Maybe<Model_Mutation_Response>;
  /** insert data into the table: "model_input" */
  insert_model_input?: Maybe<Model_Input_Mutation_Response>;
  /** insert data into the table: "model_input_fixed_binding" */
  insert_model_input_fixed_binding?: Maybe<Model_Input_Fixed_Binding_Mutation_Response>;
  /** insert a single row into the table: "model_input_fixed_binding" */
  insert_model_input_fixed_binding_one?: Maybe<Model_Input_Fixed_Binding>;
  /** insert a single row into the table: "model_input" */
  insert_model_input_one?: Maybe<Model_Input>;
  /** insert data into the table: "model_io" */
  insert_model_io?: Maybe<Model_Io_Mutation_Response>;
  /** insert a single row into the table: "model_io" */
  insert_model_io_one?: Maybe<Model_Io>;
  /** insert data into the table: "model_io_variable" */
  insert_model_io_variable?: Maybe<Model_Io_Variable_Mutation_Response>;
  /** insert a single row into the table: "model_io_variable" */
  insert_model_io_variable_one?: Maybe<Model_Io_Variable>;
  /** insert a single row into the table: "model" */
  insert_model_one?: Maybe<Model>;
  /** insert data into the table: "model_output" */
  insert_model_output?: Maybe<Model_Output_Mutation_Response>;
  /** insert a single row into the table: "model_output" */
  insert_model_output_one?: Maybe<Model_Output>;
  /** insert data into the table: "model_parameter" */
  insert_model_parameter?: Maybe<Model_Parameter_Mutation_Response>;
  /** insert a single row into the table: "model_parameter" */
  insert_model_parameter_one?: Maybe<Model_Parameter>;
  /** insert data into the table: "problem_statement" */
  insert_problem_statement?: Maybe<Problem_Statement_Mutation_Response>;
  /** insert a single row into the table: "problem_statement" */
  insert_problem_statement_one?: Maybe<Problem_Statement>;
  /** insert data into the table: "problem_statement_permission" */
  insert_problem_statement_permission?: Maybe<Problem_Statement_Permission_Mutation_Response>;
  /** insert a single row into the table: "problem_statement_permission" */
  insert_problem_statement_permission_one?: Maybe<Problem_Statement_Permission>;
  /** insert data into the table: "problem_statement_provenance" */
  insert_problem_statement_provenance?: Maybe<Problem_Statement_Provenance_Mutation_Response>;
  /** insert a single row into the table: "problem_statement_provenance" */
  insert_problem_statement_provenance_one?: Maybe<Problem_Statement_Provenance>;
  /** insert data into the table: "profile" */
  insert_profile?: Maybe<Profile_Mutation_Response>;
  /** insert a single row into the table: "profile" */
  insert_profile_one?: Maybe<Profile>;
  /** insert data into the table: "region" */
  insert_region?: Maybe<Region_Mutation_Response>;
  /** insert data into the table: "region_category" */
  insert_region_category?: Maybe<Region_Category_Mutation_Response>;
  /** insert a single row into the table: "region_category" */
  insert_region_category_one?: Maybe<Region_Category>;
  /** insert data into the table: "region_category_tree" */
  insert_region_category_tree?: Maybe<Region_Category_Tree_Mutation_Response>;
  /** insert a single row into the table: "region_category_tree" */
  insert_region_category_tree_one?: Maybe<Region_Category_Tree>;
  /** insert data into the table: "region_geometry" */
  insert_region_geometry?: Maybe<Region_Geometry_Mutation_Response>;
  /** insert a single row into the table: "region_geometry" */
  insert_region_geometry_one?: Maybe<Region_Geometry>;
  /** insert a single row into the table: "region" */
  insert_region_one?: Maybe<Region>;
  /** insert data into the table: "regions_containing_point" */
  insert_regions_containing_point?: Maybe<Regions_Containing_Point_Mutation_Response>;
  /** insert a single row into the table: "regions_containing_point" */
  insert_regions_containing_point_one?: Maybe<Regions_Containing_Point>;
  /** insert data into the table: "resource" */
  insert_resource?: Maybe<Resource_Mutation_Response>;
  /** insert a single row into the table: "resource" */
  insert_resource_one?: Maybe<Resource>;
  /** insert data into the table: "task" */
  insert_task?: Maybe<Task_Mutation_Response>;
  /** insert a single row into the table: "task" */
  insert_task_one?: Maybe<Task>;
  /** insert data into the table: "task_permission" */
  insert_task_permission?: Maybe<Task_Permission_Mutation_Response>;
  /** insert a single row into the table: "task_permission" */
  insert_task_permission_one?: Maybe<Task_Permission>;
  /** insert data into the table: "task_provenance" */
  insert_task_provenance?: Maybe<Task_Provenance_Mutation_Response>;
  /** insert a single row into the table: "task_provenance" */
  insert_task_provenance_one?: Maybe<Task_Provenance>;
  /** insert data into the table: "thread" */
  insert_thread?: Maybe<Thread_Mutation_Response>;
  /** insert data into the table: "thread_data" */
  insert_thread_data?: Maybe<Thread_Data_Mutation_Response>;
  /** insert a single row into the table: "thread_data" */
  insert_thread_data_one?: Maybe<Thread_Data>;
  /** insert data into the table: "thread_model" */
  insert_thread_model?: Maybe<Thread_Model_Mutation_Response>;
  /** insert data into the table: "thread_model_execution" */
  insert_thread_model_execution?: Maybe<Thread_Model_Execution_Mutation_Response>;
  /** insert a single row into the table: "thread_model_execution" */
  insert_thread_model_execution_one?: Maybe<Thread_Model_Execution>;
  /** insert data into the table: "thread_model_execution_summary" */
  insert_thread_model_execution_summary?: Maybe<Thread_Model_Execution_Summary_Mutation_Response>;
  /** insert a single row into the table: "thread_model_execution_summary" */
  insert_thread_model_execution_summary_one?: Maybe<Thread_Model_Execution_Summary>;
  /** insert data into the table: "thread_model_io" */
  insert_thread_model_io?: Maybe<Thread_Model_Io_Mutation_Response>;
  /** insert a single row into the table: "thread_model_io" */
  insert_thread_model_io_one?: Maybe<Thread_Model_Io>;
  /** insert a single row into the table: "thread_model" */
  insert_thread_model_one?: Maybe<Thread_Model>;
  /** insert data into the table: "thread_model_parameter" */
  insert_thread_model_parameter?: Maybe<Thread_Model_Parameter_Mutation_Response>;
  /** insert a single row into the table: "thread_model_parameter" */
  insert_thread_model_parameter_one?: Maybe<Thread_Model_Parameter>;
  /** insert a single row into the table: "thread" */
  insert_thread_one?: Maybe<Thread>;
  /** insert data into the table: "thread_permission" */
  insert_thread_permission?: Maybe<Thread_Permission_Mutation_Response>;
  /** insert a single row into the table: "thread_permission" */
  insert_thread_permission_one?: Maybe<Thread_Permission>;
  /** insert data into the table: "thread_provenance" */
  insert_thread_provenance?: Maybe<Thread_Provenance_Mutation_Response>;
  /** insert a single row into the table: "thread_provenance" */
  insert_thread_provenance_one?: Maybe<Thread_Provenance>;
  /** insert data into the table: "variable" */
  insert_variable?: Maybe<Variable_Mutation_Response>;
  /** insert data into the table: "variable_category" */
  insert_variable_category?: Maybe<Variable_Category_Mutation_Response>;
  /** insert a single row into the table: "variable_category" */
  insert_variable_category_one?: Maybe<Variable_Category>;
  /** insert a single row into the table: "variable" */
  insert_variable_one?: Maybe<Variable>;
  /** update data of the table: "dataset" */
  update_dataset?: Maybe<Dataset_Mutation_Response>;
  /** update single row of the table: "dataset" */
  update_dataset_by_pk?: Maybe<Dataset>;
  /** update multiples rows of table: "dataset" */
  update_dataset_many?: Maybe<Array<Maybe<Dataset_Mutation_Response>>>;
  /** update data of the table: "dataslice" */
  update_dataslice?: Maybe<Dataslice_Mutation_Response>;
  /** update single row of the table: "dataslice" */
  update_dataslice_by_pk?: Maybe<Dataslice>;
  /** update multiples rows of table: "dataslice" */
  update_dataslice_many?: Maybe<Array<Maybe<Dataslice_Mutation_Response>>>;
  /** update data of the table: "dataslice_resource" */
  update_dataslice_resource?: Maybe<Dataslice_Resource_Mutation_Response>;
  /** update single row of the table: "dataslice_resource" */
  update_dataslice_resource_by_pk?: Maybe<Dataslice_Resource>;
  /** update multiples rows of table: "dataslice_resource" */
  update_dataslice_resource_many?: Maybe<Array<Maybe<Dataslice_Resource_Mutation_Response>>>;
  /** update data of the table: "execution" */
  update_execution?: Maybe<Execution_Mutation_Response>;
  /** update single row of the table: "execution" */
  update_execution_by_pk?: Maybe<Execution>;
  /** update data of the table: "execution_data_binding" */
  update_execution_data_binding?: Maybe<Execution_Data_Binding_Mutation_Response>;
  /** update single row of the table: "execution_data_binding" */
  update_execution_data_binding_by_pk?: Maybe<Execution_Data_Binding>;
  /** update multiples rows of table: "execution_data_binding" */
  update_execution_data_binding_many?: Maybe<Array<Maybe<Execution_Data_Binding_Mutation_Response>>>;
  /** update multiples rows of table: "execution" */
  update_execution_many?: Maybe<Array<Maybe<Execution_Mutation_Response>>>;
  /** update data of the table: "execution_parameter_binding" */
  update_execution_parameter_binding?: Maybe<Execution_Parameter_Binding_Mutation_Response>;
  /** update single row of the table: "execution_parameter_binding" */
  update_execution_parameter_binding_by_pk?: Maybe<Execution_Parameter_Binding>;
  /** update multiples rows of table: "execution_parameter_binding" */
  update_execution_parameter_binding_many?: Maybe<Array<Maybe<Execution_Parameter_Binding_Mutation_Response>>>;
  /** update data of the table: "execution_result" */
  update_execution_result?: Maybe<Execution_Result_Mutation_Response>;
  /** update single row of the table: "execution_result" */
  update_execution_result_by_pk?: Maybe<Execution_Result>;
  /** update multiples rows of table: "execution_result" */
  update_execution_result_many?: Maybe<Array<Maybe<Execution_Result_Mutation_Response>>>;
  /** update data of the table: "intervention" */
  update_intervention?: Maybe<Intervention_Mutation_Response>;
  /** update single row of the table: "intervention" */
  update_intervention_by_pk?: Maybe<Intervention>;
  /** update multiples rows of table: "intervention" */
  update_intervention_many?: Maybe<Array<Maybe<Intervention_Mutation_Response>>>;
  /** update data of the table: "model" */
  update_model?: Maybe<Model_Mutation_Response>;
  /** update single row of the table: "model" */
  update_model_by_pk?: Maybe<Model>;
  /** update data of the table: "model_input" */
  update_model_input?: Maybe<Model_Input_Mutation_Response>;
  /** update single row of the table: "model_input" */
  update_model_input_by_pk?: Maybe<Model_Input>;
  /** update data of the table: "model_input_fixed_binding" */
  update_model_input_fixed_binding?: Maybe<Model_Input_Fixed_Binding_Mutation_Response>;
  /** update single row of the table: "model_input_fixed_binding" */
  update_model_input_fixed_binding_by_pk?: Maybe<Model_Input_Fixed_Binding>;
  /** update multiples rows of table: "model_input_fixed_binding" */
  update_model_input_fixed_binding_many?: Maybe<Array<Maybe<Model_Input_Fixed_Binding_Mutation_Response>>>;
  /** update multiples rows of table: "model_input" */
  update_model_input_many?: Maybe<Array<Maybe<Model_Input_Mutation_Response>>>;
  /** update data of the table: "model_io" */
  update_model_io?: Maybe<Model_Io_Mutation_Response>;
  /** update single row of the table: "model_io" */
  update_model_io_by_pk?: Maybe<Model_Io>;
  /** update multiples rows of table: "model_io" */
  update_model_io_many?: Maybe<Array<Maybe<Model_Io_Mutation_Response>>>;
  /** update data of the table: "model_io_variable" */
  update_model_io_variable?: Maybe<Model_Io_Variable_Mutation_Response>;
  /** update single row of the table: "model_io_variable" */
  update_model_io_variable_by_pk?: Maybe<Model_Io_Variable>;
  /** update multiples rows of table: "model_io_variable" */
  update_model_io_variable_many?: Maybe<Array<Maybe<Model_Io_Variable_Mutation_Response>>>;
  /** update multiples rows of table: "model" */
  update_model_many?: Maybe<Array<Maybe<Model_Mutation_Response>>>;
  /** update data of the table: "model_output" */
  update_model_output?: Maybe<Model_Output_Mutation_Response>;
  /** update single row of the table: "model_output" */
  update_model_output_by_pk?: Maybe<Model_Output>;
  /** update multiples rows of table: "model_output" */
  update_model_output_many?: Maybe<Array<Maybe<Model_Output_Mutation_Response>>>;
  /** update data of the table: "model_parameter" */
  update_model_parameter?: Maybe<Model_Parameter_Mutation_Response>;
  /** update single row of the table: "model_parameter" */
  update_model_parameter_by_pk?: Maybe<Model_Parameter>;
  /** update multiples rows of table: "model_parameter" */
  update_model_parameter_many?: Maybe<Array<Maybe<Model_Parameter_Mutation_Response>>>;
  /** update data of the table: "problem_statement" */
  update_problem_statement?: Maybe<Problem_Statement_Mutation_Response>;
  /** update single row of the table: "problem_statement" */
  update_problem_statement_by_pk?: Maybe<Problem_Statement>;
  /** update multiples rows of table: "problem_statement" */
  update_problem_statement_many?: Maybe<Array<Maybe<Problem_Statement_Mutation_Response>>>;
  /** update data of the table: "problem_statement_permission" */
  update_problem_statement_permission?: Maybe<Problem_Statement_Permission_Mutation_Response>;
  /** update single row of the table: "problem_statement_permission" */
  update_problem_statement_permission_by_pk?: Maybe<Problem_Statement_Permission>;
  /** update multiples rows of table: "problem_statement_permission" */
  update_problem_statement_permission_many?: Maybe<Array<Maybe<Problem_Statement_Permission_Mutation_Response>>>;
  /** update data of the table: "problem_statement_provenance" */
  update_problem_statement_provenance?: Maybe<Problem_Statement_Provenance_Mutation_Response>;
  /** update single row of the table: "problem_statement_provenance" */
  update_problem_statement_provenance_by_pk?: Maybe<Problem_Statement_Provenance>;
  /** update multiples rows of table: "problem_statement_provenance" */
  update_problem_statement_provenance_many?: Maybe<Array<Maybe<Problem_Statement_Provenance_Mutation_Response>>>;
  /** update data of the table: "profile" */
  update_profile?: Maybe<Profile_Mutation_Response>;
  /** update single row of the table: "profile" */
  update_profile_by_pk?: Maybe<Profile>;
  /** update multiples rows of table: "profile" */
  update_profile_many?: Maybe<Array<Maybe<Profile_Mutation_Response>>>;
  /** update data of the table: "region" */
  update_region?: Maybe<Region_Mutation_Response>;
  /** update single row of the table: "region" */
  update_region_by_pk?: Maybe<Region>;
  /** update data of the table: "region_category" */
  update_region_category?: Maybe<Region_Category_Mutation_Response>;
  /** update single row of the table: "region_category" */
  update_region_category_by_pk?: Maybe<Region_Category>;
  /** update multiples rows of table: "region_category" */
  update_region_category_many?: Maybe<Array<Maybe<Region_Category_Mutation_Response>>>;
  /** update data of the table: "region_category_tree" */
  update_region_category_tree?: Maybe<Region_Category_Tree_Mutation_Response>;
  /** update single row of the table: "region_category_tree" */
  update_region_category_tree_by_pk?: Maybe<Region_Category_Tree>;
  /** update multiples rows of table: "region_category_tree" */
  update_region_category_tree_many?: Maybe<Array<Maybe<Region_Category_Tree_Mutation_Response>>>;
  /** update data of the table: "region_geometry" */
  update_region_geometry?: Maybe<Region_Geometry_Mutation_Response>;
  /** update single row of the table: "region_geometry" */
  update_region_geometry_by_pk?: Maybe<Region_Geometry>;
  /** update multiples rows of table: "region_geometry" */
  update_region_geometry_many?: Maybe<Array<Maybe<Region_Geometry_Mutation_Response>>>;
  /** update multiples rows of table: "region" */
  update_region_many?: Maybe<Array<Maybe<Region_Mutation_Response>>>;
  /** update data of the table: "regions_containing_point" */
  update_regions_containing_point?: Maybe<Regions_Containing_Point_Mutation_Response>;
  /** update multiples rows of table: "regions_containing_point" */
  update_regions_containing_point_many?: Maybe<Array<Maybe<Regions_Containing_Point_Mutation_Response>>>;
  /** update data of the table: "resource" */
  update_resource?: Maybe<Resource_Mutation_Response>;
  /** update single row of the table: "resource" */
  update_resource_by_pk?: Maybe<Resource>;
  /** update multiples rows of table: "resource" */
  update_resource_many?: Maybe<Array<Maybe<Resource_Mutation_Response>>>;
  /** update data of the table: "task" */
  update_task?: Maybe<Task_Mutation_Response>;
  /** update single row of the table: "task" */
  update_task_by_pk?: Maybe<Task>;
  /** update multiples rows of table: "task" */
  update_task_many?: Maybe<Array<Maybe<Task_Mutation_Response>>>;
  /** update data of the table: "task_permission" */
  update_task_permission?: Maybe<Task_Permission_Mutation_Response>;
  /** update single row of the table: "task_permission" */
  update_task_permission_by_pk?: Maybe<Task_Permission>;
  /** update multiples rows of table: "task_permission" */
  update_task_permission_many?: Maybe<Array<Maybe<Task_Permission_Mutation_Response>>>;
  /** update data of the table: "task_provenance" */
  update_task_provenance?: Maybe<Task_Provenance_Mutation_Response>;
  /** update single row of the table: "task_provenance" */
  update_task_provenance_by_pk?: Maybe<Task_Provenance>;
  /** update multiples rows of table: "task_provenance" */
  update_task_provenance_many?: Maybe<Array<Maybe<Task_Provenance_Mutation_Response>>>;
  /** update data of the table: "thread" */
  update_thread?: Maybe<Thread_Mutation_Response>;
  /** update single row of the table: "thread" */
  update_thread_by_pk?: Maybe<Thread>;
  /** update data of the table: "thread_data" */
  update_thread_data?: Maybe<Thread_Data_Mutation_Response>;
  /** update single row of the table: "thread_data" */
  update_thread_data_by_pk?: Maybe<Thread_Data>;
  /** update multiples rows of table: "thread_data" */
  update_thread_data_many?: Maybe<Array<Maybe<Thread_Data_Mutation_Response>>>;
  /** update multiples rows of table: "thread" */
  update_thread_many?: Maybe<Array<Maybe<Thread_Mutation_Response>>>;
  /** update data of the table: "thread_model" */
  update_thread_model?: Maybe<Thread_Model_Mutation_Response>;
  /** update single row of the table: "thread_model" */
  update_thread_model_by_pk?: Maybe<Thread_Model>;
  /** update data of the table: "thread_model_execution" */
  update_thread_model_execution?: Maybe<Thread_Model_Execution_Mutation_Response>;
  /** update single row of the table: "thread_model_execution" */
  update_thread_model_execution_by_pk?: Maybe<Thread_Model_Execution>;
  /** update multiples rows of table: "thread_model_execution" */
  update_thread_model_execution_many?: Maybe<Array<Maybe<Thread_Model_Execution_Mutation_Response>>>;
  /** update data of the table: "thread_model_execution_summary" */
  update_thread_model_execution_summary?: Maybe<Thread_Model_Execution_Summary_Mutation_Response>;
  /** update single row of the table: "thread_model_execution_summary" */
  update_thread_model_execution_summary_by_pk?: Maybe<Thread_Model_Execution_Summary>;
  /** update multiples rows of table: "thread_model_execution_summary" */
  update_thread_model_execution_summary_many?: Maybe<Array<Maybe<Thread_Model_Execution_Summary_Mutation_Response>>>;
  /** update data of the table: "thread_model_io" */
  update_thread_model_io?: Maybe<Thread_Model_Io_Mutation_Response>;
  /** update single row of the table: "thread_model_io" */
  update_thread_model_io_by_pk?: Maybe<Thread_Model_Io>;
  /** update multiples rows of table: "thread_model_io" */
  update_thread_model_io_many?: Maybe<Array<Maybe<Thread_Model_Io_Mutation_Response>>>;
  /** update multiples rows of table: "thread_model" */
  update_thread_model_many?: Maybe<Array<Maybe<Thread_Model_Mutation_Response>>>;
  /** update data of the table: "thread_model_parameter" */
  update_thread_model_parameter?: Maybe<Thread_Model_Parameter_Mutation_Response>;
  /** update single row of the table: "thread_model_parameter" */
  update_thread_model_parameter_by_pk?: Maybe<Thread_Model_Parameter>;
  /** update multiples rows of table: "thread_model_parameter" */
  update_thread_model_parameter_many?: Maybe<Array<Maybe<Thread_Model_Parameter_Mutation_Response>>>;
  /** update data of the table: "thread_permission" */
  update_thread_permission?: Maybe<Thread_Permission_Mutation_Response>;
  /** update single row of the table: "thread_permission" */
  update_thread_permission_by_pk?: Maybe<Thread_Permission>;
  /** update multiples rows of table: "thread_permission" */
  update_thread_permission_many?: Maybe<Array<Maybe<Thread_Permission_Mutation_Response>>>;
  /** update data of the table: "thread_provenance" */
  update_thread_provenance?: Maybe<Thread_Provenance_Mutation_Response>;
  /** update single row of the table: "thread_provenance" */
  update_thread_provenance_by_pk?: Maybe<Thread_Provenance>;
  /** update multiples rows of table: "thread_provenance" */
  update_thread_provenance_many?: Maybe<Array<Maybe<Thread_Provenance_Mutation_Response>>>;
  /** update data of the table: "variable" */
  update_variable?: Maybe<Variable_Mutation_Response>;
  /** update single row of the table: "variable" */
  update_variable_by_pk?: Maybe<Variable>;
  /** update data of the table: "variable_category" */
  update_variable_category?: Maybe<Variable_Category_Mutation_Response>;
  /** update single row of the table: "variable_category" */
  update_variable_category_by_pk?: Maybe<Variable_Category>;
  /** update multiples rows of table: "variable_category" */
  update_variable_category_many?: Maybe<Array<Maybe<Variable_Category_Mutation_Response>>>;
  /** update multiples rows of table: "variable" */
  update_variable_many?: Maybe<Array<Maybe<Variable_Mutation_Response>>>;
};


/** mutation root */
export type Mutation_RootDelete_DatasetArgs = {
  where: Dataset_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Dataset_By_PkArgs = {
  id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_DatasliceArgs = {
  where: Dataslice_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Dataslice_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Dataslice_ResourceArgs = {
  where: Dataslice_Resource_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Dataslice_Resource_By_PkArgs = {
  dataslice_id: Scalars['uuid']['input'];
  resource_id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_ExecutionArgs = {
  where: Execution_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Execution_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Execution_Data_BindingArgs = {
  where: Execution_Data_Binding_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Execution_Data_Binding_By_PkArgs = {
  execution_id: Scalars['uuid']['input'];
  model_io_id: Scalars['String']['input'];
  resource_id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Execution_Parameter_BindingArgs = {
  where: Execution_Parameter_Binding_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Execution_Parameter_Binding_By_PkArgs = {
  execution_id: Scalars['uuid']['input'];
  model_parameter_id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Execution_ResultArgs = {
  where: Execution_Result_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Execution_Result_By_PkArgs = {
  execution_id: Scalars['uuid']['input'];
  model_io_id: Scalars['String']['input'];
  resource_id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_InterventionArgs = {
  where: Intervention_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Intervention_By_PkArgs = {
  id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_ModelArgs = {
  where: Model_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Model_By_PkArgs = {
  id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Model_InputArgs = {
  where: Model_Input_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Model_Input_By_PkArgs = {
  model_id: Scalars['String']['input'];
  model_io_id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Model_Input_Fixed_BindingArgs = {
  where: Model_Input_Fixed_Binding_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Model_Input_Fixed_Binding_By_PkArgs = {
  model_io_id: Scalars['String']['input'];
  resource_id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Model_IoArgs = {
  where: Model_Io_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Model_Io_By_PkArgs = {
  id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Model_Io_VariableArgs = {
  where: Model_Io_Variable_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Model_Io_Variable_By_PkArgs = {
  model_io_id: Scalars['String']['input'];
  variable_id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Model_OutputArgs = {
  where: Model_Output_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Model_Output_By_PkArgs = {
  model_id: Scalars['String']['input'];
  model_io_id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Model_ParameterArgs = {
  where: Model_Parameter_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Model_Parameter_By_PkArgs = {
  id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Problem_StatementArgs = {
  where: Problem_Statement_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Problem_Statement_By_PkArgs = {
  id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Problem_Statement_PermissionArgs = {
  where: Problem_Statement_Permission_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Problem_Statement_Permission_By_PkArgs = {
  problem_statement_id: Scalars['String']['input'];
  user_id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Problem_Statement_ProvenanceArgs = {
  where: Problem_Statement_Provenance_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Problem_Statement_Provenance_By_PkArgs = {
  event: Scalars['problem_statement_events']['input'];
  problem_statement_id: Scalars['String']['input'];
  timestamp: Scalars['timestamptz']['input'];
};


/** mutation root */
export type Mutation_RootDelete_ProfileArgs = {
  where: Profile_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Profile_By_PkArgs = {
  id: Scalars['Int']['input'];
};


/** mutation root */
export type Mutation_RootDelete_RegionArgs = {
  where: Region_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Region_By_PkArgs = {
  id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Region_CategoryArgs = {
  where: Region_Category_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Region_Category_By_PkArgs = {
  id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Region_Category_TreeArgs = {
  where: Region_Category_Tree_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Region_Category_Tree_By_PkArgs = {
  region_category_id: Scalars['String']['input'];
  region_category_parent_id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Region_GeometryArgs = {
  where: Region_Geometry_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Region_Geometry_By_PkArgs = {
  id: Scalars['Int']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Regions_Containing_PointArgs = {
  where: Regions_Containing_Point_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_ResourceArgs = {
  where: Resource_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Resource_By_PkArgs = {
  id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_TaskArgs = {
  where: Task_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Task_By_PkArgs = {
  id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Task_PermissionArgs = {
  where: Task_Permission_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Task_Permission_By_PkArgs = {
  task_id: Scalars['String']['input'];
  user_id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Task_ProvenanceArgs = {
  where: Task_Provenance_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Task_Provenance_By_PkArgs = {
  event: Scalars['task_events']['input'];
  task_id: Scalars['String']['input'];
  timestamp: Scalars['timestamptz']['input'];
};


/** mutation root */
export type Mutation_RootDelete_ThreadArgs = {
  where: Thread_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Thread_By_PkArgs = {
  id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Thread_DataArgs = {
  where: Thread_Data_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Thread_Data_By_PkArgs = {
  dataslice_id: Scalars['uuid']['input'];
  thread_id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Thread_ModelArgs = {
  where: Thread_Model_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Thread_Model_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Thread_Model_ExecutionArgs = {
  where: Thread_Model_Execution_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Thread_Model_Execution_By_PkArgs = {
  execution_id: Scalars['uuid']['input'];
  thread_model_id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Thread_Model_Execution_SummaryArgs = {
  where: Thread_Model_Execution_Summary_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Thread_Model_Execution_Summary_By_PkArgs = {
  thread_model_id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Thread_Model_IoArgs = {
  where: Thread_Model_Io_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Thread_Model_Io_By_PkArgs = {
  dataslice_id: Scalars['uuid']['input'];
  model_io_id: Scalars['String']['input'];
  thread_model_id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Thread_Model_ParameterArgs = {
  where: Thread_Model_Parameter_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Thread_Model_Parameter_By_PkArgs = {
  model_parameter_id: Scalars['String']['input'];
  parameter_value: Scalars['String']['input'];
  thread_model_id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Thread_PermissionArgs = {
  where: Thread_Permission_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Thread_Permission_By_PkArgs = {
  thread_id: Scalars['String']['input'];
  user_id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Thread_ProvenanceArgs = {
  where: Thread_Provenance_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Thread_Provenance_By_PkArgs = {
  event: Scalars['thread_events']['input'];
  thread_id: Scalars['String']['input'];
  timestamp: Scalars['timestamptz']['input'];
};


/** mutation root */
export type Mutation_RootDelete_VariableArgs = {
  where: Variable_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Variable_By_PkArgs = {
  id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootDelete_Variable_CategoryArgs = {
  where: Variable_Category_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Variable_Category_By_PkArgs = {
  category: Scalars['String']['input'];
  variable_id: Scalars['String']['input'];
};


/** mutation root */
export type Mutation_RootInsert_DatasetArgs = {
  objects: Array<Dataset_Insert_Input>;
  on_conflict?: InputMaybe<Dataset_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Dataset_OneArgs = {
  object: Dataset_Insert_Input;
  on_conflict?: InputMaybe<Dataset_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_DatasliceArgs = {
  objects: Array<Dataslice_Insert_Input>;
  on_conflict?: InputMaybe<Dataslice_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Dataslice_OneArgs = {
  object: Dataslice_Insert_Input;
  on_conflict?: InputMaybe<Dataslice_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Dataslice_ResourceArgs = {
  objects: Array<Dataslice_Resource_Insert_Input>;
  on_conflict?: InputMaybe<Dataslice_Resource_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Dataslice_Resource_OneArgs = {
  object: Dataslice_Resource_Insert_Input;
  on_conflict?: InputMaybe<Dataslice_Resource_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_ExecutionArgs = {
  objects: Array<Execution_Insert_Input>;
  on_conflict?: InputMaybe<Execution_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Execution_Data_BindingArgs = {
  objects: Array<Execution_Data_Binding_Insert_Input>;
  on_conflict?: InputMaybe<Execution_Data_Binding_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Execution_Data_Binding_OneArgs = {
  object: Execution_Data_Binding_Insert_Input;
  on_conflict?: InputMaybe<Execution_Data_Binding_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Execution_OneArgs = {
  object: Execution_Insert_Input;
  on_conflict?: InputMaybe<Execution_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Execution_Parameter_BindingArgs = {
  objects: Array<Execution_Parameter_Binding_Insert_Input>;
  on_conflict?: InputMaybe<Execution_Parameter_Binding_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Execution_Parameter_Binding_OneArgs = {
  object: Execution_Parameter_Binding_Insert_Input;
  on_conflict?: InputMaybe<Execution_Parameter_Binding_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Execution_ResultArgs = {
  objects: Array<Execution_Result_Insert_Input>;
  on_conflict?: InputMaybe<Execution_Result_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Execution_Result_OneArgs = {
  object: Execution_Result_Insert_Input;
  on_conflict?: InputMaybe<Execution_Result_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_InterventionArgs = {
  objects: Array<Intervention_Insert_Input>;
  on_conflict?: InputMaybe<Intervention_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Intervention_OneArgs = {
  object: Intervention_Insert_Input;
  on_conflict?: InputMaybe<Intervention_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_ModelArgs = {
  objects: Array<Model_Insert_Input>;
  on_conflict?: InputMaybe<Model_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Model_InputArgs = {
  objects: Array<Model_Input_Insert_Input>;
  on_conflict?: InputMaybe<Model_Input_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Model_Input_Fixed_BindingArgs = {
  objects: Array<Model_Input_Fixed_Binding_Insert_Input>;
  on_conflict?: InputMaybe<Model_Input_Fixed_Binding_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Model_Input_Fixed_Binding_OneArgs = {
  object: Model_Input_Fixed_Binding_Insert_Input;
  on_conflict?: InputMaybe<Model_Input_Fixed_Binding_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Model_Input_OneArgs = {
  object: Model_Input_Insert_Input;
  on_conflict?: InputMaybe<Model_Input_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Model_IoArgs = {
  objects: Array<Model_Io_Insert_Input>;
  on_conflict?: InputMaybe<Model_Io_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Model_Io_OneArgs = {
  object: Model_Io_Insert_Input;
  on_conflict?: InputMaybe<Model_Io_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Model_Io_VariableArgs = {
  objects: Array<Model_Io_Variable_Insert_Input>;
  on_conflict?: InputMaybe<Model_Io_Variable_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Model_Io_Variable_OneArgs = {
  object: Model_Io_Variable_Insert_Input;
  on_conflict?: InputMaybe<Model_Io_Variable_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Model_OneArgs = {
  object: Model_Insert_Input;
  on_conflict?: InputMaybe<Model_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Model_OutputArgs = {
  objects: Array<Model_Output_Insert_Input>;
  on_conflict?: InputMaybe<Model_Output_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Model_Output_OneArgs = {
  object: Model_Output_Insert_Input;
  on_conflict?: InputMaybe<Model_Output_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Model_ParameterArgs = {
  objects: Array<Model_Parameter_Insert_Input>;
  on_conflict?: InputMaybe<Model_Parameter_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Model_Parameter_OneArgs = {
  object: Model_Parameter_Insert_Input;
  on_conflict?: InputMaybe<Model_Parameter_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Problem_StatementArgs = {
  objects: Array<Problem_Statement_Insert_Input>;
  on_conflict?: InputMaybe<Problem_Statement_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Problem_Statement_OneArgs = {
  object: Problem_Statement_Insert_Input;
  on_conflict?: InputMaybe<Problem_Statement_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Problem_Statement_PermissionArgs = {
  objects: Array<Problem_Statement_Permission_Insert_Input>;
  on_conflict?: InputMaybe<Problem_Statement_Permission_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Problem_Statement_Permission_OneArgs = {
  object: Problem_Statement_Permission_Insert_Input;
  on_conflict?: InputMaybe<Problem_Statement_Permission_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Problem_Statement_ProvenanceArgs = {
  objects: Array<Problem_Statement_Provenance_Insert_Input>;
  on_conflict?: InputMaybe<Problem_Statement_Provenance_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Problem_Statement_Provenance_OneArgs = {
  object: Problem_Statement_Provenance_Insert_Input;
  on_conflict?: InputMaybe<Problem_Statement_Provenance_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_ProfileArgs = {
  objects: Array<Profile_Insert_Input>;
  on_conflict?: InputMaybe<Profile_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Profile_OneArgs = {
  object: Profile_Insert_Input;
  on_conflict?: InputMaybe<Profile_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_RegionArgs = {
  objects: Array<Region_Insert_Input>;
  on_conflict?: InputMaybe<Region_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Region_CategoryArgs = {
  objects: Array<Region_Category_Insert_Input>;
  on_conflict?: InputMaybe<Region_Category_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Region_Category_OneArgs = {
  object: Region_Category_Insert_Input;
  on_conflict?: InputMaybe<Region_Category_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Region_Category_TreeArgs = {
  objects: Array<Region_Category_Tree_Insert_Input>;
  on_conflict?: InputMaybe<Region_Category_Tree_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Region_Category_Tree_OneArgs = {
  object: Region_Category_Tree_Insert_Input;
  on_conflict?: InputMaybe<Region_Category_Tree_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Region_GeometryArgs = {
  objects: Array<Region_Geometry_Insert_Input>;
  on_conflict?: InputMaybe<Region_Geometry_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Region_Geometry_OneArgs = {
  object: Region_Geometry_Insert_Input;
  on_conflict?: InputMaybe<Region_Geometry_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Region_OneArgs = {
  object: Region_Insert_Input;
  on_conflict?: InputMaybe<Region_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Regions_Containing_PointArgs = {
  objects: Array<Regions_Containing_Point_Insert_Input>;
};


/** mutation root */
export type Mutation_RootInsert_Regions_Containing_Point_OneArgs = {
  object: Regions_Containing_Point_Insert_Input;
};


/** mutation root */
export type Mutation_RootInsert_ResourceArgs = {
  objects: Array<Resource_Insert_Input>;
  on_conflict?: InputMaybe<Resource_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Resource_OneArgs = {
  object: Resource_Insert_Input;
  on_conflict?: InputMaybe<Resource_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_TaskArgs = {
  objects: Array<Task_Insert_Input>;
  on_conflict?: InputMaybe<Task_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Task_OneArgs = {
  object: Task_Insert_Input;
  on_conflict?: InputMaybe<Task_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Task_PermissionArgs = {
  objects: Array<Task_Permission_Insert_Input>;
  on_conflict?: InputMaybe<Task_Permission_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Task_Permission_OneArgs = {
  object: Task_Permission_Insert_Input;
  on_conflict?: InputMaybe<Task_Permission_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Task_ProvenanceArgs = {
  objects: Array<Task_Provenance_Insert_Input>;
  on_conflict?: InputMaybe<Task_Provenance_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Task_Provenance_OneArgs = {
  object: Task_Provenance_Insert_Input;
  on_conflict?: InputMaybe<Task_Provenance_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_ThreadArgs = {
  objects: Array<Thread_Insert_Input>;
  on_conflict?: InputMaybe<Thread_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Thread_DataArgs = {
  objects: Array<Thread_Data_Insert_Input>;
  on_conflict?: InputMaybe<Thread_Data_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Thread_Data_OneArgs = {
  object: Thread_Data_Insert_Input;
  on_conflict?: InputMaybe<Thread_Data_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Thread_ModelArgs = {
  objects: Array<Thread_Model_Insert_Input>;
  on_conflict?: InputMaybe<Thread_Model_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Thread_Model_ExecutionArgs = {
  objects: Array<Thread_Model_Execution_Insert_Input>;
  on_conflict?: InputMaybe<Thread_Model_Execution_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Thread_Model_Execution_OneArgs = {
  object: Thread_Model_Execution_Insert_Input;
  on_conflict?: InputMaybe<Thread_Model_Execution_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Thread_Model_Execution_SummaryArgs = {
  objects: Array<Thread_Model_Execution_Summary_Insert_Input>;
  on_conflict?: InputMaybe<Thread_Model_Execution_Summary_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Thread_Model_Execution_Summary_OneArgs = {
  object: Thread_Model_Execution_Summary_Insert_Input;
  on_conflict?: InputMaybe<Thread_Model_Execution_Summary_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Thread_Model_IoArgs = {
  objects: Array<Thread_Model_Io_Insert_Input>;
  on_conflict?: InputMaybe<Thread_Model_Io_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Thread_Model_Io_OneArgs = {
  object: Thread_Model_Io_Insert_Input;
  on_conflict?: InputMaybe<Thread_Model_Io_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Thread_Model_OneArgs = {
  object: Thread_Model_Insert_Input;
  on_conflict?: InputMaybe<Thread_Model_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Thread_Model_ParameterArgs = {
  objects: Array<Thread_Model_Parameter_Insert_Input>;
  on_conflict?: InputMaybe<Thread_Model_Parameter_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Thread_Model_Parameter_OneArgs = {
  object: Thread_Model_Parameter_Insert_Input;
  on_conflict?: InputMaybe<Thread_Model_Parameter_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Thread_OneArgs = {
  object: Thread_Insert_Input;
  on_conflict?: InputMaybe<Thread_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Thread_PermissionArgs = {
  objects: Array<Thread_Permission_Insert_Input>;
  on_conflict?: InputMaybe<Thread_Permission_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Thread_Permission_OneArgs = {
  object: Thread_Permission_Insert_Input;
  on_conflict?: InputMaybe<Thread_Permission_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Thread_ProvenanceArgs = {
  objects: Array<Thread_Provenance_Insert_Input>;
  on_conflict?: InputMaybe<Thread_Provenance_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Thread_Provenance_OneArgs = {
  object: Thread_Provenance_Insert_Input;
  on_conflict?: InputMaybe<Thread_Provenance_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_VariableArgs = {
  objects: Array<Variable_Insert_Input>;
  on_conflict?: InputMaybe<Variable_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Variable_CategoryArgs = {
  objects: Array<Variable_Category_Insert_Input>;
  on_conflict?: InputMaybe<Variable_Category_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Variable_Category_OneArgs = {
  object: Variable_Category_Insert_Input;
  on_conflict?: InputMaybe<Variable_Category_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Variable_OneArgs = {
  object: Variable_Insert_Input;
  on_conflict?: InputMaybe<Variable_On_Conflict>;
};


/** mutation root */
export type Mutation_RootUpdate_DatasetArgs = {
  _set?: InputMaybe<Dataset_Set_Input>;
  where: Dataset_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Dataset_By_PkArgs = {
  _set?: InputMaybe<Dataset_Set_Input>;
  pk_columns: Dataset_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Dataset_ManyArgs = {
  updates: Array<Dataset_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_DatasliceArgs = {
  _inc?: InputMaybe<Dataslice_Inc_Input>;
  _set?: InputMaybe<Dataslice_Set_Input>;
  where: Dataslice_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Dataslice_By_PkArgs = {
  _inc?: InputMaybe<Dataslice_Inc_Input>;
  _set?: InputMaybe<Dataslice_Set_Input>;
  pk_columns: Dataslice_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Dataslice_ManyArgs = {
  updates: Array<Dataslice_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Dataslice_ResourceArgs = {
  _set?: InputMaybe<Dataslice_Resource_Set_Input>;
  where: Dataslice_Resource_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Dataslice_Resource_By_PkArgs = {
  _set?: InputMaybe<Dataslice_Resource_Set_Input>;
  pk_columns: Dataslice_Resource_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Dataslice_Resource_ManyArgs = {
  updates: Array<Dataslice_Resource_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_ExecutionArgs = {
  _inc?: InputMaybe<Execution_Inc_Input>;
  _set?: InputMaybe<Execution_Set_Input>;
  where: Execution_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Execution_By_PkArgs = {
  _inc?: InputMaybe<Execution_Inc_Input>;
  _set?: InputMaybe<Execution_Set_Input>;
  pk_columns: Execution_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Execution_Data_BindingArgs = {
  _set?: InputMaybe<Execution_Data_Binding_Set_Input>;
  where: Execution_Data_Binding_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Execution_Data_Binding_By_PkArgs = {
  _set?: InputMaybe<Execution_Data_Binding_Set_Input>;
  pk_columns: Execution_Data_Binding_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Execution_Data_Binding_ManyArgs = {
  updates: Array<Execution_Data_Binding_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Execution_ManyArgs = {
  updates: Array<Execution_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Execution_Parameter_BindingArgs = {
  _set?: InputMaybe<Execution_Parameter_Binding_Set_Input>;
  where: Execution_Parameter_Binding_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Execution_Parameter_Binding_By_PkArgs = {
  _set?: InputMaybe<Execution_Parameter_Binding_Set_Input>;
  pk_columns: Execution_Parameter_Binding_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Execution_Parameter_Binding_ManyArgs = {
  updates: Array<Execution_Parameter_Binding_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Execution_ResultArgs = {
  _set?: InputMaybe<Execution_Result_Set_Input>;
  where: Execution_Result_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Execution_Result_By_PkArgs = {
  _set?: InputMaybe<Execution_Result_Set_Input>;
  pk_columns: Execution_Result_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Execution_Result_ManyArgs = {
  updates: Array<Execution_Result_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_InterventionArgs = {
  _set?: InputMaybe<Intervention_Set_Input>;
  where: Intervention_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Intervention_By_PkArgs = {
  _set?: InputMaybe<Intervention_Set_Input>;
  pk_columns: Intervention_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Intervention_ManyArgs = {
  updates: Array<Intervention_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_ModelArgs = {
  _set?: InputMaybe<Model_Set_Input>;
  where: Model_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Model_By_PkArgs = {
  _set?: InputMaybe<Model_Set_Input>;
  pk_columns: Model_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Model_InputArgs = {
  _inc?: InputMaybe<Model_Input_Inc_Input>;
  _set?: InputMaybe<Model_Input_Set_Input>;
  where: Model_Input_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Model_Input_By_PkArgs = {
  _inc?: InputMaybe<Model_Input_Inc_Input>;
  _set?: InputMaybe<Model_Input_Set_Input>;
  pk_columns: Model_Input_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Model_Input_Fixed_BindingArgs = {
  _set?: InputMaybe<Model_Input_Fixed_Binding_Set_Input>;
  where: Model_Input_Fixed_Binding_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Model_Input_Fixed_Binding_By_PkArgs = {
  _set?: InputMaybe<Model_Input_Fixed_Binding_Set_Input>;
  pk_columns: Model_Input_Fixed_Binding_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Model_Input_Fixed_Binding_ManyArgs = {
  updates: Array<Model_Input_Fixed_Binding_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Model_Input_ManyArgs = {
  updates: Array<Model_Input_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Model_IoArgs = {
  _set?: InputMaybe<Model_Io_Set_Input>;
  where: Model_Io_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Model_Io_By_PkArgs = {
  _set?: InputMaybe<Model_Io_Set_Input>;
  pk_columns: Model_Io_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Model_Io_ManyArgs = {
  updates: Array<Model_Io_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Model_Io_VariableArgs = {
  _set?: InputMaybe<Model_Io_Variable_Set_Input>;
  where: Model_Io_Variable_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Model_Io_Variable_By_PkArgs = {
  _set?: InputMaybe<Model_Io_Variable_Set_Input>;
  pk_columns: Model_Io_Variable_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Model_Io_Variable_ManyArgs = {
  updates: Array<Model_Io_Variable_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Model_ManyArgs = {
  updates: Array<Model_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Model_OutputArgs = {
  _inc?: InputMaybe<Model_Output_Inc_Input>;
  _set?: InputMaybe<Model_Output_Set_Input>;
  where: Model_Output_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Model_Output_By_PkArgs = {
  _inc?: InputMaybe<Model_Output_Inc_Input>;
  _set?: InputMaybe<Model_Output_Set_Input>;
  pk_columns: Model_Output_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Model_Output_ManyArgs = {
  updates: Array<Model_Output_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Model_ParameterArgs = {
  _inc?: InputMaybe<Model_Parameter_Inc_Input>;
  _set?: InputMaybe<Model_Parameter_Set_Input>;
  where: Model_Parameter_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Model_Parameter_By_PkArgs = {
  _inc?: InputMaybe<Model_Parameter_Inc_Input>;
  _set?: InputMaybe<Model_Parameter_Set_Input>;
  pk_columns: Model_Parameter_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Model_Parameter_ManyArgs = {
  updates: Array<Model_Parameter_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Problem_StatementArgs = {
  _set?: InputMaybe<Problem_Statement_Set_Input>;
  where: Problem_Statement_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Problem_Statement_By_PkArgs = {
  _set?: InputMaybe<Problem_Statement_Set_Input>;
  pk_columns: Problem_Statement_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Problem_Statement_ManyArgs = {
  updates: Array<Problem_Statement_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Problem_Statement_PermissionArgs = {
  _set?: InputMaybe<Problem_Statement_Permission_Set_Input>;
  where: Problem_Statement_Permission_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Problem_Statement_Permission_By_PkArgs = {
  _set?: InputMaybe<Problem_Statement_Permission_Set_Input>;
  pk_columns: Problem_Statement_Permission_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Problem_Statement_Permission_ManyArgs = {
  updates: Array<Problem_Statement_Permission_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Problem_Statement_ProvenanceArgs = {
  _set?: InputMaybe<Problem_Statement_Provenance_Set_Input>;
  where: Problem_Statement_Provenance_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Problem_Statement_Provenance_By_PkArgs = {
  _set?: InputMaybe<Problem_Statement_Provenance_Set_Input>;
  pk_columns: Problem_Statement_Provenance_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Problem_Statement_Provenance_ManyArgs = {
  updates: Array<Problem_Statement_Provenance_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_ProfileArgs = {
  _inc?: InputMaybe<Profile_Inc_Input>;
  _set?: InputMaybe<Profile_Set_Input>;
  where: Profile_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Profile_By_PkArgs = {
  _inc?: InputMaybe<Profile_Inc_Input>;
  _set?: InputMaybe<Profile_Set_Input>;
  pk_columns: Profile_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Profile_ManyArgs = {
  updates: Array<Profile_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_RegionArgs = {
  _set?: InputMaybe<Region_Set_Input>;
  where: Region_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Region_By_PkArgs = {
  _set?: InputMaybe<Region_Set_Input>;
  pk_columns: Region_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Region_CategoryArgs = {
  _set?: InputMaybe<Region_Category_Set_Input>;
  where: Region_Category_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Region_Category_By_PkArgs = {
  _set?: InputMaybe<Region_Category_Set_Input>;
  pk_columns: Region_Category_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Region_Category_ManyArgs = {
  updates: Array<Region_Category_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Region_Category_TreeArgs = {
  _set?: InputMaybe<Region_Category_Tree_Set_Input>;
  where: Region_Category_Tree_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Region_Category_Tree_By_PkArgs = {
  _set?: InputMaybe<Region_Category_Tree_Set_Input>;
  pk_columns: Region_Category_Tree_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Region_Category_Tree_ManyArgs = {
  updates: Array<Region_Category_Tree_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Region_GeometryArgs = {
  _inc?: InputMaybe<Region_Geometry_Inc_Input>;
  _set?: InputMaybe<Region_Geometry_Set_Input>;
  where: Region_Geometry_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Region_Geometry_By_PkArgs = {
  _inc?: InputMaybe<Region_Geometry_Inc_Input>;
  _set?: InputMaybe<Region_Geometry_Set_Input>;
  pk_columns: Region_Geometry_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Region_Geometry_ManyArgs = {
  updates: Array<Region_Geometry_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Region_ManyArgs = {
  updates: Array<Region_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Regions_Containing_PointArgs = {
  _set?: InputMaybe<Regions_Containing_Point_Set_Input>;
  where: Regions_Containing_Point_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Regions_Containing_Point_ManyArgs = {
  updates: Array<Regions_Containing_Point_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_ResourceArgs = {
  _set?: InputMaybe<Resource_Set_Input>;
  where: Resource_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Resource_By_PkArgs = {
  _set?: InputMaybe<Resource_Set_Input>;
  pk_columns: Resource_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Resource_ManyArgs = {
  updates: Array<Resource_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_TaskArgs = {
  _set?: InputMaybe<Task_Set_Input>;
  where: Task_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Task_By_PkArgs = {
  _set?: InputMaybe<Task_Set_Input>;
  pk_columns: Task_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Task_ManyArgs = {
  updates: Array<Task_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Task_PermissionArgs = {
  _set?: InputMaybe<Task_Permission_Set_Input>;
  where: Task_Permission_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Task_Permission_By_PkArgs = {
  _set?: InputMaybe<Task_Permission_Set_Input>;
  pk_columns: Task_Permission_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Task_Permission_ManyArgs = {
  updates: Array<Task_Permission_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Task_ProvenanceArgs = {
  _set?: InputMaybe<Task_Provenance_Set_Input>;
  where: Task_Provenance_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Task_Provenance_By_PkArgs = {
  _set?: InputMaybe<Task_Provenance_Set_Input>;
  pk_columns: Task_Provenance_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Task_Provenance_ManyArgs = {
  updates: Array<Task_Provenance_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_ThreadArgs = {
  _set?: InputMaybe<Thread_Set_Input>;
  where: Thread_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_By_PkArgs = {
  _set?: InputMaybe<Thread_Set_Input>;
  pk_columns: Thread_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_DataArgs = {
  _set?: InputMaybe<Thread_Data_Set_Input>;
  where: Thread_Data_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_Data_By_PkArgs = {
  _set?: InputMaybe<Thread_Data_Set_Input>;
  pk_columns: Thread_Data_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_Data_ManyArgs = {
  updates: Array<Thread_Data_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_ManyArgs = {
  updates: Array<Thread_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_ModelArgs = {
  _set?: InputMaybe<Thread_Model_Set_Input>;
  where: Thread_Model_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_Model_By_PkArgs = {
  _set?: InputMaybe<Thread_Model_Set_Input>;
  pk_columns: Thread_Model_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_Model_ExecutionArgs = {
  _set?: InputMaybe<Thread_Model_Execution_Set_Input>;
  where: Thread_Model_Execution_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_Model_Execution_By_PkArgs = {
  _set?: InputMaybe<Thread_Model_Execution_Set_Input>;
  pk_columns: Thread_Model_Execution_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_Model_Execution_ManyArgs = {
  updates: Array<Thread_Model_Execution_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_Model_Execution_SummaryArgs = {
  _inc?: InputMaybe<Thread_Model_Execution_Summary_Inc_Input>;
  _set?: InputMaybe<Thread_Model_Execution_Summary_Set_Input>;
  where: Thread_Model_Execution_Summary_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_Model_Execution_Summary_By_PkArgs = {
  _inc?: InputMaybe<Thread_Model_Execution_Summary_Inc_Input>;
  _set?: InputMaybe<Thread_Model_Execution_Summary_Set_Input>;
  pk_columns: Thread_Model_Execution_Summary_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_Model_Execution_Summary_ManyArgs = {
  updates: Array<Thread_Model_Execution_Summary_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_Model_IoArgs = {
  _set?: InputMaybe<Thread_Model_Io_Set_Input>;
  where: Thread_Model_Io_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_Model_Io_By_PkArgs = {
  _set?: InputMaybe<Thread_Model_Io_Set_Input>;
  pk_columns: Thread_Model_Io_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_Model_Io_ManyArgs = {
  updates: Array<Thread_Model_Io_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_Model_ManyArgs = {
  updates: Array<Thread_Model_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_Model_ParameterArgs = {
  _set?: InputMaybe<Thread_Model_Parameter_Set_Input>;
  where: Thread_Model_Parameter_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_Model_Parameter_By_PkArgs = {
  _set?: InputMaybe<Thread_Model_Parameter_Set_Input>;
  pk_columns: Thread_Model_Parameter_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_Model_Parameter_ManyArgs = {
  updates: Array<Thread_Model_Parameter_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_PermissionArgs = {
  _set?: InputMaybe<Thread_Permission_Set_Input>;
  where: Thread_Permission_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_Permission_By_PkArgs = {
  _set?: InputMaybe<Thread_Permission_Set_Input>;
  pk_columns: Thread_Permission_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_Permission_ManyArgs = {
  updates: Array<Thread_Permission_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_ProvenanceArgs = {
  _set?: InputMaybe<Thread_Provenance_Set_Input>;
  where: Thread_Provenance_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_Provenance_By_PkArgs = {
  _set?: InputMaybe<Thread_Provenance_Set_Input>;
  pk_columns: Thread_Provenance_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Thread_Provenance_ManyArgs = {
  updates: Array<Thread_Provenance_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_VariableArgs = {
  _set?: InputMaybe<Variable_Set_Input>;
  where: Variable_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Variable_By_PkArgs = {
  _set?: InputMaybe<Variable_Set_Input>;
  pk_columns: Variable_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Variable_CategoryArgs = {
  _set?: InputMaybe<Variable_Category_Set_Input>;
  where: Variable_Category_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Variable_Category_By_PkArgs = {
  _set?: InputMaybe<Variable_Category_Set_Input>;
  pk_columns: Variable_Category_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Variable_Category_ManyArgs = {
  updates: Array<Variable_Category_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Variable_ManyArgs = {
  updates: Array<Variable_Updates>;
};

/** column ordering options */
export enum Order_By {
  /** in ascending order, nulls last */
  Asc = 'asc',
  /** in ascending order, nulls first */
  AscNullsFirst = 'asc_nulls_first',
  /** in ascending order, nulls last */
  AscNullsLast = 'asc_nulls_last',
  /** in descending order, nulls first */
  Desc = 'desc',
  /** in descending order, nulls first */
  DescNullsFirst = 'desc_nulls_first',
  /** in descending order, nulls last */
  DescNullsLast = 'desc_nulls_last'
}

/** columns and relationships of "problem_statement" */
export type Problem_Statement = {
  __typename?: 'problem_statement';
  end_date: Scalars['date']['output'];
  /** An array relationship */
  events: Array<Problem_Statement_Provenance>;
  /** An aggregate relationship */
  events_aggregate: Problem_Statement_Provenance_Aggregate;
  id: Scalars['String']['output'];
  name?: Maybe<Scalars['String']['output']>;
  /** An array relationship */
  permissions: Array<Problem_Statement_Permission>;
  /** An aggregate relationship */
  permissions_aggregate: Problem_Statement_Permission_Aggregate;
  /** An object relationship */
  region: Region;
  region_id: Scalars['String']['output'];
  start_date: Scalars['date']['output'];
  /** An array relationship */
  tasks: Array<Task>;
  /** An aggregate relationship */
  tasks_aggregate: Task_Aggregate;
};


/** columns and relationships of "problem_statement" */
export type Problem_StatementEventsArgs = {
  distinct_on?: InputMaybe<Array<Problem_Statement_Provenance_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Problem_Statement_Provenance_Order_By>>;
  where?: InputMaybe<Problem_Statement_Provenance_Bool_Exp>;
};


/** columns and relationships of "problem_statement" */
export type Problem_StatementEvents_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Problem_Statement_Provenance_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Problem_Statement_Provenance_Order_By>>;
  where?: InputMaybe<Problem_Statement_Provenance_Bool_Exp>;
};


/** columns and relationships of "problem_statement" */
export type Problem_StatementPermissionsArgs = {
  distinct_on?: InputMaybe<Array<Problem_Statement_Permission_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Problem_Statement_Permission_Order_By>>;
  where?: InputMaybe<Problem_Statement_Permission_Bool_Exp>;
};


/** columns and relationships of "problem_statement" */
export type Problem_StatementPermissions_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Problem_Statement_Permission_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Problem_Statement_Permission_Order_By>>;
  where?: InputMaybe<Problem_Statement_Permission_Bool_Exp>;
};


/** columns and relationships of "problem_statement" */
export type Problem_StatementTasksArgs = {
  distinct_on?: InputMaybe<Array<Task_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Task_Order_By>>;
  where?: InputMaybe<Task_Bool_Exp>;
};


/** columns and relationships of "problem_statement" */
export type Problem_StatementTasks_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Task_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Task_Order_By>>;
  where?: InputMaybe<Task_Bool_Exp>;
};

/** aggregated selection of "problem_statement" */
export type Problem_Statement_Aggregate = {
  __typename?: 'problem_statement_aggregate';
  aggregate?: Maybe<Problem_Statement_Aggregate_Fields>;
  nodes: Array<Problem_Statement>;
};

/** aggregate fields of "problem_statement" */
export type Problem_Statement_Aggregate_Fields = {
  __typename?: 'problem_statement_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Problem_Statement_Max_Fields>;
  min?: Maybe<Problem_Statement_Min_Fields>;
};


/** aggregate fields of "problem_statement" */
export type Problem_Statement_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Problem_Statement_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "problem_statement" */
export type Problem_Statement_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Problem_Statement_Max_Order_By>;
  min?: InputMaybe<Problem_Statement_Min_Order_By>;
};

/** input type for inserting array relation for remote table "problem_statement" */
export type Problem_Statement_Arr_Rel_Insert_Input = {
  data: Array<Problem_Statement_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Problem_Statement_On_Conflict>;
};

/** Boolean expression to filter rows from the table "problem_statement". All fields are combined with a logical 'AND'. */
export type Problem_Statement_Bool_Exp = {
  _and?: InputMaybe<Array<Problem_Statement_Bool_Exp>>;
  _not?: InputMaybe<Problem_Statement_Bool_Exp>;
  _or?: InputMaybe<Array<Problem_Statement_Bool_Exp>>;
  end_date?: InputMaybe<Date_Comparison_Exp>;
  events?: InputMaybe<Problem_Statement_Provenance_Bool_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  permissions?: InputMaybe<Problem_Statement_Permission_Bool_Exp>;
  region?: InputMaybe<Region_Bool_Exp>;
  region_id?: InputMaybe<String_Comparison_Exp>;
  start_date?: InputMaybe<Date_Comparison_Exp>;
  tasks?: InputMaybe<Task_Bool_Exp>;
};

/** unique or primary key constraints on table "problem_statement" */
export enum Problem_Statement_Constraint {
  /** unique or primary key constraint on columns "id" */
  ProblemStatementPkey = 'problem_statement_pkey'
}

/** Boolean expression to compare columns of type "problem_statement_events". All fields are combined with logical 'AND'. */
export type Problem_Statement_Events_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['problem_statement_events']['input']>;
  _gt?: InputMaybe<Scalars['problem_statement_events']['input']>;
  _gte?: InputMaybe<Scalars['problem_statement_events']['input']>;
  _in?: InputMaybe<Array<Scalars['problem_statement_events']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['problem_statement_events']['input']>;
  _lte?: InputMaybe<Scalars['problem_statement_events']['input']>;
  _neq?: InputMaybe<Scalars['problem_statement_events']['input']>;
  _nin?: InputMaybe<Array<Scalars['problem_statement_events']['input']>>;
};

/** input type for inserting data into table "problem_statement" */
export type Problem_Statement_Insert_Input = {
  end_date?: InputMaybe<Scalars['date']['input']>;
  events?: InputMaybe<Problem_Statement_Provenance_Arr_Rel_Insert_Input>;
  id?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  permissions?: InputMaybe<Problem_Statement_Permission_Arr_Rel_Insert_Input>;
  region?: InputMaybe<Region_Obj_Rel_Insert_Input>;
  region_id?: InputMaybe<Scalars['String']['input']>;
  start_date?: InputMaybe<Scalars['date']['input']>;
  tasks?: InputMaybe<Task_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type Problem_Statement_Max_Fields = {
  __typename?: 'problem_statement_max_fields';
  end_date?: Maybe<Scalars['date']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  region_id?: Maybe<Scalars['String']['output']>;
  start_date?: Maybe<Scalars['date']['output']>;
};

/** order by max() on columns of table "problem_statement" */
export type Problem_Statement_Max_Order_By = {
  end_date?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  region_id?: InputMaybe<Order_By>;
  start_date?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Problem_Statement_Min_Fields = {
  __typename?: 'problem_statement_min_fields';
  end_date?: Maybe<Scalars['date']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  region_id?: Maybe<Scalars['String']['output']>;
  start_date?: Maybe<Scalars['date']['output']>;
};

/** order by min() on columns of table "problem_statement" */
export type Problem_Statement_Min_Order_By = {
  end_date?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  region_id?: InputMaybe<Order_By>;
  start_date?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "problem_statement" */
export type Problem_Statement_Mutation_Response = {
  __typename?: 'problem_statement_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Problem_Statement>;
};

/** input type for inserting object relation for remote table "problem_statement" */
export type Problem_Statement_Obj_Rel_Insert_Input = {
  data: Problem_Statement_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Problem_Statement_On_Conflict>;
};

/** on_conflict condition type for table "problem_statement" */
export type Problem_Statement_On_Conflict = {
  constraint: Problem_Statement_Constraint;
  update_columns?: Array<Problem_Statement_Update_Column>;
  where?: InputMaybe<Problem_Statement_Bool_Exp>;
};

/** Ordering options when selecting data from "problem_statement". */
export type Problem_Statement_Order_By = {
  end_date?: InputMaybe<Order_By>;
  events_aggregate?: InputMaybe<Problem_Statement_Provenance_Aggregate_Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  permissions_aggregate?: InputMaybe<Problem_Statement_Permission_Aggregate_Order_By>;
  region?: InputMaybe<Region_Order_By>;
  region_id?: InputMaybe<Order_By>;
  start_date?: InputMaybe<Order_By>;
  tasks_aggregate?: InputMaybe<Task_Aggregate_Order_By>;
};

/** columns and relationships of "problem_statement_permission" */
export type Problem_Statement_Permission = {
  __typename?: 'problem_statement_permission';
  /** An object relationship */
  problem_statement: Problem_Statement;
  problem_statement_id: Scalars['String']['output'];
  read: Scalars['Boolean']['output'];
  user_id: Scalars['String']['output'];
  write: Scalars['Boolean']['output'];
};

/** aggregated selection of "problem_statement_permission" */
export type Problem_Statement_Permission_Aggregate = {
  __typename?: 'problem_statement_permission_aggregate';
  aggregate?: Maybe<Problem_Statement_Permission_Aggregate_Fields>;
  nodes: Array<Problem_Statement_Permission>;
};

/** aggregate fields of "problem_statement_permission" */
export type Problem_Statement_Permission_Aggregate_Fields = {
  __typename?: 'problem_statement_permission_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Problem_Statement_Permission_Max_Fields>;
  min?: Maybe<Problem_Statement_Permission_Min_Fields>;
};


/** aggregate fields of "problem_statement_permission" */
export type Problem_Statement_Permission_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Problem_Statement_Permission_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "problem_statement_permission" */
export type Problem_Statement_Permission_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Problem_Statement_Permission_Max_Order_By>;
  min?: InputMaybe<Problem_Statement_Permission_Min_Order_By>;
};

/** input type for inserting array relation for remote table "problem_statement_permission" */
export type Problem_Statement_Permission_Arr_Rel_Insert_Input = {
  data: Array<Problem_Statement_Permission_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Problem_Statement_Permission_On_Conflict>;
};

/** Boolean expression to filter rows from the table "problem_statement_permission". All fields are combined with a logical 'AND'. */
export type Problem_Statement_Permission_Bool_Exp = {
  _and?: InputMaybe<Array<Problem_Statement_Permission_Bool_Exp>>;
  _not?: InputMaybe<Problem_Statement_Permission_Bool_Exp>;
  _or?: InputMaybe<Array<Problem_Statement_Permission_Bool_Exp>>;
  problem_statement?: InputMaybe<Problem_Statement_Bool_Exp>;
  problem_statement_id?: InputMaybe<String_Comparison_Exp>;
  read?: InputMaybe<Boolean_Comparison_Exp>;
  user_id?: InputMaybe<String_Comparison_Exp>;
  write?: InputMaybe<Boolean_Comparison_Exp>;
};

/** unique or primary key constraints on table "problem_statement_permission" */
export enum Problem_Statement_Permission_Constraint {
  /** unique or primary key constraint on columns "user_id", "problem_statement_id" */
  ProblemStatementPermissionPkey = 'problem_statement_permission_pkey'
}

/** input type for inserting data into table "problem_statement_permission" */
export type Problem_Statement_Permission_Insert_Input = {
  problem_statement?: InputMaybe<Problem_Statement_Obj_Rel_Insert_Input>;
  problem_statement_id?: InputMaybe<Scalars['String']['input']>;
  read?: InputMaybe<Scalars['Boolean']['input']>;
  user_id?: InputMaybe<Scalars['String']['input']>;
  write?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate max on columns */
export type Problem_Statement_Permission_Max_Fields = {
  __typename?: 'problem_statement_permission_max_fields';
  problem_statement_id?: Maybe<Scalars['String']['output']>;
  user_id?: Maybe<Scalars['String']['output']>;
};

/** order by max() on columns of table "problem_statement_permission" */
export type Problem_Statement_Permission_Max_Order_By = {
  problem_statement_id?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Problem_Statement_Permission_Min_Fields = {
  __typename?: 'problem_statement_permission_min_fields';
  problem_statement_id?: Maybe<Scalars['String']['output']>;
  user_id?: Maybe<Scalars['String']['output']>;
};

/** order by min() on columns of table "problem_statement_permission" */
export type Problem_Statement_Permission_Min_Order_By = {
  problem_statement_id?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "problem_statement_permission" */
export type Problem_Statement_Permission_Mutation_Response = {
  __typename?: 'problem_statement_permission_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Problem_Statement_Permission>;
};

/** on_conflict condition type for table "problem_statement_permission" */
export type Problem_Statement_Permission_On_Conflict = {
  constraint: Problem_Statement_Permission_Constraint;
  update_columns?: Array<Problem_Statement_Permission_Update_Column>;
  where?: InputMaybe<Problem_Statement_Permission_Bool_Exp>;
};

/** Ordering options when selecting data from "problem_statement_permission". */
export type Problem_Statement_Permission_Order_By = {
  problem_statement?: InputMaybe<Problem_Statement_Order_By>;
  problem_statement_id?: InputMaybe<Order_By>;
  read?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
  write?: InputMaybe<Order_By>;
};

/** primary key columns input for table: problem_statement_permission */
export type Problem_Statement_Permission_Pk_Columns_Input = {
  problem_statement_id: Scalars['String']['input'];
  user_id: Scalars['String']['input'];
};

/** select columns of table "problem_statement_permission" */
export enum Problem_Statement_Permission_Select_Column {
  /** column name */
  ProblemStatementId = 'problem_statement_id',
  /** column name */
  Read = 'read',
  /** column name */
  UserId = 'user_id',
  /** column name */
  Write = 'write'
}

/** input type for updating data in table "problem_statement_permission" */
export type Problem_Statement_Permission_Set_Input = {
  problem_statement_id?: InputMaybe<Scalars['String']['input']>;
  read?: InputMaybe<Scalars['Boolean']['input']>;
  user_id?: InputMaybe<Scalars['String']['input']>;
  write?: InputMaybe<Scalars['Boolean']['input']>;
};

/** update columns of table "problem_statement_permission" */
export enum Problem_Statement_Permission_Update_Column {
  /** column name */
  ProblemStatementId = 'problem_statement_id',
  /** column name */
  Read = 'read',
  /** column name */
  UserId = 'user_id',
  /** column name */
  Write = 'write'
}

export type Problem_Statement_Permission_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Problem_Statement_Permission_Set_Input>;
  where: Problem_Statement_Permission_Bool_Exp;
};

/** primary key columns input for table: problem_statement */
export type Problem_Statement_Pk_Columns_Input = {
  id: Scalars['String']['input'];
};

/** columns and relationships of "problem_statement_provenance" */
export type Problem_Statement_Provenance = {
  __typename?: 'problem_statement_provenance';
  event: Scalars['problem_statement_events']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  /** An object relationship */
  problem_statement: Problem_Statement;
  problem_statement_id: Scalars['String']['output'];
  timestamp: Scalars['timestamptz']['output'];
  userid: Scalars['String']['output'];
};

/** aggregated selection of "problem_statement_provenance" */
export type Problem_Statement_Provenance_Aggregate = {
  __typename?: 'problem_statement_provenance_aggregate';
  aggregate?: Maybe<Problem_Statement_Provenance_Aggregate_Fields>;
  nodes: Array<Problem_Statement_Provenance>;
};

/** aggregate fields of "problem_statement_provenance" */
export type Problem_Statement_Provenance_Aggregate_Fields = {
  __typename?: 'problem_statement_provenance_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Problem_Statement_Provenance_Max_Fields>;
  min?: Maybe<Problem_Statement_Provenance_Min_Fields>;
};


/** aggregate fields of "problem_statement_provenance" */
export type Problem_Statement_Provenance_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Problem_Statement_Provenance_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "problem_statement_provenance" */
export type Problem_Statement_Provenance_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Problem_Statement_Provenance_Max_Order_By>;
  min?: InputMaybe<Problem_Statement_Provenance_Min_Order_By>;
};

/** input type for inserting array relation for remote table "problem_statement_provenance" */
export type Problem_Statement_Provenance_Arr_Rel_Insert_Input = {
  data: Array<Problem_Statement_Provenance_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Problem_Statement_Provenance_On_Conflict>;
};

/** Boolean expression to filter rows from the table "problem_statement_provenance". All fields are combined with a logical 'AND'. */
export type Problem_Statement_Provenance_Bool_Exp = {
  _and?: InputMaybe<Array<Problem_Statement_Provenance_Bool_Exp>>;
  _not?: InputMaybe<Problem_Statement_Provenance_Bool_Exp>;
  _or?: InputMaybe<Array<Problem_Statement_Provenance_Bool_Exp>>;
  event?: InputMaybe<Problem_Statement_Events_Comparison_Exp>;
  notes?: InputMaybe<String_Comparison_Exp>;
  problem_statement?: InputMaybe<Problem_Statement_Bool_Exp>;
  problem_statement_id?: InputMaybe<String_Comparison_Exp>;
  timestamp?: InputMaybe<Timestamptz_Comparison_Exp>;
  userid?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "problem_statement_provenance" */
export enum Problem_Statement_Provenance_Constraint {
  /** unique or primary key constraint on columns "timestamp", "problem_statement_id", "event" */
  ProblemStatementProvenancePkey = 'problem_statement_provenance_pkey'
}

/** input type for inserting data into table "problem_statement_provenance" */
export type Problem_Statement_Provenance_Insert_Input = {
  event?: InputMaybe<Scalars['problem_statement_events']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  problem_statement?: InputMaybe<Problem_Statement_Obj_Rel_Insert_Input>;
  problem_statement_id?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['timestamptz']['input']>;
  userid?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Problem_Statement_Provenance_Max_Fields = {
  __typename?: 'problem_statement_provenance_max_fields';
  event?: Maybe<Scalars['problem_statement_events']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  problem_statement_id?: Maybe<Scalars['String']['output']>;
  timestamp?: Maybe<Scalars['timestamptz']['output']>;
  userid?: Maybe<Scalars['String']['output']>;
};

/** order by max() on columns of table "problem_statement_provenance" */
export type Problem_Statement_Provenance_Max_Order_By = {
  event?: InputMaybe<Order_By>;
  notes?: InputMaybe<Order_By>;
  problem_statement_id?: InputMaybe<Order_By>;
  timestamp?: InputMaybe<Order_By>;
  userid?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Problem_Statement_Provenance_Min_Fields = {
  __typename?: 'problem_statement_provenance_min_fields';
  event?: Maybe<Scalars['problem_statement_events']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  problem_statement_id?: Maybe<Scalars['String']['output']>;
  timestamp?: Maybe<Scalars['timestamptz']['output']>;
  userid?: Maybe<Scalars['String']['output']>;
};

/** order by min() on columns of table "problem_statement_provenance" */
export type Problem_Statement_Provenance_Min_Order_By = {
  event?: InputMaybe<Order_By>;
  notes?: InputMaybe<Order_By>;
  problem_statement_id?: InputMaybe<Order_By>;
  timestamp?: InputMaybe<Order_By>;
  userid?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "problem_statement_provenance" */
export type Problem_Statement_Provenance_Mutation_Response = {
  __typename?: 'problem_statement_provenance_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Problem_Statement_Provenance>;
};

/** on_conflict condition type for table "problem_statement_provenance" */
export type Problem_Statement_Provenance_On_Conflict = {
  constraint: Problem_Statement_Provenance_Constraint;
  update_columns?: Array<Problem_Statement_Provenance_Update_Column>;
  where?: InputMaybe<Problem_Statement_Provenance_Bool_Exp>;
};

/** Ordering options when selecting data from "problem_statement_provenance". */
export type Problem_Statement_Provenance_Order_By = {
  event?: InputMaybe<Order_By>;
  notes?: InputMaybe<Order_By>;
  problem_statement?: InputMaybe<Problem_Statement_Order_By>;
  problem_statement_id?: InputMaybe<Order_By>;
  timestamp?: InputMaybe<Order_By>;
  userid?: InputMaybe<Order_By>;
};

/** primary key columns input for table: problem_statement_provenance */
export type Problem_Statement_Provenance_Pk_Columns_Input = {
  event: Scalars['problem_statement_events']['input'];
  problem_statement_id: Scalars['String']['input'];
  timestamp: Scalars['timestamptz']['input'];
};

/** select columns of table "problem_statement_provenance" */
export enum Problem_Statement_Provenance_Select_Column {
  /** column name */
  Event = 'event',
  /** column name */
  Notes = 'notes',
  /** column name */
  ProblemStatementId = 'problem_statement_id',
  /** column name */
  Timestamp = 'timestamp',
  /** column name */
  Userid = 'userid'
}

/** input type for updating data in table "problem_statement_provenance" */
export type Problem_Statement_Provenance_Set_Input = {
  event?: InputMaybe<Scalars['problem_statement_events']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  problem_statement_id?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['timestamptz']['input']>;
  userid?: InputMaybe<Scalars['String']['input']>;
};

/** update columns of table "problem_statement_provenance" */
export enum Problem_Statement_Provenance_Update_Column {
  /** column name */
  Event = 'event',
  /** column name */
  Notes = 'notes',
  /** column name */
  ProblemStatementId = 'problem_statement_id',
  /** column name */
  Timestamp = 'timestamp',
  /** column name */
  Userid = 'userid'
}

export type Problem_Statement_Provenance_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Problem_Statement_Provenance_Set_Input>;
  where: Problem_Statement_Provenance_Bool_Exp;
};

/** select columns of table "problem_statement" */
export enum Problem_Statement_Select_Column {
  /** column name */
  EndDate = 'end_date',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  RegionId = 'region_id',
  /** column name */
  StartDate = 'start_date'
}

/** input type for updating data in table "problem_statement" */
export type Problem_Statement_Set_Input = {
  end_date?: InputMaybe<Scalars['date']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  region_id?: InputMaybe<Scalars['String']['input']>;
  start_date?: InputMaybe<Scalars['date']['input']>;
};

/** update columns of table "problem_statement" */
export enum Problem_Statement_Update_Column {
  /** column name */
  EndDate = 'end_date',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  RegionId = 'region_id',
  /** column name */
  StartDate = 'start_date'
}

export type Problem_Statement_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Problem_Statement_Set_Input>;
  where: Problem_Statement_Bool_Exp;
};

/** columns and relationships of "profile" */
export type Profile = {
  __typename?: 'profile';
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
};

/** aggregated selection of "profile" */
export type Profile_Aggregate = {
  __typename?: 'profile_aggregate';
  aggregate?: Maybe<Profile_Aggregate_Fields>;
  nodes: Array<Profile>;
};

/** aggregate fields of "profile" */
export type Profile_Aggregate_Fields = {
  __typename?: 'profile_aggregate_fields';
  avg?: Maybe<Profile_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Profile_Max_Fields>;
  min?: Maybe<Profile_Min_Fields>;
  stddev?: Maybe<Profile_Stddev_Fields>;
  stddev_pop?: Maybe<Profile_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Profile_Stddev_Samp_Fields>;
  sum?: Maybe<Profile_Sum_Fields>;
  var_pop?: Maybe<Profile_Var_Pop_Fields>;
  var_samp?: Maybe<Profile_Var_Samp_Fields>;
  variance?: Maybe<Profile_Variance_Fields>;
};


/** aggregate fields of "profile" */
export type Profile_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Profile_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate avg on columns */
export type Profile_Avg_Fields = {
  __typename?: 'profile_avg_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "profile". All fields are combined with a logical 'AND'. */
export type Profile_Bool_Exp = {
  _and?: InputMaybe<Array<Profile_Bool_Exp>>;
  _not?: InputMaybe<Profile_Bool_Exp>;
  _or?: InputMaybe<Array<Profile_Bool_Exp>>;
  id?: InputMaybe<Int_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "profile" */
export enum Profile_Constraint {
  /** unique or primary key constraint on columns "id" */
  ProfilePkey = 'profile_pkey'
}

/** input type for incrementing numeric columns in table "profile" */
export type Profile_Inc_Input = {
  id?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "profile" */
export type Profile_Insert_Input = {
  id?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Profile_Max_Fields = {
  __typename?: 'profile_max_fields';
  id?: Maybe<Scalars['Int']['output']>;
  name?: Maybe<Scalars['String']['output']>;
};

/** aggregate min on columns */
export type Profile_Min_Fields = {
  __typename?: 'profile_min_fields';
  id?: Maybe<Scalars['Int']['output']>;
  name?: Maybe<Scalars['String']['output']>;
};

/** response of any mutation on the table "profile" */
export type Profile_Mutation_Response = {
  __typename?: 'profile_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Profile>;
};

/** on_conflict condition type for table "profile" */
export type Profile_On_Conflict = {
  constraint: Profile_Constraint;
  update_columns?: Array<Profile_Update_Column>;
  where?: InputMaybe<Profile_Bool_Exp>;
};

/** Ordering options when selecting data from "profile". */
export type Profile_Order_By = {
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
};

/** primary key columns input for table: profile */
export type Profile_Pk_Columns_Input = {
  id: Scalars['Int']['input'];
};

/** select columns of table "profile" */
export enum Profile_Select_Column {
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name'
}

/** input type for updating data in table "profile" */
export type Profile_Set_Input = {
  id?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate stddev on columns */
export type Profile_Stddev_Fields = {
  __typename?: 'profile_stddev_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type Profile_Stddev_Pop_Fields = {
  __typename?: 'profile_stddev_pop_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type Profile_Stddev_Samp_Fields = {
  __typename?: 'profile_stddev_samp_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** aggregate sum on columns */
export type Profile_Sum_Fields = {
  __typename?: 'profile_sum_fields';
  id?: Maybe<Scalars['Int']['output']>;
};

/** update columns of table "profile" */
export enum Profile_Update_Column {
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name'
}

export type Profile_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Profile_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Profile_Set_Input>;
  where: Profile_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Profile_Var_Pop_Fields = {
  __typename?: 'profile_var_pop_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type Profile_Var_Samp_Fields = {
  __typename?: 'profile_var_samp_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type Profile_Variance_Fields = {
  __typename?: 'profile_variance_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

export type Query_Root = {
  __typename?: 'query_root';
  /** fetch data from the table: "dataset" */
  dataset: Array<Dataset>;
  /** fetch aggregated fields from the table: "dataset" */
  dataset_aggregate: Dataset_Aggregate;
  /** fetch data from the table: "dataset" using primary key columns */
  dataset_by_pk?: Maybe<Dataset>;
  /** fetch data from the table: "dataslice" */
  dataslice: Array<Dataslice>;
  /** fetch aggregated fields from the table: "dataslice" */
  dataslice_aggregate: Dataslice_Aggregate;
  /** fetch data from the table: "dataslice" using primary key columns */
  dataslice_by_pk?: Maybe<Dataslice>;
  /** fetch data from the table: "dataslice_resource" */
  dataslice_resource: Array<Dataslice_Resource>;
  /** fetch aggregated fields from the table: "dataslice_resource" */
  dataslice_resource_aggregate: Dataslice_Resource_Aggregate;
  /** fetch data from the table: "dataslice_resource" using primary key columns */
  dataslice_resource_by_pk?: Maybe<Dataslice_Resource>;
  /** fetch data from the table: "execution" */
  execution: Array<Execution>;
  /** fetch aggregated fields from the table: "execution" */
  execution_aggregate: Execution_Aggregate;
  /** fetch data from the table: "execution" using primary key columns */
  execution_by_pk?: Maybe<Execution>;
  /** fetch data from the table: "execution_data_binding" */
  execution_data_binding: Array<Execution_Data_Binding>;
  /** fetch aggregated fields from the table: "execution_data_binding" */
  execution_data_binding_aggregate: Execution_Data_Binding_Aggregate;
  /** fetch data from the table: "execution_data_binding" using primary key columns */
  execution_data_binding_by_pk?: Maybe<Execution_Data_Binding>;
  /** fetch data from the table: "execution_parameter_binding" */
  execution_parameter_binding: Array<Execution_Parameter_Binding>;
  /** fetch aggregated fields from the table: "execution_parameter_binding" */
  execution_parameter_binding_aggregate: Execution_Parameter_Binding_Aggregate;
  /** fetch data from the table: "execution_parameter_binding" using primary key columns */
  execution_parameter_binding_by_pk?: Maybe<Execution_Parameter_Binding>;
  /** fetch data from the table: "execution_result" */
  execution_result: Array<Execution_Result>;
  /** fetch aggregated fields from the table: "execution_result" */
  execution_result_aggregate: Execution_Result_Aggregate;
  /** fetch data from the table: "execution_result" using primary key columns */
  execution_result_by_pk?: Maybe<Execution_Result>;
  /** execute function "find_regions_containing_point" which returns "regions_containing_point" */
  find_regions_containing_point: Array<Regions_Containing_Point>;
  /** execute function "find_regions_containing_point" and query aggregates on result of table type "regions_containing_point" */
  find_regions_containing_point_aggregate: Regions_Containing_Point_Aggregate;
  /** execute function "find_regions_containing_point_fuzzy" which returns "regions_containing_point" */
  find_regions_containing_point_fuzzy: Array<Regions_Containing_Point>;
  /** execute function "find_regions_containing_point_fuzzy" and query aggregates on result of table type "regions_containing_point" */
  find_regions_containing_point_fuzzy_aggregate: Regions_Containing_Point_Aggregate;
  /** fetch data from the table: "intervention" */
  intervention: Array<Intervention>;
  /** fetch aggregated fields from the table: "intervention" */
  intervention_aggregate: Intervention_Aggregate;
  /** fetch data from the table: "intervention" using primary key columns */
  intervention_by_pk?: Maybe<Intervention>;
  /** fetch data from the table: "model" */
  model: Array<Model>;
  /** fetch aggregated fields from the table: "model" */
  model_aggregate: Model_Aggregate;
  /** fetch data from the table: "model" using primary key columns */
  model_by_pk?: Maybe<Model>;
  /** fetch data from the table: "model_input" */
  model_input: Array<Model_Input>;
  /** fetch aggregated fields from the table: "model_input" */
  model_input_aggregate: Model_Input_Aggregate;
  /** fetch data from the table: "model_input" using primary key columns */
  model_input_by_pk?: Maybe<Model_Input>;
  /** fetch data from the table: "model_input_fixed_binding" */
  model_input_fixed_binding: Array<Model_Input_Fixed_Binding>;
  /** fetch aggregated fields from the table: "model_input_fixed_binding" */
  model_input_fixed_binding_aggregate: Model_Input_Fixed_Binding_Aggregate;
  /** fetch data from the table: "model_input_fixed_binding" using primary key columns */
  model_input_fixed_binding_by_pk?: Maybe<Model_Input_Fixed_Binding>;
  /** fetch data from the table: "model_io" */
  model_io: Array<Model_Io>;
  /** fetch aggregated fields from the table: "model_io" */
  model_io_aggregate: Model_Io_Aggregate;
  /** fetch data from the table: "model_io" using primary key columns */
  model_io_by_pk?: Maybe<Model_Io>;
  /** fetch data from the table: "model_io_variable" */
  model_io_variable: Array<Model_Io_Variable>;
  /** fetch aggregated fields from the table: "model_io_variable" */
  model_io_variable_aggregate: Model_Io_Variable_Aggregate;
  /** fetch data from the table: "model_io_variable" using primary key columns */
  model_io_variable_by_pk?: Maybe<Model_Io_Variable>;
  /** fetch data from the table: "model_output" */
  model_output: Array<Model_Output>;
  /** fetch aggregated fields from the table: "model_output" */
  model_output_aggregate: Model_Output_Aggregate;
  /** fetch data from the table: "model_output" using primary key columns */
  model_output_by_pk?: Maybe<Model_Output>;
  /** fetch data from the table: "model_parameter" */
  model_parameter: Array<Model_Parameter>;
  /** fetch aggregated fields from the table: "model_parameter" */
  model_parameter_aggregate: Model_Parameter_Aggregate;
  /** fetch data from the table: "model_parameter" using primary key columns */
  model_parameter_by_pk?: Maybe<Model_Parameter>;
  /** fetch data from the table: "problem_statement" */
  problem_statement: Array<Problem_Statement>;
  /** fetch aggregated fields from the table: "problem_statement" */
  problem_statement_aggregate: Problem_Statement_Aggregate;
  /** fetch data from the table: "problem_statement" using primary key columns */
  problem_statement_by_pk?: Maybe<Problem_Statement>;
  /** fetch data from the table: "problem_statement_permission" */
  problem_statement_permission: Array<Problem_Statement_Permission>;
  /** fetch aggregated fields from the table: "problem_statement_permission" */
  problem_statement_permission_aggregate: Problem_Statement_Permission_Aggregate;
  /** fetch data from the table: "problem_statement_permission" using primary key columns */
  problem_statement_permission_by_pk?: Maybe<Problem_Statement_Permission>;
  /** fetch data from the table: "problem_statement_provenance" */
  problem_statement_provenance: Array<Problem_Statement_Provenance>;
  /** fetch aggregated fields from the table: "problem_statement_provenance" */
  problem_statement_provenance_aggregate: Problem_Statement_Provenance_Aggregate;
  /** fetch data from the table: "problem_statement_provenance" using primary key columns */
  problem_statement_provenance_by_pk?: Maybe<Problem_Statement_Provenance>;
  /** fetch data from the table: "profile" */
  profile: Array<Profile>;
  /** fetch aggregated fields from the table: "profile" */
  profile_aggregate: Profile_Aggregate;
  /** fetch data from the table: "profile" using primary key columns */
  profile_by_pk?: Maybe<Profile>;
  /** fetch data from the table: "region" */
  region: Array<Region>;
  /** fetch aggregated fields from the table: "region" */
  region_aggregate: Region_Aggregate;
  /** fetch data from the table: "region" using primary key columns */
  region_by_pk?: Maybe<Region>;
  /** fetch data from the table: "region_category" */
  region_category: Array<Region_Category>;
  /** fetch aggregated fields from the table: "region_category" */
  region_category_aggregate: Region_Category_Aggregate;
  /** fetch data from the table: "region_category" using primary key columns */
  region_category_by_pk?: Maybe<Region_Category>;
  /** fetch data from the table: "region_category_tree" */
  region_category_tree: Array<Region_Category_Tree>;
  /** fetch aggregated fields from the table: "region_category_tree" */
  region_category_tree_aggregate: Region_Category_Tree_Aggregate;
  /** fetch data from the table: "region_category_tree" using primary key columns */
  region_category_tree_by_pk?: Maybe<Region_Category_Tree>;
  /** fetch data from the table: "region_geometry" */
  region_geometry: Array<Region_Geometry>;
  /** fetch aggregated fields from the table: "region_geometry" */
  region_geometry_aggregate: Region_Geometry_Aggregate;
  /** fetch data from the table: "region_geometry" using primary key columns */
  region_geometry_by_pk?: Maybe<Region_Geometry>;
  /** fetch data from the table: "regions_containing_point" */
  regions_containing_point: Array<Regions_Containing_Point>;
  /** fetch aggregated fields from the table: "regions_containing_point" */
  regions_containing_point_aggregate: Regions_Containing_Point_Aggregate;
  /** fetch data from the table: "resource" */
  resource: Array<Resource>;
  /** fetch aggregated fields from the table: "resource" */
  resource_aggregate: Resource_Aggregate;
  /** fetch data from the table: "resource" using primary key columns */
  resource_by_pk?: Maybe<Resource>;
  /** fetch data from the table: "task" */
  task: Array<Task>;
  /** fetch aggregated fields from the table: "task" */
  task_aggregate: Task_Aggregate;
  /** fetch data from the table: "task" using primary key columns */
  task_by_pk?: Maybe<Task>;
  /** fetch data from the table: "task_permission" */
  task_permission: Array<Task_Permission>;
  /** fetch aggregated fields from the table: "task_permission" */
  task_permission_aggregate: Task_Permission_Aggregate;
  /** fetch data from the table: "task_permission" using primary key columns */
  task_permission_by_pk?: Maybe<Task_Permission>;
  /** fetch data from the table: "task_provenance" */
  task_provenance: Array<Task_Provenance>;
  /** fetch aggregated fields from the table: "task_provenance" */
  task_provenance_aggregate: Task_Provenance_Aggregate;
  /** fetch data from the table: "task_provenance" using primary key columns */
  task_provenance_by_pk?: Maybe<Task_Provenance>;
  /** fetch data from the table: "thread" */
  thread: Array<Thread>;
  /** fetch aggregated fields from the table: "thread" */
  thread_aggregate: Thread_Aggregate;
  /** fetch data from the table: "thread" using primary key columns */
  thread_by_pk?: Maybe<Thread>;
  /** An array relationship */
  thread_data: Array<Thread_Data>;
  /** An aggregate relationship */
  thread_data_aggregate: Thread_Data_Aggregate;
  /** fetch data from the table: "thread_data" using primary key columns */
  thread_data_by_pk?: Maybe<Thread_Data>;
  /** fetch data from the table: "thread_model" */
  thread_model: Array<Thread_Model>;
  /** fetch aggregated fields from the table: "thread_model" */
  thread_model_aggregate: Thread_Model_Aggregate;
  /** fetch data from the table: "thread_model" using primary key columns */
  thread_model_by_pk?: Maybe<Thread_Model>;
  /** fetch data from the table: "thread_model_execution" */
  thread_model_execution: Array<Thread_Model_Execution>;
  /** fetch aggregated fields from the table: "thread_model_execution" */
  thread_model_execution_aggregate: Thread_Model_Execution_Aggregate;
  /** fetch data from the table: "thread_model_execution" using primary key columns */
  thread_model_execution_by_pk?: Maybe<Thread_Model_Execution>;
  /** fetch data from the table: "thread_model_execution_summary" */
  thread_model_execution_summary: Array<Thread_Model_Execution_Summary>;
  /** fetch aggregated fields from the table: "thread_model_execution_summary" */
  thread_model_execution_summary_aggregate: Thread_Model_Execution_Summary_Aggregate;
  /** fetch data from the table: "thread_model_execution_summary" using primary key columns */
  thread_model_execution_summary_by_pk?: Maybe<Thread_Model_Execution_Summary>;
  /** fetch data from the table: "thread_model_io" */
  thread_model_io: Array<Thread_Model_Io>;
  /** fetch aggregated fields from the table: "thread_model_io" */
  thread_model_io_aggregate: Thread_Model_Io_Aggregate;
  /** fetch data from the table: "thread_model_io" using primary key columns */
  thread_model_io_by_pk?: Maybe<Thread_Model_Io>;
  /** fetch data from the table: "thread_model_parameter" */
  thread_model_parameter: Array<Thread_Model_Parameter>;
  /** fetch aggregated fields from the table: "thread_model_parameter" */
  thread_model_parameter_aggregate: Thread_Model_Parameter_Aggregate;
  /** fetch data from the table: "thread_model_parameter" using primary key columns */
  thread_model_parameter_by_pk?: Maybe<Thread_Model_Parameter>;
  /** fetch data from the table: "thread_permission" */
  thread_permission: Array<Thread_Permission>;
  /** fetch aggregated fields from the table: "thread_permission" */
  thread_permission_aggregate: Thread_Permission_Aggregate;
  /** fetch data from the table: "thread_permission" using primary key columns */
  thread_permission_by_pk?: Maybe<Thread_Permission>;
  /** fetch data from the table: "thread_provenance" */
  thread_provenance: Array<Thread_Provenance>;
  /** fetch aggregated fields from the table: "thread_provenance" */
  thread_provenance_aggregate: Thread_Provenance_Aggregate;
  /** fetch data from the table: "thread_provenance" using primary key columns */
  thread_provenance_by_pk?: Maybe<Thread_Provenance>;
  /** fetch data from the table: "variable" */
  variable: Array<Variable>;
  /** fetch aggregated fields from the table: "variable" */
  variable_aggregate: Variable_Aggregate;
  /** fetch data from the table: "variable" using primary key columns */
  variable_by_pk?: Maybe<Variable>;
  /** fetch data from the table: "variable_category" */
  variable_category: Array<Variable_Category>;
  /** fetch aggregated fields from the table: "variable_category" */
  variable_category_aggregate: Variable_Category_Aggregate;
  /** fetch data from the table: "variable_category" using primary key columns */
  variable_category_by_pk?: Maybe<Variable_Category>;
};


export type Query_RootDatasetArgs = {
  distinct_on?: InputMaybe<Array<Dataset_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Dataset_Order_By>>;
  where?: InputMaybe<Dataset_Bool_Exp>;
};


export type Query_RootDataset_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Dataset_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Dataset_Order_By>>;
  where?: InputMaybe<Dataset_Bool_Exp>;
};


export type Query_RootDataset_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Query_RootDatasliceArgs = {
  distinct_on?: InputMaybe<Array<Dataslice_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Dataslice_Order_By>>;
  where?: InputMaybe<Dataslice_Bool_Exp>;
};


export type Query_RootDataslice_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Dataslice_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Dataslice_Order_By>>;
  where?: InputMaybe<Dataslice_Bool_Exp>;
};


export type Query_RootDataslice_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootDataslice_ResourceArgs = {
  distinct_on?: InputMaybe<Array<Dataslice_Resource_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Dataslice_Resource_Order_By>>;
  where?: InputMaybe<Dataslice_Resource_Bool_Exp>;
};


export type Query_RootDataslice_Resource_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Dataslice_Resource_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Dataslice_Resource_Order_By>>;
  where?: InputMaybe<Dataslice_Resource_Bool_Exp>;
};


export type Query_RootDataslice_Resource_By_PkArgs = {
  dataslice_id: Scalars['uuid']['input'];
  resource_id: Scalars['String']['input'];
};


export type Query_RootExecutionArgs = {
  distinct_on?: InputMaybe<Array<Execution_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Order_By>>;
  where?: InputMaybe<Execution_Bool_Exp>;
};


export type Query_RootExecution_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Execution_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Order_By>>;
  where?: InputMaybe<Execution_Bool_Exp>;
};


export type Query_RootExecution_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootExecution_Data_BindingArgs = {
  distinct_on?: InputMaybe<Array<Execution_Data_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Data_Binding_Order_By>>;
  where?: InputMaybe<Execution_Data_Binding_Bool_Exp>;
};


export type Query_RootExecution_Data_Binding_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Execution_Data_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Data_Binding_Order_By>>;
  where?: InputMaybe<Execution_Data_Binding_Bool_Exp>;
};


export type Query_RootExecution_Data_Binding_By_PkArgs = {
  execution_id: Scalars['uuid']['input'];
  model_io_id: Scalars['String']['input'];
  resource_id: Scalars['String']['input'];
};


export type Query_RootExecution_Parameter_BindingArgs = {
  distinct_on?: InputMaybe<Array<Execution_Parameter_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Parameter_Binding_Order_By>>;
  where?: InputMaybe<Execution_Parameter_Binding_Bool_Exp>;
};


export type Query_RootExecution_Parameter_Binding_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Execution_Parameter_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Parameter_Binding_Order_By>>;
  where?: InputMaybe<Execution_Parameter_Binding_Bool_Exp>;
};


export type Query_RootExecution_Parameter_Binding_By_PkArgs = {
  execution_id: Scalars['uuid']['input'];
  model_parameter_id: Scalars['String']['input'];
};


export type Query_RootExecution_ResultArgs = {
  distinct_on?: InputMaybe<Array<Execution_Result_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Result_Order_By>>;
  where?: InputMaybe<Execution_Result_Bool_Exp>;
};


export type Query_RootExecution_Result_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Execution_Result_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Result_Order_By>>;
  where?: InputMaybe<Execution_Result_Bool_Exp>;
};


export type Query_RootExecution_Result_By_PkArgs = {
  execution_id: Scalars['uuid']['input'];
  model_io_id: Scalars['String']['input'];
  resource_id: Scalars['String']['input'];
};


export type Query_RootFind_Regions_Containing_PointArgs = {
  args: Find_Regions_Containing_Point_Args;
  distinct_on?: InputMaybe<Array<Regions_Containing_Point_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Regions_Containing_Point_Order_By>>;
  where?: InputMaybe<Regions_Containing_Point_Bool_Exp>;
};


export type Query_RootFind_Regions_Containing_Point_AggregateArgs = {
  args: Find_Regions_Containing_Point_Args;
  distinct_on?: InputMaybe<Array<Regions_Containing_Point_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Regions_Containing_Point_Order_By>>;
  where?: InputMaybe<Regions_Containing_Point_Bool_Exp>;
};


export type Query_RootFind_Regions_Containing_Point_FuzzyArgs = {
  args: Find_Regions_Containing_Point_Fuzzy_Args;
  distinct_on?: InputMaybe<Array<Regions_Containing_Point_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Regions_Containing_Point_Order_By>>;
  where?: InputMaybe<Regions_Containing_Point_Bool_Exp>;
};


export type Query_RootFind_Regions_Containing_Point_Fuzzy_AggregateArgs = {
  args: Find_Regions_Containing_Point_Fuzzy_Args;
  distinct_on?: InputMaybe<Array<Regions_Containing_Point_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Regions_Containing_Point_Order_By>>;
  where?: InputMaybe<Regions_Containing_Point_Bool_Exp>;
};


export type Query_RootInterventionArgs = {
  distinct_on?: InputMaybe<Array<Intervention_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Intervention_Order_By>>;
  where?: InputMaybe<Intervention_Bool_Exp>;
};


export type Query_RootIntervention_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Intervention_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Intervention_Order_By>>;
  where?: InputMaybe<Intervention_Bool_Exp>;
};


export type Query_RootIntervention_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Query_RootModelArgs = {
  distinct_on?: InputMaybe<Array<Model_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Order_By>>;
  where?: InputMaybe<Model_Bool_Exp>;
};


export type Query_RootModel_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Model_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Order_By>>;
  where?: InputMaybe<Model_Bool_Exp>;
};


export type Query_RootModel_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Query_RootModel_InputArgs = {
  distinct_on?: InputMaybe<Array<Model_Input_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Input_Order_By>>;
  where?: InputMaybe<Model_Input_Bool_Exp>;
};


export type Query_RootModel_Input_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Model_Input_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Input_Order_By>>;
  where?: InputMaybe<Model_Input_Bool_Exp>;
};


export type Query_RootModel_Input_By_PkArgs = {
  model_id: Scalars['String']['input'];
  model_io_id: Scalars['String']['input'];
};


export type Query_RootModel_Input_Fixed_BindingArgs = {
  distinct_on?: InputMaybe<Array<Model_Input_Fixed_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Input_Fixed_Binding_Order_By>>;
  where?: InputMaybe<Model_Input_Fixed_Binding_Bool_Exp>;
};


export type Query_RootModel_Input_Fixed_Binding_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Model_Input_Fixed_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Input_Fixed_Binding_Order_By>>;
  where?: InputMaybe<Model_Input_Fixed_Binding_Bool_Exp>;
};


export type Query_RootModel_Input_Fixed_Binding_By_PkArgs = {
  model_io_id: Scalars['String']['input'];
  resource_id: Scalars['String']['input'];
};


export type Query_RootModel_IoArgs = {
  distinct_on?: InputMaybe<Array<Model_Io_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Io_Order_By>>;
  where?: InputMaybe<Model_Io_Bool_Exp>;
};


export type Query_RootModel_Io_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Model_Io_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Io_Order_By>>;
  where?: InputMaybe<Model_Io_Bool_Exp>;
};


export type Query_RootModel_Io_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Query_RootModel_Io_VariableArgs = {
  distinct_on?: InputMaybe<Array<Model_Io_Variable_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Io_Variable_Order_By>>;
  where?: InputMaybe<Model_Io_Variable_Bool_Exp>;
};


export type Query_RootModel_Io_Variable_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Model_Io_Variable_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Io_Variable_Order_By>>;
  where?: InputMaybe<Model_Io_Variable_Bool_Exp>;
};


export type Query_RootModel_Io_Variable_By_PkArgs = {
  model_io_id: Scalars['String']['input'];
  variable_id: Scalars['String']['input'];
};


export type Query_RootModel_OutputArgs = {
  distinct_on?: InputMaybe<Array<Model_Output_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Output_Order_By>>;
  where?: InputMaybe<Model_Output_Bool_Exp>;
};


export type Query_RootModel_Output_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Model_Output_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Output_Order_By>>;
  where?: InputMaybe<Model_Output_Bool_Exp>;
};


export type Query_RootModel_Output_By_PkArgs = {
  model_id: Scalars['String']['input'];
  model_io_id: Scalars['String']['input'];
};


export type Query_RootModel_ParameterArgs = {
  distinct_on?: InputMaybe<Array<Model_Parameter_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Parameter_Order_By>>;
  where?: InputMaybe<Model_Parameter_Bool_Exp>;
};


export type Query_RootModel_Parameter_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Model_Parameter_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Parameter_Order_By>>;
  where?: InputMaybe<Model_Parameter_Bool_Exp>;
};


export type Query_RootModel_Parameter_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Query_RootProblem_StatementArgs = {
  distinct_on?: InputMaybe<Array<Problem_Statement_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Problem_Statement_Order_By>>;
  where?: InputMaybe<Problem_Statement_Bool_Exp>;
};


export type Query_RootProblem_Statement_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Problem_Statement_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Problem_Statement_Order_By>>;
  where?: InputMaybe<Problem_Statement_Bool_Exp>;
};


export type Query_RootProblem_Statement_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Query_RootProblem_Statement_PermissionArgs = {
  distinct_on?: InputMaybe<Array<Problem_Statement_Permission_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Problem_Statement_Permission_Order_By>>;
  where?: InputMaybe<Problem_Statement_Permission_Bool_Exp>;
};


export type Query_RootProblem_Statement_Permission_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Problem_Statement_Permission_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Problem_Statement_Permission_Order_By>>;
  where?: InputMaybe<Problem_Statement_Permission_Bool_Exp>;
};


export type Query_RootProblem_Statement_Permission_By_PkArgs = {
  problem_statement_id: Scalars['String']['input'];
  user_id: Scalars['String']['input'];
};


export type Query_RootProblem_Statement_ProvenanceArgs = {
  distinct_on?: InputMaybe<Array<Problem_Statement_Provenance_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Problem_Statement_Provenance_Order_By>>;
  where?: InputMaybe<Problem_Statement_Provenance_Bool_Exp>;
};


export type Query_RootProblem_Statement_Provenance_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Problem_Statement_Provenance_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Problem_Statement_Provenance_Order_By>>;
  where?: InputMaybe<Problem_Statement_Provenance_Bool_Exp>;
};


export type Query_RootProblem_Statement_Provenance_By_PkArgs = {
  event: Scalars['problem_statement_events']['input'];
  problem_statement_id: Scalars['String']['input'];
  timestamp: Scalars['timestamptz']['input'];
};


export type Query_RootProfileArgs = {
  distinct_on?: InputMaybe<Array<Profile_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Profile_Order_By>>;
  where?: InputMaybe<Profile_Bool_Exp>;
};


export type Query_RootProfile_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Profile_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Profile_Order_By>>;
  where?: InputMaybe<Profile_Bool_Exp>;
};


export type Query_RootProfile_By_PkArgs = {
  id: Scalars['Int']['input'];
};


export type Query_RootRegionArgs = {
  distinct_on?: InputMaybe<Array<Region_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Order_By>>;
  where?: InputMaybe<Region_Bool_Exp>;
};


export type Query_RootRegion_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Region_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Order_By>>;
  where?: InputMaybe<Region_Bool_Exp>;
};


export type Query_RootRegion_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Query_RootRegion_CategoryArgs = {
  distinct_on?: InputMaybe<Array<Region_Category_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Category_Order_By>>;
  where?: InputMaybe<Region_Category_Bool_Exp>;
};


export type Query_RootRegion_Category_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Region_Category_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Category_Order_By>>;
  where?: InputMaybe<Region_Category_Bool_Exp>;
};


export type Query_RootRegion_Category_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Query_RootRegion_Category_TreeArgs = {
  distinct_on?: InputMaybe<Array<Region_Category_Tree_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Category_Tree_Order_By>>;
  where?: InputMaybe<Region_Category_Tree_Bool_Exp>;
};


export type Query_RootRegion_Category_Tree_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Region_Category_Tree_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Category_Tree_Order_By>>;
  where?: InputMaybe<Region_Category_Tree_Bool_Exp>;
};


export type Query_RootRegion_Category_Tree_By_PkArgs = {
  region_category_id: Scalars['String']['input'];
  region_category_parent_id: Scalars['String']['input'];
};


export type Query_RootRegion_GeometryArgs = {
  distinct_on?: InputMaybe<Array<Region_Geometry_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Geometry_Order_By>>;
  where?: InputMaybe<Region_Geometry_Bool_Exp>;
};


export type Query_RootRegion_Geometry_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Region_Geometry_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Geometry_Order_By>>;
  where?: InputMaybe<Region_Geometry_Bool_Exp>;
};


export type Query_RootRegion_Geometry_By_PkArgs = {
  id: Scalars['Int']['input'];
};


export type Query_RootRegions_Containing_PointArgs = {
  distinct_on?: InputMaybe<Array<Regions_Containing_Point_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Regions_Containing_Point_Order_By>>;
  where?: InputMaybe<Regions_Containing_Point_Bool_Exp>;
};


export type Query_RootRegions_Containing_Point_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Regions_Containing_Point_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Regions_Containing_Point_Order_By>>;
  where?: InputMaybe<Regions_Containing_Point_Bool_Exp>;
};


export type Query_RootResourceArgs = {
  distinct_on?: InputMaybe<Array<Resource_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Resource_Order_By>>;
  where?: InputMaybe<Resource_Bool_Exp>;
};


export type Query_RootResource_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Resource_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Resource_Order_By>>;
  where?: InputMaybe<Resource_Bool_Exp>;
};


export type Query_RootResource_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Query_RootTaskArgs = {
  distinct_on?: InputMaybe<Array<Task_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Task_Order_By>>;
  where?: InputMaybe<Task_Bool_Exp>;
};


export type Query_RootTask_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Task_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Task_Order_By>>;
  where?: InputMaybe<Task_Bool_Exp>;
};


export type Query_RootTask_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Query_RootTask_PermissionArgs = {
  distinct_on?: InputMaybe<Array<Task_Permission_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Task_Permission_Order_By>>;
  where?: InputMaybe<Task_Permission_Bool_Exp>;
};


export type Query_RootTask_Permission_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Task_Permission_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Task_Permission_Order_By>>;
  where?: InputMaybe<Task_Permission_Bool_Exp>;
};


export type Query_RootTask_Permission_By_PkArgs = {
  task_id: Scalars['String']['input'];
  user_id: Scalars['String']['input'];
};


export type Query_RootTask_ProvenanceArgs = {
  distinct_on?: InputMaybe<Array<Task_Provenance_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Task_Provenance_Order_By>>;
  where?: InputMaybe<Task_Provenance_Bool_Exp>;
};


export type Query_RootTask_Provenance_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Task_Provenance_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Task_Provenance_Order_By>>;
  where?: InputMaybe<Task_Provenance_Bool_Exp>;
};


export type Query_RootTask_Provenance_By_PkArgs = {
  event: Scalars['task_events']['input'];
  task_id: Scalars['String']['input'];
  timestamp: Scalars['timestamptz']['input'];
};


export type Query_RootThreadArgs = {
  distinct_on?: InputMaybe<Array<Thread_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Order_By>>;
  where?: InputMaybe<Thread_Bool_Exp>;
};


export type Query_RootThread_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Order_By>>;
  where?: InputMaybe<Thread_Bool_Exp>;
};


export type Query_RootThread_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Query_RootThread_DataArgs = {
  distinct_on?: InputMaybe<Array<Thread_Data_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Data_Order_By>>;
  where?: InputMaybe<Thread_Data_Bool_Exp>;
};


export type Query_RootThread_Data_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Data_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Data_Order_By>>;
  where?: InputMaybe<Thread_Data_Bool_Exp>;
};


export type Query_RootThread_Data_By_PkArgs = {
  dataslice_id: Scalars['uuid']['input'];
  thread_id: Scalars['String']['input'];
};


export type Query_RootThread_ModelArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Order_By>>;
  where?: InputMaybe<Thread_Model_Bool_Exp>;
};


export type Query_RootThread_Model_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Order_By>>;
  where?: InputMaybe<Thread_Model_Bool_Exp>;
};


export type Query_RootThread_Model_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootThread_Model_ExecutionArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Execution_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Execution_Order_By>>;
  where?: InputMaybe<Thread_Model_Execution_Bool_Exp>;
};


export type Query_RootThread_Model_Execution_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Execution_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Execution_Order_By>>;
  where?: InputMaybe<Thread_Model_Execution_Bool_Exp>;
};


export type Query_RootThread_Model_Execution_By_PkArgs = {
  execution_id: Scalars['uuid']['input'];
  thread_model_id: Scalars['uuid']['input'];
};


export type Query_RootThread_Model_Execution_SummaryArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Execution_Summary_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Execution_Summary_Order_By>>;
  where?: InputMaybe<Thread_Model_Execution_Summary_Bool_Exp>;
};


export type Query_RootThread_Model_Execution_Summary_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Execution_Summary_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Execution_Summary_Order_By>>;
  where?: InputMaybe<Thread_Model_Execution_Summary_Bool_Exp>;
};


export type Query_RootThread_Model_Execution_Summary_By_PkArgs = {
  thread_model_id: Scalars['uuid']['input'];
};


export type Query_RootThread_Model_IoArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Io_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Io_Order_By>>;
  where?: InputMaybe<Thread_Model_Io_Bool_Exp>;
};


export type Query_RootThread_Model_Io_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Io_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Io_Order_By>>;
  where?: InputMaybe<Thread_Model_Io_Bool_Exp>;
};


export type Query_RootThread_Model_Io_By_PkArgs = {
  dataslice_id: Scalars['uuid']['input'];
  model_io_id: Scalars['String']['input'];
  thread_model_id: Scalars['uuid']['input'];
};


export type Query_RootThread_Model_ParameterArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Parameter_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Parameter_Order_By>>;
  where?: InputMaybe<Thread_Model_Parameter_Bool_Exp>;
};


export type Query_RootThread_Model_Parameter_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Parameter_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Parameter_Order_By>>;
  where?: InputMaybe<Thread_Model_Parameter_Bool_Exp>;
};


export type Query_RootThread_Model_Parameter_By_PkArgs = {
  model_parameter_id: Scalars['String']['input'];
  parameter_value: Scalars['String']['input'];
  thread_model_id: Scalars['uuid']['input'];
};


export type Query_RootThread_PermissionArgs = {
  distinct_on?: InputMaybe<Array<Thread_Permission_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Permission_Order_By>>;
  where?: InputMaybe<Thread_Permission_Bool_Exp>;
};


export type Query_RootThread_Permission_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Permission_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Permission_Order_By>>;
  where?: InputMaybe<Thread_Permission_Bool_Exp>;
};


export type Query_RootThread_Permission_By_PkArgs = {
  thread_id: Scalars['String']['input'];
  user_id: Scalars['String']['input'];
};


export type Query_RootThread_ProvenanceArgs = {
  distinct_on?: InputMaybe<Array<Thread_Provenance_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Provenance_Order_By>>;
  where?: InputMaybe<Thread_Provenance_Bool_Exp>;
};


export type Query_RootThread_Provenance_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Provenance_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Provenance_Order_By>>;
  where?: InputMaybe<Thread_Provenance_Bool_Exp>;
};


export type Query_RootThread_Provenance_By_PkArgs = {
  event: Scalars['thread_events']['input'];
  thread_id: Scalars['String']['input'];
  timestamp: Scalars['timestamptz']['input'];
};


export type Query_RootVariableArgs = {
  distinct_on?: InputMaybe<Array<Variable_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Variable_Order_By>>;
  where?: InputMaybe<Variable_Bool_Exp>;
};


export type Query_RootVariable_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Variable_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Variable_Order_By>>;
  where?: InputMaybe<Variable_Bool_Exp>;
};


export type Query_RootVariable_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Query_RootVariable_CategoryArgs = {
  distinct_on?: InputMaybe<Array<Variable_Category_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Variable_Category_Order_By>>;
  where?: InputMaybe<Variable_Category_Bool_Exp>;
};


export type Query_RootVariable_Category_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Variable_Category_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Variable_Category_Order_By>>;
  where?: InputMaybe<Variable_Category_Bool_Exp>;
};


export type Query_RootVariable_Category_By_PkArgs = {
  category: Scalars['String']['input'];
  variable_id: Scalars['String']['input'];
};

/** columns and relationships of "region" */
export type Region = {
  __typename?: 'region';
  category_id?: Maybe<Scalars['String']['output']>;
  /** An array relationship */
  dataslices: Array<Dataslice>;
  /** An aggregate relationship */
  dataslices_aggregate: Dataslice_Aggregate;
  /** An array relationship */
  geometries: Array<Region_Geometry>;
  /** An aggregate relationship */
  geometries_aggregate: Region_Geometry_Aggregate;
  id: Scalars['String']['output'];
  model_catalog_uri?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  /** An object relationship */
  parent_region?: Maybe<Region>;
  parent_region_id?: Maybe<Scalars['String']['output']>;
  /** An array relationship */
  problem_statements: Array<Problem_Statement>;
  /** An aggregate relationship */
  problem_statements_aggregate: Problem_Statement_Aggregate;
  /** An object relationship */
  region_category?: Maybe<Region_Category>;
  /** An array relationship */
  subregions: Array<Region>;
  /** An aggregate relationship */
  subregions_aggregate: Region_Aggregate;
  /** An array relationship */
  tasks: Array<Task>;
  /** An aggregate relationship */
  tasks_aggregate: Task_Aggregate;
  /** An array relationship */
  threads: Array<Thread>;
  /** An aggregate relationship */
  threads_aggregate: Thread_Aggregate;
};


/** columns and relationships of "region" */
export type RegionDataslicesArgs = {
  distinct_on?: InputMaybe<Array<Dataslice_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Dataslice_Order_By>>;
  where?: InputMaybe<Dataslice_Bool_Exp>;
};


/** columns and relationships of "region" */
export type RegionDataslices_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Dataslice_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Dataslice_Order_By>>;
  where?: InputMaybe<Dataslice_Bool_Exp>;
};


/** columns and relationships of "region" */
export type RegionGeometriesArgs = {
  distinct_on?: InputMaybe<Array<Region_Geometry_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Geometry_Order_By>>;
  where?: InputMaybe<Region_Geometry_Bool_Exp>;
};


/** columns and relationships of "region" */
export type RegionGeometries_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Region_Geometry_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Geometry_Order_By>>;
  where?: InputMaybe<Region_Geometry_Bool_Exp>;
};


/** columns and relationships of "region" */
export type RegionProblem_StatementsArgs = {
  distinct_on?: InputMaybe<Array<Problem_Statement_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Problem_Statement_Order_By>>;
  where?: InputMaybe<Problem_Statement_Bool_Exp>;
};


/** columns and relationships of "region" */
export type RegionProblem_Statements_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Problem_Statement_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Problem_Statement_Order_By>>;
  where?: InputMaybe<Problem_Statement_Bool_Exp>;
};


/** columns and relationships of "region" */
export type RegionSubregionsArgs = {
  distinct_on?: InputMaybe<Array<Region_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Order_By>>;
  where?: InputMaybe<Region_Bool_Exp>;
};


/** columns and relationships of "region" */
export type RegionSubregions_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Region_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Order_By>>;
  where?: InputMaybe<Region_Bool_Exp>;
};


/** columns and relationships of "region" */
export type RegionTasksArgs = {
  distinct_on?: InputMaybe<Array<Task_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Task_Order_By>>;
  where?: InputMaybe<Task_Bool_Exp>;
};


/** columns and relationships of "region" */
export type RegionTasks_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Task_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Task_Order_By>>;
  where?: InputMaybe<Task_Bool_Exp>;
};


/** columns and relationships of "region" */
export type RegionThreadsArgs = {
  distinct_on?: InputMaybe<Array<Thread_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Order_By>>;
  where?: InputMaybe<Thread_Bool_Exp>;
};


/** columns and relationships of "region" */
export type RegionThreads_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Order_By>>;
  where?: InputMaybe<Thread_Bool_Exp>;
};

/** aggregated selection of "region" */
export type Region_Aggregate = {
  __typename?: 'region_aggregate';
  aggregate?: Maybe<Region_Aggregate_Fields>;
  nodes: Array<Region>;
};

/** aggregate fields of "region" */
export type Region_Aggregate_Fields = {
  __typename?: 'region_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Region_Max_Fields>;
  min?: Maybe<Region_Min_Fields>;
};


/** aggregate fields of "region" */
export type Region_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Region_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "region" */
export type Region_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Region_Max_Order_By>;
  min?: InputMaybe<Region_Min_Order_By>;
};

/** input type for inserting array relation for remote table "region" */
export type Region_Arr_Rel_Insert_Input = {
  data: Array<Region_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Region_On_Conflict>;
};

/** Boolean expression to filter rows from the table "region". All fields are combined with a logical 'AND'. */
export type Region_Bool_Exp = {
  _and?: InputMaybe<Array<Region_Bool_Exp>>;
  _not?: InputMaybe<Region_Bool_Exp>;
  _or?: InputMaybe<Array<Region_Bool_Exp>>;
  category_id?: InputMaybe<String_Comparison_Exp>;
  dataslices?: InputMaybe<Dataslice_Bool_Exp>;
  geometries?: InputMaybe<Region_Geometry_Bool_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  model_catalog_uri?: InputMaybe<String_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  parent_region?: InputMaybe<Region_Bool_Exp>;
  parent_region_id?: InputMaybe<String_Comparison_Exp>;
  problem_statements?: InputMaybe<Problem_Statement_Bool_Exp>;
  region_category?: InputMaybe<Region_Category_Bool_Exp>;
  subregions?: InputMaybe<Region_Bool_Exp>;
  tasks?: InputMaybe<Task_Bool_Exp>;
  threads?: InputMaybe<Thread_Bool_Exp>;
};

/** columns and relationships of "region_category" */
export type Region_Category = {
  __typename?: 'region_category';
  /** An array relationship */
  category_trees: Array<Region_Category_Tree>;
  /** An aggregate relationship */
  category_trees_aggregate: Region_Category_Tree_Aggregate;
  citation?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
  /** An array relationship */
  regions: Array<Region>;
  /** An aggregate relationship */
  regions_aggregate: Region_Aggregate;
  /** An array relationship */
  sub_categories: Array<Region_Category_Tree>;
  /** An aggregate relationship */
  sub_categories_aggregate: Region_Category_Tree_Aggregate;
};


/** columns and relationships of "region_category" */
export type Region_CategoryCategory_TreesArgs = {
  distinct_on?: InputMaybe<Array<Region_Category_Tree_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Category_Tree_Order_By>>;
  where?: InputMaybe<Region_Category_Tree_Bool_Exp>;
};


/** columns and relationships of "region_category" */
export type Region_CategoryCategory_Trees_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Region_Category_Tree_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Category_Tree_Order_By>>;
  where?: InputMaybe<Region_Category_Tree_Bool_Exp>;
};


/** columns and relationships of "region_category" */
export type Region_CategoryRegionsArgs = {
  distinct_on?: InputMaybe<Array<Region_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Order_By>>;
  where?: InputMaybe<Region_Bool_Exp>;
};


/** columns and relationships of "region_category" */
export type Region_CategoryRegions_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Region_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Order_By>>;
  where?: InputMaybe<Region_Bool_Exp>;
};


/** columns and relationships of "region_category" */
export type Region_CategorySub_CategoriesArgs = {
  distinct_on?: InputMaybe<Array<Region_Category_Tree_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Category_Tree_Order_By>>;
  where?: InputMaybe<Region_Category_Tree_Bool_Exp>;
};


/** columns and relationships of "region_category" */
export type Region_CategorySub_Categories_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Region_Category_Tree_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Category_Tree_Order_By>>;
  where?: InputMaybe<Region_Category_Tree_Bool_Exp>;
};

/** aggregated selection of "region_category" */
export type Region_Category_Aggregate = {
  __typename?: 'region_category_aggregate';
  aggregate?: Maybe<Region_Category_Aggregate_Fields>;
  nodes: Array<Region_Category>;
};

/** aggregate fields of "region_category" */
export type Region_Category_Aggregate_Fields = {
  __typename?: 'region_category_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Region_Category_Max_Fields>;
  min?: Maybe<Region_Category_Min_Fields>;
};


/** aggregate fields of "region_category" */
export type Region_Category_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Region_Category_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "region_category". All fields are combined with a logical 'AND'. */
export type Region_Category_Bool_Exp = {
  _and?: InputMaybe<Array<Region_Category_Bool_Exp>>;
  _not?: InputMaybe<Region_Category_Bool_Exp>;
  _or?: InputMaybe<Array<Region_Category_Bool_Exp>>;
  category_trees?: InputMaybe<Region_Category_Tree_Bool_Exp>;
  citation?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  regions?: InputMaybe<Region_Bool_Exp>;
  sub_categories?: InputMaybe<Region_Category_Tree_Bool_Exp>;
};

/** unique or primary key constraints on table "region_category" */
export enum Region_Category_Constraint {
  /** unique or primary key constraint on columns "id" */
  RegionCategoryPkey = 'region_category_pkey'
}

/** input type for inserting data into table "region_category" */
export type Region_Category_Insert_Input = {
  category_trees?: InputMaybe<Region_Category_Tree_Arr_Rel_Insert_Input>;
  citation?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  regions?: InputMaybe<Region_Arr_Rel_Insert_Input>;
  sub_categories?: InputMaybe<Region_Category_Tree_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type Region_Category_Max_Fields = {
  __typename?: 'region_category_max_fields';
  citation?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
};

/** aggregate min on columns */
export type Region_Category_Min_Fields = {
  __typename?: 'region_category_min_fields';
  citation?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
};

/** response of any mutation on the table "region_category" */
export type Region_Category_Mutation_Response = {
  __typename?: 'region_category_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Region_Category>;
};

/** input type for inserting object relation for remote table "region_category" */
export type Region_Category_Obj_Rel_Insert_Input = {
  data: Region_Category_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Region_Category_On_Conflict>;
};

/** on_conflict condition type for table "region_category" */
export type Region_Category_On_Conflict = {
  constraint: Region_Category_Constraint;
  update_columns?: Array<Region_Category_Update_Column>;
  where?: InputMaybe<Region_Category_Bool_Exp>;
};

/** Ordering options when selecting data from "region_category". */
export type Region_Category_Order_By = {
  category_trees_aggregate?: InputMaybe<Region_Category_Tree_Aggregate_Order_By>;
  citation?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  regions_aggregate?: InputMaybe<Region_Aggregate_Order_By>;
  sub_categories_aggregate?: InputMaybe<Region_Category_Tree_Aggregate_Order_By>;
};

/** primary key columns input for table: region_category */
export type Region_Category_Pk_Columns_Input = {
  id: Scalars['String']['input'];
};

/** select columns of table "region_category" */
export enum Region_Category_Select_Column {
  /** column name */
  Citation = 'citation',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name'
}

/** input type for updating data in table "region_category" */
export type Region_Category_Set_Input = {
  citation?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

/** columns and relationships of "region_category_tree" */
export type Region_Category_Tree = {
  __typename?: 'region_category_tree';
  /** An object relationship */
  parent_region_category: Region_Category;
  /** An object relationship */
  region_category: Region_Category;
  region_category_id: Scalars['String']['output'];
  region_category_parent_id: Scalars['String']['output'];
};

/** aggregated selection of "region_category_tree" */
export type Region_Category_Tree_Aggregate = {
  __typename?: 'region_category_tree_aggregate';
  aggregate?: Maybe<Region_Category_Tree_Aggregate_Fields>;
  nodes: Array<Region_Category_Tree>;
};

/** aggregate fields of "region_category_tree" */
export type Region_Category_Tree_Aggregate_Fields = {
  __typename?: 'region_category_tree_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Region_Category_Tree_Max_Fields>;
  min?: Maybe<Region_Category_Tree_Min_Fields>;
};


/** aggregate fields of "region_category_tree" */
export type Region_Category_Tree_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Region_Category_Tree_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "region_category_tree" */
export type Region_Category_Tree_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Region_Category_Tree_Max_Order_By>;
  min?: InputMaybe<Region_Category_Tree_Min_Order_By>;
};

/** input type for inserting array relation for remote table "region_category_tree" */
export type Region_Category_Tree_Arr_Rel_Insert_Input = {
  data: Array<Region_Category_Tree_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Region_Category_Tree_On_Conflict>;
};

/** Boolean expression to filter rows from the table "region_category_tree". All fields are combined with a logical 'AND'. */
export type Region_Category_Tree_Bool_Exp = {
  _and?: InputMaybe<Array<Region_Category_Tree_Bool_Exp>>;
  _not?: InputMaybe<Region_Category_Tree_Bool_Exp>;
  _or?: InputMaybe<Array<Region_Category_Tree_Bool_Exp>>;
  parent_region_category?: InputMaybe<Region_Category_Bool_Exp>;
  region_category?: InputMaybe<Region_Category_Bool_Exp>;
  region_category_id?: InputMaybe<String_Comparison_Exp>;
  region_category_parent_id?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "region_category_tree" */
export enum Region_Category_Tree_Constraint {
  /** unique or primary key constraint on columns "region_category_id", "region_category_parent_id" */
  RegionCategoryTreePkey = 'region_category_tree_pkey'
}

/** input type for inserting data into table "region_category_tree" */
export type Region_Category_Tree_Insert_Input = {
  parent_region_category?: InputMaybe<Region_Category_Obj_Rel_Insert_Input>;
  region_category?: InputMaybe<Region_Category_Obj_Rel_Insert_Input>;
  region_category_id?: InputMaybe<Scalars['String']['input']>;
  region_category_parent_id?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Region_Category_Tree_Max_Fields = {
  __typename?: 'region_category_tree_max_fields';
  region_category_id?: Maybe<Scalars['String']['output']>;
  region_category_parent_id?: Maybe<Scalars['String']['output']>;
};

/** order by max() on columns of table "region_category_tree" */
export type Region_Category_Tree_Max_Order_By = {
  region_category_id?: InputMaybe<Order_By>;
  region_category_parent_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Region_Category_Tree_Min_Fields = {
  __typename?: 'region_category_tree_min_fields';
  region_category_id?: Maybe<Scalars['String']['output']>;
  region_category_parent_id?: Maybe<Scalars['String']['output']>;
};

/** order by min() on columns of table "region_category_tree" */
export type Region_Category_Tree_Min_Order_By = {
  region_category_id?: InputMaybe<Order_By>;
  region_category_parent_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "region_category_tree" */
export type Region_Category_Tree_Mutation_Response = {
  __typename?: 'region_category_tree_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Region_Category_Tree>;
};

/** on_conflict condition type for table "region_category_tree" */
export type Region_Category_Tree_On_Conflict = {
  constraint: Region_Category_Tree_Constraint;
  update_columns?: Array<Region_Category_Tree_Update_Column>;
  where?: InputMaybe<Region_Category_Tree_Bool_Exp>;
};

/** Ordering options when selecting data from "region_category_tree". */
export type Region_Category_Tree_Order_By = {
  parent_region_category?: InputMaybe<Region_Category_Order_By>;
  region_category?: InputMaybe<Region_Category_Order_By>;
  region_category_id?: InputMaybe<Order_By>;
  region_category_parent_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: region_category_tree */
export type Region_Category_Tree_Pk_Columns_Input = {
  region_category_id: Scalars['String']['input'];
  region_category_parent_id: Scalars['String']['input'];
};

/** select columns of table "region_category_tree" */
export enum Region_Category_Tree_Select_Column {
  /** column name */
  RegionCategoryId = 'region_category_id',
  /** column name */
  RegionCategoryParentId = 'region_category_parent_id'
}

/** input type for updating data in table "region_category_tree" */
export type Region_Category_Tree_Set_Input = {
  region_category_id?: InputMaybe<Scalars['String']['input']>;
  region_category_parent_id?: InputMaybe<Scalars['String']['input']>;
};

/** update columns of table "region_category_tree" */
export enum Region_Category_Tree_Update_Column {
  /** column name */
  RegionCategoryId = 'region_category_id',
  /** column name */
  RegionCategoryParentId = 'region_category_parent_id'
}

export type Region_Category_Tree_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Region_Category_Tree_Set_Input>;
  where: Region_Category_Tree_Bool_Exp;
};

/** update columns of table "region_category" */
export enum Region_Category_Update_Column {
  /** column name */
  Citation = 'citation',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name'
}

export type Region_Category_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Region_Category_Set_Input>;
  where: Region_Category_Bool_Exp;
};

/** unique or primary key constraints on table "region" */
export enum Region_Constraint {
  /** unique or primary key constraint on columns "id" */
  RegionPkey = 'region_pkey'
}

/** columns and relationships of "region_geometry" */
export type Region_Geometry = {
  __typename?: 'region_geometry';
  geometry: Scalars['geometry']['output'];
  id: Scalars['Int']['output'];
  /** An object relationship */
  region: Region;
  region_id: Scalars['String']['output'];
};

/** aggregated selection of "region_geometry" */
export type Region_Geometry_Aggregate = {
  __typename?: 'region_geometry_aggregate';
  aggregate?: Maybe<Region_Geometry_Aggregate_Fields>;
  nodes: Array<Region_Geometry>;
};

/** aggregate fields of "region_geometry" */
export type Region_Geometry_Aggregate_Fields = {
  __typename?: 'region_geometry_aggregate_fields';
  avg?: Maybe<Region_Geometry_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Region_Geometry_Max_Fields>;
  min?: Maybe<Region_Geometry_Min_Fields>;
  stddev?: Maybe<Region_Geometry_Stddev_Fields>;
  stddev_pop?: Maybe<Region_Geometry_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Region_Geometry_Stddev_Samp_Fields>;
  sum?: Maybe<Region_Geometry_Sum_Fields>;
  var_pop?: Maybe<Region_Geometry_Var_Pop_Fields>;
  var_samp?: Maybe<Region_Geometry_Var_Samp_Fields>;
  variance?: Maybe<Region_Geometry_Variance_Fields>;
};


/** aggregate fields of "region_geometry" */
export type Region_Geometry_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Region_Geometry_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "region_geometry" */
export type Region_Geometry_Aggregate_Order_By = {
  avg?: InputMaybe<Region_Geometry_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Region_Geometry_Max_Order_By>;
  min?: InputMaybe<Region_Geometry_Min_Order_By>;
  stddev?: InputMaybe<Region_Geometry_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Region_Geometry_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Region_Geometry_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Region_Geometry_Sum_Order_By>;
  var_pop?: InputMaybe<Region_Geometry_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Region_Geometry_Var_Samp_Order_By>;
  variance?: InputMaybe<Region_Geometry_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "region_geometry" */
export type Region_Geometry_Arr_Rel_Insert_Input = {
  data: Array<Region_Geometry_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Region_Geometry_On_Conflict>;
};

/** aggregate avg on columns */
export type Region_Geometry_Avg_Fields = {
  __typename?: 'region_geometry_avg_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "region_geometry" */
export type Region_Geometry_Avg_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "region_geometry". All fields are combined with a logical 'AND'. */
export type Region_Geometry_Bool_Exp = {
  _and?: InputMaybe<Array<Region_Geometry_Bool_Exp>>;
  _not?: InputMaybe<Region_Geometry_Bool_Exp>;
  _or?: InputMaybe<Array<Region_Geometry_Bool_Exp>>;
  geometry?: InputMaybe<Geometry_Comparison_Exp>;
  id?: InputMaybe<Int_Comparison_Exp>;
  region?: InputMaybe<Region_Bool_Exp>;
  region_id?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "region_geometry" */
export enum Region_Geometry_Constraint {
  /** unique or primary key constraint on columns "id" */
  RegionGeometryPkey = 'region_geometry_pkey'
}

/** input type for incrementing numeric columns in table "region_geometry" */
export type Region_Geometry_Inc_Input = {
  id?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "region_geometry" */
export type Region_Geometry_Insert_Input = {
  geometry?: InputMaybe<Scalars['geometry']['input']>;
  id?: InputMaybe<Scalars['Int']['input']>;
  region?: InputMaybe<Region_Obj_Rel_Insert_Input>;
  region_id?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Region_Geometry_Max_Fields = {
  __typename?: 'region_geometry_max_fields';
  id?: Maybe<Scalars['Int']['output']>;
  region_id?: Maybe<Scalars['String']['output']>;
};

/** order by max() on columns of table "region_geometry" */
export type Region_Geometry_Max_Order_By = {
  id?: InputMaybe<Order_By>;
  region_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Region_Geometry_Min_Fields = {
  __typename?: 'region_geometry_min_fields';
  id?: Maybe<Scalars['Int']['output']>;
  region_id?: Maybe<Scalars['String']['output']>;
};

/** order by min() on columns of table "region_geometry" */
export type Region_Geometry_Min_Order_By = {
  id?: InputMaybe<Order_By>;
  region_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "region_geometry" */
export type Region_Geometry_Mutation_Response = {
  __typename?: 'region_geometry_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Region_Geometry>;
};

/** on_conflict condition type for table "region_geometry" */
export type Region_Geometry_On_Conflict = {
  constraint: Region_Geometry_Constraint;
  update_columns?: Array<Region_Geometry_Update_Column>;
  where?: InputMaybe<Region_Geometry_Bool_Exp>;
};

/** Ordering options when selecting data from "region_geometry". */
export type Region_Geometry_Order_By = {
  geometry?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  region?: InputMaybe<Region_Order_By>;
  region_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: region_geometry */
export type Region_Geometry_Pk_Columns_Input = {
  id: Scalars['Int']['input'];
};

/** select columns of table "region_geometry" */
export enum Region_Geometry_Select_Column {
  /** column name */
  Geometry = 'geometry',
  /** column name */
  Id = 'id',
  /** column name */
  RegionId = 'region_id'
}

/** input type for updating data in table "region_geometry" */
export type Region_Geometry_Set_Input = {
  geometry?: InputMaybe<Scalars['geometry']['input']>;
  id?: InputMaybe<Scalars['Int']['input']>;
  region_id?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate stddev on columns */
export type Region_Geometry_Stddev_Fields = {
  __typename?: 'region_geometry_stddev_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "region_geometry" */
export type Region_Geometry_Stddev_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Region_Geometry_Stddev_Pop_Fields = {
  __typename?: 'region_geometry_stddev_pop_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "region_geometry" */
export type Region_Geometry_Stddev_Pop_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Region_Geometry_Stddev_Samp_Fields = {
  __typename?: 'region_geometry_stddev_samp_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "region_geometry" */
export type Region_Geometry_Stddev_Samp_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** aggregate sum on columns */
export type Region_Geometry_Sum_Fields = {
  __typename?: 'region_geometry_sum_fields';
  id?: Maybe<Scalars['Int']['output']>;
};

/** order by sum() on columns of table "region_geometry" */
export type Region_Geometry_Sum_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** update columns of table "region_geometry" */
export enum Region_Geometry_Update_Column {
  /** column name */
  Geometry = 'geometry',
  /** column name */
  Id = 'id',
  /** column name */
  RegionId = 'region_id'
}

export type Region_Geometry_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Region_Geometry_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Region_Geometry_Set_Input>;
  where: Region_Geometry_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Region_Geometry_Var_Pop_Fields = {
  __typename?: 'region_geometry_var_pop_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "region_geometry" */
export type Region_Geometry_Var_Pop_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Region_Geometry_Var_Samp_Fields = {
  __typename?: 'region_geometry_var_samp_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "region_geometry" */
export type Region_Geometry_Var_Samp_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Region_Geometry_Variance_Fields = {
  __typename?: 'region_geometry_variance_fields';
  id?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "region_geometry" */
export type Region_Geometry_Variance_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** input type for inserting data into table "region" */
export type Region_Insert_Input = {
  category_id?: InputMaybe<Scalars['String']['input']>;
  dataslices?: InputMaybe<Dataslice_Arr_Rel_Insert_Input>;
  geometries?: InputMaybe<Region_Geometry_Arr_Rel_Insert_Input>;
  id?: InputMaybe<Scalars['String']['input']>;
  model_catalog_uri?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  parent_region?: InputMaybe<Region_Obj_Rel_Insert_Input>;
  parent_region_id?: InputMaybe<Scalars['String']['input']>;
  problem_statements?: InputMaybe<Problem_Statement_Arr_Rel_Insert_Input>;
  region_category?: InputMaybe<Region_Category_Obj_Rel_Insert_Input>;
  subregions?: InputMaybe<Region_Arr_Rel_Insert_Input>;
  tasks?: InputMaybe<Task_Arr_Rel_Insert_Input>;
  threads?: InputMaybe<Thread_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type Region_Max_Fields = {
  __typename?: 'region_max_fields';
  category_id?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  model_catalog_uri?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  parent_region_id?: Maybe<Scalars['String']['output']>;
};

/** order by max() on columns of table "region" */
export type Region_Max_Order_By = {
  category_id?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  model_catalog_uri?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  parent_region_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Region_Min_Fields = {
  __typename?: 'region_min_fields';
  category_id?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  model_catalog_uri?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  parent_region_id?: Maybe<Scalars['String']['output']>;
};

/** order by min() on columns of table "region" */
export type Region_Min_Order_By = {
  category_id?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  model_catalog_uri?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  parent_region_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "region" */
export type Region_Mutation_Response = {
  __typename?: 'region_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Region>;
};

/** input type for inserting object relation for remote table "region" */
export type Region_Obj_Rel_Insert_Input = {
  data: Region_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Region_On_Conflict>;
};

/** on_conflict condition type for table "region" */
export type Region_On_Conflict = {
  constraint: Region_Constraint;
  update_columns?: Array<Region_Update_Column>;
  where?: InputMaybe<Region_Bool_Exp>;
};

/** Ordering options when selecting data from "region". */
export type Region_Order_By = {
  category_id?: InputMaybe<Order_By>;
  dataslices_aggregate?: InputMaybe<Dataslice_Aggregate_Order_By>;
  geometries_aggregate?: InputMaybe<Region_Geometry_Aggregate_Order_By>;
  id?: InputMaybe<Order_By>;
  model_catalog_uri?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  parent_region?: InputMaybe<Region_Order_By>;
  parent_region_id?: InputMaybe<Order_By>;
  problem_statements_aggregate?: InputMaybe<Problem_Statement_Aggregate_Order_By>;
  region_category?: InputMaybe<Region_Category_Order_By>;
  subregions_aggregate?: InputMaybe<Region_Aggregate_Order_By>;
  tasks_aggregate?: InputMaybe<Task_Aggregate_Order_By>;
  threads_aggregate?: InputMaybe<Thread_Aggregate_Order_By>;
};

/** primary key columns input for table: region */
export type Region_Pk_Columns_Input = {
  id: Scalars['String']['input'];
};

/** select columns of table "region" */
export enum Region_Select_Column {
  /** column name */
  CategoryId = 'category_id',
  /** column name */
  Id = 'id',
  /** column name */
  ModelCatalogUri = 'model_catalog_uri',
  /** column name */
  Name = 'name',
  /** column name */
  ParentRegionId = 'parent_region_id'
}

/** input type for updating data in table "region" */
export type Region_Set_Input = {
  category_id?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  model_catalog_uri?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  parent_region_id?: InputMaybe<Scalars['String']['input']>;
};

/** update columns of table "region" */
export enum Region_Update_Column {
  /** column name */
  CategoryId = 'category_id',
  /** column name */
  Id = 'id',
  /** column name */
  ModelCatalogUri = 'model_catalog_uri',
  /** column name */
  Name = 'name',
  /** column name */
  ParentRegionId = 'parent_region_id'
}

export type Region_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Region_Set_Input>;
  where: Region_Bool_Exp;
};

/** columns and relationships of "regions_containing_point" */
export type Regions_Containing_Point = {
  __typename?: 'regions_containing_point';
  category_id?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
};

export type Regions_Containing_Point_Aggregate = {
  __typename?: 'regions_containing_point_aggregate';
  aggregate?: Maybe<Regions_Containing_Point_Aggregate_Fields>;
  nodes: Array<Regions_Containing_Point>;
};

/** aggregate fields of "regions_containing_point" */
export type Regions_Containing_Point_Aggregate_Fields = {
  __typename?: 'regions_containing_point_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Regions_Containing_Point_Max_Fields>;
  min?: Maybe<Regions_Containing_Point_Min_Fields>;
};


/** aggregate fields of "regions_containing_point" */
export type Regions_Containing_Point_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Regions_Containing_Point_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "regions_containing_point". All fields are combined with a logical 'AND'. */
export type Regions_Containing_Point_Bool_Exp = {
  _and?: InputMaybe<Array<Regions_Containing_Point_Bool_Exp>>;
  _not?: InputMaybe<Regions_Containing_Point_Bool_Exp>;
  _or?: InputMaybe<Array<Regions_Containing_Point_Bool_Exp>>;
  category_id?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
};

/** input type for inserting data into table "regions_containing_point" */
export type Regions_Containing_Point_Insert_Input = {
  category_id?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Regions_Containing_Point_Max_Fields = {
  __typename?: 'regions_containing_point_max_fields';
  category_id?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
};

/** aggregate min on columns */
export type Regions_Containing_Point_Min_Fields = {
  __typename?: 'regions_containing_point_min_fields';
  category_id?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
};

/** response of any mutation on the table "regions_containing_point" */
export type Regions_Containing_Point_Mutation_Response = {
  __typename?: 'regions_containing_point_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Regions_Containing_Point>;
};

/** Ordering options when selecting data from "regions_containing_point". */
export type Regions_Containing_Point_Order_By = {
  category_id?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
};

/** select columns of table "regions_containing_point" */
export enum Regions_Containing_Point_Select_Column {
  /** column name */
  CategoryId = 'category_id',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name'
}

/** input type for updating data in table "regions_containing_point" */
export type Regions_Containing_Point_Set_Input = {
  category_id?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type Regions_Containing_Point_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Regions_Containing_Point_Set_Input>;
  where: Regions_Containing_Point_Bool_Exp;
};

/** columns and relationships of "resource" */
export type Resource = {
  __typename?: 'resource';
  /** An array relationship */
  dataslice_resources: Array<Dataslice_Resource>;
  /** An aggregate relationship */
  dataslice_resources_aggregate: Dataslice_Resource_Aggregate;
  dcid?: Maybe<Scalars['String']['output']>;
  end_date?: Maybe<Scalars['date']['output']>;
  /** An array relationship */
  execution_data_bindings: Array<Execution_Data_Binding>;
  /** An aggregate relationship */
  execution_data_bindings_aggregate: Execution_Data_Binding_Aggregate;
  /** An array relationship */
  execution_results: Array<Execution_Result>;
  /** An aggregate relationship */
  execution_results_aggregate: Execution_Result_Aggregate;
  id: Scalars['String']['output'];
  /** An array relationship */
  model_input_fixed_bindings: Array<Model_Input_Fixed_Binding>;
  /** An aggregate relationship */
  model_input_fixed_bindings_aggregate: Model_Input_Fixed_Binding_Aggregate;
  name: Scalars['String']['output'];
  spatial_coverage?: Maybe<Scalars['geometry']['output']>;
  start_date?: Maybe<Scalars['date']['output']>;
  url: Scalars['String']['output'];
};


/** columns and relationships of "resource" */
export type ResourceDataslice_ResourcesArgs = {
  distinct_on?: InputMaybe<Array<Dataslice_Resource_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Dataslice_Resource_Order_By>>;
  where?: InputMaybe<Dataslice_Resource_Bool_Exp>;
};


/** columns and relationships of "resource" */
export type ResourceDataslice_Resources_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Dataslice_Resource_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Dataslice_Resource_Order_By>>;
  where?: InputMaybe<Dataslice_Resource_Bool_Exp>;
};


/** columns and relationships of "resource" */
export type ResourceExecution_Data_BindingsArgs = {
  distinct_on?: InputMaybe<Array<Execution_Data_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Data_Binding_Order_By>>;
  where?: InputMaybe<Execution_Data_Binding_Bool_Exp>;
};


/** columns and relationships of "resource" */
export type ResourceExecution_Data_Bindings_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Execution_Data_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Data_Binding_Order_By>>;
  where?: InputMaybe<Execution_Data_Binding_Bool_Exp>;
};


/** columns and relationships of "resource" */
export type ResourceExecution_ResultsArgs = {
  distinct_on?: InputMaybe<Array<Execution_Result_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Result_Order_By>>;
  where?: InputMaybe<Execution_Result_Bool_Exp>;
};


/** columns and relationships of "resource" */
export type ResourceExecution_Results_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Execution_Result_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Result_Order_By>>;
  where?: InputMaybe<Execution_Result_Bool_Exp>;
};


/** columns and relationships of "resource" */
export type ResourceModel_Input_Fixed_BindingsArgs = {
  distinct_on?: InputMaybe<Array<Model_Input_Fixed_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Input_Fixed_Binding_Order_By>>;
  where?: InputMaybe<Model_Input_Fixed_Binding_Bool_Exp>;
};


/** columns and relationships of "resource" */
export type ResourceModel_Input_Fixed_Bindings_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Model_Input_Fixed_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Input_Fixed_Binding_Order_By>>;
  where?: InputMaybe<Model_Input_Fixed_Binding_Bool_Exp>;
};

/** aggregated selection of "resource" */
export type Resource_Aggregate = {
  __typename?: 'resource_aggregate';
  aggregate?: Maybe<Resource_Aggregate_Fields>;
  nodes: Array<Resource>;
};

/** aggregate fields of "resource" */
export type Resource_Aggregate_Fields = {
  __typename?: 'resource_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Resource_Max_Fields>;
  min?: Maybe<Resource_Min_Fields>;
};


/** aggregate fields of "resource" */
export type Resource_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Resource_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "resource". All fields are combined with a logical 'AND'. */
export type Resource_Bool_Exp = {
  _and?: InputMaybe<Array<Resource_Bool_Exp>>;
  _not?: InputMaybe<Resource_Bool_Exp>;
  _or?: InputMaybe<Array<Resource_Bool_Exp>>;
  dataslice_resources?: InputMaybe<Dataslice_Resource_Bool_Exp>;
  dcid?: InputMaybe<String_Comparison_Exp>;
  end_date?: InputMaybe<Date_Comparison_Exp>;
  execution_data_bindings?: InputMaybe<Execution_Data_Binding_Bool_Exp>;
  execution_results?: InputMaybe<Execution_Result_Bool_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  model_input_fixed_bindings?: InputMaybe<Model_Input_Fixed_Binding_Bool_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  spatial_coverage?: InputMaybe<Geometry_Comparison_Exp>;
  start_date?: InputMaybe<Date_Comparison_Exp>;
  url?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "resource" */
export enum Resource_Constraint {
  /** unique or primary key constraint on columns "id" */
  ResourcePkey = 'resource_pkey'
}

/** input type for inserting data into table "resource" */
export type Resource_Insert_Input = {
  dataslice_resources?: InputMaybe<Dataslice_Resource_Arr_Rel_Insert_Input>;
  dcid?: InputMaybe<Scalars['String']['input']>;
  end_date?: InputMaybe<Scalars['date']['input']>;
  execution_data_bindings?: InputMaybe<Execution_Data_Binding_Arr_Rel_Insert_Input>;
  execution_results?: InputMaybe<Execution_Result_Arr_Rel_Insert_Input>;
  id?: InputMaybe<Scalars['String']['input']>;
  model_input_fixed_bindings?: InputMaybe<Model_Input_Fixed_Binding_Arr_Rel_Insert_Input>;
  name?: InputMaybe<Scalars['String']['input']>;
  spatial_coverage?: InputMaybe<Scalars['geometry']['input']>;
  start_date?: InputMaybe<Scalars['date']['input']>;
  url?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Resource_Max_Fields = {
  __typename?: 'resource_max_fields';
  dcid?: Maybe<Scalars['String']['output']>;
  end_date?: Maybe<Scalars['date']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  start_date?: Maybe<Scalars['date']['output']>;
  url?: Maybe<Scalars['String']['output']>;
};

/** aggregate min on columns */
export type Resource_Min_Fields = {
  __typename?: 'resource_min_fields';
  dcid?: Maybe<Scalars['String']['output']>;
  end_date?: Maybe<Scalars['date']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  start_date?: Maybe<Scalars['date']['output']>;
  url?: Maybe<Scalars['String']['output']>;
};

/** response of any mutation on the table "resource" */
export type Resource_Mutation_Response = {
  __typename?: 'resource_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Resource>;
};

/** input type for inserting object relation for remote table "resource" */
export type Resource_Obj_Rel_Insert_Input = {
  data: Resource_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Resource_On_Conflict>;
};

/** on_conflict condition type for table "resource" */
export type Resource_On_Conflict = {
  constraint: Resource_Constraint;
  update_columns?: Array<Resource_Update_Column>;
  where?: InputMaybe<Resource_Bool_Exp>;
};

/** Ordering options when selecting data from "resource". */
export type Resource_Order_By = {
  dataslice_resources_aggregate?: InputMaybe<Dataslice_Resource_Aggregate_Order_By>;
  dcid?: InputMaybe<Order_By>;
  end_date?: InputMaybe<Order_By>;
  execution_data_bindings_aggregate?: InputMaybe<Execution_Data_Binding_Aggregate_Order_By>;
  execution_results_aggregate?: InputMaybe<Execution_Result_Aggregate_Order_By>;
  id?: InputMaybe<Order_By>;
  model_input_fixed_bindings_aggregate?: InputMaybe<Model_Input_Fixed_Binding_Aggregate_Order_By>;
  name?: InputMaybe<Order_By>;
  spatial_coverage?: InputMaybe<Order_By>;
  start_date?: InputMaybe<Order_By>;
  url?: InputMaybe<Order_By>;
};

/** primary key columns input for table: resource */
export type Resource_Pk_Columns_Input = {
  id: Scalars['String']['input'];
};

/** select columns of table "resource" */
export enum Resource_Select_Column {
  /** column name */
  Dcid = 'dcid',
  /** column name */
  EndDate = 'end_date',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  SpatialCoverage = 'spatial_coverage',
  /** column name */
  StartDate = 'start_date',
  /** column name */
  Url = 'url'
}

/** input type for updating data in table "resource" */
export type Resource_Set_Input = {
  dcid?: InputMaybe<Scalars['String']['input']>;
  end_date?: InputMaybe<Scalars['date']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  spatial_coverage?: InputMaybe<Scalars['geometry']['input']>;
  start_date?: InputMaybe<Scalars['date']['input']>;
  url?: InputMaybe<Scalars['String']['input']>;
};

/** update columns of table "resource" */
export enum Resource_Update_Column {
  /** column name */
  Dcid = 'dcid',
  /** column name */
  EndDate = 'end_date',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  SpatialCoverage = 'spatial_coverage',
  /** column name */
  StartDate = 'start_date',
  /** column name */
  Url = 'url'
}

export type Resource_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Resource_Set_Input>;
  where: Resource_Bool_Exp;
};

export type St_D_Within_Geography_Input = {
  distance: Scalars['Float']['input'];
  from: Scalars['geography']['input'];
  use_spheroid?: InputMaybe<Scalars['Boolean']['input']>;
};

export type St_D_Within_Input = {
  distance: Scalars['Float']['input'];
  from: Scalars['geometry']['input'];
};

export type Subscription_Root = {
  __typename?: 'subscription_root';
  /** fetch data from the table: "dataset" */
  dataset: Array<Dataset>;
  /** fetch aggregated fields from the table: "dataset" */
  dataset_aggregate: Dataset_Aggregate;
  /** fetch data from the table: "dataset" using primary key columns */
  dataset_by_pk?: Maybe<Dataset>;
  /** fetch data from the table: "dataslice" */
  dataslice: Array<Dataslice>;
  /** fetch aggregated fields from the table: "dataslice" */
  dataslice_aggregate: Dataslice_Aggregate;
  /** fetch data from the table: "dataslice" using primary key columns */
  dataslice_by_pk?: Maybe<Dataslice>;
  /** fetch data from the table: "dataslice_resource" */
  dataslice_resource: Array<Dataslice_Resource>;
  /** fetch aggregated fields from the table: "dataslice_resource" */
  dataslice_resource_aggregate: Dataslice_Resource_Aggregate;
  /** fetch data from the table: "dataslice_resource" using primary key columns */
  dataslice_resource_by_pk?: Maybe<Dataslice_Resource>;
  /** fetch data from the table: "execution" */
  execution: Array<Execution>;
  /** fetch aggregated fields from the table: "execution" */
  execution_aggregate: Execution_Aggregate;
  /** fetch data from the table: "execution" using primary key columns */
  execution_by_pk?: Maybe<Execution>;
  /** fetch data from the table: "execution_data_binding" */
  execution_data_binding: Array<Execution_Data_Binding>;
  /** fetch aggregated fields from the table: "execution_data_binding" */
  execution_data_binding_aggregate: Execution_Data_Binding_Aggregate;
  /** fetch data from the table: "execution_data_binding" using primary key columns */
  execution_data_binding_by_pk?: Maybe<Execution_Data_Binding>;
  /** fetch data from the table: "execution_parameter_binding" */
  execution_parameter_binding: Array<Execution_Parameter_Binding>;
  /** fetch aggregated fields from the table: "execution_parameter_binding" */
  execution_parameter_binding_aggregate: Execution_Parameter_Binding_Aggregate;
  /** fetch data from the table: "execution_parameter_binding" using primary key columns */
  execution_parameter_binding_by_pk?: Maybe<Execution_Parameter_Binding>;
  /** fetch data from the table: "execution_result" */
  execution_result: Array<Execution_Result>;
  /** fetch aggregated fields from the table: "execution_result" */
  execution_result_aggregate: Execution_Result_Aggregate;
  /** fetch data from the table: "execution_result" using primary key columns */
  execution_result_by_pk?: Maybe<Execution_Result>;
  /** execute function "find_regions_containing_point" which returns "regions_containing_point" */
  find_regions_containing_point: Array<Regions_Containing_Point>;
  /** execute function "find_regions_containing_point" and query aggregates on result of table type "regions_containing_point" */
  find_regions_containing_point_aggregate: Regions_Containing_Point_Aggregate;
  /** execute function "find_regions_containing_point_fuzzy" which returns "regions_containing_point" */
  find_regions_containing_point_fuzzy: Array<Regions_Containing_Point>;
  /** execute function "find_regions_containing_point_fuzzy" and query aggregates on result of table type "regions_containing_point" */
  find_regions_containing_point_fuzzy_aggregate: Regions_Containing_Point_Aggregate;
  /** fetch data from the table: "intervention" */
  intervention: Array<Intervention>;
  /** fetch aggregated fields from the table: "intervention" */
  intervention_aggregate: Intervention_Aggregate;
  /** fetch data from the table: "intervention" using primary key columns */
  intervention_by_pk?: Maybe<Intervention>;
  /** fetch data from the table: "model" */
  model: Array<Model>;
  /** fetch aggregated fields from the table: "model" */
  model_aggregate: Model_Aggregate;
  /** fetch data from the table: "model" using primary key columns */
  model_by_pk?: Maybe<Model>;
  /** fetch data from the table: "model_input" */
  model_input: Array<Model_Input>;
  /** fetch aggregated fields from the table: "model_input" */
  model_input_aggregate: Model_Input_Aggregate;
  /** fetch data from the table: "model_input" using primary key columns */
  model_input_by_pk?: Maybe<Model_Input>;
  /** fetch data from the table: "model_input_fixed_binding" */
  model_input_fixed_binding: Array<Model_Input_Fixed_Binding>;
  /** fetch aggregated fields from the table: "model_input_fixed_binding" */
  model_input_fixed_binding_aggregate: Model_Input_Fixed_Binding_Aggregate;
  /** fetch data from the table: "model_input_fixed_binding" using primary key columns */
  model_input_fixed_binding_by_pk?: Maybe<Model_Input_Fixed_Binding>;
  /** fetch data from the table: "model_io" */
  model_io: Array<Model_Io>;
  /** fetch aggregated fields from the table: "model_io" */
  model_io_aggregate: Model_Io_Aggregate;
  /** fetch data from the table: "model_io" using primary key columns */
  model_io_by_pk?: Maybe<Model_Io>;
  /** fetch data from the table: "model_io_variable" */
  model_io_variable: Array<Model_Io_Variable>;
  /** fetch aggregated fields from the table: "model_io_variable" */
  model_io_variable_aggregate: Model_Io_Variable_Aggregate;
  /** fetch data from the table: "model_io_variable" using primary key columns */
  model_io_variable_by_pk?: Maybe<Model_Io_Variable>;
  /** fetch data from the table: "model_output" */
  model_output: Array<Model_Output>;
  /** fetch aggregated fields from the table: "model_output" */
  model_output_aggregate: Model_Output_Aggregate;
  /** fetch data from the table: "model_output" using primary key columns */
  model_output_by_pk?: Maybe<Model_Output>;
  /** fetch data from the table: "model_parameter" */
  model_parameter: Array<Model_Parameter>;
  /** fetch aggregated fields from the table: "model_parameter" */
  model_parameter_aggregate: Model_Parameter_Aggregate;
  /** fetch data from the table: "model_parameter" using primary key columns */
  model_parameter_by_pk?: Maybe<Model_Parameter>;
  /** fetch data from the table: "problem_statement" */
  problem_statement: Array<Problem_Statement>;
  /** fetch aggregated fields from the table: "problem_statement" */
  problem_statement_aggregate: Problem_Statement_Aggregate;
  /** fetch data from the table: "problem_statement" using primary key columns */
  problem_statement_by_pk?: Maybe<Problem_Statement>;
  /** fetch data from the table: "problem_statement_permission" */
  problem_statement_permission: Array<Problem_Statement_Permission>;
  /** fetch aggregated fields from the table: "problem_statement_permission" */
  problem_statement_permission_aggregate: Problem_Statement_Permission_Aggregate;
  /** fetch data from the table: "problem_statement_permission" using primary key columns */
  problem_statement_permission_by_pk?: Maybe<Problem_Statement_Permission>;
  /** fetch data from the table: "problem_statement_provenance" */
  problem_statement_provenance: Array<Problem_Statement_Provenance>;
  /** fetch aggregated fields from the table: "problem_statement_provenance" */
  problem_statement_provenance_aggregate: Problem_Statement_Provenance_Aggregate;
  /** fetch data from the table: "problem_statement_provenance" using primary key columns */
  problem_statement_provenance_by_pk?: Maybe<Problem_Statement_Provenance>;
  /** fetch data from the table: "profile" */
  profile: Array<Profile>;
  /** fetch aggregated fields from the table: "profile" */
  profile_aggregate: Profile_Aggregate;
  /** fetch data from the table: "profile" using primary key columns */
  profile_by_pk?: Maybe<Profile>;
  /** fetch data from the table: "region" */
  region: Array<Region>;
  /** fetch aggregated fields from the table: "region" */
  region_aggregate: Region_Aggregate;
  /** fetch data from the table: "region" using primary key columns */
  region_by_pk?: Maybe<Region>;
  /** fetch data from the table: "region_category" */
  region_category: Array<Region_Category>;
  /** fetch aggregated fields from the table: "region_category" */
  region_category_aggregate: Region_Category_Aggregate;
  /** fetch data from the table: "region_category" using primary key columns */
  region_category_by_pk?: Maybe<Region_Category>;
  /** fetch data from the table: "region_category_tree" */
  region_category_tree: Array<Region_Category_Tree>;
  /** fetch aggregated fields from the table: "region_category_tree" */
  region_category_tree_aggregate: Region_Category_Tree_Aggregate;
  /** fetch data from the table: "region_category_tree" using primary key columns */
  region_category_tree_by_pk?: Maybe<Region_Category_Tree>;
  /** fetch data from the table: "region_geometry" */
  region_geometry: Array<Region_Geometry>;
  /** fetch aggregated fields from the table: "region_geometry" */
  region_geometry_aggregate: Region_Geometry_Aggregate;
  /** fetch data from the table: "region_geometry" using primary key columns */
  region_geometry_by_pk?: Maybe<Region_Geometry>;
  /** fetch data from the table: "regions_containing_point" */
  regions_containing_point: Array<Regions_Containing_Point>;
  /** fetch aggregated fields from the table: "regions_containing_point" */
  regions_containing_point_aggregate: Regions_Containing_Point_Aggregate;
  /** fetch data from the table: "resource" */
  resource: Array<Resource>;
  /** fetch aggregated fields from the table: "resource" */
  resource_aggregate: Resource_Aggregate;
  /** fetch data from the table: "resource" using primary key columns */
  resource_by_pk?: Maybe<Resource>;
  /** fetch data from the table: "task" */
  task: Array<Task>;
  /** fetch aggregated fields from the table: "task" */
  task_aggregate: Task_Aggregate;
  /** fetch data from the table: "task" using primary key columns */
  task_by_pk?: Maybe<Task>;
  /** fetch data from the table: "task_permission" */
  task_permission: Array<Task_Permission>;
  /** fetch aggregated fields from the table: "task_permission" */
  task_permission_aggregate: Task_Permission_Aggregate;
  /** fetch data from the table: "task_permission" using primary key columns */
  task_permission_by_pk?: Maybe<Task_Permission>;
  /** fetch data from the table: "task_provenance" */
  task_provenance: Array<Task_Provenance>;
  /** fetch aggregated fields from the table: "task_provenance" */
  task_provenance_aggregate: Task_Provenance_Aggregate;
  /** fetch data from the table: "task_provenance" using primary key columns */
  task_provenance_by_pk?: Maybe<Task_Provenance>;
  /** fetch data from the table: "thread" */
  thread: Array<Thread>;
  /** fetch aggregated fields from the table: "thread" */
  thread_aggregate: Thread_Aggregate;
  /** fetch data from the table: "thread" using primary key columns */
  thread_by_pk?: Maybe<Thread>;
  /** An array relationship */
  thread_data: Array<Thread_Data>;
  /** An aggregate relationship */
  thread_data_aggregate: Thread_Data_Aggregate;
  /** fetch data from the table: "thread_data" using primary key columns */
  thread_data_by_pk?: Maybe<Thread_Data>;
  /** fetch data from the table: "thread_model" */
  thread_model: Array<Thread_Model>;
  /** fetch aggregated fields from the table: "thread_model" */
  thread_model_aggregate: Thread_Model_Aggregate;
  /** fetch data from the table: "thread_model" using primary key columns */
  thread_model_by_pk?: Maybe<Thread_Model>;
  /** fetch data from the table: "thread_model_execution" */
  thread_model_execution: Array<Thread_Model_Execution>;
  /** fetch aggregated fields from the table: "thread_model_execution" */
  thread_model_execution_aggregate: Thread_Model_Execution_Aggregate;
  /** fetch data from the table: "thread_model_execution" using primary key columns */
  thread_model_execution_by_pk?: Maybe<Thread_Model_Execution>;
  /** fetch data from the table: "thread_model_execution_summary" */
  thread_model_execution_summary: Array<Thread_Model_Execution_Summary>;
  /** fetch aggregated fields from the table: "thread_model_execution_summary" */
  thread_model_execution_summary_aggregate: Thread_Model_Execution_Summary_Aggregate;
  /** fetch data from the table: "thread_model_execution_summary" using primary key columns */
  thread_model_execution_summary_by_pk?: Maybe<Thread_Model_Execution_Summary>;
  /** fetch data from the table: "thread_model_io" */
  thread_model_io: Array<Thread_Model_Io>;
  /** fetch aggregated fields from the table: "thread_model_io" */
  thread_model_io_aggregate: Thread_Model_Io_Aggregate;
  /** fetch data from the table: "thread_model_io" using primary key columns */
  thread_model_io_by_pk?: Maybe<Thread_Model_Io>;
  /** fetch data from the table: "thread_model_parameter" */
  thread_model_parameter: Array<Thread_Model_Parameter>;
  /** fetch aggregated fields from the table: "thread_model_parameter" */
  thread_model_parameter_aggregate: Thread_Model_Parameter_Aggregate;
  /** fetch data from the table: "thread_model_parameter" using primary key columns */
  thread_model_parameter_by_pk?: Maybe<Thread_Model_Parameter>;
  /** fetch data from the table: "thread_permission" */
  thread_permission: Array<Thread_Permission>;
  /** fetch aggregated fields from the table: "thread_permission" */
  thread_permission_aggregate: Thread_Permission_Aggregate;
  /** fetch data from the table: "thread_permission" using primary key columns */
  thread_permission_by_pk?: Maybe<Thread_Permission>;
  /** fetch data from the table: "thread_provenance" */
  thread_provenance: Array<Thread_Provenance>;
  /** fetch aggregated fields from the table: "thread_provenance" */
  thread_provenance_aggregate: Thread_Provenance_Aggregate;
  /** fetch data from the table: "thread_provenance" using primary key columns */
  thread_provenance_by_pk?: Maybe<Thread_Provenance>;
  /** fetch data from the table: "variable" */
  variable: Array<Variable>;
  /** fetch aggregated fields from the table: "variable" */
  variable_aggregate: Variable_Aggregate;
  /** fetch data from the table: "variable" using primary key columns */
  variable_by_pk?: Maybe<Variable>;
  /** fetch data from the table: "variable_category" */
  variable_category: Array<Variable_Category>;
  /** fetch aggregated fields from the table: "variable_category" */
  variable_category_aggregate: Variable_Category_Aggregate;
  /** fetch data from the table: "variable_category" using primary key columns */
  variable_category_by_pk?: Maybe<Variable_Category>;
};


export type Subscription_RootDatasetArgs = {
  distinct_on?: InputMaybe<Array<Dataset_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Dataset_Order_By>>;
  where?: InputMaybe<Dataset_Bool_Exp>;
};


export type Subscription_RootDataset_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Dataset_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Dataset_Order_By>>;
  where?: InputMaybe<Dataset_Bool_Exp>;
};


export type Subscription_RootDataset_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Subscription_RootDatasliceArgs = {
  distinct_on?: InputMaybe<Array<Dataslice_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Dataslice_Order_By>>;
  where?: InputMaybe<Dataslice_Bool_Exp>;
};


export type Subscription_RootDataslice_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Dataslice_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Dataslice_Order_By>>;
  where?: InputMaybe<Dataslice_Bool_Exp>;
};


export type Subscription_RootDataslice_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootDataslice_ResourceArgs = {
  distinct_on?: InputMaybe<Array<Dataslice_Resource_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Dataslice_Resource_Order_By>>;
  where?: InputMaybe<Dataslice_Resource_Bool_Exp>;
};


export type Subscription_RootDataslice_Resource_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Dataslice_Resource_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Dataslice_Resource_Order_By>>;
  where?: InputMaybe<Dataslice_Resource_Bool_Exp>;
};


export type Subscription_RootDataslice_Resource_By_PkArgs = {
  dataslice_id: Scalars['uuid']['input'];
  resource_id: Scalars['String']['input'];
};


export type Subscription_RootExecutionArgs = {
  distinct_on?: InputMaybe<Array<Execution_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Order_By>>;
  where?: InputMaybe<Execution_Bool_Exp>;
};


export type Subscription_RootExecution_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Execution_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Order_By>>;
  where?: InputMaybe<Execution_Bool_Exp>;
};


export type Subscription_RootExecution_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootExecution_Data_BindingArgs = {
  distinct_on?: InputMaybe<Array<Execution_Data_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Data_Binding_Order_By>>;
  where?: InputMaybe<Execution_Data_Binding_Bool_Exp>;
};


export type Subscription_RootExecution_Data_Binding_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Execution_Data_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Data_Binding_Order_By>>;
  where?: InputMaybe<Execution_Data_Binding_Bool_Exp>;
};


export type Subscription_RootExecution_Data_Binding_By_PkArgs = {
  execution_id: Scalars['uuid']['input'];
  model_io_id: Scalars['String']['input'];
  resource_id: Scalars['String']['input'];
};


export type Subscription_RootExecution_Parameter_BindingArgs = {
  distinct_on?: InputMaybe<Array<Execution_Parameter_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Parameter_Binding_Order_By>>;
  where?: InputMaybe<Execution_Parameter_Binding_Bool_Exp>;
};


export type Subscription_RootExecution_Parameter_Binding_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Execution_Parameter_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Parameter_Binding_Order_By>>;
  where?: InputMaybe<Execution_Parameter_Binding_Bool_Exp>;
};


export type Subscription_RootExecution_Parameter_Binding_By_PkArgs = {
  execution_id: Scalars['uuid']['input'];
  model_parameter_id: Scalars['String']['input'];
};


export type Subscription_RootExecution_ResultArgs = {
  distinct_on?: InputMaybe<Array<Execution_Result_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Result_Order_By>>;
  where?: InputMaybe<Execution_Result_Bool_Exp>;
};


export type Subscription_RootExecution_Result_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Execution_Result_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Execution_Result_Order_By>>;
  where?: InputMaybe<Execution_Result_Bool_Exp>;
};


export type Subscription_RootExecution_Result_By_PkArgs = {
  execution_id: Scalars['uuid']['input'];
  model_io_id: Scalars['String']['input'];
  resource_id: Scalars['String']['input'];
};


export type Subscription_RootFind_Regions_Containing_PointArgs = {
  args: Find_Regions_Containing_Point_Args;
  distinct_on?: InputMaybe<Array<Regions_Containing_Point_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Regions_Containing_Point_Order_By>>;
  where?: InputMaybe<Regions_Containing_Point_Bool_Exp>;
};


export type Subscription_RootFind_Regions_Containing_Point_AggregateArgs = {
  args: Find_Regions_Containing_Point_Args;
  distinct_on?: InputMaybe<Array<Regions_Containing_Point_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Regions_Containing_Point_Order_By>>;
  where?: InputMaybe<Regions_Containing_Point_Bool_Exp>;
};


export type Subscription_RootFind_Regions_Containing_Point_FuzzyArgs = {
  args: Find_Regions_Containing_Point_Fuzzy_Args;
  distinct_on?: InputMaybe<Array<Regions_Containing_Point_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Regions_Containing_Point_Order_By>>;
  where?: InputMaybe<Regions_Containing_Point_Bool_Exp>;
};


export type Subscription_RootFind_Regions_Containing_Point_Fuzzy_AggregateArgs = {
  args: Find_Regions_Containing_Point_Fuzzy_Args;
  distinct_on?: InputMaybe<Array<Regions_Containing_Point_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Regions_Containing_Point_Order_By>>;
  where?: InputMaybe<Regions_Containing_Point_Bool_Exp>;
};


export type Subscription_RootInterventionArgs = {
  distinct_on?: InputMaybe<Array<Intervention_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Intervention_Order_By>>;
  where?: InputMaybe<Intervention_Bool_Exp>;
};


export type Subscription_RootIntervention_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Intervention_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Intervention_Order_By>>;
  where?: InputMaybe<Intervention_Bool_Exp>;
};


export type Subscription_RootIntervention_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Subscription_RootModelArgs = {
  distinct_on?: InputMaybe<Array<Model_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Order_By>>;
  where?: InputMaybe<Model_Bool_Exp>;
};


export type Subscription_RootModel_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Model_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Order_By>>;
  where?: InputMaybe<Model_Bool_Exp>;
};


export type Subscription_RootModel_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Subscription_RootModel_InputArgs = {
  distinct_on?: InputMaybe<Array<Model_Input_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Input_Order_By>>;
  where?: InputMaybe<Model_Input_Bool_Exp>;
};


export type Subscription_RootModel_Input_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Model_Input_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Input_Order_By>>;
  where?: InputMaybe<Model_Input_Bool_Exp>;
};


export type Subscription_RootModel_Input_By_PkArgs = {
  model_id: Scalars['String']['input'];
  model_io_id: Scalars['String']['input'];
};


export type Subscription_RootModel_Input_Fixed_BindingArgs = {
  distinct_on?: InputMaybe<Array<Model_Input_Fixed_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Input_Fixed_Binding_Order_By>>;
  where?: InputMaybe<Model_Input_Fixed_Binding_Bool_Exp>;
};


export type Subscription_RootModel_Input_Fixed_Binding_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Model_Input_Fixed_Binding_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Input_Fixed_Binding_Order_By>>;
  where?: InputMaybe<Model_Input_Fixed_Binding_Bool_Exp>;
};


export type Subscription_RootModel_Input_Fixed_Binding_By_PkArgs = {
  model_io_id: Scalars['String']['input'];
  resource_id: Scalars['String']['input'];
};


export type Subscription_RootModel_IoArgs = {
  distinct_on?: InputMaybe<Array<Model_Io_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Io_Order_By>>;
  where?: InputMaybe<Model_Io_Bool_Exp>;
};


export type Subscription_RootModel_Io_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Model_Io_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Io_Order_By>>;
  where?: InputMaybe<Model_Io_Bool_Exp>;
};


export type Subscription_RootModel_Io_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Subscription_RootModel_Io_VariableArgs = {
  distinct_on?: InputMaybe<Array<Model_Io_Variable_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Io_Variable_Order_By>>;
  where?: InputMaybe<Model_Io_Variable_Bool_Exp>;
};


export type Subscription_RootModel_Io_Variable_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Model_Io_Variable_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Io_Variable_Order_By>>;
  where?: InputMaybe<Model_Io_Variable_Bool_Exp>;
};


export type Subscription_RootModel_Io_Variable_By_PkArgs = {
  model_io_id: Scalars['String']['input'];
  variable_id: Scalars['String']['input'];
};


export type Subscription_RootModel_OutputArgs = {
  distinct_on?: InputMaybe<Array<Model_Output_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Output_Order_By>>;
  where?: InputMaybe<Model_Output_Bool_Exp>;
};


export type Subscription_RootModel_Output_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Model_Output_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Output_Order_By>>;
  where?: InputMaybe<Model_Output_Bool_Exp>;
};


export type Subscription_RootModel_Output_By_PkArgs = {
  model_id: Scalars['String']['input'];
  model_io_id: Scalars['String']['input'];
};


export type Subscription_RootModel_ParameterArgs = {
  distinct_on?: InputMaybe<Array<Model_Parameter_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Parameter_Order_By>>;
  where?: InputMaybe<Model_Parameter_Bool_Exp>;
};


export type Subscription_RootModel_Parameter_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Model_Parameter_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Parameter_Order_By>>;
  where?: InputMaybe<Model_Parameter_Bool_Exp>;
};


export type Subscription_RootModel_Parameter_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Subscription_RootProblem_StatementArgs = {
  distinct_on?: InputMaybe<Array<Problem_Statement_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Problem_Statement_Order_By>>;
  where?: InputMaybe<Problem_Statement_Bool_Exp>;
};


export type Subscription_RootProblem_Statement_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Problem_Statement_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Problem_Statement_Order_By>>;
  where?: InputMaybe<Problem_Statement_Bool_Exp>;
};


export type Subscription_RootProblem_Statement_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Subscription_RootProblem_Statement_PermissionArgs = {
  distinct_on?: InputMaybe<Array<Problem_Statement_Permission_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Problem_Statement_Permission_Order_By>>;
  where?: InputMaybe<Problem_Statement_Permission_Bool_Exp>;
};


export type Subscription_RootProblem_Statement_Permission_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Problem_Statement_Permission_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Problem_Statement_Permission_Order_By>>;
  where?: InputMaybe<Problem_Statement_Permission_Bool_Exp>;
};


export type Subscription_RootProblem_Statement_Permission_By_PkArgs = {
  problem_statement_id: Scalars['String']['input'];
  user_id: Scalars['String']['input'];
};


export type Subscription_RootProblem_Statement_ProvenanceArgs = {
  distinct_on?: InputMaybe<Array<Problem_Statement_Provenance_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Problem_Statement_Provenance_Order_By>>;
  where?: InputMaybe<Problem_Statement_Provenance_Bool_Exp>;
};


export type Subscription_RootProblem_Statement_Provenance_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Problem_Statement_Provenance_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Problem_Statement_Provenance_Order_By>>;
  where?: InputMaybe<Problem_Statement_Provenance_Bool_Exp>;
};


export type Subscription_RootProblem_Statement_Provenance_By_PkArgs = {
  event: Scalars['problem_statement_events']['input'];
  problem_statement_id: Scalars['String']['input'];
  timestamp: Scalars['timestamptz']['input'];
};


export type Subscription_RootProfileArgs = {
  distinct_on?: InputMaybe<Array<Profile_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Profile_Order_By>>;
  where?: InputMaybe<Profile_Bool_Exp>;
};


export type Subscription_RootProfile_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Profile_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Profile_Order_By>>;
  where?: InputMaybe<Profile_Bool_Exp>;
};


export type Subscription_RootProfile_By_PkArgs = {
  id: Scalars['Int']['input'];
};


export type Subscription_RootRegionArgs = {
  distinct_on?: InputMaybe<Array<Region_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Order_By>>;
  where?: InputMaybe<Region_Bool_Exp>;
};


export type Subscription_RootRegion_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Region_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Order_By>>;
  where?: InputMaybe<Region_Bool_Exp>;
};


export type Subscription_RootRegion_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Subscription_RootRegion_CategoryArgs = {
  distinct_on?: InputMaybe<Array<Region_Category_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Category_Order_By>>;
  where?: InputMaybe<Region_Category_Bool_Exp>;
};


export type Subscription_RootRegion_Category_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Region_Category_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Category_Order_By>>;
  where?: InputMaybe<Region_Category_Bool_Exp>;
};


export type Subscription_RootRegion_Category_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Subscription_RootRegion_Category_TreeArgs = {
  distinct_on?: InputMaybe<Array<Region_Category_Tree_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Category_Tree_Order_By>>;
  where?: InputMaybe<Region_Category_Tree_Bool_Exp>;
};


export type Subscription_RootRegion_Category_Tree_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Region_Category_Tree_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Category_Tree_Order_By>>;
  where?: InputMaybe<Region_Category_Tree_Bool_Exp>;
};


export type Subscription_RootRegion_Category_Tree_By_PkArgs = {
  region_category_id: Scalars['String']['input'];
  region_category_parent_id: Scalars['String']['input'];
};


export type Subscription_RootRegion_GeometryArgs = {
  distinct_on?: InputMaybe<Array<Region_Geometry_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Geometry_Order_By>>;
  where?: InputMaybe<Region_Geometry_Bool_Exp>;
};


export type Subscription_RootRegion_Geometry_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Region_Geometry_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Region_Geometry_Order_By>>;
  where?: InputMaybe<Region_Geometry_Bool_Exp>;
};


export type Subscription_RootRegion_Geometry_By_PkArgs = {
  id: Scalars['Int']['input'];
};


export type Subscription_RootRegions_Containing_PointArgs = {
  distinct_on?: InputMaybe<Array<Regions_Containing_Point_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Regions_Containing_Point_Order_By>>;
  where?: InputMaybe<Regions_Containing_Point_Bool_Exp>;
};


export type Subscription_RootRegions_Containing_Point_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Regions_Containing_Point_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Regions_Containing_Point_Order_By>>;
  where?: InputMaybe<Regions_Containing_Point_Bool_Exp>;
};


export type Subscription_RootResourceArgs = {
  distinct_on?: InputMaybe<Array<Resource_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Resource_Order_By>>;
  where?: InputMaybe<Resource_Bool_Exp>;
};


export type Subscription_RootResource_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Resource_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Resource_Order_By>>;
  where?: InputMaybe<Resource_Bool_Exp>;
};


export type Subscription_RootResource_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Subscription_RootTaskArgs = {
  distinct_on?: InputMaybe<Array<Task_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Task_Order_By>>;
  where?: InputMaybe<Task_Bool_Exp>;
};


export type Subscription_RootTask_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Task_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Task_Order_By>>;
  where?: InputMaybe<Task_Bool_Exp>;
};


export type Subscription_RootTask_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Subscription_RootTask_PermissionArgs = {
  distinct_on?: InputMaybe<Array<Task_Permission_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Task_Permission_Order_By>>;
  where?: InputMaybe<Task_Permission_Bool_Exp>;
};


export type Subscription_RootTask_Permission_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Task_Permission_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Task_Permission_Order_By>>;
  where?: InputMaybe<Task_Permission_Bool_Exp>;
};


export type Subscription_RootTask_Permission_By_PkArgs = {
  task_id: Scalars['String']['input'];
  user_id: Scalars['String']['input'];
};


export type Subscription_RootTask_ProvenanceArgs = {
  distinct_on?: InputMaybe<Array<Task_Provenance_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Task_Provenance_Order_By>>;
  where?: InputMaybe<Task_Provenance_Bool_Exp>;
};


export type Subscription_RootTask_Provenance_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Task_Provenance_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Task_Provenance_Order_By>>;
  where?: InputMaybe<Task_Provenance_Bool_Exp>;
};


export type Subscription_RootTask_Provenance_By_PkArgs = {
  event: Scalars['task_events']['input'];
  task_id: Scalars['String']['input'];
  timestamp: Scalars['timestamptz']['input'];
};


export type Subscription_RootThreadArgs = {
  distinct_on?: InputMaybe<Array<Thread_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Order_By>>;
  where?: InputMaybe<Thread_Bool_Exp>;
};


export type Subscription_RootThread_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Order_By>>;
  where?: InputMaybe<Thread_Bool_Exp>;
};


export type Subscription_RootThread_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Subscription_RootThread_DataArgs = {
  distinct_on?: InputMaybe<Array<Thread_Data_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Data_Order_By>>;
  where?: InputMaybe<Thread_Data_Bool_Exp>;
};


export type Subscription_RootThread_Data_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Data_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Data_Order_By>>;
  where?: InputMaybe<Thread_Data_Bool_Exp>;
};


export type Subscription_RootThread_Data_By_PkArgs = {
  dataslice_id: Scalars['uuid']['input'];
  thread_id: Scalars['String']['input'];
};


export type Subscription_RootThread_ModelArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Order_By>>;
  where?: InputMaybe<Thread_Model_Bool_Exp>;
};


export type Subscription_RootThread_Model_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Order_By>>;
  where?: InputMaybe<Thread_Model_Bool_Exp>;
};


export type Subscription_RootThread_Model_By_PkArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootThread_Model_ExecutionArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Execution_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Execution_Order_By>>;
  where?: InputMaybe<Thread_Model_Execution_Bool_Exp>;
};


export type Subscription_RootThread_Model_Execution_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Execution_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Execution_Order_By>>;
  where?: InputMaybe<Thread_Model_Execution_Bool_Exp>;
};


export type Subscription_RootThread_Model_Execution_By_PkArgs = {
  execution_id: Scalars['uuid']['input'];
  thread_model_id: Scalars['uuid']['input'];
};


export type Subscription_RootThread_Model_Execution_SummaryArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Execution_Summary_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Execution_Summary_Order_By>>;
  where?: InputMaybe<Thread_Model_Execution_Summary_Bool_Exp>;
};


export type Subscription_RootThread_Model_Execution_Summary_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Execution_Summary_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Execution_Summary_Order_By>>;
  where?: InputMaybe<Thread_Model_Execution_Summary_Bool_Exp>;
};


export type Subscription_RootThread_Model_Execution_Summary_By_PkArgs = {
  thread_model_id: Scalars['uuid']['input'];
};


export type Subscription_RootThread_Model_IoArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Io_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Io_Order_By>>;
  where?: InputMaybe<Thread_Model_Io_Bool_Exp>;
};


export type Subscription_RootThread_Model_Io_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Io_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Io_Order_By>>;
  where?: InputMaybe<Thread_Model_Io_Bool_Exp>;
};


export type Subscription_RootThread_Model_Io_By_PkArgs = {
  dataslice_id: Scalars['uuid']['input'];
  model_io_id: Scalars['String']['input'];
  thread_model_id: Scalars['uuid']['input'];
};


export type Subscription_RootThread_Model_ParameterArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Parameter_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Parameter_Order_By>>;
  where?: InputMaybe<Thread_Model_Parameter_Bool_Exp>;
};


export type Subscription_RootThread_Model_Parameter_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Parameter_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Parameter_Order_By>>;
  where?: InputMaybe<Thread_Model_Parameter_Bool_Exp>;
};


export type Subscription_RootThread_Model_Parameter_By_PkArgs = {
  model_parameter_id: Scalars['String']['input'];
  parameter_value: Scalars['String']['input'];
  thread_model_id: Scalars['uuid']['input'];
};


export type Subscription_RootThread_PermissionArgs = {
  distinct_on?: InputMaybe<Array<Thread_Permission_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Permission_Order_By>>;
  where?: InputMaybe<Thread_Permission_Bool_Exp>;
};


export type Subscription_RootThread_Permission_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Permission_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Permission_Order_By>>;
  where?: InputMaybe<Thread_Permission_Bool_Exp>;
};


export type Subscription_RootThread_Permission_By_PkArgs = {
  thread_id: Scalars['String']['input'];
  user_id: Scalars['String']['input'];
};


export type Subscription_RootThread_ProvenanceArgs = {
  distinct_on?: InputMaybe<Array<Thread_Provenance_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Provenance_Order_By>>;
  where?: InputMaybe<Thread_Provenance_Bool_Exp>;
};


export type Subscription_RootThread_Provenance_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Provenance_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Provenance_Order_By>>;
  where?: InputMaybe<Thread_Provenance_Bool_Exp>;
};


export type Subscription_RootThread_Provenance_By_PkArgs = {
  event: Scalars['thread_events']['input'];
  thread_id: Scalars['String']['input'];
  timestamp: Scalars['timestamptz']['input'];
};


export type Subscription_RootVariableArgs = {
  distinct_on?: InputMaybe<Array<Variable_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Variable_Order_By>>;
  where?: InputMaybe<Variable_Bool_Exp>;
};


export type Subscription_RootVariable_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Variable_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Variable_Order_By>>;
  where?: InputMaybe<Variable_Bool_Exp>;
};


export type Subscription_RootVariable_By_PkArgs = {
  id: Scalars['String']['input'];
};


export type Subscription_RootVariable_CategoryArgs = {
  distinct_on?: InputMaybe<Array<Variable_Category_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Variable_Category_Order_By>>;
  where?: InputMaybe<Variable_Category_Bool_Exp>;
};


export type Subscription_RootVariable_Category_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Variable_Category_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Variable_Category_Order_By>>;
  where?: InputMaybe<Variable_Category_Bool_Exp>;
};


export type Subscription_RootVariable_Category_By_PkArgs = {
  category: Scalars['String']['input'];
  variable_id: Scalars['String']['input'];
};

/** columns and relationships of "task" */
export type Task = {
  __typename?: 'task';
  /** An object relationship */
  driving_variable?: Maybe<Variable>;
  driving_variable_id?: Maybe<Scalars['String']['output']>;
  end_date: Scalars['date']['output'];
  /** An array relationship */
  events: Array<Task_Provenance>;
  /** An aggregate relationship */
  events_aggregate: Task_Provenance_Aggregate;
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
  /** An array relationship */
  permissions: Array<Task_Permission>;
  /** An aggregate relationship */
  permissions_aggregate: Task_Permission_Aggregate;
  /** An object relationship */
  problem_statement: Problem_Statement;
  problem_statement_id: Scalars['String']['output'];
  /** An object relationship */
  region?: Maybe<Region>;
  region_id?: Maybe<Scalars['String']['output']>;
  /** An object relationship */
  response_variable?: Maybe<Variable>;
  response_variable_id?: Maybe<Scalars['String']['output']>;
  start_date: Scalars['date']['output'];
  /** An array relationship */
  threads: Array<Thread>;
  /** An aggregate relationship */
  threads_aggregate: Thread_Aggregate;
};


/** columns and relationships of "task" */
export type TaskEventsArgs = {
  distinct_on?: InputMaybe<Array<Task_Provenance_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Task_Provenance_Order_By>>;
  where?: InputMaybe<Task_Provenance_Bool_Exp>;
};


/** columns and relationships of "task" */
export type TaskEvents_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Task_Provenance_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Task_Provenance_Order_By>>;
  where?: InputMaybe<Task_Provenance_Bool_Exp>;
};


/** columns and relationships of "task" */
export type TaskPermissionsArgs = {
  distinct_on?: InputMaybe<Array<Task_Permission_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Task_Permission_Order_By>>;
  where?: InputMaybe<Task_Permission_Bool_Exp>;
};


/** columns and relationships of "task" */
export type TaskPermissions_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Task_Permission_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Task_Permission_Order_By>>;
  where?: InputMaybe<Task_Permission_Bool_Exp>;
};


/** columns and relationships of "task" */
export type TaskThreadsArgs = {
  distinct_on?: InputMaybe<Array<Thread_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Order_By>>;
  where?: InputMaybe<Thread_Bool_Exp>;
};


/** columns and relationships of "task" */
export type TaskThreads_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Order_By>>;
  where?: InputMaybe<Thread_Bool_Exp>;
};

/** aggregated selection of "task" */
export type Task_Aggregate = {
  __typename?: 'task_aggregate';
  aggregate?: Maybe<Task_Aggregate_Fields>;
  nodes: Array<Task>;
};

/** aggregate fields of "task" */
export type Task_Aggregate_Fields = {
  __typename?: 'task_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Task_Max_Fields>;
  min?: Maybe<Task_Min_Fields>;
};


/** aggregate fields of "task" */
export type Task_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Task_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "task" */
export type Task_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Task_Max_Order_By>;
  min?: InputMaybe<Task_Min_Order_By>;
};

/** input type for inserting array relation for remote table "task" */
export type Task_Arr_Rel_Insert_Input = {
  data: Array<Task_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Task_On_Conflict>;
};

/** Boolean expression to filter rows from the table "task". All fields are combined with a logical 'AND'. */
export type Task_Bool_Exp = {
  _and?: InputMaybe<Array<Task_Bool_Exp>>;
  _not?: InputMaybe<Task_Bool_Exp>;
  _or?: InputMaybe<Array<Task_Bool_Exp>>;
  driving_variable?: InputMaybe<Variable_Bool_Exp>;
  driving_variable_id?: InputMaybe<String_Comparison_Exp>;
  end_date?: InputMaybe<Date_Comparison_Exp>;
  events?: InputMaybe<Task_Provenance_Bool_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  permissions?: InputMaybe<Task_Permission_Bool_Exp>;
  problem_statement?: InputMaybe<Problem_Statement_Bool_Exp>;
  problem_statement_id?: InputMaybe<String_Comparison_Exp>;
  region?: InputMaybe<Region_Bool_Exp>;
  region_id?: InputMaybe<String_Comparison_Exp>;
  response_variable?: InputMaybe<Variable_Bool_Exp>;
  response_variable_id?: InputMaybe<String_Comparison_Exp>;
  start_date?: InputMaybe<Date_Comparison_Exp>;
  threads?: InputMaybe<Thread_Bool_Exp>;
};

/** unique or primary key constraints on table "task" */
export enum Task_Constraint {
  /** unique or primary key constraint on columns "id" */
  TaskPkey = 'task_pkey'
}

/** Boolean expression to compare columns of type "task_events". All fields are combined with logical 'AND'. */
export type Task_Events_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['task_events']['input']>;
  _gt?: InputMaybe<Scalars['task_events']['input']>;
  _gte?: InputMaybe<Scalars['task_events']['input']>;
  _in?: InputMaybe<Array<Scalars['task_events']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['task_events']['input']>;
  _lte?: InputMaybe<Scalars['task_events']['input']>;
  _neq?: InputMaybe<Scalars['task_events']['input']>;
  _nin?: InputMaybe<Array<Scalars['task_events']['input']>>;
};

/** input type for inserting data into table "task" */
export type Task_Insert_Input = {
  driving_variable?: InputMaybe<Variable_Obj_Rel_Insert_Input>;
  driving_variable_id?: InputMaybe<Scalars['String']['input']>;
  end_date?: InputMaybe<Scalars['date']['input']>;
  events?: InputMaybe<Task_Provenance_Arr_Rel_Insert_Input>;
  id?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  permissions?: InputMaybe<Task_Permission_Arr_Rel_Insert_Input>;
  problem_statement?: InputMaybe<Problem_Statement_Obj_Rel_Insert_Input>;
  problem_statement_id?: InputMaybe<Scalars['String']['input']>;
  region?: InputMaybe<Region_Obj_Rel_Insert_Input>;
  region_id?: InputMaybe<Scalars['String']['input']>;
  response_variable?: InputMaybe<Variable_Obj_Rel_Insert_Input>;
  response_variable_id?: InputMaybe<Scalars['String']['input']>;
  start_date?: InputMaybe<Scalars['date']['input']>;
  threads?: InputMaybe<Thread_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type Task_Max_Fields = {
  __typename?: 'task_max_fields';
  driving_variable_id?: Maybe<Scalars['String']['output']>;
  end_date?: Maybe<Scalars['date']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  problem_statement_id?: Maybe<Scalars['String']['output']>;
  region_id?: Maybe<Scalars['String']['output']>;
  response_variable_id?: Maybe<Scalars['String']['output']>;
  start_date?: Maybe<Scalars['date']['output']>;
};

/** order by max() on columns of table "task" */
export type Task_Max_Order_By = {
  driving_variable_id?: InputMaybe<Order_By>;
  end_date?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  problem_statement_id?: InputMaybe<Order_By>;
  region_id?: InputMaybe<Order_By>;
  response_variable_id?: InputMaybe<Order_By>;
  start_date?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Task_Min_Fields = {
  __typename?: 'task_min_fields';
  driving_variable_id?: Maybe<Scalars['String']['output']>;
  end_date?: Maybe<Scalars['date']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  problem_statement_id?: Maybe<Scalars['String']['output']>;
  region_id?: Maybe<Scalars['String']['output']>;
  response_variable_id?: Maybe<Scalars['String']['output']>;
  start_date?: Maybe<Scalars['date']['output']>;
};

/** order by min() on columns of table "task" */
export type Task_Min_Order_By = {
  driving_variable_id?: InputMaybe<Order_By>;
  end_date?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  problem_statement_id?: InputMaybe<Order_By>;
  region_id?: InputMaybe<Order_By>;
  response_variable_id?: InputMaybe<Order_By>;
  start_date?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "task" */
export type Task_Mutation_Response = {
  __typename?: 'task_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Task>;
};

/** input type for inserting object relation for remote table "task" */
export type Task_Obj_Rel_Insert_Input = {
  data: Task_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Task_On_Conflict>;
};

/** on_conflict condition type for table "task" */
export type Task_On_Conflict = {
  constraint: Task_Constraint;
  update_columns?: Array<Task_Update_Column>;
  where?: InputMaybe<Task_Bool_Exp>;
};

/** Ordering options when selecting data from "task". */
export type Task_Order_By = {
  driving_variable?: InputMaybe<Variable_Order_By>;
  driving_variable_id?: InputMaybe<Order_By>;
  end_date?: InputMaybe<Order_By>;
  events_aggregate?: InputMaybe<Task_Provenance_Aggregate_Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  permissions_aggregate?: InputMaybe<Task_Permission_Aggregate_Order_By>;
  problem_statement?: InputMaybe<Problem_Statement_Order_By>;
  problem_statement_id?: InputMaybe<Order_By>;
  region?: InputMaybe<Region_Order_By>;
  region_id?: InputMaybe<Order_By>;
  response_variable?: InputMaybe<Variable_Order_By>;
  response_variable_id?: InputMaybe<Order_By>;
  start_date?: InputMaybe<Order_By>;
  threads_aggregate?: InputMaybe<Thread_Aggregate_Order_By>;
};

/** columns and relationships of "task_permission" */
export type Task_Permission = {
  __typename?: 'task_permission';
  read: Scalars['Boolean']['output'];
  /** An object relationship */
  task: Task;
  task_id: Scalars['String']['output'];
  user_id: Scalars['String']['output'];
  write: Scalars['Boolean']['output'];
};

/** aggregated selection of "task_permission" */
export type Task_Permission_Aggregate = {
  __typename?: 'task_permission_aggregate';
  aggregate?: Maybe<Task_Permission_Aggregate_Fields>;
  nodes: Array<Task_Permission>;
};

/** aggregate fields of "task_permission" */
export type Task_Permission_Aggregate_Fields = {
  __typename?: 'task_permission_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Task_Permission_Max_Fields>;
  min?: Maybe<Task_Permission_Min_Fields>;
};


/** aggregate fields of "task_permission" */
export type Task_Permission_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Task_Permission_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "task_permission" */
export type Task_Permission_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Task_Permission_Max_Order_By>;
  min?: InputMaybe<Task_Permission_Min_Order_By>;
};

/** input type for inserting array relation for remote table "task_permission" */
export type Task_Permission_Arr_Rel_Insert_Input = {
  data: Array<Task_Permission_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Task_Permission_On_Conflict>;
};

/** Boolean expression to filter rows from the table "task_permission". All fields are combined with a logical 'AND'. */
export type Task_Permission_Bool_Exp = {
  _and?: InputMaybe<Array<Task_Permission_Bool_Exp>>;
  _not?: InputMaybe<Task_Permission_Bool_Exp>;
  _or?: InputMaybe<Array<Task_Permission_Bool_Exp>>;
  read?: InputMaybe<Boolean_Comparison_Exp>;
  task?: InputMaybe<Task_Bool_Exp>;
  task_id?: InputMaybe<String_Comparison_Exp>;
  user_id?: InputMaybe<String_Comparison_Exp>;
  write?: InputMaybe<Boolean_Comparison_Exp>;
};

/** unique or primary key constraints on table "task_permission" */
export enum Task_Permission_Constraint {
  /** unique or primary key constraint on columns "user_id", "task_id" */
  TaskPermissionPkey = 'task_permission_pkey'
}

/** input type for inserting data into table "task_permission" */
export type Task_Permission_Insert_Input = {
  read?: InputMaybe<Scalars['Boolean']['input']>;
  task?: InputMaybe<Task_Obj_Rel_Insert_Input>;
  task_id?: InputMaybe<Scalars['String']['input']>;
  user_id?: InputMaybe<Scalars['String']['input']>;
  write?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate max on columns */
export type Task_Permission_Max_Fields = {
  __typename?: 'task_permission_max_fields';
  task_id?: Maybe<Scalars['String']['output']>;
  user_id?: Maybe<Scalars['String']['output']>;
};

/** order by max() on columns of table "task_permission" */
export type Task_Permission_Max_Order_By = {
  task_id?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Task_Permission_Min_Fields = {
  __typename?: 'task_permission_min_fields';
  task_id?: Maybe<Scalars['String']['output']>;
  user_id?: Maybe<Scalars['String']['output']>;
};

/** order by min() on columns of table "task_permission" */
export type Task_Permission_Min_Order_By = {
  task_id?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "task_permission" */
export type Task_Permission_Mutation_Response = {
  __typename?: 'task_permission_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Task_Permission>;
};

/** on_conflict condition type for table "task_permission" */
export type Task_Permission_On_Conflict = {
  constraint: Task_Permission_Constraint;
  update_columns?: Array<Task_Permission_Update_Column>;
  where?: InputMaybe<Task_Permission_Bool_Exp>;
};

/** Ordering options when selecting data from "task_permission". */
export type Task_Permission_Order_By = {
  read?: InputMaybe<Order_By>;
  task?: InputMaybe<Task_Order_By>;
  task_id?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
  write?: InputMaybe<Order_By>;
};

/** primary key columns input for table: task_permission */
export type Task_Permission_Pk_Columns_Input = {
  task_id: Scalars['String']['input'];
  user_id: Scalars['String']['input'];
};

/** select columns of table "task_permission" */
export enum Task_Permission_Select_Column {
  /** column name */
  Read = 'read',
  /** column name */
  TaskId = 'task_id',
  /** column name */
  UserId = 'user_id',
  /** column name */
  Write = 'write'
}

/** input type for updating data in table "task_permission" */
export type Task_Permission_Set_Input = {
  read?: InputMaybe<Scalars['Boolean']['input']>;
  task_id?: InputMaybe<Scalars['String']['input']>;
  user_id?: InputMaybe<Scalars['String']['input']>;
  write?: InputMaybe<Scalars['Boolean']['input']>;
};

/** update columns of table "task_permission" */
export enum Task_Permission_Update_Column {
  /** column name */
  Read = 'read',
  /** column name */
  TaskId = 'task_id',
  /** column name */
  UserId = 'user_id',
  /** column name */
  Write = 'write'
}

export type Task_Permission_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Task_Permission_Set_Input>;
  where: Task_Permission_Bool_Exp;
};

/** primary key columns input for table: task */
export type Task_Pk_Columns_Input = {
  id: Scalars['String']['input'];
};

/** columns and relationships of "task_provenance" */
export type Task_Provenance = {
  __typename?: 'task_provenance';
  event: Scalars['task_events']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  /** An object relationship */
  task: Task;
  task_id: Scalars['String']['output'];
  timestamp: Scalars['timestamptz']['output'];
  userid: Scalars['String']['output'];
};

/** aggregated selection of "task_provenance" */
export type Task_Provenance_Aggregate = {
  __typename?: 'task_provenance_aggregate';
  aggregate?: Maybe<Task_Provenance_Aggregate_Fields>;
  nodes: Array<Task_Provenance>;
};

/** aggregate fields of "task_provenance" */
export type Task_Provenance_Aggregate_Fields = {
  __typename?: 'task_provenance_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Task_Provenance_Max_Fields>;
  min?: Maybe<Task_Provenance_Min_Fields>;
};


/** aggregate fields of "task_provenance" */
export type Task_Provenance_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Task_Provenance_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "task_provenance" */
export type Task_Provenance_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Task_Provenance_Max_Order_By>;
  min?: InputMaybe<Task_Provenance_Min_Order_By>;
};

/** input type for inserting array relation for remote table "task_provenance" */
export type Task_Provenance_Arr_Rel_Insert_Input = {
  data: Array<Task_Provenance_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Task_Provenance_On_Conflict>;
};

/** Boolean expression to filter rows from the table "task_provenance". All fields are combined with a logical 'AND'. */
export type Task_Provenance_Bool_Exp = {
  _and?: InputMaybe<Array<Task_Provenance_Bool_Exp>>;
  _not?: InputMaybe<Task_Provenance_Bool_Exp>;
  _or?: InputMaybe<Array<Task_Provenance_Bool_Exp>>;
  event?: InputMaybe<Task_Events_Comparison_Exp>;
  notes?: InputMaybe<String_Comparison_Exp>;
  task?: InputMaybe<Task_Bool_Exp>;
  task_id?: InputMaybe<String_Comparison_Exp>;
  timestamp?: InputMaybe<Timestamptz_Comparison_Exp>;
  userid?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "task_provenance" */
export enum Task_Provenance_Constraint {
  /** unique or primary key constraint on columns "timestamp", "event", "task_id" */
  TaskProvenancePkey = 'task_provenance_pkey'
}

/** input type for inserting data into table "task_provenance" */
export type Task_Provenance_Insert_Input = {
  event?: InputMaybe<Scalars['task_events']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  task?: InputMaybe<Task_Obj_Rel_Insert_Input>;
  task_id?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['timestamptz']['input']>;
  userid?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Task_Provenance_Max_Fields = {
  __typename?: 'task_provenance_max_fields';
  event?: Maybe<Scalars['task_events']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  task_id?: Maybe<Scalars['String']['output']>;
  timestamp?: Maybe<Scalars['timestamptz']['output']>;
  userid?: Maybe<Scalars['String']['output']>;
};

/** order by max() on columns of table "task_provenance" */
export type Task_Provenance_Max_Order_By = {
  event?: InputMaybe<Order_By>;
  notes?: InputMaybe<Order_By>;
  task_id?: InputMaybe<Order_By>;
  timestamp?: InputMaybe<Order_By>;
  userid?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Task_Provenance_Min_Fields = {
  __typename?: 'task_provenance_min_fields';
  event?: Maybe<Scalars['task_events']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  task_id?: Maybe<Scalars['String']['output']>;
  timestamp?: Maybe<Scalars['timestamptz']['output']>;
  userid?: Maybe<Scalars['String']['output']>;
};

/** order by min() on columns of table "task_provenance" */
export type Task_Provenance_Min_Order_By = {
  event?: InputMaybe<Order_By>;
  notes?: InputMaybe<Order_By>;
  task_id?: InputMaybe<Order_By>;
  timestamp?: InputMaybe<Order_By>;
  userid?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "task_provenance" */
export type Task_Provenance_Mutation_Response = {
  __typename?: 'task_provenance_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Task_Provenance>;
};

/** on_conflict condition type for table "task_provenance" */
export type Task_Provenance_On_Conflict = {
  constraint: Task_Provenance_Constraint;
  update_columns?: Array<Task_Provenance_Update_Column>;
  where?: InputMaybe<Task_Provenance_Bool_Exp>;
};

/** Ordering options when selecting data from "task_provenance". */
export type Task_Provenance_Order_By = {
  event?: InputMaybe<Order_By>;
  notes?: InputMaybe<Order_By>;
  task?: InputMaybe<Task_Order_By>;
  task_id?: InputMaybe<Order_By>;
  timestamp?: InputMaybe<Order_By>;
  userid?: InputMaybe<Order_By>;
};

/** primary key columns input for table: task_provenance */
export type Task_Provenance_Pk_Columns_Input = {
  event: Scalars['task_events']['input'];
  task_id: Scalars['String']['input'];
  timestamp: Scalars['timestamptz']['input'];
};

/** select columns of table "task_provenance" */
export enum Task_Provenance_Select_Column {
  /** column name */
  Event = 'event',
  /** column name */
  Notes = 'notes',
  /** column name */
  TaskId = 'task_id',
  /** column name */
  Timestamp = 'timestamp',
  /** column name */
  Userid = 'userid'
}

/** input type for updating data in table "task_provenance" */
export type Task_Provenance_Set_Input = {
  event?: InputMaybe<Scalars['task_events']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  task_id?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['timestamptz']['input']>;
  userid?: InputMaybe<Scalars['String']['input']>;
};

/** update columns of table "task_provenance" */
export enum Task_Provenance_Update_Column {
  /** column name */
  Event = 'event',
  /** column name */
  Notes = 'notes',
  /** column name */
  TaskId = 'task_id',
  /** column name */
  Timestamp = 'timestamp',
  /** column name */
  Userid = 'userid'
}

export type Task_Provenance_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Task_Provenance_Set_Input>;
  where: Task_Provenance_Bool_Exp;
};

/** select columns of table "task" */
export enum Task_Select_Column {
  /** column name */
  DrivingVariableId = 'driving_variable_id',
  /** column name */
  EndDate = 'end_date',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  ProblemStatementId = 'problem_statement_id',
  /** column name */
  RegionId = 'region_id',
  /** column name */
  ResponseVariableId = 'response_variable_id',
  /** column name */
  StartDate = 'start_date'
}

/** input type for updating data in table "task" */
export type Task_Set_Input = {
  driving_variable_id?: InputMaybe<Scalars['String']['input']>;
  end_date?: InputMaybe<Scalars['date']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  problem_statement_id?: InputMaybe<Scalars['String']['input']>;
  region_id?: InputMaybe<Scalars['String']['input']>;
  response_variable_id?: InputMaybe<Scalars['String']['input']>;
  start_date?: InputMaybe<Scalars['date']['input']>;
};

/** update columns of table "task" */
export enum Task_Update_Column {
  /** column name */
  DrivingVariableId = 'driving_variable_id',
  /** column name */
  EndDate = 'end_date',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  ProblemStatementId = 'problem_statement_id',
  /** column name */
  RegionId = 'region_id',
  /** column name */
  ResponseVariableId = 'response_variable_id',
  /** column name */
  StartDate = 'start_date'
}

export type Task_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Task_Set_Input>;
  where: Task_Bool_Exp;
};

/** columns and relationships of "thread" */
export type Thread = {
  __typename?: 'thread';
  /** An object relationship */
  driving_variable?: Maybe<Variable>;
  driving_variable_id?: Maybe<Scalars['String']['output']>;
  end_date: Scalars['date']['output'];
  /** An array relationship */
  events: Array<Thread_Provenance>;
  /** An aggregate relationship */
  events_aggregate: Thread_Provenance_Aggregate;
  id: Scalars['String']['output'];
  name?: Maybe<Scalars['String']['output']>;
  /** An array relationship */
  permissions: Array<Thread_Permission>;
  /** An aggregate relationship */
  permissions_aggregate: Thread_Permission_Aggregate;
  /** An object relationship */
  region?: Maybe<Region>;
  region_id?: Maybe<Scalars['String']['output']>;
  /** An object relationship */
  response_variable?: Maybe<Variable>;
  response_variable_id?: Maybe<Scalars['String']['output']>;
  start_date: Scalars['date']['output'];
  /** An object relationship */
  task: Task;
  task_id: Scalars['String']['output'];
  /** An array relationship */
  thread_data: Array<Thread_Data>;
  /** An aggregate relationship */
  thread_data_aggregate: Thread_Data_Aggregate;
  /** An array relationship */
  thread_models: Array<Thread_Model>;
  /** An aggregate relationship */
  thread_models_aggregate: Thread_Model_Aggregate;
};


/** columns and relationships of "thread" */
export type ThreadEventsArgs = {
  distinct_on?: InputMaybe<Array<Thread_Provenance_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Provenance_Order_By>>;
  where?: InputMaybe<Thread_Provenance_Bool_Exp>;
};


/** columns and relationships of "thread" */
export type ThreadEvents_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Provenance_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Provenance_Order_By>>;
  where?: InputMaybe<Thread_Provenance_Bool_Exp>;
};


/** columns and relationships of "thread" */
export type ThreadPermissionsArgs = {
  distinct_on?: InputMaybe<Array<Thread_Permission_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Permission_Order_By>>;
  where?: InputMaybe<Thread_Permission_Bool_Exp>;
};


/** columns and relationships of "thread" */
export type ThreadPermissions_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Permission_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Permission_Order_By>>;
  where?: InputMaybe<Thread_Permission_Bool_Exp>;
};


/** columns and relationships of "thread" */
export type ThreadThread_DataArgs = {
  distinct_on?: InputMaybe<Array<Thread_Data_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Data_Order_By>>;
  where?: InputMaybe<Thread_Data_Bool_Exp>;
};


/** columns and relationships of "thread" */
export type ThreadThread_Data_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Data_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Data_Order_By>>;
  where?: InputMaybe<Thread_Data_Bool_Exp>;
};


/** columns and relationships of "thread" */
export type ThreadThread_ModelsArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Order_By>>;
  where?: InputMaybe<Thread_Model_Bool_Exp>;
};


/** columns and relationships of "thread" */
export type ThreadThread_Models_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Order_By>>;
  where?: InputMaybe<Thread_Model_Bool_Exp>;
};

/** aggregated selection of "thread" */
export type Thread_Aggregate = {
  __typename?: 'thread_aggregate';
  aggregate?: Maybe<Thread_Aggregate_Fields>;
  nodes: Array<Thread>;
};

/** aggregate fields of "thread" */
export type Thread_Aggregate_Fields = {
  __typename?: 'thread_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Thread_Max_Fields>;
  min?: Maybe<Thread_Min_Fields>;
};


/** aggregate fields of "thread" */
export type Thread_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Thread_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "thread" */
export type Thread_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Thread_Max_Order_By>;
  min?: InputMaybe<Thread_Min_Order_By>;
};

/** input type for inserting array relation for remote table "thread" */
export type Thread_Arr_Rel_Insert_Input = {
  data: Array<Thread_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Thread_On_Conflict>;
};

/** Boolean expression to filter rows from the table "thread". All fields are combined with a logical 'AND'. */
export type Thread_Bool_Exp = {
  _and?: InputMaybe<Array<Thread_Bool_Exp>>;
  _not?: InputMaybe<Thread_Bool_Exp>;
  _or?: InputMaybe<Array<Thread_Bool_Exp>>;
  driving_variable?: InputMaybe<Variable_Bool_Exp>;
  driving_variable_id?: InputMaybe<String_Comparison_Exp>;
  end_date?: InputMaybe<Date_Comparison_Exp>;
  events?: InputMaybe<Thread_Provenance_Bool_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  permissions?: InputMaybe<Thread_Permission_Bool_Exp>;
  region?: InputMaybe<Region_Bool_Exp>;
  region_id?: InputMaybe<String_Comparison_Exp>;
  response_variable?: InputMaybe<Variable_Bool_Exp>;
  response_variable_id?: InputMaybe<String_Comparison_Exp>;
  start_date?: InputMaybe<Date_Comparison_Exp>;
  task?: InputMaybe<Task_Bool_Exp>;
  task_id?: InputMaybe<String_Comparison_Exp>;
  thread_data?: InputMaybe<Thread_Data_Bool_Exp>;
  thread_models?: InputMaybe<Thread_Model_Bool_Exp>;
};

/** unique or primary key constraints on table "thread" */
export enum Thread_Constraint {
  /** unique or primary key constraint on columns "id" */
  ThreadPkey = 'thread_pkey'
}

/** columns and relationships of "thread_data" */
export type Thread_Data = {
  __typename?: 'thread_data';
  /** An object relationship */
  dataslice: Dataslice;
  dataslice_id: Scalars['uuid']['output'];
  /** An object relationship */
  thread: Thread;
  thread_id: Scalars['String']['output'];
};

/** aggregated selection of "thread_data" */
export type Thread_Data_Aggregate = {
  __typename?: 'thread_data_aggregate';
  aggregate?: Maybe<Thread_Data_Aggregate_Fields>;
  nodes: Array<Thread_Data>;
};

/** aggregate fields of "thread_data" */
export type Thread_Data_Aggregate_Fields = {
  __typename?: 'thread_data_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Thread_Data_Max_Fields>;
  min?: Maybe<Thread_Data_Min_Fields>;
};


/** aggregate fields of "thread_data" */
export type Thread_Data_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Thread_Data_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "thread_data" */
export type Thread_Data_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Thread_Data_Max_Order_By>;
  min?: InputMaybe<Thread_Data_Min_Order_By>;
};

/** input type for inserting array relation for remote table "thread_data" */
export type Thread_Data_Arr_Rel_Insert_Input = {
  data: Array<Thread_Data_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Thread_Data_On_Conflict>;
};

/** Boolean expression to filter rows from the table "thread_data". All fields are combined with a logical 'AND'. */
export type Thread_Data_Bool_Exp = {
  _and?: InputMaybe<Array<Thread_Data_Bool_Exp>>;
  _not?: InputMaybe<Thread_Data_Bool_Exp>;
  _or?: InputMaybe<Array<Thread_Data_Bool_Exp>>;
  dataslice?: InputMaybe<Dataslice_Bool_Exp>;
  dataslice_id?: InputMaybe<Uuid_Comparison_Exp>;
  thread?: InputMaybe<Thread_Bool_Exp>;
  thread_id?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "thread_data" */
export enum Thread_Data_Constraint {
  /** unique or primary key constraint on columns "dataslice_id", "thread_id" */
  ThreadDataPkey = 'thread_data_pkey'
}

/** input type for inserting data into table "thread_data" */
export type Thread_Data_Insert_Input = {
  dataslice?: InputMaybe<Dataslice_Obj_Rel_Insert_Input>;
  dataslice_id?: InputMaybe<Scalars['uuid']['input']>;
  thread?: InputMaybe<Thread_Obj_Rel_Insert_Input>;
  thread_id?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Thread_Data_Max_Fields = {
  __typename?: 'thread_data_max_fields';
  dataslice_id?: Maybe<Scalars['uuid']['output']>;
  thread_id?: Maybe<Scalars['String']['output']>;
};

/** order by max() on columns of table "thread_data" */
export type Thread_Data_Max_Order_By = {
  dataslice_id?: InputMaybe<Order_By>;
  thread_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Thread_Data_Min_Fields = {
  __typename?: 'thread_data_min_fields';
  dataslice_id?: Maybe<Scalars['uuid']['output']>;
  thread_id?: Maybe<Scalars['String']['output']>;
};

/** order by min() on columns of table "thread_data" */
export type Thread_Data_Min_Order_By = {
  dataslice_id?: InputMaybe<Order_By>;
  thread_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "thread_data" */
export type Thread_Data_Mutation_Response = {
  __typename?: 'thread_data_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Thread_Data>;
};

/** on_conflict condition type for table "thread_data" */
export type Thread_Data_On_Conflict = {
  constraint: Thread_Data_Constraint;
  update_columns?: Array<Thread_Data_Update_Column>;
  where?: InputMaybe<Thread_Data_Bool_Exp>;
};

/** Ordering options when selecting data from "thread_data". */
export type Thread_Data_Order_By = {
  dataslice?: InputMaybe<Dataslice_Order_By>;
  dataslice_id?: InputMaybe<Order_By>;
  thread?: InputMaybe<Thread_Order_By>;
  thread_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: thread_data */
export type Thread_Data_Pk_Columns_Input = {
  dataslice_id: Scalars['uuid']['input'];
  thread_id: Scalars['String']['input'];
};

/** select columns of table "thread_data" */
export enum Thread_Data_Select_Column {
  /** column name */
  DatasliceId = 'dataslice_id',
  /** column name */
  ThreadId = 'thread_id'
}

/** input type for updating data in table "thread_data" */
export type Thread_Data_Set_Input = {
  dataslice_id?: InputMaybe<Scalars['uuid']['input']>;
  thread_id?: InputMaybe<Scalars['String']['input']>;
};

/** update columns of table "thread_data" */
export enum Thread_Data_Update_Column {
  /** column name */
  DatasliceId = 'dataslice_id',
  /** column name */
  ThreadId = 'thread_id'
}

export type Thread_Data_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Thread_Data_Set_Input>;
  where: Thread_Data_Bool_Exp;
};

/** Boolean expression to compare columns of type "thread_events". All fields are combined with logical 'AND'. */
export type Thread_Events_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['thread_events']['input']>;
  _gt?: InputMaybe<Scalars['thread_events']['input']>;
  _gte?: InputMaybe<Scalars['thread_events']['input']>;
  _in?: InputMaybe<Array<Scalars['thread_events']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['thread_events']['input']>;
  _lte?: InputMaybe<Scalars['thread_events']['input']>;
  _neq?: InputMaybe<Scalars['thread_events']['input']>;
  _nin?: InputMaybe<Array<Scalars['thread_events']['input']>>;
};

/** input type for inserting data into table "thread" */
export type Thread_Insert_Input = {
  driving_variable?: InputMaybe<Variable_Obj_Rel_Insert_Input>;
  driving_variable_id?: InputMaybe<Scalars['String']['input']>;
  end_date?: InputMaybe<Scalars['date']['input']>;
  events?: InputMaybe<Thread_Provenance_Arr_Rel_Insert_Input>;
  id?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  permissions?: InputMaybe<Thread_Permission_Arr_Rel_Insert_Input>;
  region?: InputMaybe<Region_Obj_Rel_Insert_Input>;
  region_id?: InputMaybe<Scalars['String']['input']>;
  response_variable?: InputMaybe<Variable_Obj_Rel_Insert_Input>;
  response_variable_id?: InputMaybe<Scalars['String']['input']>;
  start_date?: InputMaybe<Scalars['date']['input']>;
  task?: InputMaybe<Task_Obj_Rel_Insert_Input>;
  task_id?: InputMaybe<Scalars['String']['input']>;
  thread_data?: InputMaybe<Thread_Data_Arr_Rel_Insert_Input>;
  thread_models?: InputMaybe<Thread_Model_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type Thread_Max_Fields = {
  __typename?: 'thread_max_fields';
  driving_variable_id?: Maybe<Scalars['String']['output']>;
  end_date?: Maybe<Scalars['date']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  region_id?: Maybe<Scalars['String']['output']>;
  response_variable_id?: Maybe<Scalars['String']['output']>;
  start_date?: Maybe<Scalars['date']['output']>;
  task_id?: Maybe<Scalars['String']['output']>;
};

/** order by max() on columns of table "thread" */
export type Thread_Max_Order_By = {
  driving_variable_id?: InputMaybe<Order_By>;
  end_date?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  region_id?: InputMaybe<Order_By>;
  response_variable_id?: InputMaybe<Order_By>;
  start_date?: InputMaybe<Order_By>;
  task_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Thread_Min_Fields = {
  __typename?: 'thread_min_fields';
  driving_variable_id?: Maybe<Scalars['String']['output']>;
  end_date?: Maybe<Scalars['date']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  region_id?: Maybe<Scalars['String']['output']>;
  response_variable_id?: Maybe<Scalars['String']['output']>;
  start_date?: Maybe<Scalars['date']['output']>;
  task_id?: Maybe<Scalars['String']['output']>;
};

/** order by min() on columns of table "thread" */
export type Thread_Min_Order_By = {
  driving_variable_id?: InputMaybe<Order_By>;
  end_date?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  region_id?: InputMaybe<Order_By>;
  response_variable_id?: InputMaybe<Order_By>;
  start_date?: InputMaybe<Order_By>;
  task_id?: InputMaybe<Order_By>;
};

/** columns and relationships of "thread_model" */
export type Thread_Model = {
  __typename?: 'thread_model';
  /** An array relationship */
  data_bindings: Array<Thread_Model_Io>;
  /** An aggregate relationship */
  data_bindings_aggregate: Thread_Model_Io_Aggregate;
  /** An array relationship */
  execution_summary: Array<Thread_Model_Execution_Summary>;
  /** An aggregate relationship */
  execution_summary_aggregate: Thread_Model_Execution_Summary_Aggregate;
  /** An array relationship */
  executions: Array<Thread_Model_Execution>;
  /** An aggregate relationship */
  executions_aggregate: Thread_Model_Execution_Aggregate;
  id: Scalars['uuid']['output'];
  /** An object relationship */
  model: Model;
  model_id: Scalars['String']['output'];
  /** An array relationship */
  parameter_bindings: Array<Thread_Model_Parameter>;
  /** An aggregate relationship */
  parameter_bindings_aggregate: Thread_Model_Parameter_Aggregate;
  /** An object relationship */
  thread: Thread;
  thread_id: Scalars['String']['output'];
};


/** columns and relationships of "thread_model" */
export type Thread_ModelData_BindingsArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Io_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Io_Order_By>>;
  where?: InputMaybe<Thread_Model_Io_Bool_Exp>;
};


/** columns and relationships of "thread_model" */
export type Thread_ModelData_Bindings_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Io_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Io_Order_By>>;
  where?: InputMaybe<Thread_Model_Io_Bool_Exp>;
};


/** columns and relationships of "thread_model" */
export type Thread_ModelExecution_SummaryArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Execution_Summary_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Execution_Summary_Order_By>>;
  where?: InputMaybe<Thread_Model_Execution_Summary_Bool_Exp>;
};


/** columns and relationships of "thread_model" */
export type Thread_ModelExecution_Summary_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Execution_Summary_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Execution_Summary_Order_By>>;
  where?: InputMaybe<Thread_Model_Execution_Summary_Bool_Exp>;
};


/** columns and relationships of "thread_model" */
export type Thread_ModelExecutionsArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Execution_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Execution_Order_By>>;
  where?: InputMaybe<Thread_Model_Execution_Bool_Exp>;
};


/** columns and relationships of "thread_model" */
export type Thread_ModelExecutions_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Execution_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Execution_Order_By>>;
  where?: InputMaybe<Thread_Model_Execution_Bool_Exp>;
};


/** columns and relationships of "thread_model" */
export type Thread_ModelParameter_BindingsArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Parameter_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Parameter_Order_By>>;
  where?: InputMaybe<Thread_Model_Parameter_Bool_Exp>;
};


/** columns and relationships of "thread_model" */
export type Thread_ModelParameter_Bindings_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Model_Parameter_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Model_Parameter_Order_By>>;
  where?: InputMaybe<Thread_Model_Parameter_Bool_Exp>;
};

/** aggregated selection of "thread_model" */
export type Thread_Model_Aggregate = {
  __typename?: 'thread_model_aggregate';
  aggregate?: Maybe<Thread_Model_Aggregate_Fields>;
  nodes: Array<Thread_Model>;
};

/** aggregate fields of "thread_model" */
export type Thread_Model_Aggregate_Fields = {
  __typename?: 'thread_model_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Thread_Model_Max_Fields>;
  min?: Maybe<Thread_Model_Min_Fields>;
};


/** aggregate fields of "thread_model" */
export type Thread_Model_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Thread_Model_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "thread_model" */
export type Thread_Model_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Thread_Model_Max_Order_By>;
  min?: InputMaybe<Thread_Model_Min_Order_By>;
};

/** input type for inserting array relation for remote table "thread_model" */
export type Thread_Model_Arr_Rel_Insert_Input = {
  data: Array<Thread_Model_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Thread_Model_On_Conflict>;
};

/** Boolean expression to filter rows from the table "thread_model". All fields are combined with a logical 'AND'. */
export type Thread_Model_Bool_Exp = {
  _and?: InputMaybe<Array<Thread_Model_Bool_Exp>>;
  _not?: InputMaybe<Thread_Model_Bool_Exp>;
  _or?: InputMaybe<Array<Thread_Model_Bool_Exp>>;
  data_bindings?: InputMaybe<Thread_Model_Io_Bool_Exp>;
  execution_summary?: InputMaybe<Thread_Model_Execution_Summary_Bool_Exp>;
  executions?: InputMaybe<Thread_Model_Execution_Bool_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  model?: InputMaybe<Model_Bool_Exp>;
  model_id?: InputMaybe<String_Comparison_Exp>;
  parameter_bindings?: InputMaybe<Thread_Model_Parameter_Bool_Exp>;
  thread?: InputMaybe<Thread_Bool_Exp>;
  thread_id?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "thread_model" */
export enum Thread_Model_Constraint {
  /** unique or primary key constraint on columns "id" */
  ThreadModelPkey = 'thread_model_pkey',
  /** unique or primary key constraint on columns "model_id", "thread_id" */
  ThreadModelThreadIdModelIdKey = 'thread_model_thread_id_model_id_key'
}

/** columns and relationships of "thread_model_execution" */
export type Thread_Model_Execution = {
  __typename?: 'thread_model_execution';
  /** An object relationship */
  execution: Execution;
  execution_id: Scalars['uuid']['output'];
  /** An object relationship */
  thread_model: Thread_Model;
  thread_model_id: Scalars['uuid']['output'];
};

/** aggregated selection of "thread_model_execution" */
export type Thread_Model_Execution_Aggregate = {
  __typename?: 'thread_model_execution_aggregate';
  aggregate?: Maybe<Thread_Model_Execution_Aggregate_Fields>;
  nodes: Array<Thread_Model_Execution>;
};

/** aggregate fields of "thread_model_execution" */
export type Thread_Model_Execution_Aggregate_Fields = {
  __typename?: 'thread_model_execution_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Thread_Model_Execution_Max_Fields>;
  min?: Maybe<Thread_Model_Execution_Min_Fields>;
};


/** aggregate fields of "thread_model_execution" */
export type Thread_Model_Execution_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Thread_Model_Execution_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "thread_model_execution" */
export type Thread_Model_Execution_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Thread_Model_Execution_Max_Order_By>;
  min?: InputMaybe<Thread_Model_Execution_Min_Order_By>;
};

/** input type for inserting array relation for remote table "thread_model_execution" */
export type Thread_Model_Execution_Arr_Rel_Insert_Input = {
  data: Array<Thread_Model_Execution_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Thread_Model_Execution_On_Conflict>;
};

/** Boolean expression to filter rows from the table "thread_model_execution". All fields are combined with a logical 'AND'. */
export type Thread_Model_Execution_Bool_Exp = {
  _and?: InputMaybe<Array<Thread_Model_Execution_Bool_Exp>>;
  _not?: InputMaybe<Thread_Model_Execution_Bool_Exp>;
  _or?: InputMaybe<Array<Thread_Model_Execution_Bool_Exp>>;
  execution?: InputMaybe<Execution_Bool_Exp>;
  execution_id?: InputMaybe<Uuid_Comparison_Exp>;
  thread_model?: InputMaybe<Thread_Model_Bool_Exp>;
  thread_model_id?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "thread_model_execution" */
export enum Thread_Model_Execution_Constraint {
  /** unique or primary key constraint on columns "execution_id", "thread_model_id" */
  ThreadModelExecutionPkey = 'thread_model_execution_pkey'
}

/** input type for inserting data into table "thread_model_execution" */
export type Thread_Model_Execution_Insert_Input = {
  execution?: InputMaybe<Execution_Obj_Rel_Insert_Input>;
  execution_id?: InputMaybe<Scalars['uuid']['input']>;
  thread_model?: InputMaybe<Thread_Model_Obj_Rel_Insert_Input>;
  thread_model_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate max on columns */
export type Thread_Model_Execution_Max_Fields = {
  __typename?: 'thread_model_execution_max_fields';
  execution_id?: Maybe<Scalars['uuid']['output']>;
  thread_model_id?: Maybe<Scalars['uuid']['output']>;
};

/** order by max() on columns of table "thread_model_execution" */
export type Thread_Model_Execution_Max_Order_By = {
  execution_id?: InputMaybe<Order_By>;
  thread_model_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Thread_Model_Execution_Min_Fields = {
  __typename?: 'thread_model_execution_min_fields';
  execution_id?: Maybe<Scalars['uuid']['output']>;
  thread_model_id?: Maybe<Scalars['uuid']['output']>;
};

/** order by min() on columns of table "thread_model_execution" */
export type Thread_Model_Execution_Min_Order_By = {
  execution_id?: InputMaybe<Order_By>;
  thread_model_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "thread_model_execution" */
export type Thread_Model_Execution_Mutation_Response = {
  __typename?: 'thread_model_execution_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Thread_Model_Execution>;
};

/** on_conflict condition type for table "thread_model_execution" */
export type Thread_Model_Execution_On_Conflict = {
  constraint: Thread_Model_Execution_Constraint;
  update_columns?: Array<Thread_Model_Execution_Update_Column>;
  where?: InputMaybe<Thread_Model_Execution_Bool_Exp>;
};

/** Ordering options when selecting data from "thread_model_execution". */
export type Thread_Model_Execution_Order_By = {
  execution?: InputMaybe<Execution_Order_By>;
  execution_id?: InputMaybe<Order_By>;
  thread_model?: InputMaybe<Thread_Model_Order_By>;
  thread_model_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: thread_model_execution */
export type Thread_Model_Execution_Pk_Columns_Input = {
  execution_id: Scalars['uuid']['input'];
  thread_model_id: Scalars['uuid']['input'];
};

/** select columns of table "thread_model_execution" */
export enum Thread_Model_Execution_Select_Column {
  /** column name */
  ExecutionId = 'execution_id',
  /** column name */
  ThreadModelId = 'thread_model_id'
}

/** input type for updating data in table "thread_model_execution" */
export type Thread_Model_Execution_Set_Input = {
  execution_id?: InputMaybe<Scalars['uuid']['input']>;
  thread_model_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** columns and relationships of "thread_model_execution_summary" */
export type Thread_Model_Execution_Summary = {
  __typename?: 'thread_model_execution_summary';
  failed_runs: Scalars['Int']['output'];
  fetched_run_outputs: Scalars['Int']['output'];
  ingested_runs: Scalars['Int']['output'];
  ingestion_time?: Maybe<Scalars['timestamp']['output']>;
  published_runs: Scalars['Int']['output'];
  publishing_time?: Maybe<Scalars['timestamp']['output']>;
  registered_runs: Scalars['Int']['output'];
  registration_time?: Maybe<Scalars['timestamp']['output']>;
  submission_time?: Maybe<Scalars['timestamp']['output']>;
  submitted_for_execution: Scalars['Boolean']['output'];
  submitted_for_ingestion: Scalars['Boolean']['output'];
  submitted_for_publishing: Scalars['Boolean']['output'];
  submitted_for_registration: Scalars['Boolean']['output'];
  submitted_runs: Scalars['Int']['output'];
  successful_runs: Scalars['Int']['output'];
  /** An object relationship */
  thread_model: Thread_Model;
  thread_model_id: Scalars['uuid']['output'];
  total_runs: Scalars['Int']['output'];
  workflow_name?: Maybe<Scalars['String']['output']>;
};

/** aggregated selection of "thread_model_execution_summary" */
export type Thread_Model_Execution_Summary_Aggregate = {
  __typename?: 'thread_model_execution_summary_aggregate';
  aggregate?: Maybe<Thread_Model_Execution_Summary_Aggregate_Fields>;
  nodes: Array<Thread_Model_Execution_Summary>;
};

/** aggregate fields of "thread_model_execution_summary" */
export type Thread_Model_Execution_Summary_Aggregate_Fields = {
  __typename?: 'thread_model_execution_summary_aggregate_fields';
  avg?: Maybe<Thread_Model_Execution_Summary_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Thread_Model_Execution_Summary_Max_Fields>;
  min?: Maybe<Thread_Model_Execution_Summary_Min_Fields>;
  stddev?: Maybe<Thread_Model_Execution_Summary_Stddev_Fields>;
  stddev_pop?: Maybe<Thread_Model_Execution_Summary_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Thread_Model_Execution_Summary_Stddev_Samp_Fields>;
  sum?: Maybe<Thread_Model_Execution_Summary_Sum_Fields>;
  var_pop?: Maybe<Thread_Model_Execution_Summary_Var_Pop_Fields>;
  var_samp?: Maybe<Thread_Model_Execution_Summary_Var_Samp_Fields>;
  variance?: Maybe<Thread_Model_Execution_Summary_Variance_Fields>;
};


/** aggregate fields of "thread_model_execution_summary" */
export type Thread_Model_Execution_Summary_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Thread_Model_Execution_Summary_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "thread_model_execution_summary" */
export type Thread_Model_Execution_Summary_Aggregate_Order_By = {
  avg?: InputMaybe<Thread_Model_Execution_Summary_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Thread_Model_Execution_Summary_Max_Order_By>;
  min?: InputMaybe<Thread_Model_Execution_Summary_Min_Order_By>;
  stddev?: InputMaybe<Thread_Model_Execution_Summary_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Thread_Model_Execution_Summary_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Thread_Model_Execution_Summary_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Thread_Model_Execution_Summary_Sum_Order_By>;
  var_pop?: InputMaybe<Thread_Model_Execution_Summary_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Thread_Model_Execution_Summary_Var_Samp_Order_By>;
  variance?: InputMaybe<Thread_Model_Execution_Summary_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "thread_model_execution_summary" */
export type Thread_Model_Execution_Summary_Arr_Rel_Insert_Input = {
  data: Array<Thread_Model_Execution_Summary_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Thread_Model_Execution_Summary_On_Conflict>;
};

/** aggregate avg on columns */
export type Thread_Model_Execution_Summary_Avg_Fields = {
  __typename?: 'thread_model_execution_summary_avg_fields';
  failed_runs?: Maybe<Scalars['Float']['output']>;
  fetched_run_outputs?: Maybe<Scalars['Float']['output']>;
  ingested_runs?: Maybe<Scalars['Float']['output']>;
  published_runs?: Maybe<Scalars['Float']['output']>;
  registered_runs?: Maybe<Scalars['Float']['output']>;
  submitted_runs?: Maybe<Scalars['Float']['output']>;
  successful_runs?: Maybe<Scalars['Float']['output']>;
  total_runs?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "thread_model_execution_summary" */
export type Thread_Model_Execution_Summary_Avg_Order_By = {
  failed_runs?: InputMaybe<Order_By>;
  fetched_run_outputs?: InputMaybe<Order_By>;
  ingested_runs?: InputMaybe<Order_By>;
  published_runs?: InputMaybe<Order_By>;
  registered_runs?: InputMaybe<Order_By>;
  submitted_runs?: InputMaybe<Order_By>;
  successful_runs?: InputMaybe<Order_By>;
  total_runs?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "thread_model_execution_summary". All fields are combined with a logical 'AND'. */
export type Thread_Model_Execution_Summary_Bool_Exp = {
  _and?: InputMaybe<Array<Thread_Model_Execution_Summary_Bool_Exp>>;
  _not?: InputMaybe<Thread_Model_Execution_Summary_Bool_Exp>;
  _or?: InputMaybe<Array<Thread_Model_Execution_Summary_Bool_Exp>>;
  failed_runs?: InputMaybe<Int_Comparison_Exp>;
  fetched_run_outputs?: InputMaybe<Int_Comparison_Exp>;
  ingested_runs?: InputMaybe<Int_Comparison_Exp>;
  ingestion_time?: InputMaybe<Timestamp_Comparison_Exp>;
  published_runs?: InputMaybe<Int_Comparison_Exp>;
  publishing_time?: InputMaybe<Timestamp_Comparison_Exp>;
  registered_runs?: InputMaybe<Int_Comparison_Exp>;
  registration_time?: InputMaybe<Timestamp_Comparison_Exp>;
  submission_time?: InputMaybe<Timestamp_Comparison_Exp>;
  submitted_for_execution?: InputMaybe<Boolean_Comparison_Exp>;
  submitted_for_ingestion?: InputMaybe<Boolean_Comparison_Exp>;
  submitted_for_publishing?: InputMaybe<Boolean_Comparison_Exp>;
  submitted_for_registration?: InputMaybe<Boolean_Comparison_Exp>;
  submitted_runs?: InputMaybe<Int_Comparison_Exp>;
  successful_runs?: InputMaybe<Int_Comparison_Exp>;
  thread_model?: InputMaybe<Thread_Model_Bool_Exp>;
  thread_model_id?: InputMaybe<Uuid_Comparison_Exp>;
  total_runs?: InputMaybe<Int_Comparison_Exp>;
  workflow_name?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "thread_model_execution_summary" */
export enum Thread_Model_Execution_Summary_Constraint {
  /** unique or primary key constraint on columns "thread_model_id" */
  ThreadModelExecutionSummaryPkey = 'thread_model_execution_summary_pkey'
}

/** input type for incrementing numeric columns in table "thread_model_execution_summary" */
export type Thread_Model_Execution_Summary_Inc_Input = {
  failed_runs?: InputMaybe<Scalars['Int']['input']>;
  fetched_run_outputs?: InputMaybe<Scalars['Int']['input']>;
  ingested_runs?: InputMaybe<Scalars['Int']['input']>;
  published_runs?: InputMaybe<Scalars['Int']['input']>;
  registered_runs?: InputMaybe<Scalars['Int']['input']>;
  submitted_runs?: InputMaybe<Scalars['Int']['input']>;
  successful_runs?: InputMaybe<Scalars['Int']['input']>;
  total_runs?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "thread_model_execution_summary" */
export type Thread_Model_Execution_Summary_Insert_Input = {
  failed_runs?: InputMaybe<Scalars['Int']['input']>;
  fetched_run_outputs?: InputMaybe<Scalars['Int']['input']>;
  ingested_runs?: InputMaybe<Scalars['Int']['input']>;
  ingestion_time?: InputMaybe<Scalars['timestamp']['input']>;
  published_runs?: InputMaybe<Scalars['Int']['input']>;
  publishing_time?: InputMaybe<Scalars['timestamp']['input']>;
  registered_runs?: InputMaybe<Scalars['Int']['input']>;
  registration_time?: InputMaybe<Scalars['timestamp']['input']>;
  submission_time?: InputMaybe<Scalars['timestamp']['input']>;
  submitted_for_execution?: InputMaybe<Scalars['Boolean']['input']>;
  submitted_for_ingestion?: InputMaybe<Scalars['Boolean']['input']>;
  submitted_for_publishing?: InputMaybe<Scalars['Boolean']['input']>;
  submitted_for_registration?: InputMaybe<Scalars['Boolean']['input']>;
  submitted_runs?: InputMaybe<Scalars['Int']['input']>;
  successful_runs?: InputMaybe<Scalars['Int']['input']>;
  thread_model?: InputMaybe<Thread_Model_Obj_Rel_Insert_Input>;
  thread_model_id?: InputMaybe<Scalars['uuid']['input']>;
  total_runs?: InputMaybe<Scalars['Int']['input']>;
  workflow_name?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Thread_Model_Execution_Summary_Max_Fields = {
  __typename?: 'thread_model_execution_summary_max_fields';
  failed_runs?: Maybe<Scalars['Int']['output']>;
  fetched_run_outputs?: Maybe<Scalars['Int']['output']>;
  ingested_runs?: Maybe<Scalars['Int']['output']>;
  ingestion_time?: Maybe<Scalars['timestamp']['output']>;
  published_runs?: Maybe<Scalars['Int']['output']>;
  publishing_time?: Maybe<Scalars['timestamp']['output']>;
  registered_runs?: Maybe<Scalars['Int']['output']>;
  registration_time?: Maybe<Scalars['timestamp']['output']>;
  submission_time?: Maybe<Scalars['timestamp']['output']>;
  submitted_runs?: Maybe<Scalars['Int']['output']>;
  successful_runs?: Maybe<Scalars['Int']['output']>;
  thread_model_id?: Maybe<Scalars['uuid']['output']>;
  total_runs?: Maybe<Scalars['Int']['output']>;
  workflow_name?: Maybe<Scalars['String']['output']>;
};

/** order by max() on columns of table "thread_model_execution_summary" */
export type Thread_Model_Execution_Summary_Max_Order_By = {
  failed_runs?: InputMaybe<Order_By>;
  fetched_run_outputs?: InputMaybe<Order_By>;
  ingested_runs?: InputMaybe<Order_By>;
  ingestion_time?: InputMaybe<Order_By>;
  published_runs?: InputMaybe<Order_By>;
  publishing_time?: InputMaybe<Order_By>;
  registered_runs?: InputMaybe<Order_By>;
  registration_time?: InputMaybe<Order_By>;
  submission_time?: InputMaybe<Order_By>;
  submitted_runs?: InputMaybe<Order_By>;
  successful_runs?: InputMaybe<Order_By>;
  thread_model_id?: InputMaybe<Order_By>;
  total_runs?: InputMaybe<Order_By>;
  workflow_name?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Thread_Model_Execution_Summary_Min_Fields = {
  __typename?: 'thread_model_execution_summary_min_fields';
  failed_runs?: Maybe<Scalars['Int']['output']>;
  fetched_run_outputs?: Maybe<Scalars['Int']['output']>;
  ingested_runs?: Maybe<Scalars['Int']['output']>;
  ingestion_time?: Maybe<Scalars['timestamp']['output']>;
  published_runs?: Maybe<Scalars['Int']['output']>;
  publishing_time?: Maybe<Scalars['timestamp']['output']>;
  registered_runs?: Maybe<Scalars['Int']['output']>;
  registration_time?: Maybe<Scalars['timestamp']['output']>;
  submission_time?: Maybe<Scalars['timestamp']['output']>;
  submitted_runs?: Maybe<Scalars['Int']['output']>;
  successful_runs?: Maybe<Scalars['Int']['output']>;
  thread_model_id?: Maybe<Scalars['uuid']['output']>;
  total_runs?: Maybe<Scalars['Int']['output']>;
  workflow_name?: Maybe<Scalars['String']['output']>;
};

/** order by min() on columns of table "thread_model_execution_summary" */
export type Thread_Model_Execution_Summary_Min_Order_By = {
  failed_runs?: InputMaybe<Order_By>;
  fetched_run_outputs?: InputMaybe<Order_By>;
  ingested_runs?: InputMaybe<Order_By>;
  ingestion_time?: InputMaybe<Order_By>;
  published_runs?: InputMaybe<Order_By>;
  publishing_time?: InputMaybe<Order_By>;
  registered_runs?: InputMaybe<Order_By>;
  registration_time?: InputMaybe<Order_By>;
  submission_time?: InputMaybe<Order_By>;
  submitted_runs?: InputMaybe<Order_By>;
  successful_runs?: InputMaybe<Order_By>;
  thread_model_id?: InputMaybe<Order_By>;
  total_runs?: InputMaybe<Order_By>;
  workflow_name?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "thread_model_execution_summary" */
export type Thread_Model_Execution_Summary_Mutation_Response = {
  __typename?: 'thread_model_execution_summary_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Thread_Model_Execution_Summary>;
};

/** on_conflict condition type for table "thread_model_execution_summary" */
export type Thread_Model_Execution_Summary_On_Conflict = {
  constraint: Thread_Model_Execution_Summary_Constraint;
  update_columns?: Array<Thread_Model_Execution_Summary_Update_Column>;
  where?: InputMaybe<Thread_Model_Execution_Summary_Bool_Exp>;
};

/** Ordering options when selecting data from "thread_model_execution_summary". */
export type Thread_Model_Execution_Summary_Order_By = {
  failed_runs?: InputMaybe<Order_By>;
  fetched_run_outputs?: InputMaybe<Order_By>;
  ingested_runs?: InputMaybe<Order_By>;
  ingestion_time?: InputMaybe<Order_By>;
  published_runs?: InputMaybe<Order_By>;
  publishing_time?: InputMaybe<Order_By>;
  registered_runs?: InputMaybe<Order_By>;
  registration_time?: InputMaybe<Order_By>;
  submission_time?: InputMaybe<Order_By>;
  submitted_for_execution?: InputMaybe<Order_By>;
  submitted_for_ingestion?: InputMaybe<Order_By>;
  submitted_for_publishing?: InputMaybe<Order_By>;
  submitted_for_registration?: InputMaybe<Order_By>;
  submitted_runs?: InputMaybe<Order_By>;
  successful_runs?: InputMaybe<Order_By>;
  thread_model?: InputMaybe<Thread_Model_Order_By>;
  thread_model_id?: InputMaybe<Order_By>;
  total_runs?: InputMaybe<Order_By>;
  workflow_name?: InputMaybe<Order_By>;
};

/** primary key columns input for table: thread_model_execution_summary */
export type Thread_Model_Execution_Summary_Pk_Columns_Input = {
  thread_model_id: Scalars['uuid']['input'];
};

/** select columns of table "thread_model_execution_summary" */
export enum Thread_Model_Execution_Summary_Select_Column {
  /** column name */
  FailedRuns = 'failed_runs',
  /** column name */
  FetchedRunOutputs = 'fetched_run_outputs',
  /** column name */
  IngestedRuns = 'ingested_runs',
  /** column name */
  IngestionTime = 'ingestion_time',
  /** column name */
  PublishedRuns = 'published_runs',
  /** column name */
  PublishingTime = 'publishing_time',
  /** column name */
  RegisteredRuns = 'registered_runs',
  /** column name */
  RegistrationTime = 'registration_time',
  /** column name */
  SubmissionTime = 'submission_time',
  /** column name */
  SubmittedForExecution = 'submitted_for_execution',
  /** column name */
  SubmittedForIngestion = 'submitted_for_ingestion',
  /** column name */
  SubmittedForPublishing = 'submitted_for_publishing',
  /** column name */
  SubmittedForRegistration = 'submitted_for_registration',
  /** column name */
  SubmittedRuns = 'submitted_runs',
  /** column name */
  SuccessfulRuns = 'successful_runs',
  /** column name */
  ThreadModelId = 'thread_model_id',
  /** column name */
  TotalRuns = 'total_runs',
  /** column name */
  WorkflowName = 'workflow_name'
}

/** input type for updating data in table "thread_model_execution_summary" */
export type Thread_Model_Execution_Summary_Set_Input = {
  failed_runs?: InputMaybe<Scalars['Int']['input']>;
  fetched_run_outputs?: InputMaybe<Scalars['Int']['input']>;
  ingested_runs?: InputMaybe<Scalars['Int']['input']>;
  ingestion_time?: InputMaybe<Scalars['timestamp']['input']>;
  published_runs?: InputMaybe<Scalars['Int']['input']>;
  publishing_time?: InputMaybe<Scalars['timestamp']['input']>;
  registered_runs?: InputMaybe<Scalars['Int']['input']>;
  registration_time?: InputMaybe<Scalars['timestamp']['input']>;
  submission_time?: InputMaybe<Scalars['timestamp']['input']>;
  submitted_for_execution?: InputMaybe<Scalars['Boolean']['input']>;
  submitted_for_ingestion?: InputMaybe<Scalars['Boolean']['input']>;
  submitted_for_publishing?: InputMaybe<Scalars['Boolean']['input']>;
  submitted_for_registration?: InputMaybe<Scalars['Boolean']['input']>;
  submitted_runs?: InputMaybe<Scalars['Int']['input']>;
  successful_runs?: InputMaybe<Scalars['Int']['input']>;
  thread_model_id?: InputMaybe<Scalars['uuid']['input']>;
  total_runs?: InputMaybe<Scalars['Int']['input']>;
  workflow_name?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate stddev on columns */
export type Thread_Model_Execution_Summary_Stddev_Fields = {
  __typename?: 'thread_model_execution_summary_stddev_fields';
  failed_runs?: Maybe<Scalars['Float']['output']>;
  fetched_run_outputs?: Maybe<Scalars['Float']['output']>;
  ingested_runs?: Maybe<Scalars['Float']['output']>;
  published_runs?: Maybe<Scalars['Float']['output']>;
  registered_runs?: Maybe<Scalars['Float']['output']>;
  submitted_runs?: Maybe<Scalars['Float']['output']>;
  successful_runs?: Maybe<Scalars['Float']['output']>;
  total_runs?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "thread_model_execution_summary" */
export type Thread_Model_Execution_Summary_Stddev_Order_By = {
  failed_runs?: InputMaybe<Order_By>;
  fetched_run_outputs?: InputMaybe<Order_By>;
  ingested_runs?: InputMaybe<Order_By>;
  published_runs?: InputMaybe<Order_By>;
  registered_runs?: InputMaybe<Order_By>;
  submitted_runs?: InputMaybe<Order_By>;
  successful_runs?: InputMaybe<Order_By>;
  total_runs?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Thread_Model_Execution_Summary_Stddev_Pop_Fields = {
  __typename?: 'thread_model_execution_summary_stddev_pop_fields';
  failed_runs?: Maybe<Scalars['Float']['output']>;
  fetched_run_outputs?: Maybe<Scalars['Float']['output']>;
  ingested_runs?: Maybe<Scalars['Float']['output']>;
  published_runs?: Maybe<Scalars['Float']['output']>;
  registered_runs?: Maybe<Scalars['Float']['output']>;
  submitted_runs?: Maybe<Scalars['Float']['output']>;
  successful_runs?: Maybe<Scalars['Float']['output']>;
  total_runs?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "thread_model_execution_summary" */
export type Thread_Model_Execution_Summary_Stddev_Pop_Order_By = {
  failed_runs?: InputMaybe<Order_By>;
  fetched_run_outputs?: InputMaybe<Order_By>;
  ingested_runs?: InputMaybe<Order_By>;
  published_runs?: InputMaybe<Order_By>;
  registered_runs?: InputMaybe<Order_By>;
  submitted_runs?: InputMaybe<Order_By>;
  successful_runs?: InputMaybe<Order_By>;
  total_runs?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Thread_Model_Execution_Summary_Stddev_Samp_Fields = {
  __typename?: 'thread_model_execution_summary_stddev_samp_fields';
  failed_runs?: Maybe<Scalars['Float']['output']>;
  fetched_run_outputs?: Maybe<Scalars['Float']['output']>;
  ingested_runs?: Maybe<Scalars['Float']['output']>;
  published_runs?: Maybe<Scalars['Float']['output']>;
  registered_runs?: Maybe<Scalars['Float']['output']>;
  submitted_runs?: Maybe<Scalars['Float']['output']>;
  successful_runs?: Maybe<Scalars['Float']['output']>;
  total_runs?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "thread_model_execution_summary" */
export type Thread_Model_Execution_Summary_Stddev_Samp_Order_By = {
  failed_runs?: InputMaybe<Order_By>;
  fetched_run_outputs?: InputMaybe<Order_By>;
  ingested_runs?: InputMaybe<Order_By>;
  published_runs?: InputMaybe<Order_By>;
  registered_runs?: InputMaybe<Order_By>;
  submitted_runs?: InputMaybe<Order_By>;
  successful_runs?: InputMaybe<Order_By>;
  total_runs?: InputMaybe<Order_By>;
};

/** aggregate sum on columns */
export type Thread_Model_Execution_Summary_Sum_Fields = {
  __typename?: 'thread_model_execution_summary_sum_fields';
  failed_runs?: Maybe<Scalars['Int']['output']>;
  fetched_run_outputs?: Maybe<Scalars['Int']['output']>;
  ingested_runs?: Maybe<Scalars['Int']['output']>;
  published_runs?: Maybe<Scalars['Int']['output']>;
  registered_runs?: Maybe<Scalars['Int']['output']>;
  submitted_runs?: Maybe<Scalars['Int']['output']>;
  successful_runs?: Maybe<Scalars['Int']['output']>;
  total_runs?: Maybe<Scalars['Int']['output']>;
};

/** order by sum() on columns of table "thread_model_execution_summary" */
export type Thread_Model_Execution_Summary_Sum_Order_By = {
  failed_runs?: InputMaybe<Order_By>;
  fetched_run_outputs?: InputMaybe<Order_By>;
  ingested_runs?: InputMaybe<Order_By>;
  published_runs?: InputMaybe<Order_By>;
  registered_runs?: InputMaybe<Order_By>;
  submitted_runs?: InputMaybe<Order_By>;
  successful_runs?: InputMaybe<Order_By>;
  total_runs?: InputMaybe<Order_By>;
};

/** update columns of table "thread_model_execution_summary" */
export enum Thread_Model_Execution_Summary_Update_Column {
  /** column name */
  FailedRuns = 'failed_runs',
  /** column name */
  FetchedRunOutputs = 'fetched_run_outputs',
  /** column name */
  IngestedRuns = 'ingested_runs',
  /** column name */
  IngestionTime = 'ingestion_time',
  /** column name */
  PublishedRuns = 'published_runs',
  /** column name */
  PublishingTime = 'publishing_time',
  /** column name */
  RegisteredRuns = 'registered_runs',
  /** column name */
  RegistrationTime = 'registration_time',
  /** column name */
  SubmissionTime = 'submission_time',
  /** column name */
  SubmittedForExecution = 'submitted_for_execution',
  /** column name */
  SubmittedForIngestion = 'submitted_for_ingestion',
  /** column name */
  SubmittedForPublishing = 'submitted_for_publishing',
  /** column name */
  SubmittedForRegistration = 'submitted_for_registration',
  /** column name */
  SubmittedRuns = 'submitted_runs',
  /** column name */
  SuccessfulRuns = 'successful_runs',
  /** column name */
  ThreadModelId = 'thread_model_id',
  /** column name */
  TotalRuns = 'total_runs',
  /** column name */
  WorkflowName = 'workflow_name'
}

export type Thread_Model_Execution_Summary_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Thread_Model_Execution_Summary_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Thread_Model_Execution_Summary_Set_Input>;
  where: Thread_Model_Execution_Summary_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Thread_Model_Execution_Summary_Var_Pop_Fields = {
  __typename?: 'thread_model_execution_summary_var_pop_fields';
  failed_runs?: Maybe<Scalars['Float']['output']>;
  fetched_run_outputs?: Maybe<Scalars['Float']['output']>;
  ingested_runs?: Maybe<Scalars['Float']['output']>;
  published_runs?: Maybe<Scalars['Float']['output']>;
  registered_runs?: Maybe<Scalars['Float']['output']>;
  submitted_runs?: Maybe<Scalars['Float']['output']>;
  successful_runs?: Maybe<Scalars['Float']['output']>;
  total_runs?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "thread_model_execution_summary" */
export type Thread_Model_Execution_Summary_Var_Pop_Order_By = {
  failed_runs?: InputMaybe<Order_By>;
  fetched_run_outputs?: InputMaybe<Order_By>;
  ingested_runs?: InputMaybe<Order_By>;
  published_runs?: InputMaybe<Order_By>;
  registered_runs?: InputMaybe<Order_By>;
  submitted_runs?: InputMaybe<Order_By>;
  successful_runs?: InputMaybe<Order_By>;
  total_runs?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Thread_Model_Execution_Summary_Var_Samp_Fields = {
  __typename?: 'thread_model_execution_summary_var_samp_fields';
  failed_runs?: Maybe<Scalars['Float']['output']>;
  fetched_run_outputs?: Maybe<Scalars['Float']['output']>;
  ingested_runs?: Maybe<Scalars['Float']['output']>;
  published_runs?: Maybe<Scalars['Float']['output']>;
  registered_runs?: Maybe<Scalars['Float']['output']>;
  submitted_runs?: Maybe<Scalars['Float']['output']>;
  successful_runs?: Maybe<Scalars['Float']['output']>;
  total_runs?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "thread_model_execution_summary" */
export type Thread_Model_Execution_Summary_Var_Samp_Order_By = {
  failed_runs?: InputMaybe<Order_By>;
  fetched_run_outputs?: InputMaybe<Order_By>;
  ingested_runs?: InputMaybe<Order_By>;
  published_runs?: InputMaybe<Order_By>;
  registered_runs?: InputMaybe<Order_By>;
  submitted_runs?: InputMaybe<Order_By>;
  successful_runs?: InputMaybe<Order_By>;
  total_runs?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Thread_Model_Execution_Summary_Variance_Fields = {
  __typename?: 'thread_model_execution_summary_variance_fields';
  failed_runs?: Maybe<Scalars['Float']['output']>;
  fetched_run_outputs?: Maybe<Scalars['Float']['output']>;
  ingested_runs?: Maybe<Scalars['Float']['output']>;
  published_runs?: Maybe<Scalars['Float']['output']>;
  registered_runs?: Maybe<Scalars['Float']['output']>;
  submitted_runs?: Maybe<Scalars['Float']['output']>;
  successful_runs?: Maybe<Scalars['Float']['output']>;
  total_runs?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "thread_model_execution_summary" */
export type Thread_Model_Execution_Summary_Variance_Order_By = {
  failed_runs?: InputMaybe<Order_By>;
  fetched_run_outputs?: InputMaybe<Order_By>;
  ingested_runs?: InputMaybe<Order_By>;
  published_runs?: InputMaybe<Order_By>;
  registered_runs?: InputMaybe<Order_By>;
  submitted_runs?: InputMaybe<Order_By>;
  successful_runs?: InputMaybe<Order_By>;
  total_runs?: InputMaybe<Order_By>;
};

/** update columns of table "thread_model_execution" */
export enum Thread_Model_Execution_Update_Column {
  /** column name */
  ExecutionId = 'execution_id',
  /** column name */
  ThreadModelId = 'thread_model_id'
}

export type Thread_Model_Execution_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Thread_Model_Execution_Set_Input>;
  where: Thread_Model_Execution_Bool_Exp;
};

/** input type for inserting data into table "thread_model" */
export type Thread_Model_Insert_Input = {
  data_bindings?: InputMaybe<Thread_Model_Io_Arr_Rel_Insert_Input>;
  execution_summary?: InputMaybe<Thread_Model_Execution_Summary_Arr_Rel_Insert_Input>;
  executions?: InputMaybe<Thread_Model_Execution_Arr_Rel_Insert_Input>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  model?: InputMaybe<Model_Obj_Rel_Insert_Input>;
  model_id?: InputMaybe<Scalars['String']['input']>;
  parameter_bindings?: InputMaybe<Thread_Model_Parameter_Arr_Rel_Insert_Input>;
  thread?: InputMaybe<Thread_Obj_Rel_Insert_Input>;
  thread_id?: InputMaybe<Scalars['String']['input']>;
};

/** columns and relationships of "thread_model_io" */
export type Thread_Model_Io = {
  __typename?: 'thread_model_io';
  /** An object relationship */
  dataslice: Dataslice;
  dataslice_id: Scalars['uuid']['output'];
  /** An object relationship */
  model_io: Model_Io;
  model_io_id: Scalars['String']['output'];
  /** An object relationship */
  thread_model: Thread_Model;
  thread_model_id: Scalars['uuid']['output'];
};

/** aggregated selection of "thread_model_io" */
export type Thread_Model_Io_Aggregate = {
  __typename?: 'thread_model_io_aggregate';
  aggregate?: Maybe<Thread_Model_Io_Aggregate_Fields>;
  nodes: Array<Thread_Model_Io>;
};

/** aggregate fields of "thread_model_io" */
export type Thread_Model_Io_Aggregate_Fields = {
  __typename?: 'thread_model_io_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Thread_Model_Io_Max_Fields>;
  min?: Maybe<Thread_Model_Io_Min_Fields>;
};


/** aggregate fields of "thread_model_io" */
export type Thread_Model_Io_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Thread_Model_Io_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "thread_model_io" */
export type Thread_Model_Io_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Thread_Model_Io_Max_Order_By>;
  min?: InputMaybe<Thread_Model_Io_Min_Order_By>;
};

/** input type for inserting array relation for remote table "thread_model_io" */
export type Thread_Model_Io_Arr_Rel_Insert_Input = {
  data: Array<Thread_Model_Io_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Thread_Model_Io_On_Conflict>;
};

/** Boolean expression to filter rows from the table "thread_model_io". All fields are combined with a logical 'AND'. */
export type Thread_Model_Io_Bool_Exp = {
  _and?: InputMaybe<Array<Thread_Model_Io_Bool_Exp>>;
  _not?: InputMaybe<Thread_Model_Io_Bool_Exp>;
  _or?: InputMaybe<Array<Thread_Model_Io_Bool_Exp>>;
  dataslice?: InputMaybe<Dataslice_Bool_Exp>;
  dataslice_id?: InputMaybe<Uuid_Comparison_Exp>;
  model_io?: InputMaybe<Model_Io_Bool_Exp>;
  model_io_id?: InputMaybe<String_Comparison_Exp>;
  thread_model?: InputMaybe<Thread_Model_Bool_Exp>;
  thread_model_id?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "thread_model_io" */
export enum Thread_Model_Io_Constraint {
  /** unique or primary key constraint on columns "dataslice_id", "thread_model_id", "model_io_id" */
  ThreadModelIoPkey = 'thread_model_io_pkey'
}

/** input type for inserting data into table "thread_model_io" */
export type Thread_Model_Io_Insert_Input = {
  dataslice?: InputMaybe<Dataslice_Obj_Rel_Insert_Input>;
  dataslice_id?: InputMaybe<Scalars['uuid']['input']>;
  model_io?: InputMaybe<Model_Io_Obj_Rel_Insert_Input>;
  model_io_id?: InputMaybe<Scalars['String']['input']>;
  thread_model?: InputMaybe<Thread_Model_Obj_Rel_Insert_Input>;
  thread_model_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate max on columns */
export type Thread_Model_Io_Max_Fields = {
  __typename?: 'thread_model_io_max_fields';
  dataslice_id?: Maybe<Scalars['uuid']['output']>;
  model_io_id?: Maybe<Scalars['String']['output']>;
  thread_model_id?: Maybe<Scalars['uuid']['output']>;
};

/** order by max() on columns of table "thread_model_io" */
export type Thread_Model_Io_Max_Order_By = {
  dataslice_id?: InputMaybe<Order_By>;
  model_io_id?: InputMaybe<Order_By>;
  thread_model_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Thread_Model_Io_Min_Fields = {
  __typename?: 'thread_model_io_min_fields';
  dataslice_id?: Maybe<Scalars['uuid']['output']>;
  model_io_id?: Maybe<Scalars['String']['output']>;
  thread_model_id?: Maybe<Scalars['uuid']['output']>;
};

/** order by min() on columns of table "thread_model_io" */
export type Thread_Model_Io_Min_Order_By = {
  dataslice_id?: InputMaybe<Order_By>;
  model_io_id?: InputMaybe<Order_By>;
  thread_model_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "thread_model_io" */
export type Thread_Model_Io_Mutation_Response = {
  __typename?: 'thread_model_io_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Thread_Model_Io>;
};

/** on_conflict condition type for table "thread_model_io" */
export type Thread_Model_Io_On_Conflict = {
  constraint: Thread_Model_Io_Constraint;
  update_columns?: Array<Thread_Model_Io_Update_Column>;
  where?: InputMaybe<Thread_Model_Io_Bool_Exp>;
};

/** Ordering options when selecting data from "thread_model_io". */
export type Thread_Model_Io_Order_By = {
  dataslice?: InputMaybe<Dataslice_Order_By>;
  dataslice_id?: InputMaybe<Order_By>;
  model_io?: InputMaybe<Model_Io_Order_By>;
  model_io_id?: InputMaybe<Order_By>;
  thread_model?: InputMaybe<Thread_Model_Order_By>;
  thread_model_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: thread_model_io */
export type Thread_Model_Io_Pk_Columns_Input = {
  dataslice_id: Scalars['uuid']['input'];
  model_io_id: Scalars['String']['input'];
  thread_model_id: Scalars['uuid']['input'];
};

/** select columns of table "thread_model_io" */
export enum Thread_Model_Io_Select_Column {
  /** column name */
  DatasliceId = 'dataslice_id',
  /** column name */
  ModelIoId = 'model_io_id',
  /** column name */
  ThreadModelId = 'thread_model_id'
}

/** input type for updating data in table "thread_model_io" */
export type Thread_Model_Io_Set_Input = {
  dataslice_id?: InputMaybe<Scalars['uuid']['input']>;
  model_io_id?: InputMaybe<Scalars['String']['input']>;
  thread_model_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** update columns of table "thread_model_io" */
export enum Thread_Model_Io_Update_Column {
  /** column name */
  DatasliceId = 'dataslice_id',
  /** column name */
  ModelIoId = 'model_io_id',
  /** column name */
  ThreadModelId = 'thread_model_id'
}

export type Thread_Model_Io_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Thread_Model_Io_Set_Input>;
  where: Thread_Model_Io_Bool_Exp;
};

/** aggregate max on columns */
export type Thread_Model_Max_Fields = {
  __typename?: 'thread_model_max_fields';
  id?: Maybe<Scalars['uuid']['output']>;
  model_id?: Maybe<Scalars['String']['output']>;
  thread_id?: Maybe<Scalars['String']['output']>;
};

/** order by max() on columns of table "thread_model" */
export type Thread_Model_Max_Order_By = {
  id?: InputMaybe<Order_By>;
  model_id?: InputMaybe<Order_By>;
  thread_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Thread_Model_Min_Fields = {
  __typename?: 'thread_model_min_fields';
  id?: Maybe<Scalars['uuid']['output']>;
  model_id?: Maybe<Scalars['String']['output']>;
  thread_id?: Maybe<Scalars['String']['output']>;
};

/** order by min() on columns of table "thread_model" */
export type Thread_Model_Min_Order_By = {
  id?: InputMaybe<Order_By>;
  model_id?: InputMaybe<Order_By>;
  thread_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "thread_model" */
export type Thread_Model_Mutation_Response = {
  __typename?: 'thread_model_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Thread_Model>;
};

/** input type for inserting object relation for remote table "thread_model" */
export type Thread_Model_Obj_Rel_Insert_Input = {
  data: Thread_Model_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Thread_Model_On_Conflict>;
};

/** on_conflict condition type for table "thread_model" */
export type Thread_Model_On_Conflict = {
  constraint: Thread_Model_Constraint;
  update_columns?: Array<Thread_Model_Update_Column>;
  where?: InputMaybe<Thread_Model_Bool_Exp>;
};

/** Ordering options when selecting data from "thread_model". */
export type Thread_Model_Order_By = {
  data_bindings_aggregate?: InputMaybe<Thread_Model_Io_Aggregate_Order_By>;
  execution_summary_aggregate?: InputMaybe<Thread_Model_Execution_Summary_Aggregate_Order_By>;
  executions_aggregate?: InputMaybe<Thread_Model_Execution_Aggregate_Order_By>;
  id?: InputMaybe<Order_By>;
  model?: InputMaybe<Model_Order_By>;
  model_id?: InputMaybe<Order_By>;
  parameter_bindings_aggregate?: InputMaybe<Thread_Model_Parameter_Aggregate_Order_By>;
  thread?: InputMaybe<Thread_Order_By>;
  thread_id?: InputMaybe<Order_By>;
};

/** columns and relationships of "thread_model_parameter" */
export type Thread_Model_Parameter = {
  __typename?: 'thread_model_parameter';
  /** An object relationship */
  model_parameter: Model_Parameter;
  model_parameter_id: Scalars['String']['output'];
  parameter_value: Scalars['String']['output'];
  /** An object relationship */
  thread_model: Thread_Model;
  thread_model_id: Scalars['uuid']['output'];
};

/** aggregated selection of "thread_model_parameter" */
export type Thread_Model_Parameter_Aggregate = {
  __typename?: 'thread_model_parameter_aggregate';
  aggregate?: Maybe<Thread_Model_Parameter_Aggregate_Fields>;
  nodes: Array<Thread_Model_Parameter>;
};

/** aggregate fields of "thread_model_parameter" */
export type Thread_Model_Parameter_Aggregate_Fields = {
  __typename?: 'thread_model_parameter_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Thread_Model_Parameter_Max_Fields>;
  min?: Maybe<Thread_Model_Parameter_Min_Fields>;
};


/** aggregate fields of "thread_model_parameter" */
export type Thread_Model_Parameter_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Thread_Model_Parameter_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "thread_model_parameter" */
export type Thread_Model_Parameter_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Thread_Model_Parameter_Max_Order_By>;
  min?: InputMaybe<Thread_Model_Parameter_Min_Order_By>;
};

/** input type for inserting array relation for remote table "thread_model_parameter" */
export type Thread_Model_Parameter_Arr_Rel_Insert_Input = {
  data: Array<Thread_Model_Parameter_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Thread_Model_Parameter_On_Conflict>;
};

/** Boolean expression to filter rows from the table "thread_model_parameter". All fields are combined with a logical 'AND'. */
export type Thread_Model_Parameter_Bool_Exp = {
  _and?: InputMaybe<Array<Thread_Model_Parameter_Bool_Exp>>;
  _not?: InputMaybe<Thread_Model_Parameter_Bool_Exp>;
  _or?: InputMaybe<Array<Thread_Model_Parameter_Bool_Exp>>;
  model_parameter?: InputMaybe<Model_Parameter_Bool_Exp>;
  model_parameter_id?: InputMaybe<String_Comparison_Exp>;
  parameter_value?: InputMaybe<String_Comparison_Exp>;
  thread_model?: InputMaybe<Thread_Model_Bool_Exp>;
  thread_model_id?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "thread_model_parameter" */
export enum Thread_Model_Parameter_Constraint {
  /** unique or primary key constraint on columns "model_parameter_id", "thread_model_id", "parameter_value" */
  ThreadModelParameterPkey = 'thread_model_parameter_pkey'
}

/** input type for inserting data into table "thread_model_parameter" */
export type Thread_Model_Parameter_Insert_Input = {
  model_parameter?: InputMaybe<Model_Parameter_Obj_Rel_Insert_Input>;
  model_parameter_id?: InputMaybe<Scalars['String']['input']>;
  parameter_value?: InputMaybe<Scalars['String']['input']>;
  thread_model?: InputMaybe<Thread_Model_Obj_Rel_Insert_Input>;
  thread_model_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate max on columns */
export type Thread_Model_Parameter_Max_Fields = {
  __typename?: 'thread_model_parameter_max_fields';
  model_parameter_id?: Maybe<Scalars['String']['output']>;
  parameter_value?: Maybe<Scalars['String']['output']>;
  thread_model_id?: Maybe<Scalars['uuid']['output']>;
};

/** order by max() on columns of table "thread_model_parameter" */
export type Thread_Model_Parameter_Max_Order_By = {
  model_parameter_id?: InputMaybe<Order_By>;
  parameter_value?: InputMaybe<Order_By>;
  thread_model_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Thread_Model_Parameter_Min_Fields = {
  __typename?: 'thread_model_parameter_min_fields';
  model_parameter_id?: Maybe<Scalars['String']['output']>;
  parameter_value?: Maybe<Scalars['String']['output']>;
  thread_model_id?: Maybe<Scalars['uuid']['output']>;
};

/** order by min() on columns of table "thread_model_parameter" */
export type Thread_Model_Parameter_Min_Order_By = {
  model_parameter_id?: InputMaybe<Order_By>;
  parameter_value?: InputMaybe<Order_By>;
  thread_model_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "thread_model_parameter" */
export type Thread_Model_Parameter_Mutation_Response = {
  __typename?: 'thread_model_parameter_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Thread_Model_Parameter>;
};

/** on_conflict condition type for table "thread_model_parameter" */
export type Thread_Model_Parameter_On_Conflict = {
  constraint: Thread_Model_Parameter_Constraint;
  update_columns?: Array<Thread_Model_Parameter_Update_Column>;
  where?: InputMaybe<Thread_Model_Parameter_Bool_Exp>;
};

/** Ordering options when selecting data from "thread_model_parameter". */
export type Thread_Model_Parameter_Order_By = {
  model_parameter?: InputMaybe<Model_Parameter_Order_By>;
  model_parameter_id?: InputMaybe<Order_By>;
  parameter_value?: InputMaybe<Order_By>;
  thread_model?: InputMaybe<Thread_Model_Order_By>;
  thread_model_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: thread_model_parameter */
export type Thread_Model_Parameter_Pk_Columns_Input = {
  model_parameter_id: Scalars['String']['input'];
  parameter_value: Scalars['String']['input'];
  thread_model_id: Scalars['uuid']['input'];
};

/** select columns of table "thread_model_parameter" */
export enum Thread_Model_Parameter_Select_Column {
  /** column name */
  ModelParameterId = 'model_parameter_id',
  /** column name */
  ParameterValue = 'parameter_value',
  /** column name */
  ThreadModelId = 'thread_model_id'
}

/** input type for updating data in table "thread_model_parameter" */
export type Thread_Model_Parameter_Set_Input = {
  model_parameter_id?: InputMaybe<Scalars['String']['input']>;
  parameter_value?: InputMaybe<Scalars['String']['input']>;
  thread_model_id?: InputMaybe<Scalars['uuid']['input']>;
};

/** update columns of table "thread_model_parameter" */
export enum Thread_Model_Parameter_Update_Column {
  /** column name */
  ModelParameterId = 'model_parameter_id',
  /** column name */
  ParameterValue = 'parameter_value',
  /** column name */
  ThreadModelId = 'thread_model_id'
}

export type Thread_Model_Parameter_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Thread_Model_Parameter_Set_Input>;
  where: Thread_Model_Parameter_Bool_Exp;
};

/** primary key columns input for table: thread_model */
export type Thread_Model_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "thread_model" */
export enum Thread_Model_Select_Column {
  /** column name */
  Id = 'id',
  /** column name */
  ModelId = 'model_id',
  /** column name */
  ThreadId = 'thread_id'
}

/** input type for updating data in table "thread_model" */
export type Thread_Model_Set_Input = {
  id?: InputMaybe<Scalars['uuid']['input']>;
  model_id?: InputMaybe<Scalars['String']['input']>;
  thread_id?: InputMaybe<Scalars['String']['input']>;
};

/** update columns of table "thread_model" */
export enum Thread_Model_Update_Column {
  /** column name */
  Id = 'id',
  /** column name */
  ModelId = 'model_id',
  /** column name */
  ThreadId = 'thread_id'
}

export type Thread_Model_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Thread_Model_Set_Input>;
  where: Thread_Model_Bool_Exp;
};

/** response of any mutation on the table "thread" */
export type Thread_Mutation_Response = {
  __typename?: 'thread_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Thread>;
};

/** input type for inserting object relation for remote table "thread" */
export type Thread_Obj_Rel_Insert_Input = {
  data: Thread_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Thread_On_Conflict>;
};

/** on_conflict condition type for table "thread" */
export type Thread_On_Conflict = {
  constraint: Thread_Constraint;
  update_columns?: Array<Thread_Update_Column>;
  where?: InputMaybe<Thread_Bool_Exp>;
};

/** Ordering options when selecting data from "thread". */
export type Thread_Order_By = {
  driving_variable?: InputMaybe<Variable_Order_By>;
  driving_variable_id?: InputMaybe<Order_By>;
  end_date?: InputMaybe<Order_By>;
  events_aggregate?: InputMaybe<Thread_Provenance_Aggregate_Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  permissions_aggregate?: InputMaybe<Thread_Permission_Aggregate_Order_By>;
  region?: InputMaybe<Region_Order_By>;
  region_id?: InputMaybe<Order_By>;
  response_variable?: InputMaybe<Variable_Order_By>;
  response_variable_id?: InputMaybe<Order_By>;
  start_date?: InputMaybe<Order_By>;
  task?: InputMaybe<Task_Order_By>;
  task_id?: InputMaybe<Order_By>;
  thread_data_aggregate?: InputMaybe<Thread_Data_Aggregate_Order_By>;
  thread_models_aggregate?: InputMaybe<Thread_Model_Aggregate_Order_By>;
};

/** columns and relationships of "thread_permission" */
export type Thread_Permission = {
  __typename?: 'thread_permission';
  execute: Scalars['Boolean']['output'];
  read: Scalars['Boolean']['output'];
  /** An object relationship */
  thread: Thread;
  thread_id: Scalars['String']['output'];
  user_id: Scalars['String']['output'];
  write: Scalars['Boolean']['output'];
};

/** aggregated selection of "thread_permission" */
export type Thread_Permission_Aggregate = {
  __typename?: 'thread_permission_aggregate';
  aggregate?: Maybe<Thread_Permission_Aggregate_Fields>;
  nodes: Array<Thread_Permission>;
};

/** aggregate fields of "thread_permission" */
export type Thread_Permission_Aggregate_Fields = {
  __typename?: 'thread_permission_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Thread_Permission_Max_Fields>;
  min?: Maybe<Thread_Permission_Min_Fields>;
};


/** aggregate fields of "thread_permission" */
export type Thread_Permission_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Thread_Permission_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "thread_permission" */
export type Thread_Permission_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Thread_Permission_Max_Order_By>;
  min?: InputMaybe<Thread_Permission_Min_Order_By>;
};

/** input type for inserting array relation for remote table "thread_permission" */
export type Thread_Permission_Arr_Rel_Insert_Input = {
  data: Array<Thread_Permission_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Thread_Permission_On_Conflict>;
};

/** Boolean expression to filter rows from the table "thread_permission". All fields are combined with a logical 'AND'. */
export type Thread_Permission_Bool_Exp = {
  _and?: InputMaybe<Array<Thread_Permission_Bool_Exp>>;
  _not?: InputMaybe<Thread_Permission_Bool_Exp>;
  _or?: InputMaybe<Array<Thread_Permission_Bool_Exp>>;
  execute?: InputMaybe<Boolean_Comparison_Exp>;
  read?: InputMaybe<Boolean_Comparison_Exp>;
  thread?: InputMaybe<Thread_Bool_Exp>;
  thread_id?: InputMaybe<String_Comparison_Exp>;
  user_id?: InputMaybe<String_Comparison_Exp>;
  write?: InputMaybe<Boolean_Comparison_Exp>;
};

/** unique or primary key constraints on table "thread_permission" */
export enum Thread_Permission_Constraint {
  /** unique or primary key constraint on columns "user_id", "thread_id" */
  ThreadPermissionPkey = 'thread_permission_pkey'
}

/** input type for inserting data into table "thread_permission" */
export type Thread_Permission_Insert_Input = {
  execute?: InputMaybe<Scalars['Boolean']['input']>;
  read?: InputMaybe<Scalars['Boolean']['input']>;
  thread?: InputMaybe<Thread_Obj_Rel_Insert_Input>;
  thread_id?: InputMaybe<Scalars['String']['input']>;
  user_id?: InputMaybe<Scalars['String']['input']>;
  write?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate max on columns */
export type Thread_Permission_Max_Fields = {
  __typename?: 'thread_permission_max_fields';
  thread_id?: Maybe<Scalars['String']['output']>;
  user_id?: Maybe<Scalars['String']['output']>;
};

/** order by max() on columns of table "thread_permission" */
export type Thread_Permission_Max_Order_By = {
  thread_id?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Thread_Permission_Min_Fields = {
  __typename?: 'thread_permission_min_fields';
  thread_id?: Maybe<Scalars['String']['output']>;
  user_id?: Maybe<Scalars['String']['output']>;
};

/** order by min() on columns of table "thread_permission" */
export type Thread_Permission_Min_Order_By = {
  thread_id?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "thread_permission" */
export type Thread_Permission_Mutation_Response = {
  __typename?: 'thread_permission_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Thread_Permission>;
};

/** on_conflict condition type for table "thread_permission" */
export type Thread_Permission_On_Conflict = {
  constraint: Thread_Permission_Constraint;
  update_columns?: Array<Thread_Permission_Update_Column>;
  where?: InputMaybe<Thread_Permission_Bool_Exp>;
};

/** Ordering options when selecting data from "thread_permission". */
export type Thread_Permission_Order_By = {
  execute?: InputMaybe<Order_By>;
  read?: InputMaybe<Order_By>;
  thread?: InputMaybe<Thread_Order_By>;
  thread_id?: InputMaybe<Order_By>;
  user_id?: InputMaybe<Order_By>;
  write?: InputMaybe<Order_By>;
};

/** primary key columns input for table: thread_permission */
export type Thread_Permission_Pk_Columns_Input = {
  thread_id: Scalars['String']['input'];
  user_id: Scalars['String']['input'];
};

/** select columns of table "thread_permission" */
export enum Thread_Permission_Select_Column {
  /** column name */
  Execute = 'execute',
  /** column name */
  Read = 'read',
  /** column name */
  ThreadId = 'thread_id',
  /** column name */
  UserId = 'user_id',
  /** column name */
  Write = 'write'
}

/** input type for updating data in table "thread_permission" */
export type Thread_Permission_Set_Input = {
  execute?: InputMaybe<Scalars['Boolean']['input']>;
  read?: InputMaybe<Scalars['Boolean']['input']>;
  thread_id?: InputMaybe<Scalars['String']['input']>;
  user_id?: InputMaybe<Scalars['String']['input']>;
  write?: InputMaybe<Scalars['Boolean']['input']>;
};

/** update columns of table "thread_permission" */
export enum Thread_Permission_Update_Column {
  /** column name */
  Execute = 'execute',
  /** column name */
  Read = 'read',
  /** column name */
  ThreadId = 'thread_id',
  /** column name */
  UserId = 'user_id',
  /** column name */
  Write = 'write'
}

export type Thread_Permission_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Thread_Permission_Set_Input>;
  where: Thread_Permission_Bool_Exp;
};

/** primary key columns input for table: thread */
export type Thread_Pk_Columns_Input = {
  id: Scalars['String']['input'];
};

/** columns and relationships of "thread_provenance" */
export type Thread_Provenance = {
  __typename?: 'thread_provenance';
  event: Scalars['thread_events']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  /** An object relationship */
  thread: Thread;
  thread_id: Scalars['String']['output'];
  timestamp: Scalars['timestamptz']['output'];
  userid: Scalars['String']['output'];
};

/** aggregated selection of "thread_provenance" */
export type Thread_Provenance_Aggregate = {
  __typename?: 'thread_provenance_aggregate';
  aggregate?: Maybe<Thread_Provenance_Aggregate_Fields>;
  nodes: Array<Thread_Provenance>;
};

/** aggregate fields of "thread_provenance" */
export type Thread_Provenance_Aggregate_Fields = {
  __typename?: 'thread_provenance_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Thread_Provenance_Max_Fields>;
  min?: Maybe<Thread_Provenance_Min_Fields>;
};


/** aggregate fields of "thread_provenance" */
export type Thread_Provenance_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Thread_Provenance_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "thread_provenance" */
export type Thread_Provenance_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Thread_Provenance_Max_Order_By>;
  min?: InputMaybe<Thread_Provenance_Min_Order_By>;
};

/** input type for inserting array relation for remote table "thread_provenance" */
export type Thread_Provenance_Arr_Rel_Insert_Input = {
  data: Array<Thread_Provenance_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Thread_Provenance_On_Conflict>;
};

/** Boolean expression to filter rows from the table "thread_provenance". All fields are combined with a logical 'AND'. */
export type Thread_Provenance_Bool_Exp = {
  _and?: InputMaybe<Array<Thread_Provenance_Bool_Exp>>;
  _not?: InputMaybe<Thread_Provenance_Bool_Exp>;
  _or?: InputMaybe<Array<Thread_Provenance_Bool_Exp>>;
  event?: InputMaybe<Thread_Events_Comparison_Exp>;
  notes?: InputMaybe<String_Comparison_Exp>;
  thread?: InputMaybe<Thread_Bool_Exp>;
  thread_id?: InputMaybe<String_Comparison_Exp>;
  timestamp?: InputMaybe<Timestamptz_Comparison_Exp>;
  userid?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "thread_provenance" */
export enum Thread_Provenance_Constraint {
  /** unique or primary key constraint on columns "timestamp", "event", "thread_id" */
  ThreadProvenancePkey = 'thread_provenance_pkey'
}

/** input type for inserting data into table "thread_provenance" */
export type Thread_Provenance_Insert_Input = {
  event?: InputMaybe<Scalars['thread_events']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  thread?: InputMaybe<Thread_Obj_Rel_Insert_Input>;
  thread_id?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['timestamptz']['input']>;
  userid?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Thread_Provenance_Max_Fields = {
  __typename?: 'thread_provenance_max_fields';
  event?: Maybe<Scalars['thread_events']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  thread_id?: Maybe<Scalars['String']['output']>;
  timestamp?: Maybe<Scalars['timestamptz']['output']>;
  userid?: Maybe<Scalars['String']['output']>;
};

/** order by max() on columns of table "thread_provenance" */
export type Thread_Provenance_Max_Order_By = {
  event?: InputMaybe<Order_By>;
  notes?: InputMaybe<Order_By>;
  thread_id?: InputMaybe<Order_By>;
  timestamp?: InputMaybe<Order_By>;
  userid?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Thread_Provenance_Min_Fields = {
  __typename?: 'thread_provenance_min_fields';
  event?: Maybe<Scalars['thread_events']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  thread_id?: Maybe<Scalars['String']['output']>;
  timestamp?: Maybe<Scalars['timestamptz']['output']>;
  userid?: Maybe<Scalars['String']['output']>;
};

/** order by min() on columns of table "thread_provenance" */
export type Thread_Provenance_Min_Order_By = {
  event?: InputMaybe<Order_By>;
  notes?: InputMaybe<Order_By>;
  thread_id?: InputMaybe<Order_By>;
  timestamp?: InputMaybe<Order_By>;
  userid?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "thread_provenance" */
export type Thread_Provenance_Mutation_Response = {
  __typename?: 'thread_provenance_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Thread_Provenance>;
};

/** on_conflict condition type for table "thread_provenance" */
export type Thread_Provenance_On_Conflict = {
  constraint: Thread_Provenance_Constraint;
  update_columns?: Array<Thread_Provenance_Update_Column>;
  where?: InputMaybe<Thread_Provenance_Bool_Exp>;
};

/** Ordering options when selecting data from "thread_provenance". */
export type Thread_Provenance_Order_By = {
  event?: InputMaybe<Order_By>;
  notes?: InputMaybe<Order_By>;
  thread?: InputMaybe<Thread_Order_By>;
  thread_id?: InputMaybe<Order_By>;
  timestamp?: InputMaybe<Order_By>;
  userid?: InputMaybe<Order_By>;
};

/** primary key columns input for table: thread_provenance */
export type Thread_Provenance_Pk_Columns_Input = {
  event: Scalars['thread_events']['input'];
  thread_id: Scalars['String']['input'];
  timestamp: Scalars['timestamptz']['input'];
};

/** select columns of table "thread_provenance" */
export enum Thread_Provenance_Select_Column {
  /** column name */
  Event = 'event',
  /** column name */
  Notes = 'notes',
  /** column name */
  ThreadId = 'thread_id',
  /** column name */
  Timestamp = 'timestamp',
  /** column name */
  Userid = 'userid'
}

/** input type for updating data in table "thread_provenance" */
export type Thread_Provenance_Set_Input = {
  event?: InputMaybe<Scalars['thread_events']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  thread_id?: InputMaybe<Scalars['String']['input']>;
  timestamp?: InputMaybe<Scalars['timestamptz']['input']>;
  userid?: InputMaybe<Scalars['String']['input']>;
};

/** update columns of table "thread_provenance" */
export enum Thread_Provenance_Update_Column {
  /** column name */
  Event = 'event',
  /** column name */
  Notes = 'notes',
  /** column name */
  ThreadId = 'thread_id',
  /** column name */
  Timestamp = 'timestamp',
  /** column name */
  Userid = 'userid'
}

export type Thread_Provenance_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Thread_Provenance_Set_Input>;
  where: Thread_Provenance_Bool_Exp;
};

/** select columns of table "thread" */
export enum Thread_Select_Column {
  /** column name */
  DrivingVariableId = 'driving_variable_id',
  /** column name */
  EndDate = 'end_date',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  RegionId = 'region_id',
  /** column name */
  ResponseVariableId = 'response_variable_id',
  /** column name */
  StartDate = 'start_date',
  /** column name */
  TaskId = 'task_id'
}

/** input type for updating data in table "thread" */
export type Thread_Set_Input = {
  driving_variable_id?: InputMaybe<Scalars['String']['input']>;
  end_date?: InputMaybe<Scalars['date']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  region_id?: InputMaybe<Scalars['String']['input']>;
  response_variable_id?: InputMaybe<Scalars['String']['input']>;
  start_date?: InputMaybe<Scalars['date']['input']>;
  task_id?: InputMaybe<Scalars['String']['input']>;
};

/** update columns of table "thread" */
export enum Thread_Update_Column {
  /** column name */
  DrivingVariableId = 'driving_variable_id',
  /** column name */
  EndDate = 'end_date',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  RegionId = 'region_id',
  /** column name */
  ResponseVariableId = 'response_variable_id',
  /** column name */
  StartDate = 'start_date',
  /** column name */
  TaskId = 'task_id'
}

export type Thread_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Thread_Set_Input>;
  where: Thread_Bool_Exp;
};

/** Boolean expression to compare columns of type "timestamp". All fields are combined with logical 'AND'. */
export type Timestamp_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['timestamp']['input']>;
  _gt?: InputMaybe<Scalars['timestamp']['input']>;
  _gte?: InputMaybe<Scalars['timestamp']['input']>;
  _in?: InputMaybe<Array<Scalars['timestamp']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['timestamp']['input']>;
  _lte?: InputMaybe<Scalars['timestamp']['input']>;
  _neq?: InputMaybe<Scalars['timestamp']['input']>;
  _nin?: InputMaybe<Array<Scalars['timestamp']['input']>>;
};

/** Boolean expression to compare columns of type "timestamptz". All fields are combined with logical 'AND'. */
export type Timestamptz_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['timestamptz']['input']>;
  _gt?: InputMaybe<Scalars['timestamptz']['input']>;
  _gte?: InputMaybe<Scalars['timestamptz']['input']>;
  _in?: InputMaybe<Array<Scalars['timestamptz']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['timestamptz']['input']>;
  _lte?: InputMaybe<Scalars['timestamptz']['input']>;
  _neq?: InputMaybe<Scalars['timestamptz']['input']>;
  _nin?: InputMaybe<Array<Scalars['timestamptz']['input']>>;
};

/** Boolean expression to compare columns of type "uuid". All fields are combined with logical 'AND'. */
export type Uuid_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['uuid']['input']>;
  _gt?: InputMaybe<Scalars['uuid']['input']>;
  _gte?: InputMaybe<Scalars['uuid']['input']>;
  _in?: InputMaybe<Array<Scalars['uuid']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['uuid']['input']>;
  _lte?: InputMaybe<Scalars['uuid']['input']>;
  _neq?: InputMaybe<Scalars['uuid']['input']>;
  _nin?: InputMaybe<Array<Scalars['uuid']['input']>>;
};

/** columns and relationships of "variable" */
export type Variable = {
  __typename?: 'variable';
  /** An array relationship */
  categories: Array<Variable_Category>;
  /** An aggregate relationship */
  categories_aggregate: Variable_Category_Aggregate;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  /** An object relationship */
  intervention?: Maybe<Intervention>;
  intervention_id?: Maybe<Scalars['String']['output']>;
  is_adjustment_variable?: Maybe<Scalars['Boolean']['output']>;
  is_indicator?: Maybe<Scalars['Boolean']['output']>;
  /** An array relationship */
  model_ios: Array<Model_Io_Variable>;
  /** An aggregate relationship */
  model_ios_aggregate: Model_Io_Variable_Aggregate;
  name?: Maybe<Scalars['String']['output']>;
  /** An array relationship */
  tasksByDrivingVariable: Array<Task>;
  /** An aggregate relationship */
  tasksByDrivingVariable_aggregate: Task_Aggregate;
  /** An array relationship */
  tasksByResponseVariable: Array<Task>;
  /** An aggregate relationship */
  tasksByResponseVariable_aggregate: Task_Aggregate;
  /** An array relationship */
  threadsByDrivingVariable: Array<Thread>;
  /** An aggregate relationship */
  threadsByDrivingVariable_aggregate: Thread_Aggregate;
  /** An array relationship */
  threadsByResponseVariable: Array<Thread>;
  /** An aggregate relationship */
  threadsByResponseVariable_aggregate: Thread_Aggregate;
  url?: Maybe<Scalars['String']['output']>;
};


/** columns and relationships of "variable" */
export type VariableCategoriesArgs = {
  distinct_on?: InputMaybe<Array<Variable_Category_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Variable_Category_Order_By>>;
  where?: InputMaybe<Variable_Category_Bool_Exp>;
};


/** columns and relationships of "variable" */
export type VariableCategories_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Variable_Category_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Variable_Category_Order_By>>;
  where?: InputMaybe<Variable_Category_Bool_Exp>;
};


/** columns and relationships of "variable" */
export type VariableModel_IosArgs = {
  distinct_on?: InputMaybe<Array<Model_Io_Variable_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Io_Variable_Order_By>>;
  where?: InputMaybe<Model_Io_Variable_Bool_Exp>;
};


/** columns and relationships of "variable" */
export type VariableModel_Ios_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Model_Io_Variable_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Model_Io_Variable_Order_By>>;
  where?: InputMaybe<Model_Io_Variable_Bool_Exp>;
};


/** columns and relationships of "variable" */
export type VariableTasksByDrivingVariableArgs = {
  distinct_on?: InputMaybe<Array<Task_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Task_Order_By>>;
  where?: InputMaybe<Task_Bool_Exp>;
};


/** columns and relationships of "variable" */
export type VariableTasksByDrivingVariable_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Task_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Task_Order_By>>;
  where?: InputMaybe<Task_Bool_Exp>;
};


/** columns and relationships of "variable" */
export type VariableTasksByResponseVariableArgs = {
  distinct_on?: InputMaybe<Array<Task_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Task_Order_By>>;
  where?: InputMaybe<Task_Bool_Exp>;
};


/** columns and relationships of "variable" */
export type VariableTasksByResponseVariable_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Task_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Task_Order_By>>;
  where?: InputMaybe<Task_Bool_Exp>;
};


/** columns and relationships of "variable" */
export type VariableThreadsByDrivingVariableArgs = {
  distinct_on?: InputMaybe<Array<Thread_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Order_By>>;
  where?: InputMaybe<Thread_Bool_Exp>;
};


/** columns and relationships of "variable" */
export type VariableThreadsByDrivingVariable_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Order_By>>;
  where?: InputMaybe<Thread_Bool_Exp>;
};


/** columns and relationships of "variable" */
export type VariableThreadsByResponseVariableArgs = {
  distinct_on?: InputMaybe<Array<Thread_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Order_By>>;
  where?: InputMaybe<Thread_Bool_Exp>;
};


/** columns and relationships of "variable" */
export type VariableThreadsByResponseVariable_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Thread_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Thread_Order_By>>;
  where?: InputMaybe<Thread_Bool_Exp>;
};

/** aggregated selection of "variable" */
export type Variable_Aggregate = {
  __typename?: 'variable_aggregate';
  aggregate?: Maybe<Variable_Aggregate_Fields>;
  nodes: Array<Variable>;
};

/** aggregate fields of "variable" */
export type Variable_Aggregate_Fields = {
  __typename?: 'variable_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Variable_Max_Fields>;
  min?: Maybe<Variable_Min_Fields>;
};


/** aggregate fields of "variable" */
export type Variable_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Variable_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "variable" */
export type Variable_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Variable_Max_Order_By>;
  min?: InputMaybe<Variable_Min_Order_By>;
};

/** input type for inserting array relation for remote table "variable" */
export type Variable_Arr_Rel_Insert_Input = {
  data: Array<Variable_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Variable_On_Conflict>;
};

/** Boolean expression to filter rows from the table "variable". All fields are combined with a logical 'AND'. */
export type Variable_Bool_Exp = {
  _and?: InputMaybe<Array<Variable_Bool_Exp>>;
  _not?: InputMaybe<Variable_Bool_Exp>;
  _or?: InputMaybe<Array<Variable_Bool_Exp>>;
  categories?: InputMaybe<Variable_Category_Bool_Exp>;
  description?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  intervention?: InputMaybe<Intervention_Bool_Exp>;
  intervention_id?: InputMaybe<String_Comparison_Exp>;
  is_adjustment_variable?: InputMaybe<Boolean_Comparison_Exp>;
  is_indicator?: InputMaybe<Boolean_Comparison_Exp>;
  model_ios?: InputMaybe<Model_Io_Variable_Bool_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  tasksByDrivingVariable?: InputMaybe<Task_Bool_Exp>;
  tasksByResponseVariable?: InputMaybe<Task_Bool_Exp>;
  threadsByDrivingVariable?: InputMaybe<Thread_Bool_Exp>;
  threadsByResponseVariable?: InputMaybe<Thread_Bool_Exp>;
  url?: InputMaybe<String_Comparison_Exp>;
};

/** columns and relationships of "variable_category" */
export type Variable_Category = {
  __typename?: 'variable_category';
  category: Scalars['String']['output'];
  /** An object relationship */
  variable: Variable;
  variable_id: Scalars['String']['output'];
};

/** aggregated selection of "variable_category" */
export type Variable_Category_Aggregate = {
  __typename?: 'variable_category_aggregate';
  aggregate?: Maybe<Variable_Category_Aggregate_Fields>;
  nodes: Array<Variable_Category>;
};

/** aggregate fields of "variable_category" */
export type Variable_Category_Aggregate_Fields = {
  __typename?: 'variable_category_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Variable_Category_Max_Fields>;
  min?: Maybe<Variable_Category_Min_Fields>;
};


/** aggregate fields of "variable_category" */
export type Variable_Category_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Variable_Category_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "variable_category" */
export type Variable_Category_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Variable_Category_Max_Order_By>;
  min?: InputMaybe<Variable_Category_Min_Order_By>;
};

/** input type for inserting array relation for remote table "variable_category" */
export type Variable_Category_Arr_Rel_Insert_Input = {
  data: Array<Variable_Category_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Variable_Category_On_Conflict>;
};

/** Boolean expression to filter rows from the table "variable_category". All fields are combined with a logical 'AND'. */
export type Variable_Category_Bool_Exp = {
  _and?: InputMaybe<Array<Variable_Category_Bool_Exp>>;
  _not?: InputMaybe<Variable_Category_Bool_Exp>;
  _or?: InputMaybe<Array<Variable_Category_Bool_Exp>>;
  category?: InputMaybe<String_Comparison_Exp>;
  variable?: InputMaybe<Variable_Bool_Exp>;
  variable_id?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "variable_category" */
export enum Variable_Category_Constraint {
  /** unique or primary key constraint on columns "variable_id", "category" */
  VariableCategoryPkey = 'variable_category_pkey'
}

/** input type for inserting data into table "variable_category" */
export type Variable_Category_Insert_Input = {
  category?: InputMaybe<Scalars['String']['input']>;
  variable?: InputMaybe<Variable_Obj_Rel_Insert_Input>;
  variable_id?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Variable_Category_Max_Fields = {
  __typename?: 'variable_category_max_fields';
  category?: Maybe<Scalars['String']['output']>;
  variable_id?: Maybe<Scalars['String']['output']>;
};

/** order by max() on columns of table "variable_category" */
export type Variable_Category_Max_Order_By = {
  category?: InputMaybe<Order_By>;
  variable_id?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Variable_Category_Min_Fields = {
  __typename?: 'variable_category_min_fields';
  category?: Maybe<Scalars['String']['output']>;
  variable_id?: Maybe<Scalars['String']['output']>;
};

/** order by min() on columns of table "variable_category" */
export type Variable_Category_Min_Order_By = {
  category?: InputMaybe<Order_By>;
  variable_id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "variable_category" */
export type Variable_Category_Mutation_Response = {
  __typename?: 'variable_category_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Variable_Category>;
};

/** on_conflict condition type for table "variable_category" */
export type Variable_Category_On_Conflict = {
  constraint: Variable_Category_Constraint;
  update_columns?: Array<Variable_Category_Update_Column>;
  where?: InputMaybe<Variable_Category_Bool_Exp>;
};

/** Ordering options when selecting data from "variable_category". */
export type Variable_Category_Order_By = {
  category?: InputMaybe<Order_By>;
  variable?: InputMaybe<Variable_Order_By>;
  variable_id?: InputMaybe<Order_By>;
};

/** primary key columns input for table: variable_category */
export type Variable_Category_Pk_Columns_Input = {
  category: Scalars['String']['input'];
  variable_id: Scalars['String']['input'];
};

/** select columns of table "variable_category" */
export enum Variable_Category_Select_Column {
  /** column name */
  Category = 'category',
  /** column name */
  VariableId = 'variable_id'
}

/** input type for updating data in table "variable_category" */
export type Variable_Category_Set_Input = {
  category?: InputMaybe<Scalars['String']['input']>;
  variable_id?: InputMaybe<Scalars['String']['input']>;
};

/** update columns of table "variable_category" */
export enum Variable_Category_Update_Column {
  /** column name */
  Category = 'category',
  /** column name */
  VariableId = 'variable_id'
}

export type Variable_Category_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Variable_Category_Set_Input>;
  where: Variable_Category_Bool_Exp;
};

/** unique or primary key constraints on table "variable" */
export enum Variable_Constraint {
  /** unique or primary key constraint on columns "id" */
  VariablePkey = 'variable_pkey'
}

/** input type for inserting data into table "variable" */
export type Variable_Insert_Input = {
  categories?: InputMaybe<Variable_Category_Arr_Rel_Insert_Input>;
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  intervention?: InputMaybe<Intervention_Obj_Rel_Insert_Input>;
  intervention_id?: InputMaybe<Scalars['String']['input']>;
  is_adjustment_variable?: InputMaybe<Scalars['Boolean']['input']>;
  is_indicator?: InputMaybe<Scalars['Boolean']['input']>;
  model_ios?: InputMaybe<Model_Io_Variable_Arr_Rel_Insert_Input>;
  name?: InputMaybe<Scalars['String']['input']>;
  tasksByDrivingVariable?: InputMaybe<Task_Arr_Rel_Insert_Input>;
  tasksByResponseVariable?: InputMaybe<Task_Arr_Rel_Insert_Input>;
  threadsByDrivingVariable?: InputMaybe<Thread_Arr_Rel_Insert_Input>;
  threadsByResponseVariable?: InputMaybe<Thread_Arr_Rel_Insert_Input>;
  url?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type Variable_Max_Fields = {
  __typename?: 'variable_max_fields';
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  intervention_id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  url?: Maybe<Scalars['String']['output']>;
};

/** order by max() on columns of table "variable" */
export type Variable_Max_Order_By = {
  description?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  intervention_id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  url?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Variable_Min_Fields = {
  __typename?: 'variable_min_fields';
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  intervention_id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  url?: Maybe<Scalars['String']['output']>;
};

/** order by min() on columns of table "variable" */
export type Variable_Min_Order_By = {
  description?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  intervention_id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  url?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "variable" */
export type Variable_Mutation_Response = {
  __typename?: 'variable_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Variable>;
};

/** input type for inserting object relation for remote table "variable" */
export type Variable_Obj_Rel_Insert_Input = {
  data: Variable_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Variable_On_Conflict>;
};

/** on_conflict condition type for table "variable" */
export type Variable_On_Conflict = {
  constraint: Variable_Constraint;
  update_columns?: Array<Variable_Update_Column>;
  where?: InputMaybe<Variable_Bool_Exp>;
};

/** Ordering options when selecting data from "variable". */
export type Variable_Order_By = {
  categories_aggregate?: InputMaybe<Variable_Category_Aggregate_Order_By>;
  description?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  intervention?: InputMaybe<Intervention_Order_By>;
  intervention_id?: InputMaybe<Order_By>;
  is_adjustment_variable?: InputMaybe<Order_By>;
  is_indicator?: InputMaybe<Order_By>;
  model_ios_aggregate?: InputMaybe<Model_Io_Variable_Aggregate_Order_By>;
  name?: InputMaybe<Order_By>;
  tasksByDrivingVariable_aggregate?: InputMaybe<Task_Aggregate_Order_By>;
  tasksByResponseVariable_aggregate?: InputMaybe<Task_Aggregate_Order_By>;
  threadsByDrivingVariable_aggregate?: InputMaybe<Thread_Aggregate_Order_By>;
  threadsByResponseVariable_aggregate?: InputMaybe<Thread_Aggregate_Order_By>;
  url?: InputMaybe<Order_By>;
};

/** primary key columns input for table: variable */
export type Variable_Pk_Columns_Input = {
  id: Scalars['String']['input'];
};

/** select columns of table "variable" */
export enum Variable_Select_Column {
  /** column name */
  Description = 'description',
  /** column name */
  Id = 'id',
  /** column name */
  InterventionId = 'intervention_id',
  /** column name */
  IsAdjustmentVariable = 'is_adjustment_variable',
  /** column name */
  IsIndicator = 'is_indicator',
  /** column name */
  Name = 'name',
  /** column name */
  Url = 'url'
}

/** input type for updating data in table "variable" */
export type Variable_Set_Input = {
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  intervention_id?: InputMaybe<Scalars['String']['input']>;
  is_adjustment_variable?: InputMaybe<Scalars['Boolean']['input']>;
  is_indicator?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  url?: InputMaybe<Scalars['String']['input']>;
};

/** update columns of table "variable" */
export enum Variable_Update_Column {
  /** column name */
  Description = 'description',
  /** column name */
  Id = 'id',
  /** column name */
  InterventionId = 'intervention_id',
  /** column name */
  IsAdjustmentVariable = 'is_adjustment_variable',
  /** column name */
  IsIndicator = 'is_indicator',
  /** column name */
  Name = 'name',
  /** column name */
  Url = 'url'
}

export type Variable_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Variable_Set_Input>;
  where: Variable_Bool_Exp;
};
