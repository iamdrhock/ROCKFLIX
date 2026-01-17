"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Database, CheckCircle2, XCircle } from "lucide-react"

export default function MigratePage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    stats?: {
      genres: number
      movies: number
      series: number
      actors: number
    }
  } | null>(null)

  const handleMigrate = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch("/api/migrate-from-mysql", {
        method: "POST",
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to migrate data",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Migrate from MySQL to Supabase
          </CardTitle>
          <CardDescription>
            This will copy all your movies, series, seasons, episodes, actors, and genres from your MySQL database to
            Supabase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              <strong>Important:</strong> Make sure you have run the SQL script to create tables in Supabase before
              migrating. This process may take a few minutes depending on how much data you have.
            </AlertDescription>
          </Alert>

          <Button onClick={handleMigrate} disabled={loading} className="w-full" size="lg">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Migrating data...
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                Start Migration
              </>
            )}
          </Button>

          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              <div className="flex items-start gap-2">
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <div className="flex-1">
                  <AlertDescription>
                    <p className="font-medium mb-2">{result.message}</p>
                    {result.stats && (
                      <div className="space-y-1 text-sm">
                        <p>✓ Genres: {result.stats.genres}</p>
                        <p>✓ Movies: {result.stats.movies}</p>
                        <p>✓ Series: {result.stats.series}</p>
                        <p>✓ Actors: {result.stats.actors}</p>
                      </div>
                    )}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}

          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>What will be migrated:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>All movies and series</li>
              <li>Seasons and episodes for series</li>
              <li>Actors and their relationships</li>
              <li>Genres and their relationships</li>
              <li>Ratings, views, and metadata</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
