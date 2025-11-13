import dotenv from "dotenv"
dotenv.config()


import http from "http"
import { Server } from "socket.io"
import app from "./app"
import { initChatSocket } from "./sockets/chat.socket"
import { pool } from "./config/db"


const server = http.createServer(app)
export const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

const resetOnlineStatus = async () => {
  try {
    // await pool.query("UPDATE users SET is_online = FALSE");
  } catch (error) {
    console.error("Ошибка при сбросе статуса пользователей:", error);
  }
};

resetOnlineStatus().then(async () => {
  await initChatSocket(io);
});


const PORT = process.env.PORT
const HOST = process.env.HOST
server.listen(PORT, Number(HOST), () => console.log("Сервер запущен на порту ", PORT))