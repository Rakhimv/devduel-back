"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.getUserProfile = exports.getTopUsers = exports.getUsersList = exports.findUser = void 0;
const chat_service_1 = require("../services/chat.service");
const user_service_1 = require("../services/user.service");
const db_1 = require("../config/db");
const findUser = async (req, res) => {
    const users = await (0, chat_service_1.findUserByLogin)(req.user.login);
    res.json(users);
};
exports.findUser = findUser;
const getUsersList = async (req, res) => {
    try {
        const offset = parseInt(req.query.offset) || 0;
        const limit = parseInt(req.query.limit) || 100;
        const result = await (0, user_service_1.getAllUsers)(offset, limit);
        res.json(result);
    }
    catch (error) {
        console.error('Error getting users list:', error);
        res.status(500).json({ error: 'Failed to get users list' });
    }
};
exports.getUsersList = getUsersList;
const getTopUsers = async (req, res) => {
    try {
        const users = await (0, user_service_1.getTopUsersByWins)();
        res.json(users);
    }
    catch (error) {
        console.error('Error getting top users:', error);
        res.status(500).json({ error: 'Failed to get top users' });
    }
};
exports.getTopUsers = getTopUsers;
const getUserProfile = async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        const user = await (0, user_service_1.getUserById)(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    }
    catch (error) {
        console.error('Error getting user profile:', error);
        res.status(500).json({ error: 'Failed to get user profile' });
    }
};
exports.getUserProfile = getUserProfile;
const deleteUser = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Не авторизован' });
        }
        await db_1.pool.query('DELETE FROM users WHERE id = $1', [userId]);
        res.json({ message: 'Аккаунт успешно удален' });
    }
    catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Ошибка удаления аккаунта' });
    }
};
exports.deleteUser = deleteUser;
