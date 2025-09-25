import { generateToken } from "../services/jwt.service";
import { createUser, findByEmail, findByEmailOrLogin, findByLogin, findByToken } from "../services/user.service"
import { Request, Response } from "express";
import bcrypt from "bcrypt"


export const register = async (req: Request, res: Response) => {
  const { email, password, name, login } = req.body
  const existingEmail = await findByEmail(email)
  if (existingEmail) {
    return res.status(400).json({ message: "Пользователь уже существует" })
  }

  const existingLogin = await findByLogin(login)
  if (existingLogin) {
    return res.status(400).json({ message: "Логин занят", errType: "login" })
  }


  const user = await createUser(name, login, email, password)
  const token = generateToken(user.name, user.id, user.email)

  res.json({ token, user: { id: user.id, email: user.email, name: user.name } })
}



export const login = async (req: Request, res: Response) => {
  const { loginOrEmail, password } = req.body;
  const user = await findByEmailOrLogin(loginOrEmail);
  if (!user) return res.status(400).json({ message: "Неправильный пароль или email" });

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return res.status(401).json({ message: "Неправильный пароль или email" });

  const token = generateToken(user.name, user.id, user.email);
  res.json({ token, user });
};



export const getme = async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    res.status(401).json({ message: "Нет токена" })
  }

  const token = authHeader?.split(" ")[1]
  const user = await findByToken(token)
  res.json(user)
}