import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { getMyChats } from "../controllers/chat.controller";
import { findUser, getUsersList, getUserProfile } from "../controllers/user.controller";

const router = Router();

router.get("/search", authMiddleware, findUser);
router.get("/list", authMiddleware, getUsersList);
router.get("/:id", authMiddleware, getUserProfile);

export default router;
