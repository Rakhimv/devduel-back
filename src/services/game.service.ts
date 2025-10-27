import { pool } from "../config/db";
import { executeCode, getLanguageId } from "./code.service";
import { wrapCodeForTesting } from "../utils/testWrapper";

export interface Task {
  id: number;
  title: string;
  description: string;
  input_example: string;
  output_example: string;
  difficulty: 'easy' | 'medium' | 'hard';
  level: number;
  code_templates: { [language: string]: string };
  function_signature: string;
  test_cases: TestCase[];
}

export interface TestCase {
  input: string;
  expected: string;
}

export const getTaskByLevel = async (level: number): Promise<Task> => {
  try {
    const result = await pool.query(
      "SELECT * FROM game_tasks WHERE level = $1 ORDER BY RANDOM() LIMIT 1",
      [level]
    );

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
  } catch (error) {
    console.error("Error getting task by level:", error);
    throw error;
  }
};

export const getAssignedTaskForLevel = async (gameId: string, level: number): Promise<Task> => {
  try {
    let result = await pool.query(
      "SELECT task_id FROM game_assigned_tasks WHERE game_id = $1 AND level = $2",
      [gameId, level]
    );

    let taskId: number;
    
    if (result.rows.length > 0) {
      taskId = result.rows[0].task_id;
    } else {
      const taskResult = await pool.query(
        "SELECT id FROM game_tasks WHERE level = $1 ORDER BY id LIMIT 1",
        [level]
      );
      
      if (taskResult.rows.length === 0) {
        throw new Error("No task found for this level");
      }
      
      taskId = taskResult.rows[0].id;
      
      await pool.query(
        "INSERT INTO game_assigned_tasks (game_id, level, task_id) VALUES ($1, $2, $3) ON CONFLICT (game_id, level) DO NOTHING",
        [gameId, level, taskId]
      );
    }

    const fullTask = await getTaskById(taskId);
    return fullTask;
  } catch (error) {
    console.error("Error getting assigned task:", error);
    throw error;
  }
};

export const getTaskById = async (taskId: number): Promise<Task> => {
  try {
    const result = await pool.query(
      "SELECT * FROM game_tasks WHERE id = $1",
      [taskId]
    );

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
  } catch (error) {
    console.error("Error getting task by ID:", error);
    throw error;
  }
};

export const getTaskTemplate = async (taskId: number, language: string): Promise<{ template: string; functionSignature: string }> => {
  try {
    const task = await getTaskById(taskId);
    const codeTemplates = task.code_templates as { [key: string]: string };
    
    const languageIdMap: { [key: string]: string } = {
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
  } catch (error) {
    console.error("Error getting task template:", error);
    throw error;
  }
};

export const getGameProgress = async (gameId: string, playerId: number): Promise<{
  currentLevel: number;
  playerLevel: number;
  opponentLevel: number;
  currentTask: Task;
  solvedTasks: number[];
}> => {
  try {
    const completedResult = await pool.query(
      "SELECT task_id FROM game_task_completions WHERE game_id = $1 AND player_id = $2",
      [gameId, playerId]
    );
    
    const solvedTasks = completedResult.rows.map(row => row.task_id);
    const playerLevel = solvedTasks.length + 1;

    const gameResult = await pool.query(
      "SELECT player1_id, player2_id FROM games WHERE id = $1",
      [gameId]
    );
    
    if (gameResult.rows.length === 0) {
      throw new Error("Game not found");
    }

    const game = gameResult.rows[0];
    const opponentId = game.player1_id === playerId ? game.player2_id : game.player1_id;
    
    const opponentCompletedResult = await pool.query(
      "SELECT task_id FROM game_task_completions WHERE game_id = $1 AND player_id = $2",
      [gameId, opponentId]
    );
    
    const opponentSolvedTasks = opponentCompletedResult.rows.map(row => row.task_id);
    const opponentLevel = opponentSolvedTasks.length + 1;

    const currentLevel = Math.max(playerLevel, opponentLevel);
    const currentTask = await getAssignedTaskForLevel(gameId, currentLevel);

    return {
      currentLevel,
      playerLevel,
      opponentLevel,
      currentTask,
      solvedTasks
    };
  } catch (error) {
    console.error("Error getting game progress:", error);
    throw error;
  }
};

export const submitTaskSolution = async (
  gameId: string,
  playerId: number,
  taskId: number,
  sourceCode: string,
  language: string,
  isRunTest: boolean = false
): Promise<{
  success: boolean;
  testResults: Array<{ input: string; expected: string; actual: string; passed: boolean }>;
  levelUp: boolean;
  gameFinished?: boolean;
}> => {
  try {
    const taskResult = await pool.query(
      "SELECT * FROM game_tasks WHERE id = $1",
      [taskId]
    );

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
    const testResults: Array<{ input: string; expected: string; actual: string; passed: boolean }> = [];

    for (const testCase of testCases) {
      try {
        const languageId = getLanguageId(language);
        
        const wrappedCode = wrapCodeForTesting(
          sourceCode,
          language,
          testCase,
          task.function_signature
        );

        console.log('Testing with:', testCase.input);
        console.log('Wrapped code:', wrappedCode.substring(0, 200));

        const result = await executeCode({
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
        } else if (result.stderr) {
          actual = `Error: ${result.stderr}`;
        } else if (result.compile_output) {
          actual = `Compile Error: ${result.compile_output}`;
        }

        const expected = testCase.expected.trim();
        
        const normalizeArrayOutput = (str: string) => {
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
      } catch (error) {
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
        await pool.query(
          "INSERT INTO game_task_completions (game_id, player_id, task_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
          [gameId, playerId, taskId]
        );

        const completedResult = await pool.query(
          "SELECT task_id FROM game_task_completions WHERE game_id = $1 AND player_id = $2",
          [gameId, playerId]
        );
        
        const completedTasks = completedResult.rows.length;
        const levelUp = completedTasks > 0;

        const MAX_LEVELS = 2;
        if (completedTasks >= MAX_LEVELS) {
          await pool.query(
            "UPDATE games SET status = 'finished', end_time = NOW() WHERE id = $1",
            [gameId]
          );

          const player1Result = await pool.query(
            "SELECT COUNT(*) as count FROM game_task_completions WHERE game_id = $1 AND player_id = (SELECT player1_id FROM games WHERE id = $1)",
            [gameId]
          );
          const player2Result = await pool.query(
            "SELECT COUNT(*) as count FROM game_task_completions WHERE game_id = $1 AND player_id = (SELECT player2_id FROM games WHERE id = $1)",
            [gameId]
          );
          
          const p1Count = parseInt(player1Result.rows[0].count);
          const p2Count = parseInt(player2Result.rows[0].count);
          
          let winnerId = null;
          if (p1Count >= MAX_LEVELS) {
            winnerId = await pool.query("SELECT player1_id FROM games WHERE id = $1", [gameId]).then(r => r.rows[0].player1_id);
          } else if (p2Count >= MAX_LEVELS) {
            winnerId = await pool.query("SELECT player2_id FROM games WHERE id = $1", [gameId]).then(r => r.rows[0].player2_id);
          }

          if (winnerId) {
            await pool.query(
              "UPDATE games SET winner_id = $1 WHERE id = $2",
              [winnerId, gameId]
            );
          }

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
      } catch (error) {
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
  } catch (error) {
    console.error("Error submitting task solution:", error);
    throw error;
  }
};

