import { Signature } from "@/design-system/brand/signature";

export function LandingFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-(--content-max) flex-col items-center gap-3 px-4 py-10 text-center md:px-6 lg:px-12">
        <Signature height={18} />
        <p className="text-xs text-ink-subtle">
          © {new Date().getFullYear()} LaCalle Life
        </p>
      </div>
    </footer>
  );
}
