"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Services } from "@/contracts";
import { services as defaultServices } from "./index";

const ServicesContext = createContext<Services>(defaultServices);

/** Gives the UI its assistant, voice, action and permission services. Tests pass their own. */
export function ServicesProvider({
  children,
  services = defaultServices,
}: {
  children: ReactNode;
  services?: Services;
}) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  return useContext(ServicesContext);
}
