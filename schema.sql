-- DevDuel Database Schema
-- This file contains all database migrations combined

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE
  IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    login VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password TEXT NOT NULL,
    avatar TEXT DEFAULT NULL,
    provider VARCHAR(50) DEFAULT 'local',
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW (),
    updated_at TIMESTAMP DEFAULT NOW (),
    refresh_token TEXT,
    is_online BOOLEAN DEFAULT FALSE,
    CONSTRAINT email_required_for_local CHECK (
      provider <> 'local'
      OR email IS NOT NULL
    )
  );

-- Users trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = (NOW() AT TIME ZONE 'UTC');
    RETURN NEW;
  END;
  $$ language 'plpgsql';

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CHATS TABLES
-- ============================================
CREATE TABLE
  IF NOT EXISTS chats (
    id VARCHAR(255) PRIMARY KEY,
    privacy_type VARCHAR(50) NOT NULL, -- 'private' or 'public'
    chat_type VARCHAR(50) NOT NULL, -- 'direct' or 'group'
    name VARCHAR(255)
  );

CREATE TABLE
  IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(255) REFERENCES chats (id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users (id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'game_invite')),
    game_invite_data JSONB,
    reply_to_message_id INTEGER REFERENCES messages (id) ON DELETE SET NULL
  );

CREATE TABLE
  IF NOT EXISTS chat_participants (
    chat_id VARCHAR(255) REFERENCES chats (id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users (id) ON DELETE CASCADE,
    PRIMARY KEY (chat_id, user_id)
  );

CREATE TABLE IF NOT EXISTS message_reads (
    message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP,
    PRIMARY KEY (message_id, user_id)
);

-- Chats indexes
CREATE INDEX idx_messages_chat_id ON messages (chat_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_game_invite_data ON messages USING GIN (game_invite_data);
CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages (message_type);

-- Insert default general chat
INSERT INTO
  chats (id, privacy_type, chat_type, name)
VALUES
  ('general', 'public', 'group', 'General') ON CONFLICT DO NOTHING;

-- ============================================
-- GAMES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    player2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    player1_ready BOOLEAN NOT NULL DEFAULT FALSE,
    player2_ready BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'ready', 'in_progress', 'finished', 'abandoned')),
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER NOT NULL DEFAULT 600000, 
    winner_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Games indexes
CREATE INDEX IF NOT EXISTS idx_games_player1_id ON games(player1_id);
CREATE INDEX IF NOT EXISTS idx_games_player2_id ON games(player2_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_start_time ON games(start_time);

-- Games trigger for updated_at
CREATE OR REPLACE FUNCTION update_games_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_games_updated_at
    BEFORE UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION update_games_updated_at();

-- ============================================
-- GAME TASKS TABLE (Algorithms)
-- ============================================
CREATE TABLE IF NOT EXISTS game_tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    input_example TEXT,
    output_example TEXT,
    difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    level INTEGER NOT NULL DEFAULT 1,
    code_templates JSONB NOT NULL DEFAULT '{}',
    supported_languages INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    function_signature VARCHAR(255),
    test_cases JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game tasks indexes
CREATE INDEX IF NOT EXISTS idx_game_tasks_level ON game_tasks(level);
CREATE INDEX IF NOT EXISTS idx_game_tasks_difficulty ON game_tasks(difficulty);

-- ============================================
-- GAME TASK COMPLETIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS game_task_completions (
    id SERIAL PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id INTEGER NOT NULL REFERENCES game_tasks(id) ON DELETE CASCADE,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_id, player_id, task_id)
);

-- Game task completions indexes
CREATE INDEX IF NOT EXISTS idx_game_task_completions_game_id ON game_task_completions(game_id);
CREATE INDEX IF NOT EXISTS idx_game_task_completions_player_id ON game_task_completions(player_id);
CREATE INDEX IF NOT EXISTS idx_game_task_completions_task_id ON game_task_completions(task_id);

-- ============================================
-- GAME ASSIGNED TASKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS game_assigned_tasks (
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    level INTEGER NOT NULL,
    task_id INTEGER NOT NULL REFERENCES game_tasks(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (game_id, level)
);

-- Game assigned tasks indexes
CREATE INDEX IF NOT EXISTS idx_game_assigned_tasks_game_id ON game_assigned_tasks(game_id);
CREATE INDEX IF NOT EXISTS idx_game_assigned_tasks_level ON game_assigned_tasks(game_id, level);

-- Add game statistics columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS games_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wins_count INTEGER DEFAULT 0;

-- Update existing users to have 0 games if NULL
UPDATE users SET games_count = 0 WHERE games_count IS NULL;
UPDATE users SET wins_count = 0 WHERE wins_count IS NULL;

-- Add is_banned column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;

-- Add reply_to_message_id column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_message_id INTEGER REFERENCES messages (id) ON DELETE SET NULL;

