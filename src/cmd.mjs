import { spawn } from "child_process";

export function cmd(cmd, args = []) {
  const p = spawn(cmd.split(" ")[0], [...cmd.split(" ").slice(1), ...args], {
    stdio: "inherit",
  });
  return new Promise((resolve) => {
    p.on("exit", resolve);
  });
}
