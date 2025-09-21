import { generateToken } from "../services/jwt.service";
import { createUser, findByEmail } from "../services/user.service"
import { Request, Response } from "express";
import bcrypt from "bcrypt"


export const register = async (req: Request, res: Response) => {
    const { email, password } = req.body
    const existing = await findByEmail(email)
    if (existing) {
        return res.status(400).json({ message: "Пользователь уже существует" })
    }

    const user = await createUser(email, password)
    const token = generateToken(user.id, user.email)

    res.json({ token, user: { id: user.id, email: user.email } })
}



export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await findByEmail(email);
  if (!user) return res.status(400).json({ message: "Неправильный пароль или email" });

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return res.status(401).json({ message: "Неправильный пароль или email" });

  const token = generateToken(user.id, user.email);
  res.json({ token, user: { id: user.id, email: user.email } });
};