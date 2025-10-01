import { v4 as uuidv4 } from "uuid";
import { pool } from "../config/db";

export const saveMessageToDB = async ({
    chatId,
    userId,
    text,
    timestamp,
}: {
    chatId: string;
    userId: number;
    text: string;
    timestamp: Date;
}) => {
    const res = await pool.query(
        "INSERT INTO messages (chat_id, user_id, text, timestamp) VALUES ($1, $2, $3, $4) RETURNING *",
        [chatId, userId, text, timestamp]
    );
    return res.rows[0];
};

export const getMessagesFromDB = async (chatId: string, limit: number = 50, offset: number = 0) => {
    const res = await pool.query(
        `SELECT m.*, u.name, u.login as username 
     FROM messages m 
     JOIN users u ON m.user_id = u.id 
     WHERE m.chat_id = $1 
     ORDER BY m.timestamp DESC 
     LIMIT $2 OFFSET $3`,
        [chatId, limit, offset]
    );
    return res.rows;
};

export const getMyChatsDB = async (userId: number) => {
    const res = await pool.query(
        `SELECT 
       c.id, 
       c.privacy_type, 
       c.chat_type, 
       c.name,
       (SELECT u2.name
        FROM chat_participants cp2 
        JOIN users u2 ON cp2.user_id = u2.id 
        WHERE cp2.chat_id = c.id AND cp2.user_id != $1
        LIMIT 1) as display_name,
       (SELECT u2.avatar
        FROM chat_participants cp2 
        JOIN users u2 ON cp2.user_id = u2.id 
        WHERE cp2.chat_id = c.id AND cp2.user_id != $1
        LIMIT 1) as avatar,
       (SELECT m.text FROM messages m WHERE m.chat_id = c.id ORDER BY m.timestamp DESC LIMIT 1) as last_message,
       (SELECT m.timestamp FROM messages m WHERE m.chat_id = c.id ORDER BY m.timestamp DESC LIMIT 1) as last_timestamp
     FROM chats c
     JOIN chat_participants cp ON c.id = cp.chat_id
     WHERE cp.user_id = $1
     UNION
     SELECT 'general', 'public', 'group', 'General', 'General', null, 
       (SELECT m.text FROM messages m WHERE m.chat_id = 'general' ORDER BY m.timestamp DESC LIMIT 1),
       (SELECT m.timestamp FROM messages m WHERE m.chat_id = 'general' ORDER BY m.timestamp DESC LIMIT 1)`,
        [userId]
    );
    return res.rows;
};

export const findUserByLogin = async (query: string) => {
    const res = await pool.query(
        "SELECT id, name, login as username, avatar FROM users WHERE login ILIKE $1 LIMIT 5",
        [`%${query}%`]
    );
    return res.rows;
};

export const createPrivateChatDB = async (userId1: number, userId2: number) => {
    const existingChat = await pool.query(
        `SELECT c.id 
     FROM chats c
     JOIN chat_participants cp1 ON c.id = cp1.chat_id
     JOIN chat_participants cp2 ON c.id = cp2.chat_id
     WHERE cp1.user_id = $1 AND cp2.user_id = $2 
     AND c.privacy_type = 'private' AND c.chat_type = 'direct'`,
        [userId1, userId2]
    );

    if (existingChat.rows.length > 0) {
        return existingChat.rows[0].id;
    }

    // Создаём новый чат, если не существует
    const chatId = uuidv4();
    await pool.query(
        "INSERT INTO chats (id, privacy_type, chat_type) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        [chatId, "private", "direct"]
    );
    await pool.query(
        "INSERT INTO chat_participants (chat_id, user_id) VALUES ($1, $2), ($1, $3) ON CONFLICT DO NOTHING",
        [chatId, userId1, userId2]
    );

    return chatId;
};

export const checkChatExists = async (chatId: string, userId: number) => {
    const res = await pool.query(
        `SELECT c.id, c.privacy_type, c.chat_type, c.name,
        (
           SELECT row_to_json(u2) 
           FROM users u2
           JOIN chat_participants cp2 ON cp2.user_id = u2.id 
           WHERE cp2.chat_id = c.id AND cp2.user_id != $2
           LIMIT 1
         ) AS user
     FROM chats c 
     JOIN chat_participants cp ON c.id = cp.chat_id 
     WHERE c.id = $1 AND cp.user_id = $2`,
        [chatId, userId]
    );
    return res.rows.length > 0 ? res.rows[0] : null;
};

export const checkUserByLogin = async (currentUserId: number, targetLogin: string) => {
    const userRes = await pool.query("SELECT id, name, login FROM users WHERE login = $1", [targetLogin]);
    if (!userRes.rows.length) throw new Error("User not found");
    const targetUser = userRes.rows[0];
    if (targetUser.id === currentUserId) throw new Error("Cannot create chat with yourself");

    const chatRes = await pool.query(
        `SELECT c.id, c.privacy_type, c.chat_type, 
       u.name as display_name
     FROM chats c
     JOIN chat_participants cp1 ON c.id = cp1.chat_id
     JOIN chat_participants cp2 ON c.id = cp2.chat_id
     JOIN users u ON cp2.user_id = u.id
     WHERE cp1.user_id = $1 AND cp2.user_id = $2 AND c.privacy_type = 'private' AND c.chat_type = 'direct'`,
        [currentUserId, targetUser.id]
    );

    return {
        chatId: chatRes.rows[0]?.id || null,
        chatExists: !!chatRes.rows.length,
        targetUser,
        privacy_type: "private",
        chat_type: "direct",
        display_name: chatRes.rows[0]?.display_name || targetUser.name,
    };
};