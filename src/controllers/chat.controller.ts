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
            return res.json({
                chatId,
                chatExists: true,
                privacy_type: "public",
                chat_type: "group",
                name: "General",
                display_name: "General",
                canSend: true
            });
        }

        const chat = await checkChatExists(chatId, req.user.id);
        if (chat) {
            return res.json({
                chatId,
                chatExists: true,
                privacy_type: chat.privacy_type,
                chat_type: chat.chat_type,
                name: chat.name,
                user: chat.user,
                display_name: chat.user.name,
                canSend: true,
            });
        }

        const userResult = await checkUserByLogin(req.user.id, chatId);
        return res.json({
            chatId: userResult.chatId || chatId,
            chatExists: userResult.chatExists,
            privacy_type: userResult.privacy_type,
            chat_type: userResult.chat_type,
            targetUser: userResult.targetUser,
            user: userResult.targetUser,
            display_name: userResult.display_name,
            canSend: true,
        });
    } catch (error: any) {
        res.status(404).json({ error: error.message });
    }
};





export const deleteChat = async (req: any, res: Response) => {
    try {
        const { chatId } = req.params
        
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
        
        // Проверяем доступ к чату
        const chat = await checkChatExists(chatId, req.user.id);
        if (!chat) {
            return res.status(404).json({ success: false, message: "Chat not found or access denied" });
        }

        // Получаем участников чата
        const participantsRes = await pool.query(
            "SELECT user_id FROM chat_participants WHERE chat_id = $1",
            [chatId]
        );
        
        // Очищаем историю
        await clearChatHistoryDB(chatId);

        // Уведомляем всех участников об очистке истории
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