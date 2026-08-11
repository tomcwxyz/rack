import { createInternalNeonAuth } from "@neondatabase/auth";
import { AuthView, NeonAuthUIProvider } from "@neondatabase/auth-ui";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ManagedAuthContextValue = {
  configured: boolean;
  configurationMessage: string | null;
  pending: boolean;
  signedIn: boolean;
  serviceUrl: string | null;
  quickModelAlias: string;
  getAccessToken: () => Promise<string | null>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const serviceUrl = import.meta.env.VITE_RACK_SERVICE_URL?.trim() || null;
const authUrl = import.meta.env.VITE_NEON_AUTH_URL?.trim() || null;
const neonAuth = authUrl ? createInternalNeonAuth(authUrl) : null;
const authClient = neonAuth?.adapter ?? null;
const quickModelAlias = import.meta.env.VITE_RACK_QUICK_MODEL_ALIAS?.trim() || "generator";

const ManagedAuthContext = createContext<ManagedAuthContextValue | null>(null);

const tokenFromClient = async (): Promise<string | null> => {
  if (!neonAuth) return null;
  const token = await neonAuth.getJWTToken();
  return typeof token === "string" && token.trim() ? token : null;
};

export function ManagedAuthProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(Boolean(authClient));
  const [signedIn, setSignedIn] = useState(false);

  const getAccessToken = useCallback(async () => {
    try {
      const token = await tokenFromClient();
      setSignedIn(Boolean(token));
      return token;
    } catch {
      setSignedIn(false);
      return null;
    }
  }, []);

  const refresh = useCallback(async () => {
    setPending(true);
    await getAccessToken();
    setPending(false);
  }, [getAccessToken]);

  const signOut = useCallback(async () => {
    if (authClient) await authClient.signOut();
    setSignedIn(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const configurationMessage = !serviceUrl
    ? "Managed checks are not configured in this desktop build."
    : !authClient
      ? "Managed sign-in is not configured in this desktop build."
      : null;

  const value = useMemo<ManagedAuthContextValue>(
    () => ({
      configured: Boolean(serviceUrl && authClient),
      configurationMessage,
      pending,
      signedIn,
      serviceUrl,
      quickModelAlias,
      getAccessToken,
      refresh,
      signOut,
    }),
    [configurationMessage, getAccessToken, pending, refresh, signOut, signedIn],
  );

  const content = (
    <ManagedAuthContext.Provider value={value}>{children}</ManagedAuthContext.Provider>
  );

  if (!authClient) return content;
  return (
    <NeonAuthUIProvider
      authClient={authClient}
      emailOTP
      defaultTheme="light"
      onSessionChange={() => void refresh()}
    >
      {content}
    </NeonAuthUIProvider>
  );
}

export function ManagedSignIn() {
  return (
    <div className="managed-sign-in">
      <div className="managed-sign-in__form">
        <AuthView path="sign-in" />
      </div>
    </div>
  );
}

export function useManagedAuth(): ManagedAuthContextValue {
  const value = useContext(ManagedAuthContext);
  if (!value) throw new Error("useManagedAuth must be used inside ManagedAuthProvider.");
  return value;
}
