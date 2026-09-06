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
 * The mark always comes from public/favicon.svg and the navigation target is
 * deliberately the site root—not the current sub-application.  Keeping this
 * an ordinary anchor preserves keyboard navigation and still works without
 * client-side JavaScript.
 */
export function BrandHomeLink({
  className,
  title = "MINI SILICON VALLEY",
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
        src={publicPath("/favicon.svg")}
        width={64}
        height={64}
        alt=""
        aria-hidden="true"
        unoptimized
        priority
      />
      {!markOnly && (
        <span className="msv-brand-home__copy">
          <strong>{title}</strong>
          {subtitle ? <small>{subtitle}</small> : null}
        </span>
      )}
    </a>
  );
}
