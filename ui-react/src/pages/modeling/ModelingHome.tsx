import { Navigate, useLocation } from 'react-router-dom';

/**
 * ModelingHome — router shell for the modeling workflow.
 *
 * /modeling              -> redirect to /modeling/problem-statements
 * /modeling/problem-statements  -> ProblemStatementsList
 * /modeling/problem-statement/:id -> MintProblemStatement
 *
 * This component just redirects /modeling to the list view; the actual routes
 * are defined in App.tsx.
 */
export function ModelingHome() {
  const location = useLocation();

  // Exact /modeling -> redirect to the list
  if (location.pathname === '/modeling') {
    return <Navigate to="/modeling/problem-statements" replace />;
  }

  // Shouldn't reach here normally (sub-routes are handled in App.tsx)
  return null;
}
