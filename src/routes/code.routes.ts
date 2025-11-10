import { Router } from "express";
import { runCode } from "../controllers/code.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.post("/run", authMiddleware, runCode);

export default router;