import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { createHash } from "node:crypto";

export function googleEnabled() {
  return Boolean(
    process.env.AUTH_SECRET &&
    process.env.AUTH_GOOGLE_ID &&
    process.env.AUTH_GOOGLE_SECRET,
  );
}

export const { handlers, auth } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: { scope: "openid email profile", prompt: "select_account" },
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/profile", error: "/profile" },
  callbacks: {
    signIn({ account, profile }) {
      return account?.provider === "google" && profile?.email_verified === true;
    },
    jwt({ token, account, profile }) {
      if (account?.provider === "google" && profile?.sub) {
        token.sub = createHash("sha256")
          .update(`google:${profile.sub}`)
          .digest("hex");
        token.name =
          typeof profile.given_name === "string"
            ? profile.given_name
            : profile.name;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
    redirect({ url, baseUrl }) {
      // Never send an OAuth return or sign-out to another origin.
      try {
        const next = new URL(url, baseUrl);
        if (next.origin === new URL(baseUrl).origin) return next.toString();
      } catch {
        /* Use the profile page for malformed return URLs. */
      }
      return `${baseUrl}/profile`;
    },
  },
});
