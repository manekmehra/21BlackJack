-- Create a table for game sessions
CREATE TABLE IF NOT EXISTS game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    state JSONB NOT NULL DEFAULT '{}'::jsonb,
    host_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup by table code
CREATE INDEX IF NOT EXISTS idx_game_sessions_code ON game_sessions(code);

-- Realtime: Enable for game_sessions
-- Run this if you want to use Supabase Realtime for broadcasts:
-- ALTER PUBLICATION supabase_realtime ADD TABLE game_sessions;

-- RLS: Basic open policy for demo (Adjust for production!)
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read/Write" ON game_sessions FOR ALL USING (true);
