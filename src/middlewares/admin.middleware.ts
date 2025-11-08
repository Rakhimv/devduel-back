import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
import { findByToken } from "../services/user.service";

export const adminMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).json({ error: "Нет токена" });
    }

    try {
        const user = await findByToken(token);
        if (!user) {
            return res.status(401).json({ error: "Пользователь не найден" });
        }

        if (user.role !== 'admin') {
            return res.status(403).json({ error: "Доступ запрещен" });
        }

        req.user = user as any;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Недействительный токен" });
    }
};

