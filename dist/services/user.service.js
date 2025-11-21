"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserById = exports.getTopUsersByWins = exports.getAllUsers = exports.findOrCreateUser_Google = exports.findOrCreateUser_Yandex = exports.findOrCreateUser_Github = exports.findByToken = exports.createUser = exports.clearRefreshToken = exports.findByRefreshToken = exports.saveRefreshToken = exports.findByEmailOrLogin = exports.findByLogin = exports.findByEmail = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const db_1 = require("../config/db");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const avatarUtils_1 = require("../utils/avatarUtils");
const SECRET = process.env.SECRET;
if (!SECRET)
    throw new Error("Нет SECRET");
const findByEmail = async (email) => {
    const result = await db_1.pool.query("SELECT * FROM users WHERE email = $1", [email]);
    return result.rows[0] || null;
};
exports.findByEmail = findByEmail;
const findByLogin = async (login) => {
    const result = await db_1.pool.query("SELECT * FROM users WHERE login = $1", [login]);
    return result.rows[0];
};
exports.findByLogin = findByLogin;
const findByEmailOrLogin = async (login) => {
    const result = await db_1.pool.query("SELECT * FROM users WHERE login = $1 OR email = $1", [login]);
    return result.rows[0] || null;
};
exports.findByEmailOrLogin = findByEmailOrLogin;
const saveRefreshToken = async (userId, refreshToken) => {
    await db_1.pool.query("UPDATE users SET refresh_token = $1 WHERE id = $2", [refreshToken, userId]);
};
exports.saveRefreshToken = saveRefreshToken;
const findByRefreshToken = async (refreshToken) => {
    const result = await db_1.pool.query("SELECT * FROM users WHERE refresh_token = $1", [refreshToken]);
    return result.rows[0] || null;
};
exports.findByRefreshToken = findByRefreshToken;
const clearRefreshToken = async (userId) => {
    await db_1.pool.query("UPDATE users SET refresh_token = NULL WHERE id = $2", [userId]);
};
exports.clearRefreshToken = clearRefreshToken;
const createUser = async (name, login, email, password) => {
    const hashed = await bcrypt_1.default.hash(password, 10);
    const result = await db_1.pool.query("INSERT INTO users (name, login, email, password) VALUES ($1, $2, $3, $4) RETURNING *", [name, login, email, hashed]);
    return result.rows[0];
};
exports.createUser = createUser;
const findByToken = async (token) => {
    const decoded = jsonwebtoken_1.default.verify(token, SECRET);
    const userId = decoded?.id ?? decoded?.sub;
    if (!userId)
        return null;
    const result = await db_1.pool.query("SELECT *, COALESCE(games_count, 0) as games_count, COALESCE(wins_count, 0) as wins_count, COALESCE(is_banned, FALSE) as is_banned FROM users WHERE id = $1", [userId]);
    return result.rows[0] || null;
};
exports.findByToken = findByToken;
const findOrCreateUser_Github = async (githubUser) => {
    try {
        const { rows: existingUser } = await db_1.pool.query('SELECT * FROM users WHERE login = $1 AND provider = $2', [githubUser.login, 'github']);
        if (existingUser.length > 0) {
            const updated = await db_1.pool.query('UPDATE users SET name = $1, avatar = CASE WHEN avatar IS NULL THEN $2 ELSE avatar END, updated_at = NOW() WHERE login = $3 AND provider = $4 RETURNING *', [githubUser.name, githubUser.avatar_url, githubUser.login, 'github']);
            return updated.rows[0];
        }
        const { rows: newUser } = await db_1.pool.query('INSERT INTO users (name, login, email, password, avatar, provider, role) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', [githubUser.name, githubUser.login, githubUser.email || null, 'oauth', githubUser.avatar_url, 'github', 'user']);
        return newUser[0];
    }
    catch (err) {
        throw new Error('Failed to find or create user: ' + err.message);
    }
};
exports.findOrCreateUser_Github = findOrCreateUser_Github;
const findOrCreateUser_Yandex = async (yandexUser) => {
    try {
        const { rows: existingUser } = await db_1.pool.query('SELECT * FROM users WHERE login = $1 AND provider = $2', [yandexUser.login, 'yandex']);
        if (existingUser.length > 0) {
            const updated = await db_1.pool.query('UPDATE users SET name = $1, avatar = CASE WHEN avatar IS NULL THEN $2 ELSE avatar END, updated_at = NOW() WHERE login = $3 AND provider = $4 RETURNING *', [yandexUser.real_name || yandexUser.display_name, `https://avatars.yandex.net/get-yapic/${yandexUser.default_avatar_id}/islands-200`, yandexUser.login, 'yandex']);
            return updated.rows[0];
        }
        const { rows: newUser } = await db_1.pool.query('INSERT INTO users (name, login, email, password, avatar, provider, role) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', [yandexUser.real_name || yandexUser.display_name, yandexUser.login, yandexUser.default_email || null, 'oauth', `https://avatars.yandex.net/get-yapic/${yandexUser.default_avatar_id}/islands-200`, 'yandex', 'user']);
        return newUser[0];
    }
    catch (err) {
        throw new Error('Failed to find or create user: ' + err.message);
    }
};
exports.findOrCreateUser_Yandex = findOrCreateUser_Yandex;
async function generateLogin(base) {
    let candidate = base;
    let counter = 1;
    while (true) {
        const { rows } = await db_1.pool.query('SELECT 1 FROM users WHERE login = $1', [candidate]);
        if (rows.length === 0)
            return candidate;
        candidate = `${base}${counter++}`;
    }
}
const findOrCreateUser_Google = async (googleUser) => {
    try {
        const { rows: existingUsers } = await db_1.pool.query('SELECT * FROM users WHERE email = $1', [googleUser.email]);
        if (existingUsers.length > 0) {
            return existingUsers[0];
        }
        const baseLogin = googleUser.email.split('@')[0];
        const login = await generateLogin(baseLogin);
        let avatarPath = null;
        try {
            if (googleUser.picture) {
                avatarPath = await (0, avatarUtils_1.downloadAndSaveAvatar)(googleUser.picture);
            }
        }
        catch (avatarError) {
            console.warn('Failed to save avatar, using original URL:', avatarError);
            avatarPath = googleUser.picture;
        }
        const { rows: newUser } = await db_1.pool.query('INSERT INTO users (name, login, email, password, avatar, provider, role) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', [googleUser.name, login, googleUser.email, 'oauth', avatarPath, 'google', 'user']);
        return newUser[0] || null;
    }
    catch (err) {
        console.error('Error in findOrCreateUser_Google:', err);
        throw new Error('Failed to find or create user: ' + err.message);
    }
};
exports.findOrCreateUser_Google = findOrCreateUser_Google;
const getAllUsers = async (offset = 0, limit = 100) => {
    try {
        const maxLimit = Math.min(limit, 100);
        const actualOffset = Math.max(0, offset);
        const result = await db_1.pool.query('SELECT id, name, login, avatar, created_at, is_online, COALESCE(games_count, 0) as games_count, COALESCE(wins_count, 0) as wins_count FROM users WHERE COALESCE(is_banned, FALSE) = FALSE ORDER BY created_at ASC LIMIT $1 OFFSET $2', [maxLimit, actualOffset]);
        const countResult = await db_1.pool.query('SELECT COUNT(*) as total FROM users WHERE COALESCE(is_banned, FALSE) = FALSE');
        const total = parseInt(countResult.rows[0].total);
        return {
            users: result.rows,
            total
        };
    }
    catch (err) {
        console.error('Error getting all users:', err);
        throw new Error('Failed to get users: ' + err.message);
    }
};
exports.getAllUsers = getAllUsers;
const getTopUsersByWins = async () => {
    try {
        const result = await db_1.pool.query(`SELECT 
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
            LIMIT 100`);
        return result.rows;
    }
    catch (err) {
        console.error('Error getting top users by wins:', err);
        throw new Error('Failed to get top users: ' + err.message);
    }
};
exports.getTopUsersByWins = getTopUsersByWins;
const getUserById = async (id) => {
    try {
        const result = await db_1.pool.query('SELECT id, name, login, email, avatar, provider, role, created_at, COALESCE(games_count, 0) as games_count, COALESCE(wins_count, 0) as wins_count FROM users WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
    catch (err) {
        console.error('Error getting user by ID:', err);
        throw new Error('Failed to get user: ' + err.message);
    }
};
exports.getUserById = getUserById;
