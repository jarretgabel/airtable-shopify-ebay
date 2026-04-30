import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const workspaceRoot = process.cwd();
const distAssetsPath = path.join(workspaceRoot, 'dist', 'assets');
const baselinePath = path.join(workspaceRoot, 'docs', 'bundle-size-baseline.json');
const knownFeatureChunkNames = [
  'feature-account',
  'feature-approval',
  'feature-dashboard',
  'feature-ebay',
  'feature-tabs',
  'feature-users',
];

function formatKilobytes(bytes) {
  return `${(bytes / 1024).toFixed(2)} kB`;
}

function formatDelta(bytes) {
  const kilobytes = bytes / 1024;
  const sign = kilobytes >= 0 ? '+' : '-';
  return `${sign}${Math.abs(kilobytes).toFixed(2)} kB`;
}

function parseArgs(argv) {
  return {
    writeBaseline: argv.includes('--write-baseline'),
  };
}

function readBaseline() {
  if (!existsSync(baselinePath)) {
    return null;
  }

  const raw = readFileSync(baselinePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || typeof parsed.chunks !== 'object' || parsed.chunks === null) {
    throw new Error(`Invalid bundle baseline file: ${baselinePath}`);
  }

  return parsed;
}

function resolveChunkName(fileName, baseline) {
  const withoutExtension = fileName.replace(/\.js$/, '');
  const candidateNames = Array.from(new Set([
    ...knownFeatureChunkNames,
    ...Object.keys(baseline?.chunks ?? {}),
  ])).sort((left, right) => right.length - left.length);

  return candidateNames.find((chunkName) => withoutExtension === chunkName || withoutExtension.startsWith(`${chunkName}-`)) ?? null;
}

function collectFeatureChunks(baseline) {
  if (!existsSync(distAssetsPath)) {
    throw new Error('Missing dist/assets. Run a production build first.');
  }

  const chunkEntries = readdirSync(distAssetsPath)
    .filter((fileName) => fileName.endsWith('.js'))
    .map((fileName) => {
      const chunkName = resolveChunkName(fileName, baseline);
      if (!chunkName) return null;

      const filePath = path.join(distAssetsPath, fileName);
      const source = readFileSync(filePath);
      const rawBytes = statSync(filePath).size;
      const gzipBytes = gzipSync(source).length;

      return [chunkName, {
        file: fileName,
        rawBytes,
        gzipBytes,
      }];
    })
    .filter((entry) => entry !== null);

  const groupedChunks = new Map();

  for (const [chunkName, chunkData] of chunkEntries) {
    const existing = groupedChunks.get(chunkName);
    if (existing) {
      existing.files.push(chunkData.file);
      existing.rawBytes += chunkData.rawBytes;
      existing.gzipBytes += chunkData.gzipBytes;
      continue;
    }

    groupedChunks.set(chunkName, {
      files: [chunkData.file],
      rawBytes: chunkData.rawBytes,
      gzipBytes: chunkData.gzipBytes,
    });
  }

  return Object.fromEntries(Array.from(groupedChunks.entries()).sort((left, right) => left[0].localeCompare(right[0])));
}

function writeBaselineFile(chunks) {
  const payload = {
    generatedAt: new Date().toISOString(),
    chunks,
  };

  writeFileSync(baselinePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function printReport(chunks, baseline) {
  const chunkNames = Object.keys(chunks);

  if (chunkNames.length === 0) {
    console.log('No feature-* chunks were found in dist/assets.');
    return;
  }

  if (baseline) {
    console.log(`Bundle report against ${path.relative(workspaceRoot, baselinePath)}:`);
  } else {
    console.log('Bundle report (no baseline recorded yet):');
  }

  for (const chunkName of chunkNames) {
    const current = chunks[chunkName];
    const previous = baseline?.chunks?.[chunkName] ?? null;

    if (!previous) {
      console.log(`- ${chunkName}: ${formatKilobytes(current.rawBytes)} raw / ${formatKilobytes(current.gzipBytes)} gzip (${current.files.length} files)`);
      continue;
    }

    const rawDelta = current.rawBytes - previous.rawBytes;
    const gzipDelta = current.gzipBytes - previous.gzipBytes;
    console.log(
      `- ${chunkName}: ${formatKilobytes(current.rawBytes)} raw / ${formatKilobytes(current.gzipBytes)} gzip `
      + `(delta ${formatDelta(rawDelta)} raw / ${formatDelta(gzipDelta)} gzip, was ${formatKilobytes(previous.rawBytes)} / ${formatKilobytes(previous.gzipBytes)})`,
    );
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseline = readBaseline();
  const chunks = collectFeatureChunks(baseline);

  printReport(chunks, baseline);

  if (options.writeBaseline) {
    writeBaselineFile(chunks);
    console.log(`Wrote bundle baseline to ${path.relative(workspaceRoot, baselinePath)}`);
  }
}

main();