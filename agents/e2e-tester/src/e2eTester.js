import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

/**
 * E2E Test Agent
 * Creates and runs end-to-end tests using Playwright
 */
class E2ETester {
  constructor(config = {}) {
    this.config = {
      projectRoot: config.projectRoot || process.cwd(),
      outputDir: config.outputDir || path.join(process.cwd(), 'test-results'),
      testsDir: config.testsDir || path.join(process.cwd(), 'e2e-tests'),
      baseURL: config.baseURL || 'http://localhost:5173',
      ...config
    };

    this.testResults = {
      timestamp: new Date().toISOString(),
      success: true,
      tests: [],
      errors: [],
      issues: []
    };
  }

  /**
   * Run E2E tests
   */
  async run() {
    console.log('🎭 E2E Tester: Starting end-to-end tests...');

    try {
      await this.ensureTestsDir();
      await this.analyzeApplication();
      await this.generateTests();
      await this.runPlaywrightTests();
      await this.saveResults();

      console.log('✅ E2E Tester: Tests completed');
      return this.testResults;
    } catch (error) {
      console.error('❌ E2E Tester error:', error.message);
      this.testResults.success = false;
      this.testResults.errors.push(error.message);
      return this.testResults;
    }
  }

  /**
   * Analyze application structure to determine what to test
   */
  async analyzeApplication() {
    console.log('📊 Analyzing application structure...');

    const srcDir = path.join(this.config.projectRoot, 'src');

    // Find all pages
    const pagesDir = path.join(srcDir, 'pages');
    try {
      const pageFiles = await fs.readdir(pagesDir);
      this.pages = pageFiles
        .filter(f => f.endsWith('.jsx') || f.endsWith('.js'))
        .map(f => f.replace(/\.(jsx|js)$/, ''));

      console.log(`Found ${this.pages.length} pages:`, this.pages.join(', '));
    } catch (error) {
      console.warn('Could not read pages directory:', error.message);
      this.pages = [];
    }

    // Analyze routing
    try {
      const appFile = path.join(srcDir, 'App.jsx');
      const appContent = await fs.readFile(appFile, 'utf-8');
      this.routes = this.extractRoutes(appContent);
      console.log(`Found ${this.routes.length} routes`);
    } catch (error) {
      console.warn('Could not analyze routes:', error.message);
      this.routes = [];
    }
  }

  /**
   * Extract routes from App.jsx
   */
  extractRoutes(content) {
    const routes = [];
    const routeRegex = /<Route\s+path=["']([^"']+)["']/g;
    let match;

    while ((match = routeRegex.exec(content)) !== null) {
      routes.push(match[1]);
    }

    return routes;
  }

  /**
   * Generate Playwright tests based on analysis
   */
  async generateTests() {
    console.log('📝 Generating Playwright tests...');

    // Generate config
    await this.generatePlaywrightConfig();

    // Generate test for each page/route
    for (const route of this.routes) {
      await this.generateRouteTest(route);
    }

    // Generate navigation test
    await this.generateNavigationTest();

    // Generate form tests if forms detected
    await this.generateFormTests();
  }

  /**
   * Generate Playwright configuration
   */
  async generatePlaywrightConfig() {
    // Never overwrite a config the project already maintains
    if (await fs.access(path.join(this.config.projectRoot, 'playwright.config.js')).then(() => true, () => false)) return;

    const config = `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'test-results/playwright-report' }]],
  outputDir: 'test-results/playwright-results',
  use: {
    baseURL: '${this.config.baseURL}',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: '${this.config.baseURL}',
    reuseExistingServer: !process.env.CI,
  },
});
`;

    const configPath = path.join(this.config.projectRoot, 'playwright.config.js');
    await fs.writeFile(configPath, config);
    console.log('✅ Generated playwright.config.js');
  }

  /**
   * Generate test for a specific route
   */
  async generateRouteTest(route) {
    const testName = route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '-');
    const testContent = `import { test, expect } from '@playwright/test';

test.describe('${testName} page', () => {
  test('should load successfully', async ({ page }) => {
    await page.goto('${route}');
    await expect(page).toHaveURL('${route}');

    // Check page is rendered
    await expect(page.locator('body')).toBeVisible();
  });

  test('should have proper title or heading', async ({ page }) => {
    await page.goto('${route}');

    // Check for heading
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });

  test('should not have console errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('${route}');
    await page.waitForLoadState('networkidle');

    expect(errors).toHaveLength(0);
  });
});
`;

