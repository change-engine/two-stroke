import { spawnSync } from "child_process";

export function cmd(cmd, args = []) {
  const { error, status } = spawnSync(
    cmd.split(" ")[0],
    [...cmd.split(" ").slice(1), ...args],
    {
      stdio: "inherit",
    },
  );
  if (status) process.exit(status);
  if (error) throw error;
}
