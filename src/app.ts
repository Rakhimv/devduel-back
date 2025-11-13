import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import authRoutes from "./routes/auth.routes";
import chatRoutes from "./routes/chat.routes";
import codeRoutes from "./routes/code.routes";
import gameRoutes from "./routes/game.routes";
import userRoutes from "./routes/user.routes";
import adminRoutes from "./routes/admin.routes";
import { pool } from "./config/db";

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use('/avatars', express.static(path.join(__dirname, '../public/avatars')));

app.get("/api/maintenance-mode", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT value FROM app_settings WHERE key = 'maintenance_mode'"
    );
    
    if (result.rows.length === 0) {
      return res.json({ enabled: false });
    }
    
    const setting = result.rows[0].value;
    res.json({ enabled: setting.enabled || false });
  } catch (error) {
    console.error('Error getting maintenance mode:', error);
    res.json({ enabled: false });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/code", codeRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);



app.get("/api/health", (_req, res) => {
  res.status(200).json({ message: "Server is running" });
});

export default app;
