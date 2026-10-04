import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

/**
 * Unit Test Agent
 * Creates and runs unit tests for the application
 */
class UnitTester {
  constructor(config = {}) {
    this.config = {
      projectRoot: config.projectRoot || process.cwd(),
      outputDir: config.outputDir || path.join(process.cwd(), 'test-results'),
      testsDir: config.testsDir || path.join(process.cwd(), 'src', '__tests__'),
      srcDir: config.srcDir || 'src',
      ...config
    };

    this.testResults = {
      timestamp: new Date().toISOString(),
      success: true,
      tests: [],
      coverage: null,
      issues: []
    };

    this.modulesToTest = [];
  }

  /**
   * Run unit tests
   */
  async run() {
    console.log('🧪 Unit Tester: Starting unit test generation...');

    try {
      await this.ensureTestsDir();
      await this.analyzeCodebase();
      await this.generateTests();
      await this.runTests();
      await this.saveResults();

      console.log('✅ Unit Tester: Tests completed');
      return this.testResults;
    } catch (error) {
      console.error('❌ Unit Tester error:', error.message);
      this.testResults.success = false;
      this.testResults.issues.push(error.message);
      return this.testResults;
    }
  }

  /**
   * Analyze codebase to identify what to test
   */
  async analyzeCodebase() {
    console.log('📊 Analyzing codebase...');

    const srcPath = path.join(this.config.projectRoot, this.config.srcDir);

    // Find utility functions
    await this.findUtilities(srcPath);

    // Find service modules
    await this.findServices(srcPath);

    // Find hooks
    await this.findHooks(srcPath);

    console.log(`Found ${this.modulesToTest.length} modules to test`);
  }

  /**
   * Find utility functions
   */
  async findUtilities(srcPath) {
    const utilsPath = path.join(srcPath, 'utils');

    try {
      const files = await this.getAllFiles(utilsPath, ['.js']);
      for (const file of files) {
        this.modulesToTest.push({
          type: 'utility',
          path: file,
          name: path.basename(file, '.js')
        });
      }
      console.log(`Found ${files.length} utility modules`);
    } catch {
      console.log('No utils directory found');
    }
  }

  /**
   * Find service modules
   */
  async findServices(srcPath) {
    const servicesPath = path.join(srcPath, 'db', 'services');

    try {
      const files = await this.getAllFiles(servicesPath, ['.js']);
      for (const file of files) {
        if (!file.endsWith('index.js')) {
          this.modulesToTest.push({
            type: 'service',
            path: file,
            name: path.basename(file, '.js')
          });
        }
      }
      console.log(`Found ${files.length} service modules`);
    } catch {
      console.log('No services directory found');
    }
  }

  /**
   * Find custom hooks
   */
  async findHooks(srcPath) {
    const hooksPath = path.join(srcPath, 'hooks');

    try {
      const files = await this.getAllFiles(hooksPath, ['.js']);
      for (const file of files) {
        if (!file.endsWith('index.js')) {
          this.modulesToTest.push({
            type: 'hook',
            path: file,
            name: path.basename(file, '.js')
          });
        }
      }
      console.log(`Found ${files.length} hook modules`);
    } catch {
      console.log('No hooks directory found');
    }
  }

  /**
   * Generate unit tests
   */
  async generateTests() {
    console.log('📝 Generating unit tests...');

    // Generate vitest config
    await this.generateVitestConfig();

    // Generate tests for each module
    for (const module of this.modulesToTest) {
      try {
        await this.generateModuleTest(module);
      } catch (error) {
        console.warn(`Could not generate test for ${module.name}:`, error.message);
      }
    }

    // Generate setup file
    await this.generateTestSetup();
  }

  /**
   * Generate Vitest configuration
   */
  async generateVitestConfig() {
    // Never overwrite a config the project already maintains
    if (await fs.access(path.join(this.config.projectRoot, 'vitest.config.js')).then(() => true, () => false)) return;

    const config = `import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/__tests__/setup.js',
    exclude: [
      ...configDefaults.exclude,
      'e2e-tests/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
`;

    const configPath = path.join(this.config.projectRoot, 'vitest.config.js');
    await fs.writeFile(configPath, config);
    console.log('✅ Generated vitest.config.js');
  }

  /**
   * Generate test setup file
   */
  async generateTestSetup() {
    // Never overwrite a config the project already maintains
    if (await fs.access(path.join(this.config.testsDir, 'setup.js')).then(() => true, () => false)) return;

    const setup = `import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});
`;

    const setupPath = path.join(this.config.testsDir, 'setup.js');
    await fs.writeFile(setupPath, setup);
    console.log('✅ Generated test setup');
  }

  /**
   * Generate test for a module
   */
  async generateModuleTest(module) {
    const testFileName = `${module.name}.test.js`;
    const testPath = path.join(this.config.testsDir, testFileName);

    // Check if test file already exists to prevent overwriting
    try {
      await fs.access(testPath);
      console.log(`⏩ Skipping existing test: ${testFileName}`);
      return;
    } catch {
      // File does not exist, proceed with generation
    }

    const content = await fs.readFile(module.path, 'utf-8');

    let testContent = '';

    if (module.type === 'utility') {
      testContent = await this.generateUtilityTest(module, content);
    } else if (module.type === 'service') {
      testContent = await this.generateServiceTest(module, content);
    } else if (module.type === 'hook') {
      testContent = await this.generateHookTest(module, content);
    }

    if (testContent) {
      await fs.writeFile(testPath, testContent);
      console.log(`✅ Generated test: ${testFileName}`);
    }
  }

