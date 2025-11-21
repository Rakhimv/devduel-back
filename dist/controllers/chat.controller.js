"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMessage = exports.sendChatInvite = exports.markMessagesAsRead = exports.clearChatHistory = exports.deleteChat = exports.getChat = exports.getMessagesChat = exports.createPrivateChat = exports.findChat = exports.getMyChats = void 0;
const chat_service_1 = require("../services/chat.service");
const db_1 = require("../config/db");
const index_1 = require("../index");
const getMyChats = async (req, res) => {
    try {
        const chats = await (0, chat_service_1.getMyChatsDB)(req.user.id);
        res.json(chats);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getMyChats = getMyChats;
const findChat = async (req, res) => {
    const query = req.query.query;
    if (!query)
        return res.status(400).json({ error: "Query is required" });
    try {
        const users = await (0, chat_service_1.findUserByLogin)(query);
        res.json(users);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.findChat = findChat;
const createPrivateChat = async (req, res) => {
    try {
        const { friendId } = req.body;
        const chatId = await (0, chat_service_1.createPrivateChatDB)(req.user.id, friendId);
        res.json({ chatId });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.createPrivateChat = createPrivateChat;
const getMessagesChat = async (req, res) => {
    try {
        const { chatId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        if (chatId !== 'general') {
            const chat = await (0, chat_service_1.checkChatExists)(chatId, req.user.id);
            if (!chat) {
                return res.status(404).json({ error: "Chat not found or access denied" });
            }
        }
        const messages = await (0, chat_service_1.getMessagesFromDB)(chatId, req.user.id, limit, offset);
        res.json(messages);
    }
    catch (error) {
        console.error('Error in getMessagesChat:', error);
        res.status(500).json({ error: error.message });
    }
};
exports.getMessagesChat = getMessagesChat;
const getChat = async (req, res) => {
    try {
        const { chatId } = req.params;
        if (chatId === "general") {
            const totalCountRes = await db_1.pool.query("SELECT COUNT(*) as total FROM users");
            const onlineCountRes = await db_1.pool.query("SELECT COUNT(*) as online FROM users WHERE is_online = TRUE");
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
        const chat = await (0, chat_service_1.checkChatExists)(chatId, req.user.id);
        if (chat) {
            let userStats = null;
            if (chat.chat_type === 'direct' && chat.user) {
                const statsRes = await db_1.pool.query('SELECT COALESCE(games_count, 0) as games_count, COALESCE(wins_count, 0) as wins_count FROM users WHERE id = $1', [chat.user.id]);
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
        const userResult = await (0, chat_service_1.checkUserByLogin)(req.user.id, chatId);
        if (userResult.targetUser && !userResult.targetUser.updated_at) {
            console.warn('updated_at missing in targetUser from checkUserByLogin:', userResult.targetUser);
        }
        let userStats = null;
        if (userResult.chat_type === 'direct' && userResult.targetUser) {
            const statsRes = await db_1.pool.query('SELECT COALESCE(games_count, 0) as games_count, COALESCE(wins_count, 0) as wins_count FROM users WHERE id = $1', [userResult.targetUser.id]);
            if (statsRes.rows.length > 0) {
                userStats = {
                    games_count: parseInt(statsRes.rows[0].games_count),
                    wins_count: parseInt(statsRes.rows[0].wins_count)
                };
            }
        }
        const userData = userResult.targetUser ? {
            ...userResult.targetUser,
            updated_at: userResult.targetUser.updated_at || null
        } : null;
        return res.json({
            chatId: userResult.chatId || chatId,
            chatExists: userResult.chatExists,
            privacy_type: userResult.privacy_type,
            chat_type: userResult.chat_type,
            targetUser: userData,
            user: userData,
            display_name: userResult.display_name,
            canSend: true,
            userStats
        });
    }
    catch (error) {
        res.status(404).json({ error: error.message });
    }
};
exports.getChat = getChat;
const deleteChat = async (req, res) => {
    try {
        const { chatId } = req.params;
        if (chatId === 'general') {
            return res.status(403).json({ success: false, message: "Cannot delete general chat" });
        }
        const participantsRes = await db_1.pool.query("SELECT user_id FROM chat_participants WHERE chat_id = $1", [chatId]);
        const deletedChat = await (0, chat_service_1.deleteChatDB)(chatId);
        if (!deletedChat) {
            return res.status(404).json({ success: false, message: "Chat not found" });
        }
        for (const participant of participantsRes.rows) {
            index_1.io.to(`user_${participant.user_id}`).emit("chat_deleted", {
                chatId
            });
        }
        return res.json({ success: true, chat: deletedChat });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.deleteChat = deleteChat;
const clearChatHistory = async (req, res) => {
    try {
        const { chatId } = req.params;
        if (chatId === 'general') {
            return res.status(403).json({ success: false, message: "Cannot clear general chat history" });
        }
        const chat = await (0, chat_service_1.checkChatExists)(chatId, req.user.id);
        if (!chat) {
            return res.status(404).json({ success: false, message: "Chat not found or access denied" });
        }
        const participantsRes = await db_1.pool.query("SELECT user_id FROM chat_participants WHERE chat_id = $1", [chatId]);
        await (0, chat_service_1.clearChatHistoryDB)(chatId);
        for (const participant of participantsRes.rows) {
            index_1.io.to(`user_${participant.user_id}`).emit("chat_history_cleared", {
                chatId
            });
        }
        return res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.clearChatHistory = clearChatHistory;
const markMessagesAsRead = async (req, res) => {
    try {
        const { chatId, messageIds, lastMessageId } = req.body;
        const userId = req.user.id;
        let affectedMessageIds = [];
        if (lastMessageId) {
            const messagesRes = await db_1.pool.query(`SELECT id FROM messages 
                WHERE chat_id = $1 AND id <= $2 AND user_id != $3
                ORDER BY id`, [chatId, lastMessageId, userId]);
            affectedMessageIds = messagesRes.rows.map(row => row.id);
            if (affectedMessageIds.length > 0) {
                await db_1.pool.query(`INSERT INTO message_reads (message_id, user_id, read_at)
                    SELECT unnest($1::int[]), $2, CURRENT_TIMESTAMP
                    ON CONFLICT (message_id, user_id) 
                    DO UPDATE SET read_at = CURRENT_TIMESTAMP
                    WHERE message_reads.read_at IS NULL`, [affectedMessageIds, userId]);
            }
        }
        else if (messageIds && messageIds.length > 0) {
            affectedMessageIds = messageIds;
            await db_1.pool.query(`INSERT INTO message_reads (message_id, user_id, read_at)
                SELECT unnest($1::int[]), $2, CURRENT_TIMESTAMP
                ON CONFLICT (message_id, user_id) 
                DO UPDATE SET read_at = CURRENT_TIMESTAMP
                WHERE message_reads.read_at IS NULL`, [messageIds, userId]);
        }
        if (affectedMessageIds.length > 0) {
            const messageSendersRes = await db_1.pool.query("SELECT DISTINCT user_id FROM messages WHERE id = ANY($1) AND user_id != $2", [affectedMessageIds, userId]);
            const senderIds = messageSendersRes.rows.map(row => row.user_id);
            for (const senderId of senderIds) {
                index_1.io.to(`user_${senderId}`).emit("messages_read_by_other", {
                    chatId,
                    messageIds: affectedMessageIds,
                    readerId: userId,
                });
            }
        }
        let chatParticipantsRes;
        if (chatId === 'general') {
            chatParticipantsRes = await db_1.pool.query("SELECT id AS user_id FROM users WHERE is_online = TRUE");
        }
        else {
            chatParticipantsRes = await db_1.pool.query("SELECT user_id FROM chat_participants WHERE chat_id = $1", [chatId]);
        }
        const lastMessageRes = await db_1.pool.query("SELECT text, timestamp FROM messages WHERE chat_id = $1 ORDER BY timestamp DESC LIMIT 1", [chatId]);
        const last_message = lastMessageRes.rows[0]?.text || null;
        const last_timestamp = lastMessageRes.rows[0]?.timestamp || null;
        for (const participant of chatParticipantsRes.rows) {
            const unread_count = await (0, chat_service_1.getUnreadCount)(chatId, participant.user_id);
            index_1.io.to(`user_${participant.user_id}`).emit("chat_update", {
                chatId,
                last_message,
                last_timestamp,
                unread_count,
            });
        }
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.markMessagesAsRead = markMessagesAsRead;
const sendChatInvite = async (req, res) => {
    try {
        const { chatId } = req.params;
        const chat = await (0, chat_service_1.checkChatExists)(chatId, req.user.id);
        if (!chat) {
            return res.status(404).json({ error: "Chat not found or access denied" });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.sendChatInvite = sendChatInvite;
const deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.id;
        const deletedMessage = await (0, chat_service_1.deleteMessageDB)(parseInt(messageId), userId);
        if (!deletedMessage) {
            return res.status(404).json({ success: false, message: "Message not found or you don't have permission to delete it" });
        }
        index_1.io.to(deletedMessage.chat_id).emit("message_deleted", {
            messageId: deletedMessage.id,
            chatId: deletedMessage.chat_id
        });
        return res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.deleteMessage = deleteMessage;
