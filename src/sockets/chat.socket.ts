import { Server, Socket } from "socket.io";
import { verify } from "jsonwebtoken";
import { getUnreadCount, saveMessageToDB } from "../services/chat.service";
import { pool } from "../config/db";

interface User {
  id: number;
  email: string;
  login: string;
}

declare module "socket.io" {
  interface SocketData {
    user: User;
  }
}

export const initChatSocket = (io: Server) => {
  io.use(async (socket: Socket, next) => {
    const token = socket.handshake.headers.cookie
      ?.split("; ")
      .find((row) => row.startsWith("token="))
      ?.split("=")[1];

    if (!token) return next(new Error("Authentication error: No token provided"));

    try {
      const decoded = verify(token, process.env.SECRET || "") as User;
      socket.data.user = decoded;

      await pool.query("UPDATE users SET is_online = TRUE WHERE id = $1", [decoded.id]);
      io.emit("user_status", { userId: decoded.id, isOnline: true });

      next();
    } catch {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    console.log(`User connected: ${socket.data.user.id}`);

    socket.on("join_chat", (chatId: string) => {
      if (chatId) socket.join(chatId);
    });

    socket.on("send_message", async ({ chatId, text }: { chatId: string; text: string }) => {
      if (!chatId || !text.trim()) return;

      const message = await saveMessageToDB({
        chatId,
        userId: socket.data.user.id,
        text,
        timestamp: new Date(),
      });

      io.to(chatId).emit("new_message", {
        id: message.id,
        userId: socket.data.user.id,
        username: socket.data.user.login,
        text,
        timestamp: message.timestamp,
        is_read: false,
      });

      if (chatId === 'general') {
        const allUsers = await pool.query("SELECT id FROM users WHERE is_online = TRUE");
        for (const user of allUsers.rows) {
          const unread_count = await getUnreadCount(chatId, user.id);
          io.to(`user_${user.id}`).emit("chat_update", {
            chatId,
            last_message: text,
            last_timestamp: message.timestamp,
            unread_count,
          });
        }
      } else {
        const participants = await pool.query(
          "SELECT user_id FROM chat_participants WHERE chat_id = $1",
          [chatId]
        );
        for (const participant of participants.rows) {
          const unread_count = await getUnreadCount(chatId, participant.user_id);
          io.to(`user_${participant.user_id}`).emit("chat_update", {
            chatId,
            last_message: text,
            last_timestamp: message.timestamp,
            unread_count,
          });
        }
      }
    });


    socket.on("disconnect", async () => {
      console.log(`User disconnected: ${socket.data.user.id}`);
      await pool.query("UPDATE users SET is_online = FALSE WHERE id = $1", [socket.data.user.id]);
      io.emit("user_status", { userId: socket.data.user.id, isOnline: false });
    });

    socket.join(`user_${socket.data.user.id}`);
  });
};









