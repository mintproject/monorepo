import { Link } from 'react-router-dom';

import { EXPLORE_DESTINATIONS } from '@/components/home/explore-destinations';

/**
 * About DYNAMO.
 *
 * The four descriptive paragraphs are carried over verbatim from the landing
 * page, which used to open with them. They describe what DYNAMO is and who it
 * is for -- worth keeping, but not worth putting in front of someone who came
 * to run a model.
 *
 * The landing page also carried a "Getting Started" card. Its instructions were
 * stale -- it named a top menu the app does not have, and a main-region control
 * in the top right that does not exist -- so "Finding your way around" below
 * describes the navigation the app actually has instead of reproducing them.
 */
export function AboutPage() {
  return (
    <div className="content-page space-y-8 py-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          About
        </p>
        <h1 className="text-2xl font-black tracking-tight">What DYNAMO is for</h1>
      </header>

      <section aria-labelledby="what-it-does" className="space-y-4">
        <h2 id="what-it-does" className="sr-only">
          What DYNAMO does
        </h2>
        <div className="max-w-[68ch] space-y-4 text-sm leading-relaxed text-foreground">
          <p>
            <strong>DYNAMO</strong> helps analysts seamlessly use advanced simulation models and
            data to explore the impact of weather and climate on water and food availability in
            selected regions around the world. For instance, an analyst can use DYNAMO to assess
            expected crop yields under different rainfall scenarios, accounting for their effects on
            flooding and drought.
          </p>
          <p>
            <strong>DYNAMO</strong>&apos;s simulation models are quantitative and embed deep
            subject-matter expertise. For example, a hydrology model incorporates physical laws that
            govern how water moves through a river basin. It uses data on terrain elevation and soil
            types to estimate how much water is absorbed into the ground and how it flows across
            land surfaces.
          </p>
          <p>
            Throughout the process, <strong>DYNAMO</strong> offers guidance to reduce the time and
            effort needed to build integrated models—while maintaining both their accuracy and
            practical value.
          </p>
          <p>
            Recognizing that analysts bring different expertise and may work with diverse models,{' '}
            <strong>DYNAMO</strong> supports individual user accounts. Each analyst&apos;s actions
            are tracked under their username, while all users share a unified interface. This means
            that when one analyst completes a task, the results are immediately accessible to the
            entire team.
          </p>
        </div>
      </section>

      <section aria-labelledby="finding-your-way" className="space-y-3">
        <div className="border-b pb-2">
          <h2 id="finding-your-way" className="text-sm font-bold">
            Finding your way around
          </h2>
        </div>

        <p className="max-w-[68ch] text-sm text-muted-foreground">
          The sidebar splits into two groups, and so does the home page.
        </p>

        <div className="max-w-[68ch] space-y-4 text-sm leading-relaxed">
          <div>
            <h3 className="font-semibold">Explore</h3>
            <p className="text-muted-foreground">
              Four ways into the same catalog. Start wherever you already know something.
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
              {EXPLORE_DESTINATIONS.map((destination) => (
                <li key={destination.href}>
                  <Link to={destination.href} className="font-medium text-foreground underline">
                    {destination.title}
                  </Link>{' '}
                  — {destination.description}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold">Decide</h3>
            <p className="text-muted-foreground">
              A{' '}
              <Link
                to="/modeling/problem-statements"
                className="font-medium text-foreground underline"
              >
                problem statement
              </Link>{' '}
              frames the question you need answered, for one region over one period. It breaks into
              tasks, each task into threads, and a thread is where you choose the models and data,
              run them, and compare the results. This part needs an account, so that everyone on the
              team sees the same work.
            </p>
          </div>
        </div>
      </section>

      <p className="text-sm">
        <Link to="/" className="font-medium underline">
          Back to the home page
        </Link>
      </p>
    </div>
  );
}
