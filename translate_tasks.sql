-- SQL скрипт для перевода заданий с английского на русский
-- Обновление названий заданий
UPDATE game_tasks 
SET title = CASE 
    WHEN title LIKE '%Sum%' OR title LIKE '%sum%' THEN REPLACE(REPLACE(title, 'Sum', 'Сумма'), 'sum', 'сумма')
    WHEN title LIKE '%Array%' OR title LIKE '%array%' THEN REPLACE(REPLACE(title, 'Array', 'Массив'), 'array', 'массив')
    WHEN title LIKE '%String%' OR title LIKE '%string%' THEN REPLACE(REPLACE(title, 'String', 'Строка'), 'string', 'строка')
    WHEN title LIKE '%Number%' OR title LIKE '%number%' THEN REPLACE(REPLACE(title, 'Number', 'Число'), 'number', 'число')
    WHEN title LIKE '%Find%' OR title LIKE '%find%' THEN REPLACE(REPLACE(title, 'Find', 'Найти'), 'find', 'найти')
    WHEN title LIKE '%Count%' OR title LIKE '%count%' THEN REPLACE(REPLACE(title, 'Count', 'Подсчет'), 'count', 'подсчет')
    WHEN title LIKE '%Reverse%' OR title LIKE '%reverse%' THEN REPLACE(REPLACE(title, 'Reverse', 'Обратить'), 'reverse', 'обратить')
    WHEN title LIKE '%Sort%' OR title LIKE '%sort%' THEN REPLACE(REPLACE(title, 'Sort', 'Сортировка'), 'sort', 'сортировка')
    WHEN title LIKE '%Two%' OR title LIKE '%two%' THEN REPLACE(REPLACE(title, 'Two', 'Два'), 'two', 'два')
    WHEN title LIKE '%Maximum%' OR title LIKE '%maximum%' THEN REPLACE(REPLACE(title, 'Maximum', 'Максимум'), 'maximum', 'максимум')
    WHEN title LIKE '%Minimum%' OR title LIKE '%minimum%' THEN REPLACE(REPLACE(title, 'Minimum', 'Минимум'), 'minimum', 'минимум')
    WHEN title LIKE '%Palindrome%' OR title LIKE '%palindrome%' THEN REPLACE(REPLACE(title, 'Palindrome', 'Палиндром'), 'palindrome', 'палиндром')
    ELSE title
END
WHERE title ~ '[A-Za-z]';

