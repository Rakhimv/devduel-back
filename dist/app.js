"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const path_1 = __importDefault(require("path"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const chat_routes_1 = __importDefault(require("./routes/chat.routes"));
const code_routes_1 = __importDefault(require("./routes/code.routes"));
const game_routes_1 = __importDefault(require("./routes/game.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const db_1 = require("./config/db");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: [process.env.FRONTEND_ORIGIN || "http://localhost:5173", "https://devduel-phi.vercel.app"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use('/avatars', express_1.default.static(path_1.default.join(__dirname, '../public/avatars')));
app.get("/api/maintenance-mode", async (_req, res) => {
    try {
        const result = await db_1.pool.query("SELECT value FROM app_settings WHERE key = 'maintenance_mode'");
        if (result.rows.length === 0) {
            return res.json({ enabled: false });
        }
        const setting = result.rows[0].value;
        res.json({ enabled: setting.enabled || false });
    }
    catch (error) {
        console.error('Error getting maintenance mode:', error);
        res.json({ enabled: false });
    }
});
app.use("/api/auth", auth_routes_1.default);
app.use("/api/chats", chat_routes_1.default);
app.use("/api/code", code_routes_1.default);
app.use("/api/game", game_routes_1.default);
app.use("/api/users", user_routes_1.default);
app.use("/api/admin", admin_routes_1.default);
app.get("/api/health", (_req, res) => {
    res.status(200).json({ message: "Server is running" });
});
exports.default = app;
