import dotenv from "dotenv"
dotenv.config()


import http from "http"
import { Server } from "socket.io"
import app from "./app"
import { initChatSocket } from "./sockets/chat.socket"


const server = http.createServer(app)
export const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});



initChatSocket(io)


const PORT = process.env.PORT
server.listen(PORT, () => console.log("Сервер запущен на порту ", PORT))