"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCode = void 0;
const code_service_1 = require("../services/code.service");
const runCode = async (req, res) => {
    try {
        const { source_code, language, stdin, cpu_time_limit, memory_limit } = req.body;
        if (!source_code || !language) {
            return res.status(400).json({
                error: "Missing required fields: source_code and language"
            });
        }
        const language_id = (0, code_service_1.getLanguageId)(language);
        const result = await (0, code_service_1.executeCode)({
            source_code,
            language_id,
            stdin,
            cpu_time_limit,
            memory_limit,
        });
        let output = "";
        if (result.status.id === 3 && result.stdout) {
            output = result.stdout;
        }
        else if (result.stderr) {
            output = `Error: ${result.stderr}`;
        }
        else if (result.compile_output) {
            output = `Compile Error: ${result.compile_output}`;
        }
        else {
            output = `No output or error occurred. Status: ${result.status.description}`;
        }
        res.json({
            output,
            status: result.status,
            time: result.time,
            memory: result.memory,
        });
    }
    catch (error) {
        console.error("Error in runCode controller:", error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to execute code"
        });
    }
};
exports.runCode = runCode;
