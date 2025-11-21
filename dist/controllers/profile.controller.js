"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeName = exports.changePassword = exports.uploadAvatar = exports.upload = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const db_1 = require("../config/db");
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path_1.default.join(__dirname, '../../public/avatars');
        if (!fs_1.default.existsSync(uploadPath)) {
            fs_1.default.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const userId = req.user?.id;
        const ext = path_1.default.extname(file.originalname);
        cb(null, `${userId}${ext}`);
    }
});
exports.upload = (0, multer_1.default)({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only image files are allowed'));
        }
    }
});
const uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const userId = req.user.id;
        const avatarPath = `/avatars/${req.file.filename}`;
        const oldAvatarRes = await db_1.pool.query('SELECT avatar FROM users WHERE id = $1', [userId]);
        const oldAvatar = oldAvatarRes.rows[0]?.avatar;
        await db_1.pool.query('UPDATE users SET avatar = $1 WHERE id = $2', [avatarPath, userId]);
        if (oldAvatar && oldAvatar !== avatarPath) {
            const oldAvatarPath = path_1.default.join(__dirname, '../../public', oldAvatar);
            if (fs_1.default.existsSync(oldAvatarPath)) {
                try {
                    fs_1.default.unlinkSync(oldAvatarPath);
                }
                catch (unlinkError) {
                    console.error('Error deleting old avatar:', unlinkError);
                }
            }
        }
        res.json({
            message: 'Avatar updated successfully',
            avatar: avatarPath
        });
    }
    catch (error) {
        console.error('Error uploading avatar:', error);
        res.status(500).json({ error: 'Failed to upload avatar' });
    }
};
exports.uploadAvatar = uploadAvatar;
const changePassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        const userId = req.user.id;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }
        const hashedPassword = await bcrypt_1.default.hash(newPassword, 10);
        await db_1.pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);
        res.json({ message: 'Password changed successfully' });
    }
    catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
};
exports.changePassword = changePassword;
const changeName = async (req, res) => {
    try {
        const { name } = req.body;
        const userId = req.user.id;
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Name cannot be empty' });
        }
        if (name.length > 50) {
            return res.status(400).json({ error: 'Name must be less than 50 characters' });
        }
        await db_1.pool.query('UPDATE users SET name = $1 WHERE id = $2', [name.trim(), userId]);
        const result = await db_1.pool.query('SELECT name FROM users WHERE id = $1', [userId]);
        res.json({ message: 'Name changed successfully', name: result.rows[0].name });
    }
    catch (error) {
        console.error('Error changing name:', error);
        res.status(500).json({ error: 'Failed to change name' });
    }
};
exports.changeName = changeName;
