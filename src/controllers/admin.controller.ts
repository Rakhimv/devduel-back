import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { pool } from "../config/db";
import { executeCode } from "../services/code.service";
import { wrapCodeForTesting } from "../utils/testWrapper";

export const getUsers = async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(
            'SELECT id, name, login, email, avatar, role, is_banned, games_count, wins_count, created_at FROM users ORDER BY created_at DESC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ error: 'Ошибка получения пользователей' });
    }
};

export const banUser = async (req: AuthRequest, res: Response) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Неверный ID пользователя' });
        }

        await pool.query(
            'UPDATE users SET is_banned = TRUE WHERE id = $1',
            [userId]
        );

        res.json({ message: 'Пользователь забанен' });
    } catch (error) {
        console.error('Error banning user:', error);
        res.status(500).json({ error: 'Ошибка бана пользователя' });
    }
};

export const unbanUser = async (req: AuthRequest, res: Response) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Неверный ID пользователя' });
        }

        await pool.query(
            'UPDATE users SET is_banned = FALSE WHERE id = $1',
            [userId]
        );

        res.json({ message: 'Пользователь разбанен' });
    } catch (error) {
        console.error('Error unbanning user:', error);
        res.status(500).json({ error: 'Ошибка разбана пользователя' });
    }
};

export const getTasks = async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(
            'SELECT * FROM game_tasks ORDER BY level, id'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error getting tasks:', error);
        res.status(500).json({ error: 'Ошибка получения заданий' });
    }
};

