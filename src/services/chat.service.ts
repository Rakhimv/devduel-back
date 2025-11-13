import { v4 as uuidv4 } from "uuid";
import { pool } from "../config/db";

export const saveMessageToDB = async ({
    chatId,
    userId,
    text,
    timestamp,
    messageType = 'text',
    gameInviteData = null,
    replyToMessageId = null,
}: {
    chatId: string;
    userId: number;
    text: string;
    timestamp: Date;
    messageType?: 'text' | 'game_invite';
    gameInviteData?: any;
    replyToMessageId?: number | null;
}) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const messageRes = await client.query(
            "INSERT INTO messages (chat_id, user_id, text, timestamp, message_type, game_invite_data, reply_to_message_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
            [chatId, userId, text, timestamp, messageType, gameInviteData ? JSON.stringify(gameInviteData) : null, replyToMessageId]
        );
        const message = messageRes.rows[0];

        const countRes = await client.query(
            "SELECT COUNT(*) as count FROM messages WHERE chat_id = $1",
            [chatId]
        );
        const messageCount = parseInt(countRes.rows[0].count);

        if (messageCount > 100) {
            await client.query(
                `DELETE FROM messages WHERE id IN (
                    SELECT id FROM messages 
                    WHERE chat_id = $1 
                    ORDER BY timestamp ASC, id ASC 
                    LIMIT $2
                )`,
                [chatId, messageCount - 100]
            );
        }

        let participants = [];
        if (chatId === "general") {

            const participantsRes = await client.query(
                "SELECT id AS user_id FROM users WHERE is_online = TRUE"
            );
            participants = participantsRes.rows;
        } else {

            const participantsRes = await client.query(
                "SELECT user_id FROM chat_participants WHERE chat_id = $1 AND user_id != $2",
                [chatId, userId]
            );
            participants = participantsRes.rows;
        }

        for (const participant of participants) {
            await client.query(
                "INSERT INTO message_reads (message_id, user_id, read_at) VALUES ($1, $2, NULL) ON CONFLICT DO NOTHING",
                [message.id, participant.user_id]
            );
        }

        await client.query("COMMIT");
        return message;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};
