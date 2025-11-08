import { Router } from "express";
import { adminMiddleware } from "../middlewares/admin.middleware";
import { getUsers, banUser, unbanUser, getTasks, createTask, updateTask, deleteTask, getStatistics } from "../controllers/admin.controller";

const router = Router();

router.use(adminMiddleware);

router.get("/users", getUsers);
router.post("/users/:id/ban", banUser);
router.post("/users/:id/unban", unbanUser);

router.get("/tasks", getTasks);
router.post("/tasks", createTask);
router.put("/tasks/:id", updateTask);
router.delete("/tasks/:id", deleteTask);

router.get("/statistics", getStatistics);

export default router;

