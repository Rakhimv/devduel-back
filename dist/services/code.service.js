"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLanguageId = exports.executeCode = void 0;
const axios_1 = __importDefault(require("axios"));
const JUDGE0_API_URL = "https://ce.judge0.com/submissions?base64_encoded=false&wait=true";
const executeCode = async (request) => {
    try {
        const response = await axios_1.default.post(JUDGE0_API_URL, {
            source_code: request.source_code,
            language_id: request.language_id,
            stdin: request.stdin || "",
            cpu_time_limit: request.cpu_time_limit || 5,
            memory_limit: request.memory_limit || 128000,
        });
        return response.data;
    }
    catch (error) {
        console.error("Error executing code:", error);
        throw new Error("Failed to execute code");
    }
};
exports.executeCode = executeCode;
const getLanguageId = (language) => {
    const languageMap = {
        javascript: 102, // Node.js 22.08.0
        js: 102,
        python: 109, // Python 3.13.2
        cpp: 105, // GCC 14.1.0
        csharp: 51, // Mono 6.6.0.161
        go: 107, // Go 1.23.5
        php: 98, // PHP 8.3.11
        java: 91, // JDK 17.0.6
        typescript: 101,
        rust: 108,
        ruby: 72,
    };
    return languageMap[language.toLowerCase()] || 102; // Default to JavaScript
};
exports.getLanguageId = getLanguageId;
