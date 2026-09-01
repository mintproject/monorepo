import { Database, FlaskConical, Map, Variable } from 'lucide-react';

/** Stable identity for a destination, used to attach its catalog count. */
export type ExploreKey = 'models' | 'datasets' | 'regions' | 'variables';

export interface ExploreDestination {
  key: ExploreKey;
  /** Route the whole card links to. */
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  /** One sentence, in the words a scientist would use. */
  description: string;
  /** The verb on the card's link, phrased as the action it performs. */
  action: string;
}

/**
 * The four ways into the catalog, in the order the landing page shows them.
 *
 * They are deliberately equal in weight: someone who knows the variable but not
 * the model is not a second-class visitor. The order matches the Explore group
 * in the sidebar, so the landing page and the nav teach the same thing.
 */
export const EXPLORE_DESTINATIONS: ExploreDestination[] = [
  {
    key: 'models',
    href: '/models',
    icon: FlaskConical,
    title: 'Models',
    description:
      'Simulation models and the configurations that are ready to run. Filter by category, region or output variable.',
    action: 'Browse models',
  },
  {
    key: 'datasets',
    href: '/datasets/search',
    icon: Database,
    title: 'Datasets',
    description:
      'Observed and derived data in the catalog. Search by variable, or narrow to a region and a time range.',
    action: 'Search datasets',
  },
  {
    key: 'regions',
    href: '/regions',
    icon: Map,
    title: 'Regions',
    description:
      'River basins, administrative areas and agricultural zones — and the models and data attached to each one.',
    action: 'Pick a region on the map',
  },
  {
    key: 'variables',
    href: '/variables',
    icon: Variable,
    title: 'Variables',
    description:
      'The standard variables and units that let a model read a dataset. Start here when you know the quantity, not the model.',
    action: 'Browse variables',
  },
];
