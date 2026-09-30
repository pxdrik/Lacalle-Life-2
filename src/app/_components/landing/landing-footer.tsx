import Link from "next/link";

import { Signature } from "@/design-system/brand/signature";

import { LEGAL_LINKS } from "../legal/legal-links";

export function LandingFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-(--content-max) flex-col items-center gap-3 px-4 py-10 text-center md:px-6 lg:px-12">
        <Signature height={18} />
        {/* Os três documentos, públicos, antes de qualquer cadastro (roadmap 8.4). */}
        <nav aria-label="Documentos legais">
          <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-ink-muted underline underline-offset-4 hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="text-xs text-ink-subtle">
          © {new Date().getFullYear()} LaCalle Life
        </p>
      </div>
    </footer>
  );
}
