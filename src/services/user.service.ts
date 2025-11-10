import bcrypt from "bcrypt"
import { pool } from "../config/db"
import { User } from "../models/user.model"
import jwt from "jsonwebtoken"
import { downloadAndSaveAvatar } from "../utils/avatarUtils"

const SECRET = process.env.SECRET

if (!SECRET) throw new Error("Нет SECRET")

export const findByEmail = async (email: string): Promise<User | null> => {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email])
    return result.rows[0] || null
}

export const findByLogin = async (login: string): Promise<User | null> => {
    const result = await pool.query("SELECT * FROM users WHERE login = $1", [login])
    return result.rows[0]
}

export const findByEmailOrLogin = async (login: string): Promise<User | null> => {
    const result = await pool.query("SELECT * FROM users WHERE login = $1 OR email = $1", [login])
    return result.rows[0] || null
}

export const saveRefreshToken = async (userId: number, refreshToken: string): Promise<void> => {
    await pool.query(
        "UPDATE users SET refresh_token = $1 WHERE id = $2",
        [refreshToken, userId]
    )
}

export const findByRefreshToken = async (refreshToken: string): Promise<User | null> => {
    const result = await pool.query("SELECT * FROM users WHERE refresh_token = $1", [refreshToken])
    return result.rows[0] || null
}

export const clearRefreshToken = async (userId: number): Promise<void> => {
    await pool.query(
        "UPDATE users SET refresh_token = NULL WHERE id = $2",
        [userId]
    )
}

export const createUser = async (name: string, login: string, email: string, password: string): Promise<User> => {
    const hashed = await bcrypt.hash(password, 10)
    const result = await pool.query(
        "INSERT INTO users (name, login, email, password) VALUES ($1, $2, $3, $4) RETURNING *",
        [name, login, email, hashed]
    )
    return result.rows[0]
}

export const findByToken = async (token: any): Promise<User | null> => {
    const decoded = jwt.verify(token, SECRET) as { id?: number; sub?: number };
    const userId = decoded?.id ?? decoded?.sub;
    if (!userId) return null;
    const result = await pool.query("SELECT *, COALESCE(games_count, 0) as games_count, COALESCE(wins_count, 0) as wins_count, COALESCE(is_banned, FALSE) as is_banned FROM users WHERE id = $1", [userId])
    return result.rows[0] || null;
}


export const findOrCreateUser_Github = async (githubUser: any): Promise<User | null> => {
    try {
        const { rows: existingUser } = await pool.query(
            'SELECT * FROM users WHERE login = $1 AND provider = $2',
            [githubUser.login, 'github']
        );

        if (existingUser.length > 0) {
            const updated = await pool.query(
                'UPDATE users SET name = $1, avatar = CASE WHEN avatar IS NULL THEN $2 ELSE avatar END, updated_at = NOW() WHERE login = $3 AND provider = $4 RETURNING *',
                [githubUser.name, githubUser.avatar_url, githubUser.login, 'github']
            );
            return updated.rows[0];
        }

        const { rows: newUser } = await pool.query(
            'INSERT INTO users (name, login, email, password, avatar, provider, role) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [githubUser.name, githubUser.login, githubUser.email || null, 'oauth', githubUser.avatar_url, 'github', 'user']
        );
        return newUser[0];
    } catch (err: any) {
        throw new Error('Failed to find or create user: ' + err.message);
    }
};

export const findOrCreateUser_Yandex = async (yandexUser: any): Promise<User | null> => {
    try {
        const { rows: existingUser } = await pool.query(
            'SELECT * FROM users WHERE login = $1 AND provider = $2',
            [yandexUser.login, 'yandex']
        );

        if (existingUser.length > 0) {
            const updated = await pool.query(
                'UPDATE users SET name = $1, avatar = CASE WHEN avatar IS NULL THEN $2 ELSE avatar END, updated_at = NOW() WHERE login = $3 AND provider = $4 RETURNING *',
                [yandexUser.real_name || yandexUser.display_name, `https://avatars.yandex.net/get-yapic/${yandexUser.default_avatar_id}/islands-200`, yandexUser.login, 'yandex']
            );
            return updated.rows[0];
        }

        const { rows: newUser } = await pool.query(
            'INSERT INTO users (name, login, email, password, avatar, provider, role) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [yandexUser.real_name || yandexUser.display_name, yandexUser.login, yandexUser.default_email || null, 'oauth', `https://avatars.yandex.net/get-yapic/${yandexUser.default_avatar_id}/islands-200`, 'yandex', 'user']
        );
        return newUser[0];
    } catch (err: any) {
        throw new Error('Failed to find or create user: ' + err.message);
    }
};





