import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { createPrivateChat, findChat, getMyChats, getMessagesChat, getChat, markMessagesAsRead, deleteChat, clearChatHistory, sendChatInvite, deleteMessage } from "../controllers/chat.controller";

const router = Router();

router.get("/my", authMiddleware, getMyChats);
router.get("/search", authMiddleware, findChat);
router.get("/:chatId", authMiddleware, getChat);
router.post("/private", authMiddleware, createPrivateChat);
router.post("/:chatId/mark-read", authMiddleware, markMessagesAsRead);
router.post("/:chatId/clear", authMiddleware, clearChatHistory);
router.get("/:chatId/messages", authMiddleware, getMessagesChat);
router.get("/:chatId/invite", authMiddleware, sendChatInvite);
router.delete("/:chatId", authMiddleware, deleteChat);
router.delete("/messages/:messageId", authMiddleware, deleteMessage);

export default router;
