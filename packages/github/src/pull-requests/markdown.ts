export function collapsibleSection(title: string, content: string): string {
  return `<details>\n<summary>${title}</summary>\n\n${content}\n</details>\n`;
}
