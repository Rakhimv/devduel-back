import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { createPrivateChat, findChat, getMyChats, getMessagesChat, getChat, markMessagesAsRead, deleteChat, clearChatHistory } from "../controllers/chat.controller";

const router = Router();

router.get("/my", authMiddleware, getMyChats);
router.get("/search", authMiddleware, findChat);
router.get("/:chatId", authMiddleware, getChat);
router.post("/private", authMiddleware, createPrivateChat);
router.post("/:chatId/mark-read", authMiddleware, markMessagesAsRead);
router.post("/:chatId/clear", authMiddleware, clearChatHistory);
router.get("/:chatId/messages", authMiddleware, getMessagesChat);
router.delete("/:chatId", authMiddleware, deleteChat);

export default router;
