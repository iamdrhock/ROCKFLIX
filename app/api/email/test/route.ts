import { NextResponse } from "next/server"
import { verifySmtpConnection, transporter, DEFAULT_FROM_EMAIL } from "@/lib/email/smtp-client"

// Test endpoint to verify SMTP configuration
export async function GET() {
  try {
    // First verify the connection
    const verification = await verifySmtpConnection()

    if (!verification.success) {
      return NextResponse.json(
        {
          success: false,
          error: "SMTP connection failed",
          details: verification.error,
        },
        { status: 500 },
      )
    }

    // Try sending a test email
    const testEmail = process.env.SMTP_USER || "test@example.com"

    const info = await transporter.sendMail({
      from: DEFAULT_FROM_EMAIL,
      to: testEmail,
      subject: "Rockflix Email Test",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #84cc16;">Email System Test</h2>
          <p>Your email notification system is working correctly!</p>
          <p>SMTP Configuration:</p>
          <ul>
            <li>Host: ${process.env.SMTP_HOST}</li>
            <li>Port: ${process.env.SMTP_PORT}</li>
            <li>From: ${DEFAULT_FROM_EMAIL}</li>
          </ul>
          <p>You can now send email notifications to your users.</p>
        </div>
      `,
    })

    return NextResponse.json({
      success: true,
      message: "Test email sent successfully",
      messageId: info.messageId,
      recipient: testEmail,
    })
  } catch (error) {
    console.error("Email test failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
