import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import { type Role } from "../../../generated/prisma";
import bcrypt from "bcryptjs";

import { db } from "~/server/db";

/**
 * Module augmentation for `next-auth` types.
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 */
export const authConfig = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "user@example.com",
        },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Find user by email
        const user = await db.user.findUnique({
          where: { email },
        });

        if (!user) {
          // Create new user with default USER role
          const hashedPassword = await bcrypt.hash(password, 12);
          const newUser = await db.user.create({
            data: {
              email,
              name: email.split("@")[0],
              role: "USER" as Role,
              password: hashedPassword,
              profileCompleted: false, // New users need to complete profile
            },
          });

          return {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            role: newUser.role,
          };
        }

        // Verify password if user exists
        if (user.password && (await bcrypt.compare(password, user.password))) {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        }

        return null;
      },
    }),
  ],
  adapter: PrismaAdapter(db) as any,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.id,
        role: token.role,
      },
    }),
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" || account?.provider === "github") {
        // Auto-assign USER role for OAuth sign-ins
        if (!user.role) {
          user.role = "USER";
        }

        // Check if this is a new user and mark profile as incomplete
        if (user.email) {
          const existingUser = await db.user.findUnique({
            where: { email: user.email },
          });

          if (!existingUser) {
            // This is a new OAuth user, they'll need to complete their profile
            await db.user.upsert({
              where: { email: user.email },
              create: {
                email: user.email,
                name: user.name,
                image: user.image,
                role: "USER" as Role,
                profileCompleted: false,
              },
              update: {
                name: user.name,
                image: user.image,
              },
            });
          }
        }

        return true;
      }
      return true;
    },
  },
  pages: {
    signIn: "/",
  },
} satisfies NextAuthConfig;
