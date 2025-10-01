import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { getMyChats } from "../controllers/chat.controller";
import { findUser } from "../controllers/user.controller";

const router = Router();

router.get("/search", authMiddleware, findUser);

export default router;
