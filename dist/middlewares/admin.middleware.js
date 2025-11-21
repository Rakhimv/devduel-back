"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminMiddleware = void 0;
const user_service_1 = require("../services/user.service");
const adminMiddleware = async (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).json({ error: "Нет токена" });
    }
    try {
        const user = await (0, user_service_1.findByToken)(token);
        if (!user) {
            return res.status(401).json({ error: "Пользователь не найден" });
        }
        if (user.role !== 'admin') {
            return res.status(403).json({ error: "Доступ запрещен" });
        }
        req.user = user;
        next();
    }
    catch (err) {
        return res.status(401).json({ error: "Недействительный токен" });
    }
};
exports.adminMiddleware = adminMiddleware;
