import crypto from "crypto";

const ENCRYPTION_KEY = process.env.CHAT_ENCRYPTION_KEY || "abc";

const KEY = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest(); 

export const encryptChatId = (userId1: number, userId2: number): string => {
    const minId = Math.min(userId1, userId2);
    const maxId = Math.max(userId1, userId2);
    const data = `${minId},${maxId}`;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv);
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    const combined = Buffer.concat([iv, encrypted]);
    return combined.toString('base64'); 
}
export const decryptChatId = (encryptedId: string): { userId1: number; userId2: number } | null => {
    try {
        const bytes = Buffer.from(encryptedId, 'base64'); 
        const iv = bytes.slice(0, 16);
        const encrypted = bytes.slice(16);
        const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, iv);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
        const [userId1, userId2] = decrypted.split(',').map(Number);
        return { userId1, userId2 };
    } catch {
        return null;
    }
}