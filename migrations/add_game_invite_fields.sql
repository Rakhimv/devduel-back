-- Добавляем поля для игровых приглашений в таблицу messages
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'game_invite')),
ADD COLUMN IF NOT EXISTS game_invite_data JSONB;

-- Создаем индекс для быстрого поиска игровых приглашений
CREATE INDEX IF NOT EXISTS idx_messages_game_invite_data ON messages USING GIN (game_invite_data);

-- Создаем индекс для поиска по типу сообщения
CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages (message_type);
