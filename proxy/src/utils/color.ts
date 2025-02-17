import chalk from "chalk";

export const color = {
  info(message: string): string {
    return chalk.blue(message);
  },
  notice(message: string): string {
    return chalk.yellow(message);
  },
  caution(message: string): string {
    return chalk.yellowBright(message);
  },
  muted(message: string): string {
    return chalk.dim(message);
  },
  danger(message: string): string {
    return chalk.red(message);
  },
  success(message: string): string {
    return chalk.green(message);
  },
};
