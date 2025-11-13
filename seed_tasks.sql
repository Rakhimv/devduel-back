-- Начальные задачи игры со всеми поддерживаемыми языками
-- ID языков: JavaScript=102, Python=109, C++=105, Go=107, PHP=98, Java=91, C#=51

INSERT INTO game_tasks (id, title, description, input_example, output_example, difficulty, level, supported_languages, code_templates, function_signature, test_cases) VALUES
(1, 'Сумма двух чисел', 'Напишите функцию, которая принимает два целых числа и возвращает их сумму.', '2, 3', '5', 'easy', 1,
ARRAY[102, 109, 105, 107, 98, 91, 51],
'{"102":"function sum(a, b) {\n    // Напишите ваш код здесь\n    \n}","109":"def sum(a, b):\n    # Напишите ваш код здесь\n    pass","105":"#include <iostream>\nusing namespace std;\nint sum(int a, int b) {\n    // Напишите ваш код здесь\n    \n}","107":"package main\n\nfunc sum(a int, b int) int {\n    // Напишите ваш код здесь\n    \n}","98":"<?php\nfunction sum($a, $b) {\n    // Напишите ваш код здесь\n    \n}","91":"public class Solution {\n    public int sum(int a, int b) {\n        // Напишите ваш код здесь\n        \n    }\n}","51":"using System;\n\npublic class Solution {\n    public int Sum(int a, int b) {\n        // Напишите ваш код здесь\n        \n    }\n}"}',
'sum(a, b)',
'[{"input":"2, 3","expected":"5"},{"input":"10, 20","expected":"30"},{"input":"-5, 7","expected":"2"},{"input":"0, 0","expected":"0"},{"input":"-10, -5","expected":"-15"}]')
ON CONFLICT (id) DO NOTHING;

INSERT INTO game_tasks (id, title, description, input_example, output_example, difficulty, level, supported_languages, code_templates, function_signature, test_cases) VALUES
(2, 'Найти максимум', 'Напишите функцию, которая принимает массив чисел и возвращает максимальное значение.', '[1, 2, 3, 4, 5]', '5', 'easy', 1,
ARRAY[102, 109, 105, 107, 98, 91, 51],
'{"102":"function findMax(arr) {\n    // Напишите ваш код здесь\n    \n}","109":"def findMax(arr):\n    # Напишите ваш код здесь\n    pass","105":"#include <iostream>\n#include <vector>\nusing namespace std;\nint findMax(vector<int>& arr) {\n    // Напишите ваш код здесь\n    \n}","107":"package main\n\nfunc findMax(arr []int) int {\n    // Напишите ваш код здесь\n    \n}","98":"<?php\nfunction findMax($arr) {\n    // Напишите ваш код здесь\n    \n}","91":"public class Solution {\n    public int findMax(int[] arr) {\n        // Напишите ваш код здесь\n        \n    }\n}","51":"using System;\nusing System.Linq;\n\npublic class Solution {\n    public int FindMax(int[] arr) {\n        // Напишите ваш код здесь\n        \n    }\n}"}',
'findMax(arr)',
'[{"input":"[1, 2, 3, 4, 5]","expected":"5"},{"input":"[-10, -5, 0, 5]","expected":"5"},{"input":"[42]","expected":"42"},{"input":"[-5, -10, -15]","expected":"-5"},{"input":"[10, 5, 20, 15]","expected":"20"}]')
ON CONFLICT (id) DO NOTHING;

INSERT INTO game_tasks (id, title, description, input_example, output_example, difficulty, level, supported_languages, code_templates, function_signature, test_cases) VALUES
(3, 'Подсчёт гласных', 'Напишите функцию, которая подсчитывает количество гласных букв в строке.', 'hello', '2', 'easy', 1,
ARRAY[102, 109, 105, 107, 98, 91, 51],
'{"102":"function countVowels(str) {\n    // Напишите ваш код здесь\n    // Подсказка: гласные буквы \\\"aeiouAEIOU\\\"\n    \n}","109":"def countVowels(s):\n    # Напишите ваш код здесь\n    # Подсказка: гласные буквы \\\"aeiouAEIOU\\\"\n    pass","105":"#include <iostream>\n#include <string>\nusing namespace std;\nint countVowels(string str) {\n    // Напишите ваш код здесь\n    \n}","107":"package main\nimport \\\"strings\\\"\n\nfunc countVowels(s string) int {\n    // Напишите ваш код здесь\n    \n}","98":"<?php\nfunction countVowels($str) {\n    // Напишите ваш код здесь\n    \n}","91":"public class Solution {\n    public int countVowels(String str) {\n        // Напишите ваш код здесь\n        \n    }\n}","51":"using System;\n\npublic class Solution {\n    public int CountVowels(string str) {\n        // Напишите ваш код здесь\n        \n    }\n}"}',
'countVowels(str)',
'[{"input":"hello","expected":"2"},{"input":"programming","expected":"3"},{"input":"aeiou","expected":"5"},{"input":"xyz","expected":"0"},{"input":"Hello World","expected":"3"}]')
ON CONFLICT (id) DO NOTHING;

