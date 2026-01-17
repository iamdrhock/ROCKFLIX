-- Analytics System for Rockflix
-- Tracks views, searches, player errors, and user engagement

-- View tracking with detailed metadata
CREATE TABLE IF NOT EXISTS view_analytics (
    id BIGSERIAL PRIMARY KEY,
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    session_id TEXT,
    view_duration INTEGER, -- seconds watched
    completion_percentage INTEGER, -- 0-100
    device_type TEXT, -- mobile, tablet, desktop
    browser TEXT,
    country TEXT,
    referrer TEXT,
    player_used TEXT, -- which embed player
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Search tracking
CREATE TABLE IF NOT EXISTS search_analytics (
    id BIGSERIAL PRIMARY KEY,
    query TEXT NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    session_id TEXT,
    results_count INTEGER,
    clicked_result_id BIGINT REFERENCES movies(id) ON DELETE SET NULL,
    device_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player error tracking
CREATE TABLE IF NOT EXISTS player_errors (
    id BIGSERIAL PRIMARY KEY,
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    session_id TEXT,
    player_used TEXT,
    error_type TEXT, -- loading_failed, playback_error, buffering, etc.
    error_message TEXT,
    device_type TEXT,
    browser TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily aggregated stats for performance
CREATE TABLE IF NOT EXISTS daily_stats (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    total_views INTEGER DEFAULT 0,
    total_searches INTEGER DEFAULT 0,
    total_errors INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    total_comments INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_view_analytics_movie ON view_analytics(movie_id);
CREATE INDEX IF NOT EXISTS idx_view_analytics_user ON view_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_view_analytics_created ON view_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_search_analytics_query ON search_analytics(query);
CREATE INDEX IF NOT EXISTS idx_search_analytics_created ON search_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_player_errors_movie ON player_errors(movie_id);
CREATE INDEX IF NOT EXISTS idx_player_errors_created ON player_errors(created_at);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);

-- RLS Policies
ALTER TABLE view_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role has full access to view_analytics" ON view_analytics FOR ALL USING (true);
CREATE POLICY "Service role has full access to search_analytics" ON search_analytics FOR ALL USING (true);
CREATE POLICY "Service role has full access to player_errors" ON player_errors FOR ALL USING (true);
CREATE POLICY "Service role has full access to daily_stats" ON daily_stats FOR ALL USING (true);

-- Users can insert their own analytics (anonymous tracking)
CREATE POLICY "Anyone can insert view analytics" ON view_analytics FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert search analytics" ON search_analytics FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert player errors" ON player_errors FOR INSERT WITH CHECK (true);
