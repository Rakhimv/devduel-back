"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAvatar = exports.downloadAndSaveAvatar = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const https_1 = __importDefault(require("https"));
const uuid_1 = require("uuid");
const AVATARS_DIR = path_1.default.join(__dirname, '../../public/avatars');
if (!fs_1.default.existsSync(AVATARS_DIR)) {
    fs_1.default.mkdirSync(AVATARS_DIR, { recursive: true });
}
const downloadAndSaveAvatar = async (googleAvatarUrl) => {
    try {
        const fileExtension = '.jpg';
        const fileName = `${(0, uuid_1.v4)()}${fileExtension}`;
        const filePath = path_1.default.join(AVATARS_DIR, fileName);
        const file = fs_1.default.createWriteStream(filePath);
        return new Promise((resolve, reject) => {
            https_1.default.get(googleAvatarUrl, (response) => {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve(`/avatars/${fileName}`);
                });
                file.on('error', (err) => {
                    fs_1.default.unlink(filePath, () => { });
                    reject(err);
                });
            }).on('error', (err) => {
                reject(err);
            });
        });
    }
    catch (error) {
        console.error('Error downloading avatar:', error);
        throw error;
    }
};
exports.downloadAndSaveAvatar = downloadAndSaveAvatar;
const deleteAvatar = async (avatarPath) => {
    try {
        if (avatarPath && avatarPath.startsWith('/avatars/')) {
            const fileName = path_1.default.basename(avatarPath);
            const filePath = path_1.default.join(AVATARS_DIR, fileName);
            if (fs_1.default.existsSync(filePath)) {
                fs_1.default.unlinkSync(filePath);
            }
        }
    }
    catch (error) {
        console.error('Error deleting avatar:', error);
    }
};
exports.deleteAvatar = deleteAvatar;
