import jwt from "jsonwebtoken"
import dotenv from "dotenv"
dotenv.config()
const SECRET = process.env.SECRET
const REFRESH_SECRET = process.env.REFRESH_SECRET || SECRET + "_refresh"

if (!SECRET) {
  throw new Error("Нет SECRET в .env");
}

export const generateToken = (name: string, id: number, login: string) => {
  return jwt.sign({ name, id, login }, SECRET, { expiresIn: "15m" });
};

export const generateRefreshToken = (id: number) => {
  return jwt.sign({ id }, REFRESH_SECRET, { expiresIn: "180d" });
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, SECRET);
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, REFRESH_SECRET);
};