"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGoogleUser = exports.getGoogleOauthToken = exports.getYandexUser = exports.getYandexOauthToken = exports.getGithubUser = exports.getGithubOauthToken = void 0;
const axios_1 = __importDefault(require("axios"));
const qs_1 = __importDefault(require("qs"));
const getGithubOauthToken = async ({ code }) => {
    const rootUrl = 'https://github.com/login/oauth/access_token';
    const options = {
        code,
        client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
        client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
    };
    const queryString = qs_1.default.stringify(options);
    try {
        const { data } = await axios_1.default.post(rootUrl, queryString, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" }
        });
        return qs_1.default.parse(data);
    }
    catch (err) {
        throw new Error('Failed to fetch GitHub OAuth token');
    }
};
exports.getGithubOauthToken = getGithubOauthToken;
const getGithubUser = async ({ access_token }) => {
    try {
        const { data } = await axios_1.default.get('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${access_token}` },
        });
        return data;
    }
    catch (err) {
        throw new Error('Failed to fetch GitHub user');
    }
};
exports.getGithubUser = getGithubUser;
const getYandexOauthToken = async ({ code }) => {
    const rootUrl = 'https://oauth.yandex.ru/token';
    const data = qs_1.default.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.YANDEX_OAUTH_CLIENT_ID,
        client_secret: process.env.YANDEX_OAUTH_CLIENT_SECRET,
    });
    try {
        const { data: response } = await axios_1.default.post(rootUrl, data, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        return response;
    }
    catch (err) {
        throw new Error('Failed to fetch Yandex OAuth token: ' + err.message);
    }
};
exports.getYandexOauthToken = getYandexOauthToken;
const getYandexUser = async ({ access_token }) => {
    try {
        const { data } = await axios_1.default.get('https://login.yandex.ru/info', {
            params: { format: 'json', oauth_token: access_token },
        });
        return data;
    }
    catch (err) {
        throw new Error('Failed to fetch Yandex user: ' + err.message);
    }
};
exports.getYandexUser = getYandexUser;
const getGoogleOauthToken = async ({ code }) => {
    const rootUrl = 'https://oauth2.googleapis.com/token';
    const data = qs_1.default.stringify({
        code,
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URL,
        grant_type: 'authorization_code',
    });
    console.log(data);
    try {
        const { data: response } = await axios_1.default.post(rootUrl, data, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        return response;
    }
    catch (err) {
        throw new Error('Failed to fetch Google OAuth token: ' + err.message);
    }
};
exports.getGoogleOauthToken = getGoogleOauthToken;
const getGoogleUser = async ({ access_token }) => {
    try {
        const { data } = await axios_1.default.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` },
        });
        return data;
    }
    catch (err) {
        throw new Error('Failed to fetch Google user: ' + err.message);
    }
};
exports.getGoogleUser = getGoogleUser;
