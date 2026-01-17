import { NextResponse } from "next/server"

import { adminRoute } from "@/lib/security/admin-middleware"

export const GET = adminRoute(async ({ adminUser }) => {
  return NextResponse.json({
    user: {
      id: adminUser.id,
      username: adminUser.username,
    },
  })
})

