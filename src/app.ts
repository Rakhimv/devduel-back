import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import authRoutes from "./routes/auth.routes";
import chatRoutes from "./routes/chat.routes";
import codeRoutes from "./routes/code.routes";
import gameRoutes from "./routes/game.routes";

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use('/avatars', express.static(path.join(__dirname, '../public/avatars')));

app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/code", codeRoutes);
app.use("/api/game", gameRoutes);



app.get("/api/health", (_req, res) => {
  res.status(200).json({ message: "Server is running" });
});

export default app;
