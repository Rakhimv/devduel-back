CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    login VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password TEXT NOT NULL,
    avatar TEXT DEFAULT NULL,
    provider VARCHAR(50) DEFAULT 'local',
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    refresh_token TEXT,
    CONSTRAINT email_required_for_local CHECK (
        provider <> 'local' OR email IS NOT NULL
    )
);



CREATE TABLE IF NOT EXISTS chats (
  id VARCHAR(255) PRIMARY KEY, 
  type VARCHAR(50) NOT NULL   
);


CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  chat_id VARCHAR(255) REFERENCES chats(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, 
  text TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_chat_id ON messages(chat_id, timestamp DESC);
INSERT INTO chats (id, type) VALUES ('general', 'general') ON CONFLICT DO NOTHING;