import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { findUser, getUsersList, getTopUsers, getUserProfile } from "../controllers/user.controller";

const router = Router();

router.get("/search", authMiddleware, findUser);
router.get("/list", authMiddleware, getUsersList);
router.get("/rating", authMiddleware, getTopUsers);
router.get("/:id", authMiddleware, getUserProfile);

export default router;
