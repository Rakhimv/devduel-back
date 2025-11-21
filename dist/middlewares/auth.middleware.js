"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logENV = exports.authMiddleware = void 0;
const jsonwebtoken_1 = require("jsonwebtoken");
const authMiddleware = (req, res, next) => {
    const token = req.cookies?.token;
    if (!token)
        return res.status(401).json({ error: "Нет токена" });
    try {
        const decoded = (0, jsonwebtoken_1.verify)(token, process.env.SECRET || "");
        req.user = decoded;
        next();
    }
    catch (err) {
        return res.status(401).json({ error: "Нет токена" });
    }
};
exports.authMiddleware = authMiddleware;
const logENV = () => {
    console.log(process.env.SECRET);
};
exports.logENV = logENV;
