"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleOauthHandler = exports.yandexOauthHandler = exports.githubOauthHandler = exports.getme = exports.refresh = exports.logout = exports.login = exports.register = void 0;
const jwt_service_1 = require("../services/jwt.service");
const user_service_1 = require("../services/user.service");
const bcrypt_1 = __importDefault(require("bcrypt"));
const auth_service_1 = require("../services/auth.service");
const register = async (req, res) => {
    const { email, password, name, login } = req.body;
    const existingEmail = await (0, user_service_1.findByEmail)(email);
    if (existingEmail) {
        return res.status(400).json({ message: "Пользователь уже существует" });
    }
    const existingLogin = await (0, user_service_1.findByLogin)(login);
    if (existingLogin) {
        return res.status(400).json({ message: "Логин занят", errType: "login" });
    }
    const user = await (0, user_service_1.createUser)(name, login, email, password);
    const token = (0, jwt_service_1.generateToken)(user.name, user.id, user.login);
    const refreshToken = (0, jwt_service_1.generateRefreshToken)(user.id);
    await (0, user_service_1.saveRefreshToken)(user.id, refreshToken);
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 15 * 60 * 1000
    });
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 180 * 24 * 60 * 60 * 1000
    });
    res.json({ user: { id: user.id, email: user.email, name: user.name } });
};
exports.register = register;
const login = async (req, res) => {
    const { loginOrEmail, password } = req.body;
    const user = await (0, user_service_1.findByEmailOrLogin)(loginOrEmail);
    if (!user)
        return res.status(400).json({ message: "Неправильный пароль или email" });
    const isValid = await bcrypt_1.default.compare(password, user.password);
    if (!isValid)
        return res.status(401).json({ message: "Неправильный пароль или email" });
    const token = (0, jwt_service_1.generateToken)(user.name, user.id, user.login);
    const refreshToken = (0, jwt_service_1.generateRefreshToken)(user.id);
    await (0, user_service_1.saveRefreshToken)(user.id, refreshToken);
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 15 * 60 * 1000
    });
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 180 * 24 * 60 * 60 * 1000
    });
    res.json({ user });
};
exports.login = login;
const logout = async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
        try {
            const decoded = (0, jwt_service_1.verifyRefreshToken)(refreshToken);
            await (0, user_service_1.clearRefreshToken)(decoded.id);
        }
        catch (error) {
        }
    }
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });
    res.json({ message: "Выход выполнен" });
};
exports.logout = logout;
const refresh = async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ message: "Нет refresh token" });
    }
    try {
        const decoded = (0, jwt_service_1.verifyRefreshToken)(refreshToken);
        const user = await (0, user_service_1.findByRefreshToken)(refreshToken);
        if (!user) {
            return res.status(401).json({ message: "Недействительный refresh token" });
        }
        const newToken = (0, jwt_service_1.generateToken)(user.name, user.id, user.login);
        const newRefreshToken = (0, jwt_service_1.generateRefreshToken)(user.id);
        await (0, user_service_1.saveRefreshToken)(user.id, newRefreshToken);
        res.cookie('token', newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 15 * 60 * 1000
        });
        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 180 * 24 * 60 * 60 * 1000
        });
        res.json({ user: { id: user.id, email: user.email, name: user.name } });
    }
    catch (error) {
        return res.status(401).json({ message: "Недействительный refresh token" });
    }
};
exports.refresh = refresh;
const getme = async (req, res) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).json({ message: "Нет токена" });
    }
    const user = await (0, user_service_1.findByToken)(token);
    if (!user) {
        return res.status(401).json({ message: "Недействительный токен" });
    }
    if (user.is_banned) {
        return res.status(403).json({ message: "Вы забанены", is_banned: true });
    }
    res.json(user);
};
exports.getme = getme;
/// GITHUB OAUTH
const githubOauthHandler = async (req, res) => {
    try {
        if (req.query.error) {
            return res.redirect(`${process.env.FRONTEND_ORIGIN}/login?error=auth_failed`);
        }
        const code = req.query.code;
        if (!code) {
            return res.status(401).json({ error: 'No code provided' });
        }
        const { access_token } = await (0, auth_service_1.getGithubOauthToken)({ code });
        const githubUser = await (0, auth_service_1.getGithubUser)({ access_token });
        const user = await (0, user_service_1.findOrCreateUser_Github)(githubUser);
        if (!user) {
            return res.redirect(`${process.env.FRONTEND_ORIGIN}/login?error=server_error`);
        }
        const token = (0, jwt_service_1.generateToken)(user.name, user.id, user.login);
        const refreshToken = (0, jwt_service_1.generateRefreshToken)(user.id);
        await (0, user_service_1.saveRefreshToken)(user.id, refreshToken);
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 15 * 60 * 1000
        });
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 180 * 24 * 60 * 60 * 1000
        });
        const redirectUrl = req.query.state
            ? `${process.env.FRONTEND_ORIGIN}/app${req.query.state}`
            : `${process.env.FRONTEND_ORIGIN}/app`;
        return res.redirect(redirectUrl);
    }
    catch (err) {
        return res.redirect(`${process.env.FRONTEND_ORIGIN}/login?error=server_error`);
    }
};
exports.githubOauthHandler = githubOauthHandler;
/// YANDEX OAUTH
const yandexOauthHandler = async (req, res) => {
    try {
        if (req.query.error) {
            return res.redirect(`${process.env.FRONTEND_ORIGIN}/login?error=auth_failed`);
        }
        const code = req.query.code;
        if (!code) {
            return res.status(401).json({ error: 'No code provided' });
        }
        const { access_token } = await (0, auth_service_1.getYandexOauthToken)({ code });
        const yandexUser = await (0, auth_service_1.getYandexUser)({ access_token });
        const user = await (0, user_service_1.findOrCreateUser_Yandex)(yandexUser);
        if (!user) {
            return res.redirect(`${process.env.FRONTEND_ORIGIN}/login?error=server_error`);
        }
        const token = (0, jwt_service_1.generateToken)(user.name, user.id, user.login);
        const refreshToken = (0, jwt_service_1.generateRefreshToken)(user.id);
        await (0, user_service_1.saveRefreshToken)(user.id, refreshToken);
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 15 * 60 * 1000
        });
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 180 * 24 * 60 * 60 * 1000
        });
        const redirectUrl = req.query.state
            ? `${process.env.FRONTEND_ORIGIN}/app${req.query.state}`
            : `${process.env.FRONTEND_ORIGIN}/app`;
        return res.redirect(redirectUrl);
    }
    catch (err) {
        console.error(err.message);
        return res.redirect(`${process.env.FRONTEND_ORIGIN}/login?error=server_error`);
    }
};
exports.yandexOauthHandler = yandexOauthHandler;
const googleOauthHandler = async (req, res) => {
    try {
        if (req.query.error) {
            return res.redirect(`${process.env.FRONTEND_ORIGIN}/login?error=auth_failed`);
        }
        const code = req.query.code || req.body.code;
        if (!code) {
            console.error('No code provided in Google OAuth callback', { query: req.query, body: req.body });
            return res.status(401).json({ error: 'No code provided' });
        }
        const { access_token } = await (0, auth_service_1.getGoogleOauthToken)({ code });
        const googleUser = await (0, auth_service_1.getGoogleUser)({ access_token });
        const user = await (0, user_service_1.findOrCreateUser_Google)(googleUser);
        if (!user) {
            return res.redirect(`${process.env.FRONTEND_ORIGIN}/login?error=server_error`);
        }
        const token = (0, jwt_service_1.generateToken)(user.name, user.id, user.login);
        const refreshToken = (0, jwt_service_1.generateRefreshToken)(user.id);
        await (0, user_service_1.saveRefreshToken)(user.id, refreshToken);
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 15 * 60 * 1000 });
        res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 180 * 24 * 60 * 60 * 1000 });
        const state = req.query.state;
        const redirectUrl = state
            ? `${process.env.FRONTEND_ORIGIN}/app${state}`
            : `${process.env.FRONTEND_ORIGIN}/app`;
        return res.redirect(redirectUrl);
    }
    catch (err) {
        console.error('Google OAuth Error:', err.message, err.stack);
        return res.redirect(`${process.env.FRONTEND_ORIGIN}/login?error=server_error`);
    }
};
exports.googleOauthHandler = googleOauthHandler;
