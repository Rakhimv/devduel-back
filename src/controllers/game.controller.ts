import { Request, Response } from "express";
import { getGameProgress, submitTaskSolution, getTaskTemplate } from "../services/game.service";

export const getTaskTemplateController = async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { language } = req.query;

    if (!taskId || !language) {
      return res.status(400).json({ 
        error: "Missing required fields: taskId and language" 
      });
    }

    const result = await getTaskTemplate(parseInt(taskId), language as string);
    res.json(result);
  } catch (error: any) {
    console.error("Error getting task template:", error);
    res.status(500).json({ 
      error: "Internal server error",
      message: error.message 
    });
  }
};

export const getProgress = async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const progress = await getGameProgress(gameId, userId);
    res.json(progress);
  } catch (error: any) {
    console.error("Error getting game progress:", error);
    res.status(500).json({ 
      error: "Internal server error",
      message: error.message 
    });
  }
};

export const submitSolution = async (req: Request, res: Response) => {
  try {
    const { gameId, taskId, source_code, language, isRunTest } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!gameId || !taskId || !source_code || !language) {
      return res.status(400).json({ 
        error: "Missing required fields: gameId, taskId, source_code, language" 
      });
    }

    const result = await submitTaskSolution(gameId, userId, taskId, source_code, language, isRunTest || false);
    res.json(result);
  } catch (error: any) {
    console.error("Error submitting solution:", error);
    res.status(500).json({ 
      error: "Internal server error",
      message: error.message 
    });
  }
};

