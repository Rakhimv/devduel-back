import { Pool } from "pg"
import dotenv from "dotenv"
dotenv.config({ path: "../../.env" })

export const pool = new Pool({
    host: process.env.PG_HOST,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DB
})

