import { Response } from "express";
import {
    createPrivateChatDB,
    findUserByLogin,
    getMyChatsDB,
    checkChatExists,
    getMessagesFromDB,
    checkUserByLogin,
} from "../services/chat.service";

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

        const messages = await getMessagesFromDB(chatId, limit, offset);
        res.json(messages);
    } catch (error: any) {
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
                canSend: true,
            });
        }

        const chat = await checkChatExists(chatId, req.user.id);
        if (chat) {
            console.log(chat)
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
            display_name: userResult.display_name,
            canSend: true,
        });
    } catch (error: any) {
        res.status(404).json({ error: error.message });
    }
};