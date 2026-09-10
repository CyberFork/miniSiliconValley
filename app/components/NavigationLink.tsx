"use client";

import { type ComponentPropsWithoutRef, useEffect, useRef, useState } from "react";

/**
 * Reliable full-document navigation for the self-hosted Vinext application.
 *
 * Core workflow links deliberately remain native anchors: an RSC hydration or
 * client-router failure must not make a normal click inert while Ctrl/Cmd-click
 * still works. Browser modifiers, context menus and no-JavaScript navigation
 * retain their native behaviour. The temporary pending label is presentation
 * only and is cleared by bfcache restoration or a bounded retry timeout.
 */
type NavigationLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href"> & { href: string };

export function NavigationLink({ children, href, onClick, ...props }: NavigationLinkProps) {
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const restore = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      setPending(false);
    };
    window.addEventListener("pageshow", restore);
    return () => {
      window.removeEventListener("pageshow", restore);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return <a {...props} href={href} aria-busy={pending || undefined} onClick={(event) => {
    onClick?.(event);
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
      && (!props.target || props.target === "_self") && !props.download) {
      setPending(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        setPending(false);
      }, 8_000);
    }
    // Never preventDefault: ordinary click, Enter, touch, open-in-new-tab and
    // no-JavaScript navigation must all use the browser's normal URL contract.
  }}>{pending ? "正在打开…" : children}</a>;
}

export default NavigationLink;
