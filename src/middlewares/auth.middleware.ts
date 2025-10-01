import { verify } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { JwtBodyI } from "../models/jwt.model";



export interface AuthRequest extends Request {
    user?: JwtBodyI
}
export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.cookies?.token
    if (!token) return res.status(401).json({ error: "Нет токена" })

    try {
        const decoded = verify(token, process.env.SECRET || "") as JwtBodyI
        req.user = decoded
        next()
    } catch (err) {
        return res.status(401).json({ error: "Нет токена" })
    }

}

export const logENV = () => {
    console.log(process.env.SECRET)
}