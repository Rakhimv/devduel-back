import bcrypt from "bcrypt"
import { pool } from "../config/db"
import { User } from "../models/user.model"
import jwt from "jsonwebtoken"
import dotenv from "dotenv"
dotenv.config({ path: "../../.env" })
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

export const createUser = async (name: string, login: string, email: string, password: string): Promise<User> => {
    const hashed = await bcrypt.hash(password, 10)
    const result = await pool.query(
        "INSERT INTO users (name, login, email, password) VALUES ($1, $2, $3, $4) RETURNING *",
        [name, login, email, hashed]
    )
    return result.rows[0]
}

export const findByToken = async (token: any): Promise<User | null> => {
    const userInfo = jwt.verify(token, SECRET) as { id: number };
    if (!userInfo || typeof userInfo !== "object" || !("id" in userInfo)) {
        return null;
    }
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [userInfo.id])
    return result.rows[0];
}