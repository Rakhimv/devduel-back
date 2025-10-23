import {Router} from "express"
import {register, login, getme, githubOauthHandler, yandexOauthHandler, refresh, logout, googleOauthHandler} from "../controllers/auth.controller"
import {uploadAvatar, changePassword, upload} from "../controllers/profile.controller"
import {authMiddleware} from "../middlewares/auth.middleware"

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/refresh', refresh)
router.post('/logout', logout)
router.get('/me', getme)


router.get('/github/callback', githubOauthHandler);
router.get('/yandex/callback', yandexOauthHandler);
router.get('/google/callback', googleOauthHandler);

router.post('/upload-avatar', authMiddleware, upload.single('avatar'), uploadAvatar);
router.post('/change-password', authMiddleware, changePassword);

export default router