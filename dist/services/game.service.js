"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitTaskSolution = exports.getGameProgress = exports.getTaskTemplate = exports.getTaskById = exports.getAssignedTaskForLevel = exports.getTaskByLevel = void 0;
const db_1 = require("../config/db");
const code_service_1 = require("./code.service");
const testWrapper_1 = require("../utils/testWrapper");
const chat_socket_1 = require("../sockets/chat.socket");
const getTaskByLevel = async (level) => {
    try {
        const result = await db_1.pool.query("SELECT * FROM game_tasks WHERE level = $1 ORDER BY RANDOM() LIMIT 1", [level]);
        if (result.rows.length === 0) {
            throw new Error("No task found for this level");
        }
        const task = result.rows[0];
        return {
            id: task.id,
            title: task.title,
            description: task.description,
            input_example: task.input_example,
            output_example: task.output_example,
            difficulty: task.difficulty,
            level: task.level,
            code_templates: task.code_templates,
            function_signature: task.function_signature,
            test_cases: task.test_cases
        };
    }
    catch (error) {
        console.error("Error getting task by level:", error);
        throw error;
    }
};
exports.getTaskByLevel = getTaskByLevel;
const getAssignedTaskForLevel = async (gameId, level) => {
    try {
        let result = await db_1.pool.query("SELECT task_id FROM game_assigned_tasks WHERE game_id = $1 AND level = $2", [gameId, level]);
        let taskId;
        if (result.rows.length > 0) {
            taskId = result.rows[0].task_id;
        }
        else {
            let taskResult;
            if (level === 1) {
                taskResult = await db_1.pool.query("SELECT id FROM game_tasks WHERE difficulty IN ('easy', 'medium') ORDER BY RANDOM() LIMIT 1");
            }
            else if (level === 2) {
                taskResult = await db_1.pool.query("SELECT id FROM game_tasks WHERE difficulty IN ('medium', 'hard') ORDER BY RANDOM() LIMIT 1");
            }
            else {
                taskResult = await db_1.pool.query("SELECT id FROM game_tasks WHERE level = $1 ORDER BY RANDOM() LIMIT 1", [level]);
            }
            if (taskResult.rows.length === 0) {
                throw new Error("No task found for this level");
            }
            taskId = taskResult.rows[0].id;
            await db_1.pool.query("INSERT INTO game_assigned_tasks (game_id, level, task_id) VALUES ($1, $2, $3) ON CONFLICT (game_id, level) DO NOTHING", [gameId, level, taskId]);
        }
        const fullTask = await (0, exports.getTaskById)(taskId);
        return fullTask;
    }
    catch (error) {
        console.error("Error getting assigned task:", error);
        throw error;
    }
};
exports.getAssignedTaskForLevel = getAssignedTaskForLevel;
const getTaskById = async (taskId) => {
    try {
        const result = await db_1.pool.query("SELECT * FROM game_tasks WHERE id = $1", [taskId]);
        if (result.rows.length === 0) {
            throw new Error("Task not found");
        }
        const task = result.rows[0];
        return {
            id: task.id,
            title: task.title,
            description: task.description,
            input_example: task.input_example,
            output_example: task.output_example,
            difficulty: task.difficulty,
            level: task.level,
            code_templates: task.code_templates,
            function_signature: task.function_signature,
            test_cases: task.test_cases
        };
    }
    catch (error) {
        console.error("Error getting task by ID:", error);
        throw error;
    }
};
exports.getTaskById = getTaskById;
const getTaskTemplate = async (taskId, language) => {
    try {
        const task = await (0, exports.getTaskById)(taskId);
        const codeTemplates = task.code_templates;
        const languageIdMap = {
            'javascript': '102',
            'python': '109',
            'cpp': '105',
            'go': '107',
            'php': '98',
            'java': '91',
            'csharp': '51'
        };
        const languageId = languageIdMap[language.toLowerCase()] || '102';
        let template = codeTemplates[languageId];
        if (!template) {
            template = codeTemplates['102'] || Object.values(codeTemplates)[0] || '';
        }
        return {
            template,
            functionSignature: task.function_signature
        };
    }
    catch (error) {
        console.error("Error getting task template:", error);
        throw error;
    }
};
exports.getTaskTemplate = getTaskTemplate;
const getGameProgress = async (gameId, playerId) => {
    try {
        const completedResult = await db_1.pool.query("SELECT task_id FROM game_task_completions WHERE game_id = $1 AND player_id = $2", [gameId, playerId]);
        const solvedTasks = completedResult.rows.map(row => row.task_id);
        const playerLevel = solvedTasks.length + 1;
        const gameResult = await db_1.pool.query("SELECT player1_id, player2_id FROM games WHERE id = $1", [gameId]);
        if (gameResult.rows.length === 0) {
            throw new Error("Game not found");
        }
        const game = gameResult.rows[0];
        const opponentId = game.player1_id === playerId ? game.player2_id : game.player1_id;
        const opponentCompletedResult = await db_1.pool.query("SELECT task_id FROM game_task_completions WHERE game_id = $1 AND player_id = $2", [gameId, opponentId]);
        const opponentSolvedTasks = opponentCompletedResult.rows.map(row => row.task_id);
        const opponentLevel = opponentSolvedTasks.length + 1;
        const currentLevel = Math.max(playerLevel, opponentLevel);
        const currentTask = await (0, exports.getAssignedTaskForLevel)(gameId, currentLevel);
        return {
            currentLevel,
            playerLevel,
            opponentLevel,
            currentTask,
            solvedTasks
        };
    }
    catch (error) {
        console.error("Error getting game progress:", error);
        throw error;
    }
};
exports.getGameProgress = getGameProgress;
const submitTaskSolution = async (gameId, playerId, taskId, sourceCode, language, isRunTest = false) => {
    try {
        const taskResult = await db_1.pool.query("SELECT * FROM game_tasks WHERE id = $1", [taskId]);
        if (taskResult.rows.length === 0) {
            throw new Error("Task not found");
        }
        const task = taskResult.rows[0];
        let testCases = task.test_cases;
        if (isRunTest) {
            testCases = [{
                    input: task.input_example,
                    expected: task.output_example
                }];
        }
        let passedTests = 0;
        const testResults = [];
        for (const testCase of testCases) {
            try {
                const languageId = (0, code_service_1.getLanguageId)(language);
                const wrappedCode = (0, testWrapper_1.wrapCodeForTesting)(sourceCode, language, testCase, task.function_signature);
                console.log('Testing with:', testCase.input);
                console.log('Wrapped code:', wrappedCode.substring(0, 200));
                const result = await (0, code_service_1.executeCode)({
                    source_code: wrappedCode,
                    language_id: languageId,
                    stdin: "",
                    cpu_time_limit: 5,
                    memory_limit: 128000
                });
                console.log('Execution result:', result);
                let actual = '';
                if (result.status.id === 3 && result.stdout) {
                    actual = result.stdout.trim();
                }
                else if (result.stderr) {
                    actual = `Error: ${result.stderr}`;
                }
                else if (result.compile_output) {
                    actual = `Compile Error: ${result.compile_output}`;
                }
                const expected = testCase.expected.trim();
                const normalizeArrayOutput = (str) => {
                    return str.replace(/\[\s+/g, '[').replace(/\s+\]/g, ']');
                };
                const normalizedActual = normalizeArrayOutput(actual);
                const normalizedExpected = normalizeArrayOutput(expected);
                const passed = normalizedActual === normalizedExpected;
                testResults.push({
                    input: testCase.input,
                    expected: testCase.expected,
                    actual: normalizedActual || actual || 'No output',
                    passed
                });
                if (passed) {
                    passedTests++;
                }
            }
            catch (error) {
                console.error("Error running test case:", error);
                testResults.push({
                    input: testCase.input,
                    expected: testCase.expected,
                    actual: 'Error: ' + (error instanceof Error ? error.message : 'Unknown error'),
                    passed: false
                });
            }
        }
        const success = passedTests === testCases.length;
        if (success && !isRunTest) {
            try {
                await db_1.pool.query("INSERT INTO game_task_completions (game_id, player_id, task_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [gameId, playerId, taskId]);
                const completedResult = await db_1.pool.query("SELECT task_id FROM game_task_completions WHERE game_id = $1 AND player_id = $2", [gameId, playerId]);
                const completedTasks = completedResult.rows.length;
                const levelUp = completedTasks > 0;
                await (0, chat_socket_1.emitGameProgressUpdate)(gameId);
                const MAX_LEVELS = 2;
                if (completedTasks >= MAX_LEVELS) {
                    const player1Result = await db_1.pool.query("SELECT COUNT(*) as count FROM game_task_completions WHERE game_id = $1 AND player_id = (SELECT player1_id FROM games WHERE id = $1)", [gameId]);
                    const player2Result = await db_1.pool.query("SELECT COUNT(*) as count FROM game_task_completions WHERE game_id = $1 AND player_id = (SELECT player2_id FROM games WHERE id = $1)", [gameId]);
                    const p1Count = parseInt(player1Result.rows[0].count);
                    const p2Count = parseInt(player2Result.rows[0].count);
                    let winnerId = null;
                    if (p1Count >= MAX_LEVELS) {
                        winnerId = await db_1.pool.query("SELECT player1_id FROM games WHERE id = $1", [gameId]).then(r => r.rows[0].player1_id);
                    }
                    else if (p2Count >= MAX_LEVELS) {
                        winnerId = await db_1.pool.query("SELECT player2_id FROM games WHERE id = $1", [gameId]).then(r => r.rows[0].player2_id);
                    }
                    if (winnerId) {
                        await db_1.pool.query("UPDATE games SET winner_id = $1 WHERE id = $2", [winnerId, gameId]);
                    }
                    await (0, chat_socket_1.finishGame)(gameId, 'finished', winnerId);
                    return {
                        success: true,
                        testResults,
                        levelUp: true,
                        gameFinished: true
                    };
                }
                return {
                    success: true,
                    testResults,
                    levelUp
                };
            }
            catch (error) {
                console.error("Error saving task completion:", error);
            }
        }
        if (isRunTest && success) {
            return {
                success: true,
                testResults,
                levelUp: false
            };
        }
        return {
            success: false,
            testResults,
            levelUp: false
        };
    }
    catch (error) {
        console.error("Error submitting task solution:", error);
        throw error;
    }
};
exports.submitTaskSolution = submitTaskSolution;
