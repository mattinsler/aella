import fs from 'node:fs';
import chalk from 'chalk';

export async function writeFile(file: string, data: string, options?: fs.WriteFileOptions | undefined) {
  try {
    await fs.promises.access(file, fs.constants.R_OK);
    const content = await fs.promises.readFile(file, options);
    if (content === data) {
      return;
    }
    console.log(`${chalk.blue('+ updated')} ${file}`);
  } catch {
    console.log(`${chalk.green('+ created')} ${file}`);
  }

  await fs.promises.writeFile(file, data, options);
}

export function writeFileSync(file: string, data: string, options?: fs.WriteFileOptions | undefined) {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, options);
    if (content === data) {
      return;
    }
    console.log(`${chalk.blue('+ updated')} ${file}`);
  } else {
    console.log(`${chalk.green('+ created')} ${file}`);
  }

  fs.writeFileSync(file, data, options);
}
