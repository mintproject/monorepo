import { ArrowRight, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useListRecentProblemStatementActivityQuery } from '@/graphql/generated/modeling';
import { useAuth } from '@/lib/auth/useAuth';
import { pickRecentProblemStatements } from '@/lib/modeling/recent-problem-statements';

/**
 * How many provenance rows to pull. Every edit to a problem statement writes
 * one, so the feed needs enough depth to hold more than one statement.
 *
 * Exported so test mocks bind to the same number the query sends.
 */
export const ACTIVITY_ROWS = 40;

interface Step {
  title: string;
  detail: string;
}

/**
 * The modeling workflow, in the order the app walks a user through it. The
 * numbering is real: each step cannot start before the one before it.
 */
const STEPS: Step[] = [
  { title: 'Frame the problem', detail: 'A question, a region, a time period' },
  { title: 'Break it into tasks', detail: 'Hydrology, then crop yield' },
  { title: 'Set up a thread', detail: 'Choose models, data, parameters' },
  { title: 'Compare results', detail: 'Runs side by side, ready to report' },
];

/**
 * The Decide lane of the landing page.
 *
 * Exploring the catalog is what people do; deciding something is what MINT is
 * for, so this panel carries the page's only accent. When the user is signed
 * in it also offers the problem statements they touched most recently.
 */
export function DecidePanel() {
  const { isAuthenticated, user } = useAuth();

  return (
    <section aria-labelledby="decide-heading" className="space-y-3">
      <div className="flex items-baseline gap-3 border-b pb-2">
        <span className="text-xs font-semibold text-muted-foreground">B</span>
        <h2 id="decide-heading" className="text-sm font-bold">
          Answer a question with models
        </h2>
        <span className="ml-auto text-xs text-muted-foreground">Sign-in required</span>
      </div>

      <div className="grid gap-6 rounded-lg border border-l-[3px] border-l-primary bg-accent/30 p-5 md:grid-cols-[1fr_260px]">
        <div>
          <h3 className="text-base font-bold">Turn a decision into a modeling thread</h3>
          <p className="mt-1 max-w-[52ch] text-sm text-muted-foreground">
            State the question you need answered. MINT breaks it into tasks, suggests the models
            that can answer each one, wires up the data, runs them, and lays the results side by
            side.
          </p>

          <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                  Step {index + 1}
                </span>
                <span className="text-xs font-semibold leading-tight">{step.title}</span>
                <span className="text-[11px] leading-snug text-muted-foreground">
                  {step.detail}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col justify-center gap-2">
          {isAuthenticated && <RecentProblemStatements userid={user?.username ?? ''} />}

          <Button asChild>
            <Link to="/modeling/problem-statements">
              <Plus className="mr-2 h-4 w-4" />
              {isAuthenticated ? 'Start a new problem statement' : 'Start a problem statement'}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/modeling/problem-statements">Browse problem statements</Link>
          </Button>
          <p className="text-center text-[11px] leading-snug text-muted-foreground">
            {isAuthenticated
              ? 'Your team sees every problem statement you create.'
              : 'You will be asked to sign in first.'}
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * The user's most recent problem statements.
 *
 * `userid` is the username, matching what `ProblemStatementsList` writes into
 * the provenance rows -- not the OAuth subject.
 *
 * This is a convenience, never a dependency: when the query is unavailable,
 * errors, or comes back empty, the block renders nothing and the panel's own
 * call to action still stands.
 */
function RecentProblemStatements({ userid }: { userid: string }) {
  const { data } = useListRecentProblemStatementActivityQuery({
    variables: { userid, limit: ACTIVITY_ROWS },
    skip: !userid,
    errorPolicy: 'all',
    fetchPolicy: 'cache-first',
  });

  const recent = pickRecentProblemStatements(data?.problem_statement_provenance ?? []);
  if (recent.length === 0) return null;

  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Continue where you left off
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {recent.map((statement) => (
          <li key={statement.id}>
            <Link
              to={`/modeling/problem-statement/${encodeURIComponent(statement.id)}`}
              className="flex items-start gap-1 text-xs font-medium leading-snug hover:text-primary hover:underline"
            >
              <span className="flex-1">{statement.name}</span>
              <ArrowRight className="mt-0.5 h-3 w-3 flex-none text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
