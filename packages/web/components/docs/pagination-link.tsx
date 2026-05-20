"use client";

import type { ComponentProps } from "react";
import Link from "next/link";

import { shouldScrollPaginationLink } from "@/components/docs/pagination-link-click";

export function DocsPaginationLink({
  onClick,
  scroll = false,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      scroll={scroll}
      onClick={(event) => {
        onClick?.(event);

        if (!shouldScrollPaginationLink(event)) {
          return;
        }

        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        window.setTimeout(() => {
          window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        }, 0);
      }}
    />
  );
}
