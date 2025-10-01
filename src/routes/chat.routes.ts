import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { createPrivateChat, findChat, getMyChats, getMessagesChat, getChat } from "../controllers/chat.controller";

const router = Router();

router.get("/my", authMiddleware, getMyChats);
router.get("/search", authMiddleware, findChat);
router.get("/:chatId", authMiddleware, getChat);
router.post("/private", authMiddleware, createPrivateChat);

router.get("/:chatId/messages", authMiddleware, getMessagesChat);

export default router;
