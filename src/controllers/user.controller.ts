import { Response } from "express";
import { findUserByLogin } from "../services/chat.service";

export const findUser = async (req: any, res: Response) => {
    const users = await findUserByLogin(req.user.login)
    res.json(users);
}