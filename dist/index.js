"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const app_1 = __importDefault(require("./app"));
const chat_socket_1 = require("./sockets/chat.socket");
const server = http_1.default.createServer(app_1.default);
exports.io = new socket_io_1.Server(server, {
    cors: {
        origin: [
            process.env.FRONTEND_ORIGIN || "http://localhost:5173",
            "https://devduel-phi.vercel.app"
        ],
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true
});
const resetOnlineStatus = async () => {
    try {
    }
    catch (error) {
        console.error("Ошибка при сбросе статуса пользователей:", error);
    }
};
resetOnlineStatus().then(async () => {
    await (0, chat_socket_1.initChatSocket)(exports.io);
});
const PORT = process.env.PORT;
const HOST = process.env.HOST;
server.listen(PORT, Number(HOST), () => console.log("Сервер запущен на порту ", PORT));
