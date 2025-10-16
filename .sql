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
    CONSTRAINT email_required_for_local CHECK (
      provider <> 'local'
      OR email IS NOT NULL
    )
  );

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
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

CREATE INDEX idx_messages_chat_id ON messages (chat_id, timestamp DESC);

INSERT INTO
  chats (id, privacy_type, chat_type, name)
VALUES
  ('general', 'public', 'group', 'General') ON CONFLICT DO NOTHING;

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


ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;