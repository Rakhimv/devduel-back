import { Server, Socket } from "socket.io";
import { verify } from "jsonwebtoken";
import { saveMessageToDB } from "../services/chat.service";

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
  io.use((socket: Socket, next) => {
    const token = socket.handshake.headers.cookie
      ?.split("; ")
      .find((row) => row.startsWith("token="))
      ?.split("=")[1];

    if (!token) return next(new Error("Authentication error: No token provided"));

     try {
       const decoded = verify(token, process.env.SECRET || "") as User;
       socket.data.user = decoded;
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
      });
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.data.user.id}`);
    });
  });
};