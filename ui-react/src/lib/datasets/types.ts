/**
 * Data Catalog domain types.
 * These mirror the shape of the data returned by the MINT Data Catalog REST API.
 */

export interface DatasetSource {
  name: string;
  url: string;
  type: string;
}

export interface DateRange {
  start_date: Date | null;
  end_date: Date | null;
}

export interface SpatialCoverage {
  type: string;
  value?: {
    x?: number;
    y?: number;
    xmin?: number;
    xmax?: number;
    ymin?: number;
    ymax?: number;
  };
  coordinates?: number[][];
}

export interface DataResource {
  id: string;
  name: string;
  url: string;
  time_period?: DateRange;
  spatial_coverage?: SpatialCoverage;
  selected?: boolean;
}

export interface Dataset {
  id: string;
  name: string;
  region: string;
  variables: string[];
  datatype: string;
  time_period: DateRange | null;
  description: string;
  version: string;
  limitations: string;
  source: DatasetSource;
  categories?: string[];
  is_cached?: boolean;
  resource_repr?: unknown;
  dataset_repr?: unknown;
  resources: DataResource[];
  resources_loaded?: boolean;
  resource_count?: number;
  spatial_coverage?: SpatialCoverage;
}

export interface DataTransformation {
  id: string;
  label?: string;
  description?: string;
  type?: string;
}

/** Query parameter shape for the data catalog search endpoint. */
export interface DatasetQueryParameters {
  name?: string;
  variables?: string[];
  spatialCoverage?: {
    xmin: number;
    xmax: number;
    ymin: number;
    ymax: number;
  };
  dateRange?: DateRange;
}
