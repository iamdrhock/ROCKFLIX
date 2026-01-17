"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  const errorMessages: Record<string, string> = {
    Configuration: "There is a problem with the server configuration. Check if your options are correct.",
    AccessDenied: "You do not have permission to sign in.",
    Verification: "The verification token has expired or has already been used.",
    Default: "An error occurred during authentication.",
  }

  const errorMessage = error ? errorMessages[error] || errorMessages.Default : errorMessages.Default

  return (
    <div className="flex min-h-[calc(100vh-200px)] w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-destructive">Authentication Error</CardTitle>
            <CardDescription>An error occurred during sign in</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{errorMessage}</p>
              {error && (
                <p className="mt-2 text-xs text-muted-foreground">Error code: {error}</p>
              )}
            </div>

            <div className="space-y-2">
              <Button asChild className="w-full">
                <Link href="/auth/login">Try Again</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/">Go Home</Link>
              </Button>
            </div>

            {error === "Configuration" && (
              <div className="mt-4 rounded-lg bg-yellow-500/10 p-4">
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  <strong>Configuration Error:</strong> This usually means:
                  <ul className="mt-2 list-disc pl-5 space-y-1">
                    <li>Google OAuth redirect URI is incorrect in Google Console</li>
                    <li>Environment variables (NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) are missing or incorrect</li>
                    <li>Database connection issue with NextAuth tables</li>
                  </ul>
                  <p className="mt-2">
                    For Google OAuth, make sure the redirect URI in Google Console is:
                    <br />
                    <code className="text-xs bg-background px-1 py-0.5 rounded">
                      https://rockflix.tv/api/auth/callback/google
                    </code>
                  </p>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[calc(100vh-200px)] w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Loading...</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  )
}


