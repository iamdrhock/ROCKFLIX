"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ClientHeader } from "@/components/client-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, CheckCircle, XCircle, Eye } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { getAuthHeaders, fetchCsrfToken } from "@/lib/utils/csrf"

interface Report {
  id: number
  report_type: string
  reason: string
  status: string
  created_at: string
  reporter_username: string
  reported_username: string
  comment_id?: number
  comment_text?: string
  resolution_notes?: string
}

export default function TalkFlixReportsPage() {
  const router = useRouter()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("pending")
  const [reviewDialog, setReviewDialog] = useState(false)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [resolutionStatus, setResolutionStatus] = useState<"resolved" | "dismissed">("resolved")

  useEffect(() => {
    // Check admin session via API instead of localStorage
    async function checkAuth() {
      try {
        await fetchCsrfToken().catch(console.error)
        const response = await fetch("/api/admin/session", { 
          credentials: "include",
          cache: "no-store",
        })
        if (!response.ok) {
          router.push("/arike")
          return
        }
        loadReports()
      } catch (error) {
        console.error("[admin] Auth check failed:", error)
        router.push("/arike")
      }
    }
    checkAuth()
  }, [router, statusFilter])

  async function loadReports() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter) params.append("status", statusFilter)

      const response = await fetch(`/api/admin/talkflix/reports?${params}`)
      if (response.ok) {
        const data = await response.json()
        setReports(data.reports)
      }
    } catch (error) {
      console.error("Error loading reports:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleResolveReport() {
    if (!selectedReport) return

    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`/api/admin/talkflix/reports/${selectedReport.id}/resolve`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          status: resolutionStatus,
          resolution_notes: resolutionNotes,
        }),
      })

      if (response.ok) {
        loadReports()
        setReviewDialog(false)
        setSelectedReport(null)
        setResolutionNotes("")
      }
    } catch (error) {
      console.error("Error resolving report:", error)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ClientHeader />

      <main className="flex-1 container px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" onClick={() => router.push("/arike/dashboard")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold">User Reports</h1>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filter Reports</CardTitle>
            <CardDescription>View reports by status</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reports ({reports.length})</CardTitle>
            <CardDescription>Review and moderate user reports</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Loading reports...</p>
            ) : reports.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No reports found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Reporter</TableHead>
                    <TableHead>Reported User</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        <Badge variant="outline">{report.report_type}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{report.reporter_username}</TableCell>
                      <TableCell className="font-medium">{report.reported_username}</TableCell>
                      <TableCell className="max-w-xs">
                        <div className="line-clamp-2">{report.reason}</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            report.status === "pending"
                              ? "default"
                              : report.status === "resolved"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {report.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedReport(report)
                              setReviewDialog(true)
                            }}
                            disabled={report.status !== "pending"}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Report</DialogTitle>
            <DialogDescription>Review and take action on this report</DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-1">Report Type</h4>
                  <Badge variant="outline">{selectedReport.report_type}</Badge>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Reported By</h4>
                  <p>{selectedReport.reporter_username}</p>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Reported User</h4>
                <p>{selectedReport.reported_username}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Reason</h4>
                <p className="text-sm">{selectedReport.reason}</p>
              </div>
              {selectedReport.comment_text && (
                <div>
                  <h4 className="font-semibold mb-1">Comment Content</h4>
                  <p className="text-sm bg-muted p-3 rounded-md">{selectedReport.comment_text}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="resolution-status">Action</Label>
                <Select
                  value={resolutionStatus}
                  onValueChange={(val) => setResolutionStatus(val as "resolved" | "dismissed")}
                >
                  <SelectTrigger id="resolution-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resolved">Resolve (Take Action)</SelectItem>
                    <SelectItem value="dismissed">Dismiss (No Action)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="resolution-notes">Notes</Label>
                <Textarea
                  id="resolution-notes"
                  placeholder="Add notes about your decision..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setReviewDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleResolveReport}>
                  {resolutionStatus === "resolved" ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Resolve
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Dismiss
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
