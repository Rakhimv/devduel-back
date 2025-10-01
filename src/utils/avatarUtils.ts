import fs from 'fs';
import path from 'path';
import https from 'https';
import { v4 as uuidv4 } from 'uuid';

const AVATARS_DIR = path.join(__dirname, '../../public/avatars');

if (!fs.existsSync(AVATARS_DIR)) {
    fs.mkdirSync(AVATARS_DIR, { recursive: true });
}

export const downloadAndSaveAvatar = async (googleAvatarUrl: string): Promise<string> => {
    try {
        const fileExtension = '.jpg';
        const fileName = `${uuidv4()}${fileExtension}`;
        const filePath = path.join(AVATARS_DIR, fileName);
        const file = fs.createWriteStream(filePath);


        return new Promise((resolve, reject) => {
            https.get(googleAvatarUrl, (response) => {
                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    resolve(`/avatars/${fileName}`);
                });

                file.on('error', (err) => {
                    fs.unlink(filePath, () => { });
                    reject(err);
                });
            }).on('error', (err) => {
                reject(err);
            });
        });
    } catch (error) {
        console.error('Error downloading avatar:', error);
        throw error;
    }
};

export const deleteAvatar = async (avatarPath: string): Promise<void> => {
    try {
        if (avatarPath && avatarPath.startsWith('/avatars/')) {
            const fileName = path.basename(avatarPath);
            const filePath = path.join(AVATARS_DIR, fileName);

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
    } catch (error) {
        console.error('Error deleting avatar:', error);
    }
};
