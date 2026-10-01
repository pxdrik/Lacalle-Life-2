"use client";

import { useCallback, useEffect, useState } from "react";

import { useCareRepository } from "../data/care-repository-context";
import type { PatientLink, PendingInvite } from "../types/care";

export type PatientsState =
  | { readonly status: "loading" }
  | { readonly status: "error" }
  | { readonly status: "ready"; readonly links: readonly PatientLink[]; readonly invites: readonly PendingInvite[] };

/** Os pacientes e os convites esperando, da profissional logada. */
export function usePatients() {
  const care = useCareRepository();
  const [state, setState] = useState<PatientsState>({ status: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    care
      .listMyPatients()
      .then(({ links, invites }) => {
        if (active) setState({ status: "ready", links, invites });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, [care, version]);

  const reload = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  return {
    state,
    reload,
    createInvite: async (label: string) => {
      const created = await care.createInvite(label);
      reload();
      return created;
    },
    cancelInvite: async (id: string) => {
      await care.cancelInvite(id);
      reload();
    },
    endLink: async (id: string) => {
      await care.endLink(id);
      reload();
    },
  };
}