-- Обновление описаний заданий
UPDATE game_tasks 
SET description = CASE 
    WHEN description LIKE '%Given%' OR description LIKE '%given%' THEN REPLACE(REPLACE(description, 'Given', 'Дано'), 'given', 'дано')
    WHEN description LIKE '%return%' OR description LIKE '%Return%' THEN REPLACE(REPLACE(description, 'return', 'вернуть'), 'Return', 'Вернуть')
    WHEN description LIKE '%function%' OR description LIKE '%Function%' THEN REPLACE(REPLACE(description, 'function', 'функция'), 'Function', 'Функция')
    WHEN description LIKE '%array%' OR description LIKE '%Array%' THEN REPLACE(REPLACE(description, 'array', 'массив'), 'Array', 'Массив')
    WHEN description LIKE '%integer%' OR description LIKE '%Integer%' THEN REPLACE(REPLACE(description, 'integer', 'целое число'), 'Integer', 'Целое число')
    WHEN description LIKE '%string%' OR description LIKE '%String%' THEN REPLACE(REPLACE(description, 'string', 'строка'), 'String', 'Строка')
    WHEN description LIKE '%example%' OR description LIKE '%Example%' THEN REPLACE(REPLACE(description, 'example', 'пример'), 'Example', 'Пример')
    WHEN description LIKE '%input%' OR description LIKE '%Input%' THEN REPLACE(REPLACE(description, 'input', 'вход'), 'Input', 'Вход')
    WHEN description LIKE '%output%' OR description LIKE '%Output%' THEN REPLACE(REPLACE(description, 'output', 'выход'), 'Output', 'Выход')
    WHEN description LIKE '%sum%' OR description LIKE '%Sum%' THEN REPLACE(REPLACE(description, 'sum', 'сумма'), 'Sum', 'Сумма')
    WHEN description LIKE '%find%' OR description LIKE '%Find%' THEN REPLACE(REPLACE(description, 'find', 'найти'), 'Find', 'Найти')
    WHEN description LIKE '%count%' OR description LIKE '%Count%' THEN REPLACE(REPLACE(description, 'count', 'подсчет'), 'Count', 'Подсчет')
    WHEN description LIKE '%reverse%' OR description LIKE '%Reverse%' THEN REPLACE(REPLACE(description, 'reverse', 'обратить'), 'Reverse', 'Обратить')
    WHEN description LIKE '%sort%' OR description LIKE '%Sort%' THEN REPLACE(REPLACE(description, 'sort', 'сортировка'), 'Sort', 'Сортировка')
    WHEN description LIKE '%maximum%' OR description LIKE '%Maximum%' THEN REPLACE(REPLACE(description, 'maximum', 'максимум'), 'Maximum', 'Максимум')
    WHEN description LIKE '%minimum%' OR description LIKE '%Minimum%' THEN REPLACE(REPLACE(description, 'minimum', 'минимум'), 'Minimum', 'Минимум')
    WHEN description LIKE '%palindrome%' OR description LIKE '%Palindrome%' THEN REPLACE(REPLACE(description, 'palindrome', 'палиндром'), 'Palindrome', 'Палиндром')
    WHEN description LIKE '%element%' OR description LIKE '%Element%' THEN REPLACE(REPLACE(description, 'element', 'элемент'), 'Element', 'Элемент')
    WHEN description LIKE '%index%' OR description LIKE '%Index%' THEN REPLACE(REPLACE(description, 'index', 'индекс'), 'Index', 'Индекс')
    WHEN description LIKE '%length%' OR description LIKE '%Length%' THEN REPLACE(REPLACE(description, 'length', 'длина'), 'Length', 'Длина')
    WHEN description LIKE '%value%' OR description LIKE '%Value%' THEN REPLACE(REPLACE(description, 'value', 'значение'), 'Value', 'Значение')
    WHEN description LIKE '%number%' OR description LIKE '%Number%' THEN REPLACE(REPLACE(description, 'number', 'число'), 'Number', 'Число')
    WHEN description LIKE '%characters%' OR description LIKE '%Characters%' THEN REPLACE(REPLACE(description, 'characters', 'символы'), 'Characters', 'Символы')
    WHEN description LIKE '%character%' OR description LIKE '%Character%' THEN REPLACE(REPLACE(description, 'character', 'символ'), 'Character', 'Символ')
    WHEN description LIKE '%positive%' OR description LIKE '%Positive%' THEN REPLACE(REPLACE(description, 'positive', 'положительное'), 'Positive', 'Положительное')
    WHEN description LIKE '%negative%' OR description LIKE '%Negative%' THEN REPLACE(REPLACE(description, 'negative', 'отрицательное'), 'Negative', 'Отрицательное')
    WHEN description LIKE '%even%' OR description LIKE '%Even%' THEN REPLACE(REPLACE(description, 'even', 'четное'), 'Even', 'Четное')
    WHEN description LIKE '%odd%' OR description LIKE '%Odd%' THEN REPLACE(REPLACE(description, 'odd', 'нечетное'), 'Odd', 'Нечетное')
    WHEN description LIKE '%greater%' OR description LIKE '%Greater%' THEN REPLACE(REPLACE(description, 'greater', 'больше'), 'Greater', 'Больше')
    WHEN description LIKE '%less%' OR description LIKE '%Less%' THEN REPLACE(REPLACE(description, 'less', 'меньше'), 'Less', 'Меньше')
    WHEN description LIKE '%equal%' OR description LIKE '%Equal%' THEN REPLACE(REPLACE(description, 'equal', 'равно'), 'Equal', 'Равно')
    WHEN description LIKE '%contains%' OR description LIKE '%Contains%' THEN REPLACE(REPLACE(description, 'contains', 'содержит'), 'Contains', 'Содержит')
    WHEN description LIKE '%empty%' OR description LIKE '%Empty%' THEN REPLACE(REPLACE(description, 'empty', 'пустой'), 'Empty', 'Пустой')
    WHEN description LIKE '%non-empty%' OR description LIKE '%Non-empty%' THEN REPLACE(REPLACE(description, 'non-empty', 'непустой'), 'Non-empty', 'Непустой')
    ELSE description
END
WHERE description ~ '[A-Za-z]';

-- Обновление примеров входа
UPDATE game_tasks 
SET input_example = CASE 
    WHEN input_example LIKE '%Input%' OR input_example LIKE '%input%' THEN REPLACE(REPLACE(input_example, 'Input', 'Вход'), 'input', 'вход')
    ELSE input_example
END
WHERE input_example ~ '[A-Za-z]';

-- Обновление примеров выхода
UPDATE game_tasks 
SET output_example = CASE 
    WHEN output_example LIKE '%Output%' OR output_example LIKE '%output%' THEN REPLACE(REPLACE(output_example, 'Output', 'Выход'), 'output', 'выход')
    ELSE output_example
END
WHERE output_example ~ '[A-Za-z]';

