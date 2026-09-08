import { Navigate, useParams } from 'react-router-dom';

/**
 * `/regions/:id` has no page of its own -- a region is shown through its models
 * or its datasets. Redirect rather than 404, so a link that stops at the region
 * still lands somewhere useful.
 *
 * The landing-page map used to navigate here, which is how every region click
 * ended up on `NotFoundPage`.
 */
export function RegionRedirect() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/regions" replace />;
  return <Navigate to={`/regions/${encodeURIComponent(id)}/models`} replace />;
}
