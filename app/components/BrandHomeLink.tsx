import Image from "next/image";
import { publicPath } from "../lib/public-path";

interface BrandHomeLinkProps {
  className?: string;
  title?: string;
  subtitle?: string;
  markOnly?: boolean;
}

/**
 * The single React brand/home primitive.
 *
 * The visible mark always comes from the official blue/green MINI硅谷
 * wordmark.  favicon.svg remains browser metadata only and must never be used
 * as an in-page brand substitute.  The navigation target is deliberately the
 * site root—not the current sub-application. Keeping this an ordinary anchor
 * preserves keyboard navigation and still works without client-side JavaScript.
 */
export function BrandHomeLink({
  className,
  title,
  subtitle,
  markOnly = false,
}: BrandHomeLinkProps) {
  return (
    // This intentionally remains a native anchor: the site root spans several
    // independently deployed surfaces, so client-side router interception is
    // both unnecessary and less reliable than an ordinary document navigation.
    <a
      className={["msv-brand-home", markOnly ? "msv-brand-home--mark" : "", className ?? ""].filter(Boolean).join(" ")}
      href={publicPath("/")}
      aria-label="返回 Mini Silicon Valley 主页"
    >
      <Image
        className="msv-brand-home__mark"
        src={publicPath("/assets/mini-silicon-valley-logo-transparent.png")}
        width={330}
        height={84}
        alt=""
        aria-hidden="true"
        unoptimized
        priority
      />
      {!markOnly && (title || subtitle) && (
        <span className="msv-brand-home__copy">
          {title ? <strong>{title}</strong> : null}
          {subtitle ? <small>{subtitle}</small> : null}
        </span>
      )}
    </a>
  );
}
