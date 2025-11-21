"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitSolution = exports.getProgress = exports.getTaskTemplateController = void 0;
const game_service_1 = require("../services/game.service");
const getTaskTemplateController = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { language } = req.query;
        if (!taskId || !language) {
            return res.status(400).json({
                error: "Missing required fields: taskId and language"
            });
        }
        const result = await (0, game_service_1.getTaskTemplate)(parseInt(taskId), language);
        res.json(result);
    }
    catch (error) {
        console.error("Error getting task template:", error);
        res.status(500).json({
            error: "Internal server error",
            message: error.message
        });
    }
};
exports.getTaskTemplateController = getTaskTemplateController;
const getProgress = async (req, res) => {
    try {
        const { gameId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const progress = await (0, game_service_1.getGameProgress)(gameId, userId);
        res.json(progress);
    }
    catch (error) {
        console.error("Error getting game progress:", error);
        res.status(500).json({
            error: "Internal server error",
            message: error.message
        });
    }
};
exports.getProgress = getProgress;
const submitSolution = async (req, res) => {
    try {
        const { gameId, taskId, source_code, language, isRunTest } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        if (!gameId || !taskId || !source_code || !language) {
            return res.status(400).json({
                error: "Missing required fields: gameId, taskId, source_code, language"
            });
        }
        const result = await (0, game_service_1.submitTaskSolution)(gameId, userId, taskId, source_code, language, isRunTest || false);
        res.json(result);
    }
    catch (error) {
        console.error("Error submitting solution:", error);
        res.status(500).json({
            error: "Internal server error",
            message: error.message
        });
    }
};
exports.submitSolution = submitSolution;
