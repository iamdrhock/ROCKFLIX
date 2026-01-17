interface Movie {
  id: number
  title: string
  poster_url: string
  type: string
  release_date: string
}

interface WeeklyDigestEmailProps {
  username: string
  newMovies: Movie[]
  newSeries: Movie[]
  weekRange: string
  siteUrl: string
}

export const WeeklyDigestEmail = ({ username, newMovies, newSeries, weekRange, siteUrl }: WeeklyDigestEmailProps) => (
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
        .section {
          margin: 30px 0;
        }
        .movie-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
          margin: 20px 0;
        }
        .movie-card {
          background: #f8f9fa;
          border-radius: 8px;
          overflow: hidden;
          text-decoration: none;
          color: inherit;
        }
        .movie-card img {
          width: 100%;
          height: auto;
        }
        .movie-card-content {
          padding: 10px;
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
        <h1 style={{ margin: 0 }}>🎬 Your Weekly Digest</h1>
        <p style={{ margin: "10px 0 0 0", opacity: 0.9 }}>{weekRange}</p>
      </div>

      <div className="content">
        <p>Hi {username},</p>

        <p>Here's what's new this week on RockFlix!</p>

        {newMovies.length > 0 && (
          <div className="section">
            <h2 style={{ borderBottom: "2px solid #667eea", paddingBottom: "10px" }}>
              🎥 New Movies ({newMovies.length})
            </h2>
            <div className="movie-grid">
              {newMovies.slice(0, 4).map((movie) => (
                <a key={movie.id} href={`${siteUrl}/movie/${movie.id}`} className="movie-card">
                  <img src={movie.poster_url || "/placeholder.svg"} alt={movie.title} />
                  <div className="movie-card-content">
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "bold" }}>{movie.title}</p>
                    <p style={{ margin: "5px 0 0 0", fontSize: "12px", color: "#666" }}>{movie.release_date}</p>
                  </div>
                </a>
              ))}
            </div>
            {newMovies.length > 4 && (
              <p style={{ textAlign: "center", marginTop: "15px" }}>
                <a href={`${siteUrl}/movies`} style={{ color: "#667eea" }}>
                  + {newMovies.length - 4} more movies
                </a>
              </p>
            )}
          </div>
        )}

        {newSeries.length > 0 && (
          <div className="section">
            <h2 style={{ borderBottom: "2px solid #667eea", paddingBottom: "10px" }}>
              📺 New TV Series ({newSeries.length})
            </h2>
            <div className="movie-grid">
              {newSeries.slice(0, 4).map((series) => (
                <a key={series.id} href={`${siteUrl}/series/${series.id}`} className="movie-card">
                  <img src={series.poster_url || "/placeholder.svg"} alt={series.title} />
                  <div className="movie-card-content">
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "bold" }}>{series.title}</p>
                    <p style={{ margin: "5px 0 0 0", fontSize: "12px", color: "#666" }}>{series.release_date}</p>
                  </div>
                </a>
              ))}
            </div>
            {newSeries.length > 4 && (
              <p style={{ textAlign: "center", marginTop: "15px" }}>
                <a href={`${siteUrl}/tv-shows`} style={{ color: "#667eea" }}>
                  + {newSeries.length - 4} more series
                </a>
              </p>
            )}
          </div>
        )}

        <center>
          <a href={siteUrl} className="button">
            Explore All Content
          </a>
        </center>
      </div>

      <div className="footer">
        <p>You're receiving this weekly digest based on your notification preferences.</p>
        <p>
          <a href={`${siteUrl}/settings`} style={{ color: "#667eea" }}>
            Manage notification preferences
          </a>
        </p>
      </div>
    </body>
  </html>
)
