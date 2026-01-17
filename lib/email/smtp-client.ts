import nodemailer from "nodemailer"

// Create reusable SMTP transporter
// Supports Gmail, SendGrid, Mailgun, or any SMTP service
export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number.parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

// Default sender email
export const DEFAULT_FROM_EMAIL = process.env.EMAIL_FROM || "noreply@rockflix.com"

// Verify SMTP connection configuration
export async function verifySmtpConnection() {
  try {
    await transporter.verify()
    console.log("SMTP Server is ready to send emails")
    return { success: true }
  } catch (error) {
    console.error("SMTP connection error:", error)
    return { success: false, error }
  }
}
