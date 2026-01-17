-- Add quick_links column to site_settings table for customizable footer sections

-- Check if quick_links column exists, if not add it with default values
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'site_settings' 
        AND column_name = 'quick_links'
    ) THEN
        ALTER TABLE site_settings 
        ADD COLUMN quick_links JSONB DEFAULT '[
            {
                "title": "Browse",
                "links": [
                    {"label": "Movies", "url": "/movies"},
                    {"label": "TV Series", "url": "/series"},
                    {"label": "Blog", "url": "/blog"}
                ]
            },
            {
                "title": "Community",
                "links": [
                    {"label": "TalkFlix", "url": "/community"},
                    {"label": "My Profile", "url": "/profile"},
                    {"label": "Top Rated", "url": "/"}
                ]
            },
            {
                "title": "Support",
                "links": [
                    {"label": "Admin Dashboard", "url": "/arike"},
                    {"label": "Help Center", "url": "/"},
                    {"label": "Contact Us", "url": "/"}
                ]
            }
        ]'::jsonb;
        
        RAISE NOTICE 'quick_links column added successfully with default values';
    ELSE
        RAISE NOTICE 'quick_links column already exists';
    END IF;
END $$;

-- Update existing row if it exists and quick_links is null
UPDATE site_settings
SET quick_links = '[
    {
        "title": "Browse",
        "links": [
            {"label": "Movies", "url": "/movies"},
            {"label": "TV Series", "url": "/series"},
            {"label": "Blog", "url": "/blog"}
        ]
    },
    {
        "title": "Community",
        "links": [
            {"label": "TalkFlix", "url": "/community"},
            {"label": "My Profile", "url": "/profile"},
            {"label": "Top Rated", "url": "/"}
        ]
    },
    {
        "title": "Support",
        "links": [
            {"label": "Admin Dashboard", "url": "/arike"},
            {"label": "Help Center", "url": "/"},
            {"label": "Contact Us", "url": "/"}
        ]
    }
]'::jsonb
WHERE quick_links IS NULL OR quick_links = 'null'::jsonb;
