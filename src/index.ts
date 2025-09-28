import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import dotenv from "dotenv"
import authRoutes from "./routes/auth.routes"
import http from "http"
import { Server, Socket } from "socket.io"
import { verify } from "jsonwebtoken"
import { getMessagesFromDB, saveMessageToDB } from "./services/chat.service"

dotenv.config({ path: "../.env" })
const app = express()
const server = http.createServer(app)
const PORT = process.env.PORT
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
})
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));



app.use(express.json())
app.use(cookieParser())
app.use("/api/auth", authRoutes)



io.use((socket: Socket, next) => {
  const token = socket.handshake.headers.cookie
    ?.split('; ')
    .find((row) => row.startsWith('token='))
    ?.split('=')[1];

  if (!token) {
    return next(new Error('Authentication error: No token'));
  }


  try {
    const decoded = verify(token, process.env.SECRET || '') as { id: number; email: string; name: string };
    socket.data.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error: Invalid token'));
  }
})


io.on("connection", (socket: Socket) => {
  console.log(`User connected: ${socket.data.user.id}`)


  socket.on('join_chat', (chatId: string) => {
    socket.join(chatId)
    console.log(`User ${socket.data.user.id} joined ${chatId}`)
  })

  socket.on('send_message', async ({chatId, text}: {chatId: string; text: string;}) => {
    if(!text.trim()) return;


    const message = await saveMessageToDB({
      chatId,
      userId: socket.data.user.id,
      text,
      timestamp: new Date()
    })


    io.to(chatId).emit('new_message', {
      id: message.id,
      userId: socket.data.user.id,
      userName: socket.data.user.login,
      text,
      timestamp: message.timestamp
    })
  })


  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.data.user.id}`)
  })

})



app.get('/chats/:chatId/messages', async (req: express.Request, res: express.Response) => {
  const token = req.cookies?.token;
  if(!token) return res.status(401).json({error: "Нет токена"})

  try {
    verify(token, process.env.SECRET || "");
    const {chatId} = req.params;
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0

    const messages = await getMessagesFromDB(chatId, limit, offset);
    res.json(messages);
  } catch (err) {
    res.status(401).json({error: "Неправильный токен"})
  }
})





app.get('/api/health', (_req, res) => {
  res.status(200).json({ message: 'Server is running' });
});



server.listen(PORT, () => console.log("Сервер запущен на порту ", PORT))