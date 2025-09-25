import jwt from "jsonwebtoken"
import dotenv from "dotenv"
dotenv.config()
const SECRET = process.env.SECRET

if (!SECRET) {
  throw new Error("Нет SECRET в .env");
}

export const generateToken = (name: string, id: number, email: string) => {
  return jwt.sign({ name, id, email }, SECRET, { expiresIn: "7d" });
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, SECRET);
};