async function generateLogin(base: string): Promise<string> {
    let candidate = base;
    let counter = 1;
    while (true) {
        const { rows } = await pool.query('SELECT 1 FROM users WHERE login = $1', [candidate]);
        if (rows.length === 0) return candidate;
        candidate = `${base}${counter++}`;
    }
}

export const findOrCreateUser_Google = async (googleUser: any): Promise<User | null> => {
    try {
        
        const { rows: existingUsers } = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [googleUser.email]
        );

        if (existingUsers.length > 0) {
            return existingUsers[0];
        }

        const baseLogin = googleUser.email.split('@')[0];
        const login = await generateLogin(baseLogin);
        
        let avatarPath = null;
        try {
            if (googleUser.picture) {
                avatarPath = await downloadAndSaveAvatar(googleUser.picture);
            }
        } catch (avatarError) {
            console.warn('Failed to save avatar, using original URL:', avatarError);
            avatarPath = googleUser.picture; 
        }
        
        const { rows: newUser } = await pool.query(
            'INSERT INTO users (name, login, email, password, avatar, provider, role) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [googleUser.name, login, googleUser.email, 'oauth', avatarPath, 'google', 'user']
        );

        return newUser[0] || null;
    } catch (err: any) {
        console.error('Error in findOrCreateUser_Google:', err);
        throw new Error('Failed to find or create user: ' + err.message);
    }
};

export const getAllUsers = async (offset: number = 0, limit: number = 100): Promise<{users: User[], total: number}> => {
    try {
        const maxLimit = Math.min(limit, 100);
        const actualOffset = Math.max(0, offset);

        const result = await pool.query(
            'SELECT id, name, login, avatar, created_at, is_online, COALESCE(games_count, 0) as games_count, COALESCE(wins_count, 0) as wins_count FROM users WHERE COALESCE(is_banned, FALSE) = FALSE ORDER BY created_at ASC LIMIT $1 OFFSET $2',
            [maxLimit, actualOffset]
        );

        const countResult = await pool.query('SELECT COUNT(*) as total FROM users WHERE COALESCE(is_banned, FALSE) = FALSE');
        const total = parseInt(countResult.rows[0].total);

        return {
            users: result.rows,
            total
        };
    } catch (err: any) {
        console.error('Error getting all users:', err);
        throw new Error('Failed to get users: ' + err.message);
    }
};

export const getTopUsersByWins = async (): Promise<User[]> => {
    try {
        const result = await pool.query(
            `SELECT 
                id, name, login, avatar, created_at, is_online, 
                COALESCE(games_count, 0) as games_count, 
                COALESCE(wins_count, 0) as wins_count,
                CASE 
                    WHEN COALESCE(games_count, 0) > 0 
                    THEN ROUND((COALESCE(wins_count, 0)::numeric / COALESCE(games_count, 1)::numeric) * 100)
                    ELSE 0 
                END as win_rate
            FROM users 
            WHERE COALESCE(is_banned, FALSE) = FALSE 
            ORDER BY COALESCE(wins_count, 0) DESC, COALESCE(games_count, 0) DESC 
            LIMIT 100`,
        );

        return result.rows;
    } catch (err: any) {
        console.error('Error getting top users by wins:', err);
        throw new Error('Failed to get top users: ' + err.message);
    }
};


export const getUserById = async (id: number): Promise<User | null> => {
    try {
        const result = await pool.query(
            'SELECT id, name, login, email, avatar, provider, role, created_at, COALESCE(games_count, 0) as games_count, COALESCE(wins_count, 0) as wins_count FROM users WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    } catch (err: any) {
        console.error('Error getting user by ID:', err);
        throw new Error('Failed to get user: ' + err.message);
    }
};