"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAdminSession } from "@/hooks/use-admin-session"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, Database, CheckCircle2, XCircle, AlertTriangle, Search } from "lucide-react"
import { getAuthHeaders } from "@/lib/utils/csrf"

export default function MigrateDatabasePage() {
  const router = useRouter()
  const { loading: authLoading } = useAdminSession()
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verificationData, setVerificationData] = useState<any>(null)
  const [exportData, setExportData] = useState<any>(null)
  const [importProgress, setImportProgress] = useState<{
    processed: number
    total: number
    startTable: number
  } | null>(null)
  const [status, setStatus] = useState<{
    type: "success" | "error" | "warning" | "info"
    message: string
  } | null>(null)

  const handleExport = async () => {
    setExporting(true)
    setStatus(null)

    try {
      const headers = await getAuthHeaders()
      const response = await fetch("/api/admin/export-database", {
        method: "POST",
        headers,
        credentials: "include",
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = "Export failed"
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.message || errorData.error || errorMessage
        } catch {
          errorMessage = errorText || errorMessage
        }
        throw new Error(errorMessage)
      }

      // Handle response - check if it's JSON or file download
      const contentType = response.headers.get("content-type")
      const contentDisposition = response.headers.get("content-disposition")
      
      if (contentDisposition && contentDisposition.includes("attachment")) {
        // Handle downloadable file response
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `database-export-${new Date().toISOString().split("T")[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        // Parse the blob as JSON for import
        const text = await blob.text()
        const data = JSON.parse(text)
        setExportData(data)
        setStatus({
          type: "success",
          message: `Export completed! ${data.metadata?.totalRecords || 0} records from ${data.metadata?.totalTables || 0} tables. File downloaded.`,
        })
      } else {
        // Handle JSON response
        const data = await response.json()
        setExportData(data)
        setStatus({
          type: "success",
          message: `Export completed! ${data.metadata?.totalRecords || 0} records from ${data.metadata?.totalTables || 0} tables.`,
        })
      }
    } catch (error) {
      console.error("Export error:", error)
      setStatus({
        type: "error",
        message: "Failed to export database. Please check console for details.",
      })
    } finally {
      setExporting(false)
    }
  }

  const handleDownload = () => {
    if (!exportData) return

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `database-export-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleVerify = async () => {
    setVerifying(true)
    setStatus(null)
    setVerificationData(null)

    try {
      const headers = await getAuthHeaders()
      const response = await fetch("/api/admin/verify-current-db", {
        method: "GET",
        headers,
        credentials: "include",
      })

      if (!response.ok) {
        let errorMessage = "Verification failed"
        try {
          const error = await response.json()
          errorMessage = error.message || error.error || errorMessage
          console.error("Verification error response:", error)
          
          // Special handling for 401 - session expired
          if (response.status === 401) {
            errorMessage = "Your admin session has expired. Please log out and log back in, then try again."
          }
        } catch (e) {
          const text = await response.text()
          errorMessage = text || errorMessage
          console.error("Verification error text:", text)
          
          if (response.status === 401) {
            errorMessage = "Your admin session has expired. Please log out and log back in, then try again."
          }
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      setVerificationData(result)
      
      if (result.conclusion?.activeDatabase) {
        setStatus({
          type: "info",
          message: `??? Active Database: ${result.conclusion.activeDatabase}. ${result.conclusion.recommendation || ""}`,
        })
      } else {
        setStatus({
          type: "warning",
          message: "Could not determine active database. Check console for details.",
        })
      }
    } catch (error) {
      console.error("Verification error:", error)
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to verify database. Please check console for details.",
      })
    } finally {
      setVerifying(false)
    }
  }

  const handleImport = async () => {
    if (!exportData) {
      setStatus({
        type: "warning",
        message: "Please export database first.",
      })
      return
    }

    setImporting(true)
    setStatus(null)

    try {
      const headers = await getAuthHeaders()
      const startTable = importProgress?.startTable || 0
      const batchSize = 8 // Process 8 tables at a time to stay under 60s timeout
      
      const response = await fetch("/api/admin/import-to-contabo", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ 
          exportData,
          startTable,
          batchSize,
        }),
      })

      // Check content type first
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text()
        console.error("Non-JSON response:", text.substring(0, 500))
        throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}. This usually means the API route crashed. Check server logs.`)
      }

      if (!response.ok) {
        try {
          const error = await response.json()
          throw new Error(error.message || error.error || "Import failed")
        } catch (parseError) {
          // If JSON parsing fails, use status text
          throw new Error(`Import failed with status ${response.status}: ${response.statusText}`)
        }
      }

      const result = await response.json()
      
      // Update progress
      const newProgress = {
        processed: result.processed || 0,
        total: result.total || 49,
        startTable: result.nextStart || 0,
      }
      setImportProgress(newProgress)
      
      if (result.hasMore) {
        // More tables to import - show progress and continue automatically
        setStatus({
          type: "info",
          message: `${result.message} Progress: ${result.processed}/${result.total} tables. Continuing...`,
        })
        
        // Wait 1 second then continue with next batch
        setTimeout(() => {
          handleImport()
        }, 1000)
      } else {
        // All done!
        setStatus({
          type: "success",
          message: `Import completed! ${result.totalImported || 0} records imported from all ${result.total || 49} tables.`,
        })
        setImportProgress(null)
        setImporting(false)
      }
    } catch (error) {
      console.error("Import error:", error)
      let errorMessage = "Failed to import database. Please check console for details."
      
      if (error instanceof Error) {
        errorMessage = error.message
        // If it's a JSON parse error, provide more helpful message
        if (error.message.includes("Unexpected token") || error.message.includes("JSON")) {
          errorMessage = "Server returned an error page instead of JSON. The import API may have crashed. Check server logs with: pm2 logs rockflix --lines 50"
        }
      }
      
      setStatus({
        type: "error",
        message: errorMessage,
      })
      // Reset progress on error so user can try again
      setImportProgress(null)
      setImporting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Database Migration</h1>
        <p className="text-muted-foreground">Migrate database from Supabase to Contabo PostgreSQL</p>
      </div>

      {status && (
        <Alert
          className={`mb-6 ${
            status.type === "success"
              ? "border-green-500"
              : status.type === "error"
                ? "border-red-500"
                : status.type === "warning"
                  ? "border-yellow-500"
                  : "border-blue-500"
          }`}
        >
          {status.type === "success" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          {status.type === "error" && <XCircle className="h-4 w-4 text-red-500" />}
          {status.type === "warning" && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
          {status.type === "info" && <AlertTriangle className="h-4 w-4 text-blue-500" />}
          <AlertTitle>
            {status.type === "success"
              ? "Success"
              : status.type === "error"
                ? "Error"
                : status.type === "warning"
                  ? "Warning"
                  : "Info"}
          </AlertTitle>
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Step 0: Verify Current Database
          </CardTitle>
          <CardDescription>Check which database your application is actually using</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleVerify} disabled={verifying} variant="outline" className="w-full">
            {verifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Verify Current Database
              </>
            )}
          </Button>
          {verificationData && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Verification Results:</h4>
              <div className="space-y-1 text-sm">
                <p><strong>Active Database:</strong> {verificationData.conclusion?.activeDatabase || "Unknown"}</p>
                <p><strong>Database Type:</strong> {verificationData.environment?.applicationDatabase?.type || "Unknown"}</p>
                {verificationData.connectionTest?.status === "connected" && (
                  <>
                    <p><strong>Tables:</strong> {verificationData.connectionTest.tables || 0}</p>
                    {verificationData.connectionTest.recordCounts && (
                      <div className="mt-2">
                        <p className="font-semibold">Key Tables:</p>
                        {Object.entries(verificationData.connectionTest.recordCounts).map(([table, count]: [string, any]) => (
                          <p key={table} className="ml-4">??? {table}: {count?.toLocaleString() || 0} records</p>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <p className="mt-2 text-xs text-muted-foreground">{verificationData.conclusion?.recommendation || ""}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Step 1: Export from Supabase
            </CardTitle>
            <CardDescription>Export all data from your Supabase database</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExport} disabled={exporting} className="w-full">
              {exporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                "Export Database"
              )}
            </Button>
            {exportData && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Export completed: {exportData.metadata?.totalRecords || 0} records from{" "}
                  {exportData.metadata?.totalTables || 0} tables
                </p>
                <Button onClick={handleDownload} variant="outline" className="w-full">
                  Download Export File
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Step 2: Import to Contabo
            </CardTitle>
            <CardDescription>Import data to your Contabo PostgreSQL database</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Important</AlertTitle>
              <AlertDescription>
                Make sure you have:
                <ul className="list-disc list-inside mt-2">
                  <li>Created schema on Contabo database</li>
                  <li>Updated CONTABO_DATABASE_URL in environment variables</li>
                  <li>Tested connection to Contabo database</li>
                </ul>
              </AlertDescription>
            </Alert>
            <Button onClick={handleImport} disabled={importing || !exportData} className="w-full">
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {importProgress 
                    ? `Importing... ${importProgress.processed}/${importProgress.total} tables`
                    : "Importing..."}
                </>
              ) : (
                importProgress && importProgress.processed > 0
                  ? `Continue Import (${importProgress.processed}/${importProgress.total})`
                  : "Import to Contabo"
              )}
            </Button>
            {importProgress && (
              <div className="mt-4">
                <div className="text-sm text-muted-foreground mb-2">
                  Progress: {importProgress.processed} of {importProgress.total} tables processed
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${(importProgress.processed / importProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Migration Guide</CardTitle>
          <CardDescription>Step-by-step instructions for database migration</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Verify current database using Step 0 above (should show Supabase)</li>
            <li>Export database from Supabase using Step 1 above</li>
            <li>Create schema on Contabo database (use Adminer or SQL scripts)</li>
            <li>Update CONTABO_DATABASE_URL in your server environment variables</li>
            <li>Import data to Contabo using Step 2 above</li>
            <li>Verify data integrity using verification queries</li>
            <li>Update application environment variables to use Contabo (remove Supabase keys)</li>
            <li>Restart application: <code className="bg-muted px-1 py-0.5 rounded">pm2 restart rockflix</code></li>
            <li>Test site functionality</li>
            <li>Keep Supabase as backup for 7 days</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}

