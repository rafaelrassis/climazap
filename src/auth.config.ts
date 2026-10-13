import type { NextAuthConfig } from "next-auth";

const PUBLIC_PREFIXES = ["/login", "/cadastro", "/o/", "/api/health"];

export const authConfig = {
  pages: { signIn: "/login" },
  providers: [],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const path = nextUrl.pathname;
      const isPublic = PUBLIC_PREFIXES.some((p) => path.startsWith(p));

      if (path.startsWith("/login") && isLoggedIn) {
        return Response.redirect(new URL("/inicio", nextUrl));
      }
      return isPublic || isLoggedIn;
    },
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
