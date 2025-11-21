"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRefreshToken = exports.verifyToken = exports.generateRefreshToken = exports.generateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const SECRET = process.env.SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET || SECRET + "_refresh";
if (!SECRET) {
    throw new Error("Нет SECRET в .env");
}
const generateToken = (name, id, login) => {
    return jsonwebtoken_1.default.sign({ name, id, login }, SECRET, { expiresIn: "15m" });
};
exports.generateToken = generateToken;
const generateRefreshToken = (id) => {
    return jsonwebtoken_1.default.sign({ id }, REFRESH_SECRET, { expiresIn: "180d" });
};
exports.generateRefreshToken = generateRefreshToken;
const verifyToken = (token) => {
    return jsonwebtoken_1.default.verify(token, SECRET);
};
exports.verifyToken = verifyToken;
const verifyRefreshToken = (token) => {
    return jsonwebtoken_1.default.verify(token, REFRESH_SECRET);
};
exports.verifyRefreshToken = verifyRefreshToken;
