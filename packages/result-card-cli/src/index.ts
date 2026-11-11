export * from './types.js';
export * from './validate.js';
export * from './radar.js';
export * from './browser.js';
export * from './template.js';
export * from './share.js';
export * from './cli.js';

if (import.meta.main) {
  const { runCli } = await import('./cli.js');
  const exitCode = await runCli(process.argv.slice(2));
  process.exit(exitCode);
}
