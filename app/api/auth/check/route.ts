import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth/nextauth-helpers"

export async function GET() {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  return NextResponse.json({ authenticated: true, user: session.user })
}

