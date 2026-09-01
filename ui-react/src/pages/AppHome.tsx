import { DecidePanel } from '@/components/home/DecidePanel';
import { ExploreCard } from '@/components/home/ExploreCard';
import { EXPLORE_DESTINATIONS } from '@/components/home/explore-destinations';
import { useAuth } from '@/lib/auth/useAuth';

/**
 * Questions MINT exists to answer, in the words an analyst would use. They set
 * the scope of the tool faster than a paragraph about it can.
 */
const STARTER_QUESTIONS = [
  'Will the harvest fall if the rains are late?',
  'How far will the flood reach?',
  'How much water is left downstream?',
];

function getWelcomeMessage(): string {
  return (
    window.__MINT_CONFIG__?.WELCOME_MESSAGE ??
    import.meta.env.VITE_WELCOME_MESSAGE ??
    'Welcome to MINT Model Catalog'
  );
}

/**
 * The landing page: two lanes, matching the Explore / Decide split the sidebar
 * already uses.
 *
 * A visitor arrives with one of two intents -- look something up, or answer a
 * question -- so the page asks which, rather than opening on a world map whose
 * region choice means nothing yet. The map moved to `/regions`, where it reads
 * as a filter.
 */
export function AppHome() {
  const { isAuthenticated, user } = useAuth();
  const welcomeMessage = getWelcomeMessage();

  return (
    <div className="content-page space-y-8 py-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {welcomeMessage}
        </p>
        <h1 className="text-2xl font-black tracking-tight">
          {isAuthenticated && user?.username
            ? `Welcome back, ${user.username}`
            : 'What do you want to do?'}
        </h1>
        <p className="max-w-[62ch] text-sm text-muted-foreground">
          MINT connects simulation models to data so you can test what happens under different
          weather and climate conditions — crop yields under low rainfall, flood extent after a
          storm, water available downstream.
        </p>
      </header>

      <section aria-labelledby="explore-heading" className="space-y-3">
        <div className="flex items-baseline gap-3 border-b pb-2">
          <span className="text-xs font-semibold text-muted-foreground">A</span>
          <h2 id="explore-heading" className="text-sm font-bold">
            Explore what is in MINT
          </h2>
          <span className="ml-auto text-xs text-muted-foreground">
            Open to everyone, no sign-in
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {EXPLORE_DESTINATIONS.map((destination) => (
            <ExploreCard key={destination.href} destination={destination} />
          ))}
        </div>
      </section>

      <DecidePanel />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Questions MINT is built for:</span>
        {STARTER_QUESTIONS.map((question) => (
          <span
            key={question}
            className="rounded-full border bg-muted/60 px-3 py-1 text-xs text-muted-foreground"
          >
            {question}
          </span>
        ))}
      </div>
    </div>
  );
}
