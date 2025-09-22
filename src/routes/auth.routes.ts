import {Router} from "express"
import {register, login, getme} from "../controllers/auth.controller"

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.get('/me', getme)

export default router