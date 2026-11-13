import fs from 'node:fs';
import path from 'node:path';
import type { ActionLogEntry, CliState, DraftResultCard, GuestAgentData } from './types.js';

export const DEFAULT_RUN_DIR = './runs/current';

export function resolveRunDir(customRunDir?: string): string {
  const dir = customRunDir && customRunDir.trim().length > 0 ? customRunDir.trim() : DEFAULT_RUN_DIR;
  return path.resolve(dir);
}

export function getStatePath(runDir: string): string {
  return path.join(runDir, 'state.json');
}

export function getGuestPath(runDir: string): string {
  return path.join(runDir, 'guest.json');
}

export function saveGuest(runDir: string, guest: GuestAgentData): string {
  fs.mkdirSync(runDir, { recursive: true });
  const p = getGuestPath(runDir);
  fs.writeFileSync(p, JSON.stringify(guest, null, 2), 'utf8');
  return p;
}

export function loadGuest(runDir: string): GuestAgentData | null {
  const p = getGuestPath(runDir);
  if (!fs.existsSync(p)) {
    return null;
  }
  const content = fs.readFileSync(p, 'utf8');
  try {
    return JSON.parse(content) as GuestAgentData;
  } catch (err) {
    throw new Error(`Corrupted guest file at ${p}: ${(err as Error).message}`);
  }
}

export function getLogsDir(runDir: string): string {
  return path.join(runDir, 'logs');
}

export function getLogFilePath(runDir: string, seed: string, agentId: string): string {
  return path.join(getLogsDir(runDir), `${seed}_${agentId}.jsonl`);
}

export function getResultDraftPath(runDir: string): string {
  return path.join(runDir, 'result_draft.json');
}

export function getAdventureMdPath(runDir: string): string {
  return path.join(runDir, 'adventure.md');
}

export function saveState(runDir: string, state: CliState): void {
  fs.mkdirSync(runDir, { recursive: true });
  const p = getStatePath(runDir);
  fs.writeFileSync(p, JSON.stringify(state, null, 2), 'utf8');
}

export function loadState(runDir: string): CliState {
  const p = getStatePath(runDir);
  if (!fs.existsSync(p)) {
    throw new Error(`State file not found at ${p}. Run 'mini-dungeon new' first.`);
  }
  const content = fs.readFileSync(p, 'utf8');
  try {
    return JSON.parse(content) as CliState;
  } catch (err) {
    throw new Error(`Corrupted state file at ${p}: ${(err as Error).message}`);
  }
}

export function stateExists(runDir: string): boolean {
  return fs.existsSync(getStatePath(runDir));
}

export function appendLogEntry(
  runDir: string,
  seed: string,
  agentId: string,
  entry: ActionLogEntry
): void {
  const logDir = getLogsDir(runDir);
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = getLogFilePath(runDir, seed, agentId);
  const line = JSON.stringify(entry) + '\n';
  fs.appendFileSync(logFile, line, 'utf8');
}

export function readLogEntries(runDir: string, seed: string, agentId: string): ActionLogEntry[] {
  const logFile = getLogFilePath(runDir, seed, agentId);
  if (!fs.existsSync(logFile)) {
    return [];
  }
  const content = fs.readFileSync(logFile, 'utf8');
  const lines = content.split('\n').filter((l: string) => l.trim().length > 0);
  return lines.map((l: string) => JSON.parse(l) as ActionLogEntry);
}

export function readRawLogContent(runDir: string, seed: string, agentId: string): string {
  const logFile = getLogFilePath(runDir, seed, agentId);
  if (!fs.existsSync(logFile)) {
    return '';
  }
  return fs.readFileSync(logFile, 'utf8');
}

export function saveResultDraft(runDir: string, draft: DraftResultCard | Record<string, unknown>): string {
  fs.mkdirSync(runDir, { recursive: true });
  const p = getResultDraftPath(runDir);
  fs.writeFileSync(p, JSON.stringify(draft, null, 2), 'utf8');
  return p;
}

export function saveAdventureMd(runDir: string, markdownContent: string): string {
  fs.mkdirSync(runDir, { recursive: true });
  const p = getAdventureMdPath(runDir);
  fs.writeFileSync(p, markdownContent, 'utf8');
  return p;
}
