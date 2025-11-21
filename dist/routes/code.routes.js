"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const code_controller_1 = require("../controllers/code.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.post("/run", auth_middleware_1.authMiddleware, code_controller_1.runCode);
exports.default = router;
