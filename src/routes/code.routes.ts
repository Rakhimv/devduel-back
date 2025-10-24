import { Router } from "express";
import { runCode } from "../controllers/code.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// POST /api/code/run
router.post("/run", authMiddleware, runCode);

export default router;