  /**
   * Generate utility function test
   */
  async generateUtilityTest(module, content) {
    // Extract exported functions
    const functionPattern = /export\s+(?:const|function)\s+(\w+)/g;
    const functions = [];
    let match;

    while ((match = functionPattern.exec(content)) !== null) {
      functions.push(match[1]);
    }

    if (functions.length === 0) return null;

    const relativePath = module.path.replace(this.config.projectRoot, '').replace(/^\//, '');
    const importPath = relativePath.replace(/^src\//, '../').replace(/\.js$/, '');

    let testContent = `import { describe, it, expect } from 'vitest';
import { ${functions.join(', ')} } from '${importPath}';

describe('${module.name}', () => {
`;

    for (const fn of functions) {
      testContent += `  describe('${fn}', () => {
    it('should be defined', () => {
      expect(${fn}).toBeDefined();
      expect(typeof ${fn}).toBe('function');
    });

    it('should handle valid input', () => {
      // TODO: Add test cases with valid input
      // const result = ${fn}(validInput);
      // expect(result).toBe(expectedOutput);
    });

    it('should handle edge cases', () => {
      // TODO: Add edge case tests
      // expect(${fn}(null)).toBeDefined();
      // expect(${fn}(undefined)).toBeDefined();
    });
  });

`;
    }

    testContent += '});\n';

    return testContent;
  }

  /**
   * Generate service test
   */
  async generateServiceTest(module, content) {
    const relativePath = module.path.replace(this.config.projectRoot, '').replace(/^\//, '');
    const importPath = relativePath.replace(/^src\//, '../').replace(/\.js$/, '');

    // Extract exported functions/methods
    const exportPattern = /export\s+(?:const|function|async function)\s+(\w+)/g;
    const exports = [];
    let match;

    while ((match = exportPattern.exec(content)) !== null) {
      exports.push(match[1]);
    }

    if (exports.length === 0) return null;

    let testContent = `import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as service from '${importPath}';

// Mock API utility
vi.mock('../../utils/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}));

describe('${module.name}', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

`;

    for (const exportName of exports) {
      testContent += `  describe('${exportName}', () => {
    it('should be defined', () => {
      expect(service.${exportName}).toBeDefined();
    });

    it('should handle successful operation', async () => {
      // TODO: Add test for successful operation
      // const result = await service.${exportName}(testData);
      // expect(result).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      // TODO: Add test for error handling
      // await expect(service.${exportName}(invalidData)).rejects.toThrow();
    });
  });

`;
    }

    testContent += '});\n';

    return testContent;
  }

  /**
   * Generate test for a custom hook
   */
  async generateHookTest(module, _content) {
    const relativePath = module.path.replace(this.config.projectRoot, '').replace(/^\//, '');
    const importPath = relativePath.replace(/^src\//, '../').replace(/\.js$/, '');

    let testContent = `import { describe, it, expect, vi } from 'vitest';
import { ${module.name} } from '${importPath}';

// Mock dependencies if needed
vi.mock('../../utils/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}));

describe('${module.name}', () => {
  it('should be defined', () => {
    expect(${module.name}).toBeDefined();
  });

  it('should initialize correctly', () => {
    // const { result } = renderHook(() => ${module.name}());
    // expect(result.current).toBeDefined();
  });
});
`;
    return testContent;
  }

  /**
   * Run the tests
   */
  async runTests() {
    console.log('🧪 Running unit tests...');

    // Define path for JSON output
    const jsonOutputPath = path.join(this.config.outputDir, 'vitest-output.json');

    return new Promise((resolve) => {
      const vitest = spawn('npx', ['vitest', 'run', '--reporter=json', '--outputFile=' + jsonOutputPath], {
        cwd: this.config.projectRoot,
        stdio: 'inherit'
      });

      vitest.on('close', async (code) => {
        if (code === 0) {
          console.log('✅ Unit tests passed');
          this.testResults.success = true;
        } else {
          console.warn(`⚠️  Unit tests exited with code ${code}`);
          this.testResults.success = false;
        }

        // Parse JSON output for detailed report
        try {
          const jsonContent = await fs.readFile(jsonOutputPath, 'utf-8');
          const results = JSON.parse(jsonContent);

          if (results.testResults) {
            results.testResults.forEach(suite => {
              suite.assertionResults.forEach(test => {
                this.testResults.tests.push({
                  name: test.fullName,
                  status: test.status,
                  duration: test.duration,
                  error: test.failureMessages?.join('\n') || null
                });

                if (test.status === 'failed') {
                  this.testResults.issues.push(`Test failed: ${test.fullName}`);
                }
              });
            });
            console.log(`📊 Parsed ${this.testResults.tests.length} test results`);
          }
        } catch (err) {
          console.error('Failed to parse Vitest JSON output:', err.message);
          this.testResults.issues.push('Failed to parse test results');
        }

        resolve();
      });

      vitest.on('error', (error) => {
        console.error('❌ Failed to run tests:', error.message);
        this.testResults.issues.push(error.message);
        resolve();
      });
    });
  }

  /**
   * Get all files with specific extensions recursively
   */
  async getAllFiles(dir, extensions) {
    const files = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && !entry.name.startsWith('.') && entry.name !== '__tests__') {
            files.push(...await this.getAllFiles(fullPath, extensions));
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch {
      // Directory doesn't exist
    }

    return files;
  }

  /**
   * Ensure tests directory exists
   */
  async ensureTestsDir() {
    await fs.mkdir(this.config.testsDir, { recursive: true });
  }

  /**
   * Save test results
   */
  async saveResults() {
    const resultsPath = path.join(this.config.outputDir, 'unit-test-results.json');
    await fs.writeFile(resultsPath, JSON.stringify(this.testResults, null, 2));
    console.log(`📊 Results saved to ${resultsPath}`);
  }
}

export default UnitTester;
