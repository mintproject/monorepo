/**
 * The chrome footer: "Powered by MINT", right aligned on the dark bar, 50px
 * tall. Pinned to the bottom of the viewport by {@link AppShell}, as a sibling
 * of the content row, so the scroll container is unchanged.
 *
 * Unbranded, unlike {@link BrandingStrip} — this is MINT's own credit, and it
 * shows for every deployment.
 */
export function Footer() {
  return (
    <footer className="mint-chrome flex h-[50px] shrink-0 items-center justify-end bg-[color:var(--mint-chrome-bg)] px-6 font-[family-name:var(--mint-chrome-font)] text-[13px] text-[color:var(--mint-chrome-muted)]">
      Powered by
      <a
        href="http://mint-project.info/index.html"
        target="_blank"
        rel="noreferrer"
        className="ml-[.2rem] hover:underline"
      >
        MINT
      </a>
    </footer>
  );
}
