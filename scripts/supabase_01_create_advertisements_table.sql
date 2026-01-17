-- Create advertisements table
CREATE TABLE IF NOT EXISTS public.advertisements (
    id BIGSERIAL PRIMARY KEY,
    position VARCHAR(100) NOT NULL UNIQUE,
    content TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create index on position for faster lookups
CREATE INDEX IF NOT EXISTS idx_advertisements_position ON public.advertisements(position);
CREATE INDEX IF NOT EXISTS idx_advertisements_active ON public.advertisements(is_active);

-- Enable RLS
ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active ads
CREATE POLICY "Allow public read access to active ads"
ON public.advertisements
FOR SELECT
USING (is_active = true);

-- Allow service role full access
CREATE POLICY "Allow service role full access"
ON public.advertisements
FOR ALL
USING (auth.role() = 'service_role');

-- Insert default ad positions
INSERT INTO public.advertisements (position, content, is_active) VALUES
('movie_detail_top', '', false),
('movie_detail_bottom', '', false),
('series_detail_top', '', false),
('series_detail_bottom', '', false),
('watch_above_player', '', false),
('watch_below_player', '', false)
ON CONFLICT (position) DO NOTHING;
