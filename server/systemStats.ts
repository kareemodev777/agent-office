import * as os from 'os';
import { execSync } from 'child_process';

export interface ProcessStats {
  pid: number;
  cpu: number;    // % CPU
  memMB: number;  // RSS in MB
  cmd: string;    // truncated command
}

export interface SystemStats {
  cpuPercent: number;       // 0-100
  memUsedMB: number;
  memTotalMB: number;
  memPercent: number;       // 0-100
  processes: ProcessStats[];
  estimatedCapacity: number; // how many more agents can likely run
}

// Track previous CPU times for accurate delta-based measurement
let prevCpuTimes: { idle: number; total: number } | null = null;

function getCpuTimes(): { idle: number; total: number } {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const [key, val] of Object.entries(cpu.times)) {
      total += val;
      if (key === 'idle') idle += val;
    }
  }
  return { idle, total };
}

export function getSystemStats(): SystemStats {
  // CPU: delta since last call for accuracy
  const curr = getCpuTimes();
  let cpuPercent = 0;
  if (prevCpuTimes) {
    const totalDiff = curr.total - prevCpuTimes.total;
    const idleDiff = curr.idle - prevCpuTimes.idle;
    if (totalDiff > 0) {
      cpuPercent = Math.round(((totalDiff - idleDiff) / totalDiff) * 100);
      cpuPercent = Math.min(100, Math.max(0, cpuPercent));
    }
  }
  prevCpuTimes = curr;

  // RAM
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsedMB = Math.round(usedMem / 1024 / 1024);
  const memTotalMB = Math.round(totalMem / 1024 / 1024);
  const memPercent = Math.round((usedMem / totalMem) * 100);

  // Per-process stats for claude processes
  const processes: ProcessStats[] = [];
  try {
    // -Ao: all processes, custom format: pid, cpu%, rss(KB), command
    const output = execSync('ps -Ao pid,pcpu,rss,comm 2>/dev/null', {
      encoding: 'utf8',
      timeout: 2000,
    });
    for (const line of output.split('\n').slice(1)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) continue;
      const [pidStr, cpuStr, rssStr, ...cmdParts] = parts;
      const cmd = cmdParts.join(' ');
      // Match claude CLI processes
      if (/claude/i.test(cmd) && !/grep/.test(cmd)) {
        processes.push({
          pid: parseInt(pidStr),
          cpu: parseFloat(cpuStr) || 0,
          memMB: Math.round((parseInt(rssStr) || 0) / 1024),
          cmd: cmd.length > 32 ? cmd.slice(0, 32) + '…' : cmd,
        });
      }
    }
  } catch {
    // ps unavailable or timed out — skip
  }

  // Capacity estimate: each claude agent ~400MB RSS on average
  const AVG_AGENT_MB = 400;
  const freeMemMB = Math.round(freeMem / 1024 / 1024);
  const estimatedCapacity = Math.max(0, Math.floor(freeMemMB / AVG_AGENT_MB));

  return {
    cpuPercent,
    memUsedMB,
    memTotalMB,
    memPercent,
    processes,
    estimatedCapacity,
  };
}