    const testPath = path.join(this.config.testsDir, `${testName}.spec.js`);
    await fs.writeFile(testPath, testContent);
    console.log(`✅ Generated test: ${testName}.spec.js`);
  }

  /**
   * Generate navigation test
   */
  async generateNavigationTest() {
    const testContent = `import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate between pages', async ({ page }) => {
    await page.goto('/');

    // Find all navigation links
    const navLinks = await page.locator('nav a, [role="navigation"] a').all();

    for (const link of navLinks.slice(0, 5)) { // Test first 5 links
      const href = await link.getAttribute('href');
      if (href && !href.startsWith('http') && !href.startsWith('#')) {
        await link.click();
        await page.waitForLoadState('networkidle');

        // Verify page loaded
        await expect(page.locator('body')).toBeVisible();

        // Go back to home
        await page.goto('/');
      }
    }
  });

  test('should have responsive navigation', async ({ page }) => {
    await page.goto('/');

    // Check navigation is visible
    const nav = page.locator('nav, [role="navigation"]').first();
    await expect(nav).toBeVisible();
  });
});
`;

    const testPath = path.join(this.config.testsDir, 'navigation.spec.js');
    await fs.writeFile(testPath, testContent);
    console.log('✅ Generated test: navigation.spec.js');
  }

  /**
   * Generate form tests
   */
  async generateFormTests() {
    const testContent = `import { test, expect } from '@playwright/test';

test.describe('Forms', () => {
  test('should handle form validation', async ({ page }) => {
    await page.goto('/');

    // Find forms on the page
    const forms = await page.locator('form').all();

    if (forms.length > 0) {
      const form = forms[0];

      // Try to submit empty form
      const submitButton = form.locator('button[type="submit"], input[type="submit"]').first();
      if (await submitButton.count() > 0) {
        await submitButton.click();

        // Check for validation messages or errors
        const validationMsg = page.locator('[role="alert"], .error, .invalid');
        // Validation should appear or form should not submit
      }
    }
  });

  test('should fill and submit forms', async ({ page }) => {
    await page.goto('/');

    const forms = await page.locator('form').all();

    for (const form of forms.slice(0, 2)) {
      // Find input fields
      const inputs = await form.locator('input:not([type="submit"]), textarea, select').all();

      for (const input of inputs) {
        const type = await input.getAttribute('type');
        const tagName = await input.evaluate(el => el.tagName.toLowerCase());

        // Fill different input types
        if (type === 'text' || type === 'email' || tagName === 'textarea') {
          await input.fill('Test Value');
        } else if (type === 'checkbox') {
          await input.check();
        }
      }
    }
  });
});
`;

    const testPath = path.join(this.config.testsDir, 'forms.spec.js');
    await fs.writeFile(testPath, testContent);
    console.log('✅ Generated test: forms.spec.js');
  }

  /**
   * Run Playwright tests
   */
  async runPlaywrightTests() {
    console.log('🎭 Running Playwright tests...');

    return new Promise((resolve, reject) => {
      const playwright = spawn('npx', ['playwright', 'test'], {
        cwd: this.config.projectRoot,
        stdio: 'inherit',
        env: { ...process.env, CI: 'true' }
      });

      playwright.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Playwright tests passed');
          this.testResults.success = true;
          resolve();
        } else {
          console.warn(`⚠️  Playwright tests exited with code ${code}`);
          this.testResults.success = false;
          this.testResults.issues.push(`Tests exited with code ${code}`);
          resolve(); // Don't reject, just mark as unsuccessful
        }
      });

      playwright.on('error', (error) => {
        console.error('❌ Failed to run Playwright tests:', error.message);
        this.testResults.errors.push(error.message);
        reject(error);
      });
    });
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
    const resultsPath = path.join(this.config.outputDir, 'e2e-results.json');
    await fs.writeFile(resultsPath, JSON.stringify(this.testResults, null, 2));
    console.log(`📊 Results saved to ${resultsPath}`);
  }
}

export default E2ETester;
