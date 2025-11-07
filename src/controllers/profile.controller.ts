import { Request, Response } from "express";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import fs from "fs";
import { pool } from "../config/db";


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../public/avatars');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req: any, file, cb) => {
    const userId = req.user?.id;
    const ext = path.extname(file.originalname);
    cb(null, `${userId}${ext}`);
  }
});

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});


export const uploadAvatar = async (req: any, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.id;
    const avatarPath = `/avatars/${req.file.filename}`;

    // Get old avatar path before updating
    const oldAvatarRes = await pool.query(
      'SELECT avatar FROM users WHERE id = $1',
      [userId]
    );
    const oldAvatar = oldAvatarRes.rows[0]?.avatar;

    // Update avatar in database
    await pool.query(
      'UPDATE users SET avatar = $1 WHERE id = $2',
      [avatarPath, userId]
    );

    // Delete old avatar file if exists and is different from new one
    if (oldAvatar && oldAvatar !== avatarPath) {
      const oldAvatarPath = path.join(__dirname, '../../public', oldAvatar);
      if (fs.existsSync(oldAvatarPath)) {
        try {
          fs.unlinkSync(oldAvatarPath);
        } catch (unlinkError) {
          console.error('Error deleting old avatar:', unlinkError);
        }
      }
    }

    res.json({ 
      message: 'Avatar updated successfully',
      avatar: avatarPath 
    });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
};

// Смена пароля
export const changePassword = async (req: any, res: Response) => {
  try {
    const { newPassword } = req.body;
    const userId = req.user.id;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, userId]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
};
