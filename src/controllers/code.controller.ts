import { Request, Response } from "express";
import { executeCode, getLanguageId } from "../services/code.service";

export const runCode = async (req: Request, res: Response) => {
  try {
    const { source_code, language, stdin, cpu_time_limit, memory_limit } = req.body;

    if (!source_code || !language) {
      return res.status(400).json({
        error: "Missing required fields: source_code and language"
      });
    }

    const language_id = getLanguageId(language);

    const result = await executeCode({
      source_code,
      language_id,
      stdin,
      cpu_time_limit,
      memory_limit,
    });

    let output = "";
    if (result.status.id === 3 && result.stdout) {
      output = result.stdout;
    } else if (result.stderr) {
      output = `Error: ${result.stderr}`;
    } else if (result.compile_output) {
      output = `Compile Error: ${result.compile_output}`;
    } else {
      output = `No output or error occurred. Status: ${result.status.description}`;
    }

    res.json({
      output,
      status: result.status,
      time: result.time,
      memory: result.memory,
    });
  } catch (error) {
    console.error("Error in runCode controller:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to execute code"
    });
  }
};