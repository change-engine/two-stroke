import { spawnSync } from "child_process";

export function cmd(program, args = []) {
  const { error, status } = spawnSync(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    program.split(" ")[0],
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    [...program.split(" ").slice(1), ...args],
    {
      stdio: "inherit",
    },
  );
  // eslint-disable-next-line no-process-exit
  if (status) process.exit(status);
  if (error) throw error;
}
