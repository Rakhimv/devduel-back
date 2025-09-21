import bcrypt from "bcrypt"
import { pool } from "../config/db"
import { User } from "../models/user.model"



export const findByEmail = async (email: string): Promise<User | null> => {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email])
    return result.rows[0] || null
}

export const createUser = async (email: string, password: string): Promise<User> => {
    const hashed = await bcrypt.hash(password, 10)
    const result = await pool.query(
        "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
        [email, hashed]
    )
    return result.rows[0]
}

