import type { Session, SupabaseClient } from "@supabase/supabase-js";

type PortalAuth = Pick<SupabaseClient["auth"], "getSession" | "setSession" | "exchangeCodeForSession">;
export type PortalAuthResult = { session: Session | null; passwordSetup: boolean; error: string | null };

const invalidLink = "Dieser Link ist abgelaufen, wurde bereits verwendet oder ist unvollständig. Bitte fordere einen neuen Link an und öffne nur die neueste E-Mail.";
const failed = (error = invalidLink): PortalAuthResult => ({ session: null, passwordSetup: false, error });
const initializations = new WeakMap<PortalAuth, Promise<PortalAuthResult>>();

// A mail callback must only be consumed once, including React Strict Mode remounts.
// No token is logged, placed in React state, or used without Supabase validation.
export function initializePortalAuth(auth: PortalAuth, href: string, replaceUrl: (url: string) => void): Promise<PortalAuthResult> {
  const existing = initializations.get(auth);
  if (existing) return existing;
  const pending = completePortalAuth(auth, href, replaceUrl);
  initializations.set(auth, pending);
  void pending.then(() => initializations.delete(auth), () => initializations.delete(auth));
  return pending;
}

async function completePortalAuth(auth: PortalAuth, href: string, replaceUrl: (url: string) => void): Promise<PortalAuthResult> {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const code = url.searchParams.get("code");
  const flowId = url.searchParams.get("sb_flow_id");
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  const type = hash.get("type");
  const passwordSetup = url.searchParams.get("setup") === "password" || type === "recovery" || type === "invite";
  const hasError = ["error", "error_code", "error_description"].some((key) => url.searchParams.has(key) || hash.has(key));
  const hasCallback = hasError || code !== null || accessToken !== null || refreshToken !== null;

  // Remove credentials before any rendering, analytics or later navigation.
  if (hasCallback) {
    for (const key of ["code", "sb_flow_id", "error", "error_code", "error_description"]) url.searchParams.delete(key);
    url.hash = "";
    replaceUrl(`${url.pathname}${url.search}`);
  }

  try {
    if (hasError) return failed();
    if (code !== null && (accessToken !== null || refreshToken !== null)) return failed();

    if (accessToken !== null || refreshToken !== null) {
      if (!accessToken || !refreshToken || hash.get("token_type") !== "bearer") return failed();
      // Admin invitations/reset links carry a token pair, not a browser PKCE code.
      // setSession validates the access token with Auth or refreshes it there.
      const { data, error } = await auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      return error || !data.session ? failed() : { session: data.session, passwordSetup, error: null };
    }

    if (code !== null) {
      if (!code) return failed();
      // Self-service links retain PKCE protection and require the original verifier.
      const { data, error } = await auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
      if (error || !data.session) {
        return failed("Dieser Link konnte nicht bestätigt werden. Öffne die neueste E-Mail im selben Browser, in dem du den Link angefordert hast, oder fordere dort einen neuen Link an.");
      }
      return { session: data.session, passwordSetup, error: null };
    }

    const { data, error } = await auth.getSession();
    if (error) return failed("Die Anmeldung konnte nicht geladen werden. Bitte lade die Seite erneut.");
    if (passwordSetup && !data.session) return failed();
    return { session: data.session, passwordSetup: passwordSetup && Boolean(data.session), error: null };
  } catch {
    return failed("Der Anmeldelink konnte gerade nicht geprüft werden. Bitte prüfe deine Internetverbindung und fordere bei Bedarf einen neuen Link an.");
  }
}
