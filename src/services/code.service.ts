import axios from "axios";

interface CodeExecutionRequest {
  source_code: string;
  language_id: number;
  stdin?: string;
  cpu_time_limit?: number;
  memory_limit?: number;
}

interface CodeExecutionResponse {
  stdout?: string;
  stderr?: string;
  compile_output?: string;
  status: {
    id: number;
    description: string;
  };
  time?: string;
  memory?: number;
}

const JUDGE0_API_URL = "https://ce.judge0.com/submissions?base64_encoded=false&wait=true";

export const executeCode = async (request: CodeExecutionRequest): Promise<CodeExecutionResponse> => {
  try {
    const response = await axios.post(JUDGE0_API_URL, {
      source_code: request.source_code,
      language_id: request.language_id,
      stdin: request.stdin || "",
      cpu_time_limit: request.cpu_time_limit || 5,
      memory_limit: request.memory_limit || 128000,
    });

    return response.data;
  } catch (error) {
    console.error("Error executing code:", error);
    throw new Error("Failed to execute code");
  }
};

export const getLanguageId = (language: string): number => {
  const languageMap: { [key: string]: number } = {
    javascript: 102,  // Node.js 22.08.0
    js: 102,
    python: 109,      // Python 3.13.2
    cpp: 105,         // GCC 14.1.0
    csharp: 51,       // Mono 6.6.0.161
    go: 107,          // Go 1.23.5
    php: 98,          // PHP 8.3.11
    java: 91,         // JDK 17.0.6
    typescript: 101,
    rust: 108,
    ruby: 72,
  };

  return languageMap[language.toLowerCase()] || 102; // Default to JavaScript
};