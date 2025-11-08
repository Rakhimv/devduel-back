import { Response } from "express";
import { findUserByLogin } from "../services/chat.service";
import { getAllUsers, getUserById, getTopUsersByWins } from "../services/user.service";
import { AuthRequest } from "../middlewares/auth.middleware";
import { pool } from "../config/db";

export const findUser = async (req: any, res: Response) => {
    const users = await findUserByLogin(req.user.login)
    res.json(users);
}

export const getUsersList = async (req: any, res: Response) => {
    try {
        const offset = parseInt(req.query.offset) || 0;
        const limit = parseInt(req.query.limit) || 100;
        
        const result = await getAllUsers(offset, limit);
        res.json(result);
    } catch (error) {
        console.error('Error getting users list:', error);
        res.status(500).json({ error: 'Failed to get users list' });
    }
}

export const getTopUsers = async (req: any, res: Response) => {
    try {
        const users = await getTopUsersByWins();
        res.json(users);
    } catch (error) {
        console.error('Error getting top users:', error);
        res.status(500).json({ error: 'Failed to get top users' });
    }
}

export const getUserProfile = async (req: any, res: Response) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        const user = await getUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(user);
    } catch (error) {
        console.error('Error getting user profile:', error);
        res.status(500).json({ error: 'Failed to get user profile' });
    }
}

export const deleteUser = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Не авторизован' });
        }

        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
        
        res.json({ message: 'Аккаунт успешно удален' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Ошибка удаления аккаунта' });
    }
};
