"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  User,
  UserManager,
  WebStorageStateStore,
  type UserManagerSettings,
} from "oidc-client-ts";

const authority =
  process.env.NEXT_PUBLIC_OIDC_ISSUER ??
  "https://auth.k8s.749rmw.com/application/o/dynasty-ff/";
const clientId =
  process.env.NEXT_PUBLIC_OIDC_CLIENT_ID ?? "dynasty-ff-frontend";

let userManager: UserManager | undefined;

function manager(): UserManager {
  if (typeof window === "undefined") {
    throw new Error("OIDC is only available in the browser");
  }
  if (userManager) return userManager;

  const settings: UserManagerSettings = {
    authority,
    metadataUrl: `${window.location.origin}/api/oidc-metadata`,
    client_id: clientId,
    redirect_uri: `${window.location.origin}/auth/callback`,
    post_logout_redirect_uri: window.location.origin,
    response_type: "code",
    scope: "openid profile email",
    loadUserInfo: false,
    automaticSilentRenew: true,
    monitorSession: false,
    userStore: new WebStorageStateStore({ store: window.localStorage }),
  };
  userManager = new UserManager(settings);
  return userManager;
}

type AuthContextValue = {
  ready: boolean;
  user: User | null;
  error: string | null;
  signIn: (returnTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
  authorizedFetch: (input: string, init?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const oidc = manager();
    const updateUser = (nextUser: User) => {
      setUser(nextUser);
      setError(null);
    };
    const clearUser = () => setUser(null);

    oidc.events.addUserLoaded(updateUser);
    oidc.events.addUserUnloaded(clearUser);
    oidc.events.addAccessTokenExpired(clearUser);

    oidc
      .getUser()
      .then((storedUser) => setUser(storedUser && !storedUser.expired ? storedUser : null))
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Unable to restore the sign-in session"),
      )
      .finally(() => setReady(true));

    return () => {
      oidc.events.removeUserLoaded(updateUser);
      oidc.events.removeUserUnloaded(clearUser);
      oidc.events.removeAccessTokenExpired(clearUser);
    };
  }, []);

  const signIn = useCallback(async (returnTo = "/") => {
    setError(null);
    await manager().signinRedirect({ state: safeReturnTo(returnTo) });
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    await manager().signoutRedirect();
  }, []);

  const authorizedFetch = useCallback(
    async (input: string, init: RequestInit = {}) => {
      const oidc = manager();
      let currentUser = await oidc.getUser();

      if (!currentUser || currentUser.expired) {
        try {
          currentUser = await oidc.signinSilent();
        } catch {
          await oidc.removeUser();
          setUser(null);
          throw new Error("Your session expired. Sign in again to continue.");
        }
      }
      if (!currentUser) {
        throw new Error("Sign in to continue.");
      }

      const headers = new Headers(init.headers);
      headers.set("authorization", `Bearer ${currentUser.access_token}`);
      const response = await fetch(input, { ...init, headers });

      if (response.status === 401 || response.status === 403) {
        await oidc.removeUser();
        setUser(null);
      }
      return response;
    },
    [],
  );

  const value = useMemo(
    () => ({ ready, user, error, signIn, signOut, authorizedFetch }),
    [ready, user, error, signIn, signOut, authorizedFetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

export async function completeSignIn(): Promise<string> {
  const signedInUser = await manager().signinRedirectCallback();
  return typeof signedInUser.state === "string" ? safeReturnTo(signedInUser.state) : "/";
}

function safeReturnTo(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://frontend.local");
    if (url.origin !== "https://frontend.local" || url.pathname === "/auth/callback") return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
