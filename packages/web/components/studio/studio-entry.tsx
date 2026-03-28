"use client";

import { useMemo, useSyncExternalStore } from "react";

import { createDefaultStudioHost } from "@/components/studio/backend";
import { LocalStudioApp } from "@/components/studio/local-studio-app";
import type { StudioBootContext } from "@/components/studio/studio-boot";

type StudioEntryProps = {
  bootContext: StudioBootContext;
};

const subscribeToClient = (): (() => void) => () => {};
const getClientSnapshot = (): boolean => true;
const getServerSnapshot = (): boolean => false;

export function StudioEntry({ bootContext }: StudioEntryProps) {
  const host = useMemo(() => createDefaultStudioHost(), []);
  const mounted = useSyncExternalStore(
    subscribeToClient,
    getClientSnapshot,
    getServerSnapshot,
  );

  if (!mounted) {
    return <div className="min-h-dvh bg-fd-background text-fd-foreground" />;
  }

  return <LocalStudioApp bootContext={bootContext} host={host} />;
}
