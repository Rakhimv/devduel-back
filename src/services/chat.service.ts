import { pool } from "../config/db";


export const saveMessageToDB = async ({ chatId, userId, text, timestamp }: { chatId: string; userId: number; text: string; timestamp: Date }) => {
    const res = await pool.query(
        'INSERT INTO messages (chat_id, user_id, text, timestamp) VALUES ($1, $2, $3, $4) RETURNING *', [chatId, userId, text, timestamp]
    )
    return res.rows[0];
}


export const getMessagesFromDB = async (chatId: string, limit: number, offset: number) => {
    const res = await pool.query(
        'SELECT m.*, u.name as user_name FROM messages m JOIN user u ON m.user_id = u.id WHERE chat_id = $1 ORDER BY timestamp DESC LIMIT $2 OFFSET $3', [chatId, limit, offset]
    )

    return res.rows;
}


export const createChatIfNotExists = async (chatId: string, type: 'general' | 'private') => {
  await pool.query('INSERT INTO chats (id, type) VALUES ($1, $2) ON CONFLICT DO NOTHING', [chatId, type]);
};