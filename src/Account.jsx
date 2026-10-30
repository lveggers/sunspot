"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { readProfile, saveProfile } from "./profile.js";

const Context = createContext(null);
const blank = { name: "", photo: null, activity: "" };
export function AccountProvider({ children }) {
  // Account profiles stay in memory. Signing out never leaves someone else's
  // Google name/photo in the anonymous profile on a shared device.
  const [account, setAccount] = useState({
    loading: true,
    user: null,
    profile: blank,
    enabled: false,
  });
  const generation = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      if (document.hidden) return;
      const version = ++generation.current;
      fetch("/api/account", {
        cache: "no-store",
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(10000),
        ]),
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw Error(data.error);
          if (controller.signal.aborted || version !== generation.current)
            return;
          setAccount({
            ...data,
            profile: data.profile || readProfile(),
            loading: false,
          });
        })
        .catch((error) => {
          if (!controller.signal.aborted && version === generation.current)
            setAccount({
              loading: false,
              user: null,
              profile: readProfile(),
              enabled: false,
              error: error.message,
            });
        });
    };
    refresh();
    document.addEventListener("visibilitychange", refresh);
    const localChanged = () =>
      setAccount((a) => (a.user ? a : { ...a, profile: readProfile() }));
    window.addEventListener("sunspot-profile", localChanged);
    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("sunspot-profile", localChanged);
    };
  }, []);
  async function save(profile) {
    const version = ++generation.current;
    if (!account.user) {
      if (account.error)
        throw Error("Profilen kunde inte hämtas. Försök igen.");
      const saved = saveProfile(profile);
      setAccount((a) => ({ ...a, profile: saved }));
      return saved;
    }
    const response = await fetch("/api/account", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...profile, expectedUserId: account.user.id }),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error);
    if (version === generation.current) setAccount({ ...data, loading: false });
    return data.profile;
  }
  return (
    <Context.Provider value={{ ...account, save }}>{children}</Context.Provider>
  );
}
export function useAccount() {
  return useContext(Context);
}
