import { Response } from "express";
import {
    createPrivateChatDB,
    findUserByLogin,
    getMyChatsDB,
    checkChatExists,
    getMessagesFromDB,
    checkUserByLogin,
    getUnreadCount,
    deleteChatDB,
    clearChatHistoryDB,
    deleteMessageDB,
} from "../services/chat.service";
import { pool } from "../config/db";
import { io } from "../index";


export const getMyChats = async (req: any, res: Response) => {
    try {
        const chats = await getMyChatsDB(req.user.id);
        res.json(chats);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};




export const findChat = async (req: any, res: Response) => {
    const query = req.query.query as string;
    if (!query) return res.status(400).json({ error: "Query is required" });

    try {
        const users = await findUserByLogin(query);
        res.json(users);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const createPrivateChat = async (req: any, res: Response) => {
    try {
        const { friendId } = req.body;
        const chatId = await createPrivateChatDB(req.user.id, friendId);
        res.json({ chatId });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
};

export const getMessagesChat = async (req: any, res: Response) => {
    try {
        const { chatId } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;

        if (chatId !== 'general') {
            const chat = await checkChatExists(chatId, req.user.id);
            if (!chat) {
                return res.status(404).json({ error: "Chat not found or access denied" });
            }
        }

        const messages = await getMessagesFromDB(chatId, req.user.id, limit, offset);
        res.json(messages);
    } catch (error: any) {
        console.error('Error in getMessagesChat:', error);
        res.status(500).json({ error: error.message });
    }
};

export const getChat = async (req: any, res: Response) => {
    try {
        const { chatId } = req.params;

        if (chatId === "general") {
            // Get total participants count and online count for general chat
            const totalCountRes = await pool.query("SELECT COUNT(*) as total FROM users");
            const onlineCountRes = await pool.query("SELECT COUNT(*) as online FROM users WHERE is_online = TRUE");
            
            return res.json({
                chatId,
                chatExists: true,
                privacy_type: "public",
                chat_type: "group",
                name: "General",
                display_name: "General",
                canSend: true,
                participantsCount: parseInt(totalCountRes.rows[0].total),
                onlineCount: parseInt(onlineCountRes.rows[0].online)
            });
        }

        const chat = await checkChatExists(chatId, req.user.id);
        if (chat) {
            // Get user stats if it's a direct chat
            let userStats = null;
            if (chat.chat_type === 'direct' && chat.user) {
                const statsRes = await pool.query(
                    'SELECT COALESCE(games_count, 0) as games_count, COALESCE(wins_count, 0) as wins_count FROM users WHERE id = $1',
                    [chat.user.id]
                );
                if (statsRes.rows.length > 0) {
                    userStats = {
                        games_count: parseInt(statsRes.rows[0].games_count),
                        wins_count: parseInt(statsRes.rows[0].wins_count)
                    };
                }
            }
            
            return res.json({
                chatId,
                chatExists: true,
                privacy_type: chat.privacy_type,
                chat_type: chat.chat_type,
                name: chat.name,
                user: chat.user,
                display_name: chat.user.name,
                canSend: true,
                userStats
            });
        }

        const userResult = await checkUserByLogin(req.user.id, chatId);
        
        // Get user stats for direct chat
        let userStats = null;
        if (userResult.chat_type === 'direct' && userResult.targetUser) {
            const statsRes = await pool.query(
                'SELECT COALESCE(games_count, 0) as games_count, COALESCE(wins_count, 0) as wins_count FROM users WHERE id = $1',
                [userResult.targetUser.id]
            );
            if (statsRes.rows.length > 0) {
                userStats = {
                    games_count: parseInt(statsRes.rows[0].games_count),
                    wins_count: parseInt(statsRes.rows[0].wins_count)
                };
            }
        }
        
        return res.json({
            chatId: userResult.chatId || chatId,
            chatExists: userResult.chatExists,
            privacy_type: userResult.privacy_type,
            chat_type: userResult.chat_type,
            targetUser: userResult.targetUser,
            user: userResult.targetUser,
            display_name: userResult.display_name,
            canSend: true,
            userStats
        });
    } catch (error: any) {
        res.status(404).json({ error: error.message });
    }
};





export const deleteChat = async (req: any, res: Response) => {
    try {
        const { chatId } = req.params

        // Prevent deletion of general chat
        if (chatId === 'general') {
            return res.status(403).json({ success: false, message: "Cannot delete general chat" });
        }

        const participantsRes = await pool.query(
            "SELECT user_id FROM chat_participants WHERE chat_id = $1",
            [chatId]
        );

        const deletedChat = await deleteChatDB(chatId)
        if (!deletedChat) {
            return res.status(404).json({ success: false, message: "Chat not found" });
        }

        for (const participant of participantsRes.rows) {
            io.to(`user_${participant.user_id}`).emit("chat_deleted", {
                chatId
            });
        }

        return res.json({ success: true, chat: deletedChat });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}

export const clearChatHistory = async (req: any, res: Response) => {
    try {
        const { chatId } = req.params;

        // Prevent clearing history of general chat
        if (chatId === 'general') {
            return res.status(403).json({ success: false, message: "Cannot clear general chat history" });
        }

        const chat = await checkChatExists(chatId, req.user.id);
        if (!chat) {
            return res.status(404).json({ success: false, message: "Chat not found or access denied" });
        }

        const participantsRes = await pool.query(
            "SELECT user_id FROM chat_participants WHERE chat_id = $1",
            [chatId]
        );

        await clearChatHistoryDB(chatId);

        for (const participant of participantsRes.rows) {
            io.to(`user_${participant.user_id}`).emit("chat_history_cleared", {
                chatId
            });
        }

        return res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}



export const markMessagesAsRead = async (req: any, res: Response) => {
    try {
        const { chatId, messageIds, lastMessageId } = req.body;
        const userId = req.user.id;

        let affectedMessageIds = [];

        if (lastMessageId) {
            const messagesRes = await pool.query(
                `SELECT id FROM messages 
                WHERE chat_id = $1 AND id <= $2 AND user_id != $3
                ORDER BY id`,
                [chatId, lastMessageId, userId]
            );

            affectedMessageIds = messagesRes.rows.map(row => row.id);

            if (affectedMessageIds.length > 0) {
                await pool.query(
                    `INSERT INTO message_reads (message_id, user_id, read_at)
                    SELECT unnest($1::int[]), $2, CURRENT_TIMESTAMP
                    ON CONFLICT (message_id, user_id) 
                    DO UPDATE SET read_at = CURRENT_TIMESTAMP
                    WHERE message_reads.read_at IS NULL`,
                    [affectedMessageIds, userId]
                );
            }
        } else if (messageIds && messageIds.length > 0) {
            affectedMessageIds = messageIds;
            await pool.query(
                `INSERT INTO message_reads (message_id, user_id, read_at)
                SELECT unnest($1::int[]), $2, CURRENT_TIMESTAMP
                ON CONFLICT (message_id, user_id) 
                DO UPDATE SET read_at = CURRENT_TIMESTAMP
                WHERE message_reads.read_at IS NULL`,
                [messageIds, userId]
            );
        }


        if (affectedMessageIds.length > 0) {
            const messageSendersRes = await pool.query(
                "SELECT DISTINCT user_id FROM messages WHERE id = ANY($1) AND user_id != $2",
                [affectedMessageIds, userId]
            );
            const senderIds = messageSendersRes.rows.map(row => row.user_id);
            for (const senderId of senderIds) {
                io.to(`user_${senderId}`).emit("messages_read_by_other", {
                    chatId,
                    messageIds: affectedMessageIds,
                    readerId: userId,
                });
            }
        }

        let chatParticipantsRes;
        if (chatId === 'general') {
            chatParticipantsRes = await pool.query(
                "SELECT id AS user_id FROM users WHERE is_online = TRUE"
            );
        } else {
            chatParticipantsRes = await pool.query(
                "SELECT user_id FROM chat_participants WHERE chat_id = $1",
                [chatId]
            );
        }

        const lastMessageRes = await pool.query(
            "SELECT text, timestamp FROM messages WHERE chat_id = $1 ORDER BY timestamp DESC LIMIT 1",
            [chatId]
        );
        const last_message = lastMessageRes.rows[0]?.text || null;
        const last_timestamp = lastMessageRes.rows[0]?.timestamp || null;


        for (const participant of chatParticipantsRes.rows) {
            const unread_count = await getUnreadCount(chatId, participant.user_id);
            io.to(`user_${participant.user_id}`).emit("chat_update", {
                chatId,
                last_message,
                last_timestamp,
                unread_count,
            });
        }

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};


export const sendChatInvite = async (req: any, res: Response) => {
    try {
        const { chatId } = req.params;
        const chat = await checkChatExists(chatId, req.user.id);
        if (!chat) {
            return res.status(404).json({ error: "Chat not found or access denied" });
        }

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const deleteMessage = async (req: any, res: Response) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.id;

        const deletedMessage = await deleteMessageDB(parseInt(messageId), userId);
        if (!deletedMessage) {
            return res.status(404).json({ success: false, message: "Message not found or you don't have permission to delete it" });
        }

        // Emit message deletion to all chat participants
        io.to(deletedMessage.chat_id).emit("message_deleted", {
            messageId: deletedMessage.id,
            chatId: deletedMessage.chat_id
        });

        return res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};