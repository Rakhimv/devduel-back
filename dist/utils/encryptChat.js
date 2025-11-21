"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptChatId = exports.encryptChatId = void 0;
const crypto_1 = __importDefault(require("crypto"));
const ENCRYPTION_KEY = process.env.CHAT_ENCRYPTION_KEY || "abc";
const KEY = crypto_1.default.createHash('sha256').update(ENCRYPTION_KEY).digest();
const encryptChatId = (userId1, userId2) => {
    const minId = Math.min(userId1, userId2);
    const maxId = Math.max(userId1, userId2);
    const data = `${minId},${maxId}`;
    const iv = crypto_1.default.randomBytes(16);
    const cipher = crypto_1.default.createCipheriv('aes-256-cbc', KEY, iv);
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    const combined = Buffer.concat([iv, encrypted]);
    return combined.toString('base64');
};
exports.encryptChatId = encryptChatId;
const decryptChatId = (encryptedId) => {
    try {
        const bytes = Buffer.from(encryptedId, 'base64');
        const iv = bytes.slice(0, 16);
        const encrypted = bytes.slice(16);
        const decipher = crypto_1.default.createDecipheriv('aes-256-cbc', KEY, iv);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
        const [userId1, userId2] = decrypted.split(',').map(Number);
        return { userId1, userId2 };
    }
    catch {
        return null;
    }
};
exports.decryptChatId = decryptChatId;
