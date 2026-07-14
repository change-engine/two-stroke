import { spawnSync } from "child_process";

export function cmd(program, args = []) {
  const { error, status } = spawnSync(
    program.split(" ")[0],
    [...program.split(" ").slice(1), ...args],
    {
      stdio: "inherit",
    },
  );
  if (status) process.exit(status);
  if (error) throw error;
}
