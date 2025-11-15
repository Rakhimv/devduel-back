import { generateToken, generateRefreshToken, verifyRefreshToken } from "../services/jwt.service";
import { createUser, findByEmail, findByEmailOrLogin, findByLogin, findByToken, findOrCreateUser_Github, findOrCreateUser_Yandex, saveRefreshToken, findByRefreshToken, clearRefreshToken, findOrCreateUser_Google } from "../services/user.service"
import { Request, Response } from "express";
import bcrypt from "bcrypt"
import { getGithubOauthToken, getGithubUser, getGoogleOauthToken, getGoogleUser, getYandexOauthToken, getYandexUser } from "../services/auth.service";



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
  const token = generateToken(user.name, user.id, user.login)
  const refreshToken = generateRefreshToken(user.id)

  await saveRefreshToken(user.id, refreshToken)

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 180 * 24 * 60 * 60 * 1000
  });

  res.json({ user: { id: user.id, email: user.email, name: user.name } })
}



export const login = async (req: Request, res: Response) => {
  const { loginOrEmail, password } = req.body;
  const user = await findByEmailOrLogin(loginOrEmail);
  if (!user) return res.status(400).json({ message: "Неправильный пароль или email" });

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return res.status(401).json({ message: "Неправильный пароль или email" });

  const token = generateToken(user.name, user.id, user.login);
  const refreshToken = generateRefreshToken(user.id)

  await saveRefreshToken(user.id, refreshToken)

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 180 * 24 * 60 * 60 * 1000
  });

  res.json({ user });
};




export const logout = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  if (refreshToken) {
    try {
      const decoded = verifyRefreshToken(refreshToken) as { id: number };
      await clearRefreshToken(decoded.id);
    } catch (error) {

    }
  }

  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });

  res.json({ message: "Выход выполнен" });
}

export const refresh = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ message: "Нет refresh token" });
  }

  try {
    const decoded = verifyRefreshToken(refreshToken) as { id: number };
    const user = await findByRefreshToken(refreshToken);

    if (!user) {
      return res.status(401).json({ message: "Недействительный refresh token" });
    }

    const newToken = generateToken(user.name, user.id, user.login);
    const newRefreshToken = generateRefreshToken(user.id);

    await saveRefreshToken(user.id, newRefreshToken);

    res.cookie('token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000
    });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 180 * 24 * 60 * 60 * 1000
    });

    res.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    return res.status(401).json({ message: "Недействительный refresh token" });
  }
}



export const getme = async (req: Request, res: Response) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ message: "Нет токена" });
  }

  const user = await findByToken(token);
  if (!user) {
    return res.status(401).json({ message: "Недействительный токен" });
  }

  if (user.is_banned) {
    return res.status(403).json({ message: "Вы забанены", is_banned: true });
  }

  res.json(user);
}






/// GITHUB OAUTH


export const githubOauthHandler = async (req: Request, res: Response) => {
  try {
    if (req.query.error) {
      return res.redirect(`${process.env.FRONTEND_ORIGIN}/login?error=auth_failed`);
    }

    const code = req.query.code as string;
    if (!code) {
      return res.status(401).json({ error: 'No code provided' });
    }


    const { access_token } = await getGithubOauthToken({ code })


    const githubUser = await getGithubUser({ access_token })
    const user = await findOrCreateUser_Github(githubUser)
    if (!user) {
      return res.redirect(`${process.env.FRONTEND_ORIGIN}/login?error=server_error`);
    }


    const token = generateToken(user.name, user.id, user.login);
    const refreshToken = generateRefreshToken(user.id);

    await saveRefreshToken(user.id, refreshToken);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 180 * 24 * 60 * 60 * 1000
    });

    const redirectUrl = req.query.state
      ? `${process.env.FRONTEND_ORIGIN}/app${req.query.state}`
      : `${process.env.FRONTEND_ORIGIN}/app`;
    return res.redirect(redirectUrl);
  } catch (err: any) {
    return res.redirect(`${process.env.FRONTEND_ORIGIN}/login?error=server_error`);
  }
};






/// YANDEX OAUTH

export const yandexOauthHandler = async (req: Request, res: Response) => {
  try {
    if (req.query.error) {
      return res.redirect(`${process.env.FRONTEND_ORIGIN}/login?error=auth_failed`);
    }

    const code = req.query.code as string;
    if (!code) {
      return res.status(401).json({ error: 'No code provided' });
    }

    const { access_token } = await getYandexOauthToken({ code });
    const yandexUser = await getYandexUser({ access_token });
    const user = await findOrCreateUser_Yandex(yandexUser);
    if (!user) {
      return res.redirect(`${process.env.FRONTEND_ORIGIN}/login?error=server_error`);
    }
    const token = generateToken(user.name, user.id, user.login);
    const refreshToken = generateRefreshToken(user.id);

    await saveRefreshToken(user.id, refreshToken);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 180 * 24 * 60 * 60 * 1000
    });

    const redirectUrl = req.query.state
      ? `${process.env.FRONTEND_ORIGIN}/app${req.query.state}`
      : `${process.env.FRONTEND_ORIGIN}/app`;
    return res.redirect(redirectUrl);
  } catch (err: any) {
    console.error(err.message);
    return res.redirect(`${process.env.FRONTEND_ORIGIN}/login?error=server_error`);
  }
};






export const googleOauthHandler = async (req: Request, res: Response) => {
  try {
    if (req.query.error) {
      return res.redirect(`${process.env.FRONTEND_ORIGIN}/login?error=auth_failed`);
    }

    const code = req.query.code as string;
    if (!code) {
      return res.status(401).json({ error: 'No code provided' });
    }

    const { access_token } = await getGoogleOauthToken({ code });
    const googleUser = await getGoogleUser({ access_token });
    const user = await findOrCreateUser_Google(googleUser);
    if (!user) {
      return res.redirect(`${process.env.FRONTEND_ORIGIN}/login?error=server_error`);
    }
    const token = generateToken(user.name, user.id, user.login);
    const refreshToken = generateRefreshToken(user.id);

    await saveRefreshToken(user.id, refreshToken);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 180 * 24 * 60 * 60 * 1000
    });

    const redirectUrl = req.query.state
      ? `${process.env.FRONTEND_ORIGIN}/app${req.query.state}`
      : `${process.env.FRONTEND_ORIGIN}/app`;
    return res.redirect(redirectUrl);
  } catch (err: any) {
    console.error(err.message);
    return res.redirect(`${process.env.FRONTEND_ORIGIN}/login?error=server_error`);
  }
};