INSERT INTO game_tasks (id, title, description, input_example, output_example, difficulty, level, supported_languages, code_templates, function_signature, test_cases) VALUES
(4, 'Факториал', 'Напишите функцию, которая вычисляет факториал числа n.', '5', '120', 'easy', 2,
ARRAY[102, 109, 105, 107, 98, 91, 51],
'{"102":"function factorial(n) {\n    // Напишите ваш код здесь\n    \n}","109":"def factorial(n):\n    # Напишите ваш код здесь\n    pass","105":"#include <iostream>\nusing namespace std;\nint factorial(int n) {\n    // Напишите ваш код здесь\n    \n}","107":"package main\n\nfunc factorial(n int) int {\n    // Напишите ваш код здесь\n    \n}","98":"<?php\nfunction factorial($n) {\n    // Напишите ваш код здесь\n    \n}","91":"public class Solution {\n    public int factorial(int n) {\n        // Напишите ваш код здесь\n        \n    }\n}","51":"using System;\n\npublic class Solution {\n    public int Factorial(int n) {\n        // Напишите ваш код здесь\n        \n    }\n}"}',
'factorial(n)',
'[{"input":"5","expected":"120"},{"input":"0","expected":"1"},{"input":"1","expected":"1"},{"input":"3","expected":"6"},{"input":"7","expected":"5040"}]')
ON CONFLICT (id) DO NOTHING;

INSERT INTO game_tasks (id, title, description, input_example, output_example, difficulty, level, supported_languages, code_templates, function_signature, test_cases) VALUES
(5, 'Проверка на палиндром', 'Напишите функцию, которая проверяет, является ли строка палиндромом.', 'racecar', 'true', 'easy', 2,
ARRAY[102, 109, 105, 107, 98, 91, 51],
'{"102":"function isPalindrome(str) {\n    // Напишите ваш код здесь\n    \n}","109":"def isPalindrome(s):\n    # Напишите ваш код здесь\n    pass","105":"#include <iostream>\n#include <string>\nusing namespace std;\nbool isPalindrome(string str) {\n    // Напишите ваш код здесь\n    \n}","107":"package main\n\nfunc isPalindrome(s string) bool {\n    // Напишите ваш код здесь\n    \n}","98":"<?php\nfunction isPalindrome($str) {\n    // Напишите ваш код здесь\n    \n}","91":"public class Solution {\n    public boolean isPalindrome(String str) {\n        // Напишите ваш код здесь\n        \n    }\n}","51":"using System;\n\npublic class Solution {\n    public bool IsPalindrome(string str) {\n        // Напишите ваш код здесь\n        \n    }\n}"}',
'isPalindrome(str)',
'[{"input":"racecar","expected":"true"},{"input":"hello","expected":"false"},{"input":"A man a plan a canal Panama","expected":"true"},{"input":"12321","expected":"true"},{"input":"race a car","expected":"false"}]')
ON CONFLICT (id) DO NOTHING;

INSERT INTO game_tasks (id, title, description, input_example, output_example, difficulty, level, supported_languages, code_templates, function_signature, test_cases) VALUES
(6, 'Разворот массива', 'Напишите функцию, которая переворачивает элементы массива на месте.', '[1, 2, 3, 4, 5]', '[5, 4, 3, 2, 1]', 'easy', 2,
ARRAY[102, 109, 105, 107, 98, 91, 51],
'{"102":"function reverseArray(arr) {\n    // Напишите ваш код здесь\n    \n}","109":"def reverseArray(arr):\n    # Напишите ваш код здесь\n    pass","105":"#include <iostream>\n#include <vector>\nusing namespace std;\nvector<int> reverseArray(vector<int>& arr) {\n    // Напишите ваш код здесь\n    \n}","107":"package main\n\nfunc reverseArray(arr []int) []int {\n    // Напишите ваш код здесь\n    \n}","98":"<?php\nfunction reverseArray($arr) {\n    // Напишите ваш код здесь\n    \n}","91":"public class Solution {\n    public int[] reverseArray(int[] arr) {\n        // Напишите ваш код здесь\n        \n    }\n}","51":"using System;\n\npublic class Solution {\n    public int[] ReverseArray(int[] arr) {\n        // Напишите ваш код здесь\n        \n    }\n}"}',
'reverseArray(arr)',
'[{"input":"[1, 2, 3, 4, 5]","expected":"[5, 4, 3, 2, 1]"},{"input":"[1, 2]","expected":"[2, 1]"},{"input":"[1]","expected":"[1]"},{"input":"[]","expected":"[]"},{"input":"[-1, 0, 1]","expected":"[1, 0, -1]"}]')
ON CONFLICT (id) DO NOTHING;

