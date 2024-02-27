export const spinnerFrames =
  process.platform === "win32" ? ["-", "\\", "|", "/"] : ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function createSpinner() {
  let index = 0;

  return () => {
    index = ++index % spinnerFrames.length;
    return spinnerFrames[index];
  };
}
