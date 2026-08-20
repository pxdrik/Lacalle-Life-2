"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";

import { DENSITY_ATTRIBUTE, type Density } from "./density";
import {
  getDensity,
  getServerDensity,
  setDensity,
  subscribeToDensity,
} from "./density-store";

interface DensityContextValue {
  readonly density: Density;
  readonly setDensity: (density: Density) => void;
}

const DensityContext = createContext<DensityContextValue | null>(null);

export function DensityProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const density = useSyncExternalStore(
    subscribeToDensity,
    getDensity,
    getServerDensity,
  );

  /**
   * The one legitimate effect here: pushing React's state out to the
   * document, which is an external system. `<html>` already carries the
   * right value from the pre-hydration script, so on first mount this
   * writes what is already there.
   */
  useEffect(() => {
    document.documentElement.setAttribute(DENSITY_ATTRIBUTE, density);
  }, [density]);

  return (
    <DensityContext value={{ density, setDensity }}>
      {children}
    </DensityContext>
  );
}

export function useDensity(): DensityContextValue {
  const value = useContext(DensityContext);
  if (value === null) {
    throw new Error("useDensity must be used within a DensityProvider.");
  }
  return value;
}
