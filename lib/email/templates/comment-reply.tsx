interface CommentReplyEmailProps {
  username: string
  replierUsername: string
  movieTitle: string
  movieId: number
  originalComment: string
  replyComment: string
  siteUrl: string
}

export const CommentReplyEmail = ({
  username,
  replierUsername,
  movieTitle,
  movieId,
  originalComment,
  replyComment,
  siteUrl,
}: CommentReplyEmailProps) => (
  <html>
    <head>
      <style>{`
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .content {
          background: #ffffff;
          padding: 30px;
          border: 1px solid #e0e0e0;
          border-top: none;
        }
        .comment-box {
          background: #f8f9fa;
          padding: 15px;
          border-left: 4px solid #667eea;
          margin: 15px 0;
          border-radius: 4px;
        }
        .reply-box {
          background: #e8f4f8;
          padding: 15px;
          border-left: 4px solid #4a90e2;
          margin: 15px 0;
          border-radius: 4px;
        }
        .button {
          display: inline-block;
          background: #667eea;
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 6px;
          margin-top: 20px;
        }
        .footer {
          background: #f8f9fa;
          padding: 20px;
          text-align: center;
          border-radius: 0 0 8px 8px;
          font-size: 12px;
          color: #666;
        }
      `}</style>
    </head>
    <body>
      <div className="header">
        <h1 style={{ margin: 0 }}>💬 New Reply to Your Comment</h1>
      </div>

      <div className="content">
        <p>Hi {username},</p>

        <p>
          <strong>{replierUsername}</strong> replied to your comment on <strong>{movieTitle}</strong>.
        </p>

        <div className="comment-box">
          <p style={{ margin: 0, fontSize: "12px", color: "#666", marginBottom: "8px" }}>Your comment:</p>
          <p style={{ margin: 0 }}>{originalComment}</p>
        </div>

        <div className="reply-box">
          <p style={{ margin: 0, fontSize: "12px", color: "#666", marginBottom: "8px" }}>
            <strong>{replierUsername}'s reply:</strong>
          </p>
          <p style={{ margin: 0 }}>{replyComment}</p>
        </div>

        <center>
          <a href={`${siteUrl}/movie/${movieId}#comments`} className="button">
            View Conversation
          </a>
        </center>
      </div>

      <div className="footer">
        <p>You're receiving this email because someone replied to your comment.</p>
        <p>
          <a href={`${siteUrl}/settings`} style={{ color: "#667eea" }}>
            Manage notification preferences
          </a>
        </p>
      </div>
    </body>
  </html>
)