export const createTask = async (req: AuthRequest, res: Response) => {
    try {
        const { title, description, input_example, output_example, difficulty, level, code_templates, supported_languages, function_signature, test_cases } = req.body;

        const result = await pool.query(
            `INSERT INTO game_tasks (title, description, input_example, output_example, difficulty, level, code_templates, supported_languages, function_signature, test_cases)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [title, description, input_example, output_example, difficulty, level, JSON.stringify(code_templates), supported_languages, function_signature, JSON.stringify(test_cases)]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Ошибка создания задания' });
    }
};

export const updateTask = async (req: AuthRequest, res: Response) => {
    try {
        const taskId = parseInt(req.params.id);
        if (isNaN(taskId)) {
            return res.status(400).json({ error: 'Неверный ID задания' });
        }

        const { title, description, input_example, output_example, difficulty, level, code_templates, supported_languages, function_signature, test_cases } = req.body;

        const result = await pool.query(
            `UPDATE game_tasks 
             SET title = $1, description = $2, input_example = $3, output_example = $4, difficulty = $5, level = $6, 
                 code_templates = $7, supported_languages = $8, function_signature = $9, test_cases = $10
             WHERE id = $11 RETURNING *`,
            [title, description, input_example, output_example, difficulty, level, JSON.stringify(code_templates), supported_languages, function_signature, JSON.stringify(test_cases), taskId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Задание не найдено' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Ошибка обновления задания' });
    }
};

export const deleteTask = async (req: AuthRequest, res: Response) => {
    try {
        const taskId = parseInt(req.params.id);
        if (isNaN(taskId)) {
            return res.status(400).json({ error: 'Неверный ID задания' });
        }

        await pool.query('DELETE FROM game_tasks WHERE id = $1', [taskId]);

        res.json({ message: 'Задание удалено' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Ошибка удаления задания' });
    }
};

export const getStatistics = async (req: AuthRequest, res: Response) => {
    try {
        const usersCount = await pool.query('SELECT COUNT(*) as count FROM users WHERE is_banned = FALSE');
        const bannedUsersCount = await pool.query('SELECT COUNT(*) as count FROM users WHERE is_banned = TRUE');
        const tasksCount = await pool.query('SELECT COUNT(*) as count FROM game_tasks');
        const gamesCount = await pool.query('SELECT COUNT(*) as count FROM games');
        const activeGamesCount = await pool.query("SELECT COUNT(*) as count FROM games WHERE status = 'in_progress'");

        res.json({
            totalUsers: parseInt(usersCount.rows[0].count),
            bannedUsers: parseInt(bannedUsersCount.rows[0].count),
            totalTasks: parseInt(tasksCount.rows[0].count),
            totalGames: parseInt(gamesCount.rows[0].count),
            activeGames: parseInt(activeGamesCount.rows[0].count)
        });
    } catch (error) {
        console.error('Error getting statistics:', error);
        res.status(500).json({ error: 'Ошибка получения статистики' });
    }
};

export const getMaintenanceMode = async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(
            "SELECT value FROM app_settings WHERE key = 'maintenance_mode'"
        );
        
        if (result.rows.length === 0) {
            return res.json({ enabled: false });
        }
        
        const setting = result.rows[0].value;
        res.json({ enabled: setting.enabled || false });
    } catch (error) {
        console.error('Error getting maintenance mode:', error);
        res.status(500).json({ error: 'Ошибка получения режима обслуживания' });
    }
};

export const setMaintenanceMode = async (req: AuthRequest, res: Response) => {
    try {
        const { enabled } = req.body;
        
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ error: 'Неверное значение enabled' });
        }
        
        await pool.query(
            `INSERT INTO app_settings (key, value, updated_at) 
             VALUES ('maintenance_mode', $1::jsonb, NOW())
             ON CONFLICT (key) 
             DO UPDATE SET value = $1::jsonb, updated_at = NOW()`,
            [JSON.stringify({ enabled })]
        );
        
        res.json({ enabled, message: `Режим обслуживания ${enabled ? 'включен' : 'выключен'}` });
    } catch (error) {
        console.error('Error setting maintenance mode:', error);
        res.status(500).json({ error: 'Ошибка установки режима обслуживания' });
    }
};

export const testTask = async (req: AuthRequest, res: Response) => {
    try {
        const taskId = parseInt(req.params.id);
        const { languageId, code } = req.body;

        if (isNaN(taskId)) {
            return res.status(400).json({ error: 'Неверный ID задания' });
        }

        if (!languageId || !code) {
            return res.status(400).json({ error: 'Не указан язык или код' });
        }

        const taskResult = await pool.query('SELECT * FROM game_tasks WHERE id = $1', [taskId]);
        if (taskResult.rows.length === 0) {
            return res.status(404).json({ error: 'Задание не найдено' });
        }

        const task = taskResult.rows[0];
        const testCases = typeof task.test_cases === 'string' ? JSON.parse(task.test_cases) : task.test_cases;

        const languageMap: { [key: number]: string } = {
            102: 'javascript',
            109: 'python',
            105: 'cpp',
            51: 'csharp',
            107: 'go',
            98: 'php',
            91: 'java'
        };

        const language = languageMap[languageId] || 'javascript';

        const results = [];
        for (const testCase of testCases) {
            try {
                const wrappedCode = wrapCodeForTesting(code, language, testCase, task.function_signature);
                const result = await executeCode({
                    source_code: wrappedCode,
                    language_id: languageId,
                    stdin: '',
                    cpu_time_limit: 5,
                    memory_limit: 128000
                });

                let output = '';
                if (result.status.id === 3 && result.stdout) {
                    output = result.stdout.trim();
                } else if (result.stderr) {
                    output = `Error: ${result.stderr}`;
                } else if (result.compile_output) {
                    output = `Compile Error: ${result.compile_output}`;
                }

                const normalizeArrayOutput = (str: string) => {
                    return str.replace(/\[\s+/g, '[').replace(/\s+\]/g, ']');
                };

                const normalizedActual = normalizeArrayOutput(output);
                const normalizedExpected = normalizeArrayOutput(testCase.expected.trim());
                const passed = normalizedActual === normalizedExpected;

                results.push({
                    input: testCase.input,
                    expected: testCase.expected,
                    output: normalizedActual || output || 'No output',
                    passed
                });
            } catch (error: any) {
                results.push({
                    input: testCase.input,
                    expected: testCase.expected,
                    output: error.message || 'Ошибка выполнения',
                    passed: false
                });
            }
        }

        const allPassed = results.every(r => r.passed);

        res.json({
            success: allPassed,
            results,
            passed: results.filter(r => r.passed).length,
            total: results.length
        });
    } catch (error) {
        console.error('Error testing task:', error);
        res.status(500).json({ error: 'Ошибка тестирования задания' });
    }
};