INSERT INTO game_tasks (id, title, description, input_example, output_example, difficulty, level, supported_languages, code_templates, function_signature, test_cases) VALUES
(7, 'Two Sum', 'Найдите два числа, сумма которых равна target, и верните их индексы.', '[2, 7, 11, 15], 9', '[0, 1]', 'medium', 3,
ARRAY[102, 109, 105, 107, 98, 91, 51],
'{"102":"function twoSum(nums, target) {\n    // Напишите ваш код здесь\n    \n}","109":"def twoSum(nums, target):\n    # Напишите ваш код здесь\n    pass","105":"#include <iostream>\n#include <vector>\n#include <map>\nusing namespace std;\nvector<int> twoSum(vector<int>& nums, int target) {\n    // Напишите ваш код здесь\n    \n}","107":"package main\n\nfunc twoSum(nums []int, target int) []int {\n    // Напишите ваш код здесь\n    \n}","98":"<?php\nfunction twoSum($nums, $target) {\n    // Напишите ваш код здесь\n    \n}","91":"public class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Напишите ваш код здесь\n        \n    }\n}","51":"using System;\n\npublic class Solution {\n    public int[] TwoSum(int[] nums, int target) {\n        // Напишите ваш код здесь\n        \n    }\n}"}',
'twoSum(nums, target)',
'[{"input":"[2, 7, 11, 15], 9","expected":"[0, 1]"},{"input":"[3, 2, 4], 6","expected":"[1, 2]"},{"input":"[3, 3], 6","expected":"[0, 1]"},{"input":"[-1, -2, -3, -4, -5], -8","expected":"[2, 4]"},{"input":"[1, 2, 3, 4], 10","expected":"[]"}]')
ON CONFLICT (id) DO NOTHING;

INSERT INTO game_tasks (id, title, description, input_example, output_example, difficulty, level, supported_languages, code_templates, function_signature, test_cases) VALUES
(8, 'Бинарный поиск', 'Найдите, существует ли target в отсортированном массиве. Верните индекс, если найден, -1 в противном случае.', '[1, 2, 3, 4, 5, 6, 7], 4', '3', 'medium', 3,
ARRAY[102, 109, 105, 107, 98, 91, 51],
'{"102":"function binarySearch(nums, target) {\n    // Напишите ваш код здесь\n    \n}","109":"def binarySearch(nums, target):\n    # Напишите ваш код здесь\n    pass","105":"#include <iostream>\n#include <vector>\nusing namespace std;\nint binarySearch(vector<int>& nums, int target) {\n    // Напишите ваш код здесь\n    \n}","107":"package main\n\nfunc binarySearch(nums []int, target int) int {\n    // Напишите ваш код здесь\n    \n}","98":"<?php\nfunction binarySearch($nums, $target) {\n    // Напишите ваш код здесь\n    \n}","91":"public class Solution {\n    public int binarySearch(int[] nums, int target) {\n        // Напишите ваш код здесь\n        \n    }\n}","51":"using System;\n\npublic class Solution {\n    public int BinarySearch(int[] nums, int target) {\n        // Напишите ваш код здесь\n        \n    }\n}"}',
'binarySearch(nums, target)',
'[{"input":"[1, 2, 3, 4, 5, 6, 7], 4","expected":"3"},{"input":"[1, 2, 3, 4, 5, 6, 7], 1","expected":"0"},{"input":"[1, 2, 3, 4, 5, 6, 7], 7","expected":"6"},{"input":"[1, 2, 3, 4, 5, 6, 7], 10","expected":"-1"},{"input":"[1, 3, 5, 7, 9], 5","expected":"2"}]')
ON CONFLICT (id) DO NOTHING;