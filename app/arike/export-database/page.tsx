"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Download, Upload, CheckCircle2, XCircle, ArrowRight } from "lucide-react"

export default function ExportDatabasePage() {
  const [exportLoading, setExportLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [exportData, setExportData] = useState<any>(null)
  const [importResult, setImportResult] = useState<any>(null)

  const handleExport = async () => {
    setExportLoading(true)
    try {
      const response = await fetch("/api/export-to-digitalocean", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to export database")
      }

      const data = await response.json()
      setExportData(data)

      // Also download the file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `supabase-export-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("[v0] Export error:", error)
      alert(error instanceof Error ? error.message : "Failed to export database")
    } finally {
      setExportLoading(false)
    }
  }

  const handleImport = async () => {
    if (!exportData) {
      alert("Please export the database first")
      return
    }

    setImportLoading(true)
    setImportResult(null)

    try {
      const response = await fetch("/api/import-to-digitalocean", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ exportData }),
      })

      const result = await response.json()
      setImportResult(result)
    } catch (error) {
      setImportResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to import data",
      })
    } finally {
      setImportLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text)
      setExportData(data)
      alert("Export file loaded successfully!")
    } catch (error) {
      alert("Failed to parse export file")
    }
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Database Migration Tool</h1>
          <p className="text-muted-foreground">
            Export your data from Supabase and import it into DigitalOcean PostgreSQL
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Export Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Step 1: Export from Supabase
              </CardTitle>
              <CardDescription>Download all your data from the current Supabase database</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleExport} disabled={exportLoading} className="w-full" size="lg">
                {exportLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export Database
                  </>
                )}
              </Button>

              {exportData && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertDescription>
                    <p className="font-medium mb-2">Export complete!</p>
                    <p className="text-sm">
                      {exportData.metadata.totalRecords.toLocaleString()} records from {exportData.metadata.totalTables}{" "}
                      tables
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-2">What will be exported:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>All movies, series, and episodes</li>
                  <li>User profiles and comments</li>
                  <li>Social features (posts, likes, follows)</li>
                  <li>Site settings and configuration</li>
                  <li>Analytics and logs</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Import Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Step 2: Import to DigitalOcean
              </CardTitle>
              <CardDescription>Upload the exported data to your DigitalOcean PostgreSQL</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium">Or upload an export file:</label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
              </div>

              <Button
                onClick={handleImport}
                disabled={!exportData || importLoading}
                className="w-full"
                size="lg"
                variant={exportData ? "default" : "secondary"}
              >
                {importLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import to DigitalOcean
                  </>
                )}
              </Button>

              {importResult && (
                <Alert variant={importResult.success ? "default" : "destructive"}>
                  <div className="flex items-start gap-2">
                    {importResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <div className="flex-1">
                      <AlertDescription>
                        <p className="font-medium mb-2">{importResult.message}</p>
                        {importResult.stats && (
                          <div className="text-sm space-y-1 max-h-48 overflow-y-auto">
                            {Object.entries(importResult.stats).map(([table, stat]: any) => (
                              <p key={table}>
                                {table}: {stat.imported || 0} imported
                                {stat.failed ? ` (${stat.failed} failed)` : ""}
                              </p>
                            ))}
                          </div>
                        )}
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              )}

              <Alert>
                <AlertDescription className="text-sm">
                  <strong>Important:</strong> Make sure you have set the <code>DIGITALOCEAN_DATABASE_URL</code>{" "}
                  environment variable with your DigitalOcean PostgreSQL connection string before importing.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>

        {/* Instructions Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5" />
              Migration Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-3">
              <li className="font-medium">
                Run the SQL schema scripts in your DigitalOcean PostgreSQL
                <p className="text-sm text-muted-foreground mt-1 ml-6">
                  Execute all the SQL scripts from the <code>scripts/</code> folder to create the database structure
                </p>
              </li>
              <li className="font-medium">
                Export your current data from Supabase
                <p className="text-sm text-muted-foreground mt-1 ml-6">
                  Click "Export Database" to download all your data as a JSON file
                </p>
              </li>
              <li className="font-medium">
                Set up your DigitalOcean database connection
                <p className="text-sm text-muted-foreground mt-1 ml-6">
                  Add <code>DIGITALOCEAN_DATABASE_URL</code> environment variable
                </p>
              </li>
              <li className="font-medium">
                Import the data to DigitalOcean
                <p className="text-sm text-muted-foreground mt-1 ml-6">
                  Click "Import to DigitalOcean" to transfer all your data
                </p>
              </li>
              <li className="font-medium">
                Update your environment variables
                <p className="text-sm text-muted-foreground mt-1 ml-6">
                  Switch your main <code>DATABASE_URL</code> to point to DigitalOcean
                </p>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
