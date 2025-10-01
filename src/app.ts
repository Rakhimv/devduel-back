import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import authRoutes from "./routes/auth.routes";
import chatRoutes from "./routes/chat.routes";

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Статические файлы для аватарок
app.use('/avatars', express.static(path.join(__dirname, '../public/avatars')));

app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);



app.get("/api/health", (_req, res) => {
  res.status(200).json({ message: "Server is running" });
});

export default app;
