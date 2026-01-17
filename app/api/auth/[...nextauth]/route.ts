/**
 * NextAuth.js API Route Handler
 * 
 * Phase 3: Active - NextAuth is now the primary authentication system
 */

import NextAuth from "next-auth"
import { nextAuthOptions } from "@/lib/auth/nextauth-config"

// Create NextAuth handler for v4
const handler = NextAuth(nextAuthOptions)

export { handler as GET, handler as POST }