export const getMessagesFromDB = async (chatId: string, userId: number, limit: number = 50, offset: number = 0) => {
    const res = await pool.query(
        `SELECT m.*, u.name, u.avatar, u.login as username, 
            CASE 
                WHEN m.user_id = $2 THEN 
                    (SELECT COUNT(*) > 0 FROM message_reads mr2 
                     WHERE mr2.message_id = m.id AND mr2.read_at IS NOT NULL)
                ELSE 
                    (mr.read_at IS NOT NULL)
            END as is_read,
            m.message_type,
            m.game_invite_data,
            m.reply_to_message_id,
            CASE 
                WHEN m.reply_to_message_id IS NOT NULL THEN
                    json_build_object(
                        'id', rm.id,
                        'text', rm.text,
                        'user_id', rm.user_id,
                        'username', ru.login,
                        'name', ru.name,
                        'avatar', ru.avatar,
                        'message_type', rm.message_type
                    )
                ELSE NULL
            END as reply_to_message
     FROM messages m 
     JOIN users u ON m.user_id = u.id 
     LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = $2
     LEFT JOIN messages rm ON m.reply_to_message_id = rm.id
     LEFT JOIN users ru ON rm.user_id = ru.id
     WHERE m.chat_id = $1 
     ORDER BY m.timestamp DESC 
     LIMIT $3 OFFSET $4`,
        [chatId, userId, limit, offset]
    );
    
    const rows = res.rows;
    for (const row of rows) {
        if (row.game_invite_data) {
            try {
                const inviteData = typeof row.game_invite_data === 'string' 
                    ? JSON.parse(row.game_invite_data) 
                    : row.game_invite_data;
                
                if (inviteData.from_user_id) {
                    const fromUserRes = await pool.query("SELECT name, login, avatar FROM users WHERE id = $1", [inviteData.from_user_id]);
                    if (fromUserRes.rows[0]) {
                        inviteData.from_avatar = fromUserRes.rows[0].avatar;
                        inviteData.from_name = fromUserRes.rows[0].name;
                        if (!inviteData.from_username) {
                            inviteData.from_username = fromUserRes.rows[0].login;
                        }
                    }
                }
                
                if (inviteData.to_user_id) {
                    const toUserRes = await pool.query("SELECT name, login, avatar FROM users WHERE id = $1", [inviteData.to_user_id]);
                    if (toUserRes.rows[0]) {
                        inviteData.to_avatar = toUserRes.rows[0].avatar;
                        inviteData.to_name = toUserRes.rows[0].name;
                        if (!inviteData.to_username) {
                            inviteData.to_username = toUserRes.rows[0].login;
                        }
                    }
                }
                
                row.game_invite_data = inviteData;
            } catch (error) {
                console.error('Error updating game invite avatars:', error);
            }
        }
    }
    
    return rows;
};
export const getMyChatsDB = async (userId: number) => {

    const privateChats = await pool.query(`
        SELECT 
            c.id, c.privacy_type, c.chat_type, c.name,
            u.name as display_name, u.avatar, u.is_online as online, u.id as user_id, u.login as username,
            m.text as last_message, m.timestamp as last_timestamp,
            COALESCE(unread.unread_count, 0) as unread_count
        FROM chats c
        JOIN chat_participants cp ON c.id = cp.chat_id
        JOIN users u ON u.id = (SELECT cp2.user_id FROM chat_participants cp2 WHERE cp2.chat_id = c.id AND cp2.user_id != $1 LIMIT 1)
        LEFT JOIN LATERAL (
            SELECT text, timestamp FROM messages WHERE chat_id = c.id ORDER BY timestamp DESC LIMIT 1
        ) m ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*) as unread_count FROM messages m2 
            LEFT JOIN message_reads mr ON m2.id = mr.message_id AND mr.user_id = $1 
            WHERE m2.chat_id = c.id AND mr.read_at IS NULL AND m2.user_id != $1
        ) unread ON true
        WHERE cp.user_id = $1
    `, [userId]);

    const generalChat = await pool.query(`
        SELECT 
            'general' as id, 'public' as privacy_type, 'group' as chat_type, 'General' as name,
            'General' as display_name, null as avatar, null as online,
            m.text as last_message, m.timestamp as last_timestamp,
            COALESCE(unread.unread_count, 0) as unread_count
        FROM (SELECT 1) dummy
        LEFT JOIN LATERAL (
            SELECT text, timestamp FROM messages WHERE chat_id = 'general' ORDER BY timestamp DESC LIMIT 1
        ) m ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*) as unread_count FROM messages m2 
            LEFT JOIN message_reads mr ON m2.id = mr.message_id AND mr.user_id = $1 
            WHERE m2.chat_id = 'general' AND mr.read_at IS NULL AND m2.user_id != $1
        ) unread ON true
    `, [userId]);

    return [...privateChats.rows, ...generalChat.rows];
};
export const findUserByLogin = async (query: string) => {
    const res = await pool.query(
        "SELECT id, name, login as username, avatar FROM users WHERE login ILIKE $1 AND COALESCE(is_banned, FALSE) = FALSE LIMIT 5",
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
           SELECT json_build_object(
               'id', u2.id,
               'name', u2.name,
               'login', u2.login,
               'email', u2.email,
               'is_online', u2.is_online,
               'updated_at', FLOOR(EXTRACT(EPOCH FROM u2.updated_at) * 1000)::BIGINT,
               'avatar', u2.avatar
           )
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
    const userRes = await pool.query(
        `SELECT id, name, login, email, is_online, 
         COALESCE(FLOOR(EXTRACT(EPOCH FROM updated_at) * 1000)::BIGINT, 0) as updated_at, 
         avatar 
         FROM users WHERE login = $1`, 
        [targetLogin]
    );
    if (!userRes.rows.length) throw new Error("User not found");
    const targetUser = userRes.rows[0];
    
    // Ensure updated_at is a number, not a string
    if (targetUser.updated_at !== null && targetUser.updated_at !== undefined) {
        targetUser.updated_at = Number(targetUser.updated_at);
    }
    
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
export const getUnreadCount = async (chatId: string, userId: number) => {
    const res = await pool.query(
        `SELECT COUNT(*) 
     FROM messages m 
     LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = $2 
     WHERE m.chat_id = $1 AND mr.read_at IS NULL AND m.user_id != $2`,
        [chatId, userId]
    );
    return parseInt(res.rows[0].count);
};
export const deleteChatDB = async (chatId: string) => {
    const res = await pool.query("DELETE FROM chats WHERE id = $1 RETURNING *", [chatId])
    return res.rows;
}

export const clearChatHistoryDB = async (chatId: string) => {
    const res = await pool.query("DELETE FROM messages WHERE chat_id = $1 RETURNING *", [chatId])
    return res.rows;
}

export const deleteMessageDB = async (messageId: number, userId: number) => {
    const res = await pool.query(
        "DELETE FROM messages WHERE id = $1 AND user_id = $2 RETURNING *",
        [messageId, userId]
    );
    return res.rows[0] || null;
}