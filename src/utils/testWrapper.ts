interface TestCase {
  input: string;
  expected: string;
}

export const wrapCodeForTesting = (
  userCode: string,
  language: string,
  testCase: TestCase,
  functionSignature: string
): string => {
  const lang = language.toLowerCase();

  if (lang === 'javascript' || lang === 'js') {
    let inputCode = testCase.input;
    
    const isStringType = functionSignature.includes('str') || functionSignature.includes('String');
    
    if (!inputCode.startsWith('"') && !inputCode.startsWith("'") && !inputCode.startsWith('[') && !inputCode.includes(',')) {
      if (isStringType) {
        inputCode = `"${inputCode}"`;
      }
    }
    
    const funcName = functionSignature.split('(')[0].trim();
    
    return `${userCode}\n\n// Test code\nconst result = ${funcName}(${inputCode});\nconsole.log(result);`;
  }

  if (lang === 'python') {
    let inputCode = testCase.input;
    
    const isStringType = functionSignature.includes('str') || functionSignature.includes('s') || functionSignature.includes('String');
    
    if (!inputCode.startsWith('"') && !inputCode.startsWith("'") && !inputCode.startsWith('[') && !inputCode.includes(',')) {
      if (isStringType) {
        inputCode = `"${inputCode}"`;
      }
    }
    
    const funcName = functionSignature.split('(')[0].trim();
    
    return `${userCode}\n\n# Test code\nresult = ${funcName}(${inputCode})\nprint(result)`;
  }

  if (lang === 'cpp' || lang === 'c++') {
    const funcName = functionSignature.split('(')[0].trim();
    let inputCode = testCase.input;
    
    if (inputCode.includes(',') && !inputCode.includes('[')) {
      inputCode = inputCode.split(',').map(arg => arg.trim()).join(', ');
    } else if (inputCode.includes('[')) {
      inputCode = inputCode.replace(/\[/g, '{').replace(/\]/g, '}');
    }
    
    const hasIostream = userCode.includes('#include <iostream>');
    const hasVector = userCode.includes('#include <vector>');
    const hasUsing = userCode.includes('using namespace std;');
    
    let includes = '';
    if (!hasIostream) includes += '#include <iostream>\n';
    if (!hasVector) includes += '#include <vector>\n';
    
    const isArrayInput = inputCode.includes('{');
    const outputCode = isArrayInput 
      ? `for (int i : result) std::cout << i << " "; std::cout << std::endl;`
      : `std::cout << result << std::endl;`;
    
    const usingDirective = hasUsing ? '' : '\nusing namespace std;';
    
    return `${includes}${userCode}${usingDirective}\n\nint main() {\n    auto result = ${funcName}(${inputCode});\n    ${outputCode}\n    return 0;\n}`;
  }

  if (lang === 'java') {
    let modifiedUserCode = userCode.replace(/public class Solution/, 'class Solution');
    const funcMatch = modifiedUserCode.match(/(\w+) (\w+)\([^)]*\) \{/);
    
    if (funcMatch) {
      const returnType = funcMatch[1];
      const functionName = funcMatch[2];
      let inputVars = testCase.input;
      
      if (inputVars.includes(',') && !inputVars.includes('[')) {
        inputVars = inputVars.split(',').map(arg => arg.trim()).join(', ');
      } else if (inputVars.includes('[')) {
        inputVars = inputVars.replace(/\[/g, '{').replace(/\]/g, '}');
      }

      const printCode = returnType === 'int[]' 
        ? `System.out.println(java.util.Arrays.toString(result))`
        : `System.out.println(result)`;

      return `${modifiedUserCode}\n\npublic class Main {\n    public static void main(String[] args) {\n        Solution s = new Solution();\n        ${returnType} result = s.${functionName}(${inputVars});\n        ${printCode};\n    }\n}`;
    }
    
    return modifiedUserCode;
  }

  if (lang === 'go') {
    const funcName = functionSignature.split('(')[0].trim();
    let inputCode = testCase.input;
    
    if (inputCode.includes(',') && !inputCode.includes('[')) {
      inputCode = inputCode.split(',').map(arg => arg.trim()).join(', ');
    } else if (inputCode.includes('[')) {
      inputCode = inputCode.replace(/\[/g, '[]int{').replace(/\]\s*$/, '}').replace(/,\s*\]/g, '}');
    }
    
    const hasFmtImport = userCode.includes('import "fmt"') || userCode.includes('import (\n    "fmt"\n)');
    
    let modifiedUserCode = userCode;
    if (!hasFmtImport) {
      modifiedUserCode = userCode.replace(/package main\n/, 'package main\n\nimport "fmt"\n');
    }
    
    return `${modifiedUserCode}\n\nfunc main() {\n    result := ${funcName}(${inputCode})\n    fmt.Println(result)\n}`;
  }

  if (lang === 'php') {
    const funcName = functionSignature.split('(')[0].trim();
    let inputCode = testCase.input;
    
    if (inputCode.includes(',') && !inputCode.includes('[')) {
      const args = inputCode.split(',').map(arg => arg.trim());
      inputCode = args.join(', ');
    } else if (inputCode.includes('[')) {
      inputCode = inputCode.replace(/\[/g, 'array(').replace(/\]/g, ')');
    }
    
    return `${userCode}\n\n$result = ${funcName}(${inputCode});\nif (is_array($result)) {\n    echo implode(", ", $result);\n} else {\n    echo $result;\n}`;
  }

  if (lang === 'csharp' || lang === 'c#') {
    const funcMatch = userCode.match(/public (\w+) (\w+)\([^)]*\)/);
    
    if (funcMatch) {
      const returnType = funcMatch[1];
      const functionName = funcMatch[2];
      let inputCode = testCase.input;
      
      if (inputCode.includes(',') && !inputCode.includes('[')) {
        inputCode = inputCode.split(',').map(arg => arg.trim()).join(', ');
      } else if (inputCode.includes('[')) {
        inputCode = inputCode.replace(/\[/g, 'new int[] {').replace(/\]/g, '}');
      }

      const printCode = returnType === 'int[]'
        ? `Console.WriteLine(string.Join(\", \", result))`
        : `Console.WriteLine(result)`;

      return `${userCode}\n\nclass Program {\n    static void Main() {\n        Solution s = new Solution();\n        ${returnType} result = s.${functionName}(${inputCode});\n        ${printCode};\n    }\n}`;
    }
    
    return userCode;
  }

  return userCode;
};

