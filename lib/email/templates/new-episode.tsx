interface NewEpisodeEmailProps {
  username: string
  seriesTitle: string
  seasonNumber: number
  episodeNumber: number
  episodeTitle: string
  seriesId: number
  episodePosterUrl?: string
  siteUrl: string
}

export const NewEpisodeEmail = ({
  username,
  seriesTitle,
  seasonNumber,
  episodeNumber,
  episodeTitle,
  seriesId,
  episodePosterUrl,
  siteUrl,
}: NewEpisodeEmailProps) => (
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
        .episode-info {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
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
        img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
        }
      `}</style>
    </head>
    <body>
      <div className="header">
        <h1 style={{ margin: 0 }}>🎬 New Episode Available!</h1>
      </div>

      <div className="content">
        <p>Hi {username},</p>

        <p>
          A new episode of <strong>{seriesTitle}</strong> is now available to watch!
        </p>

        <div className="episode-info">
          {episodePosterUrl && (
            <img
              src={episodePosterUrl || "/placeholder.svg"}
              alt={`${seriesTitle} poster`}
              style={{ marginBottom: "15px" }}
            />
          )}
          <h2 style={{ margin: "0 0 10px 0" }}>
            Season {seasonNumber}, Episode {episodeNumber}
          </h2>
          <p style={{ margin: 0, fontSize: "18px", color: "#667eea" }}>{episodeTitle}</p>
        </div>

        <p>Don't miss out! Start watching now.</p>

        <center>
          <a href={`${siteUrl}/series/${seriesId}`} className="button">
            Watch Now
          </a>
        </center>
      </div>

      <div className="footer">
        <p>You're receiving this email because you follow {seriesTitle}.</p>
        <p>
          <a href={`${siteUrl}/settings`} style={{ color: "#667eea" }}>
            Manage notification preferences
          </a>
        </p>
      </div>
    </body>
  </html>
)
