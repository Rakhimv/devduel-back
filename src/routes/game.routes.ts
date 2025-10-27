import { Router } from "express";
import { getProgress, submitSolution, getTaskTemplateController } from "../controllers/game.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.get("/task/:taskId/template", getTaskTemplateController);
router.get("/progress/:gameId", authMiddleware, getProgress);
router.post("/submit", authMiddleware, submitSolution);

export default router;

