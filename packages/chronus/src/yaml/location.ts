import { isCollection, isMap, isScalar, type Node } from "yaml";
import { findPair } from "yaml/util";
import type { FileLocation } from "../utils/errors.js";
import type { YamlFile } from "./types.js";

export type YamlDiagnosticTargetType = "value" | "key";

export function getLocationInYamlScript(
  file: YamlFile,
  path: (string | number)[],
  kind: YamlDiagnosticTargetType = "value",
): FileLocation {
  const node: Node | undefined = findYamlNode(file, path, kind);
  return {
    file: file.file,
    pos: node?.range?.[0] ?? 0,
    end: node?.range?.[1] ?? 0,
  };
}

function findYamlNode(
  file: YamlFile,
  path: (string | number)[],
  kind: YamlDiagnosticTargetType = "value",
): Node | undefined {
  let current: Node | null = file.doc.contents;

  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    const isLast = i === path.length - 1;
    if (isScalar(current)) {
      return current;
    } else if (isCollection(current)) {
      if (isLast) {
        if (kind === "value" || !isMap(current)) {
          return current.get(key, true);
        } else {
          const pair = findPair(current.items, key);
          if (kind === "key") {
            return pair?.key as any;
          } else {
            return pair as any;
          }
        }
      } else {
        current = current.get(key, true) as any;
      }
    } else {
      continue;
    }
  }
  return current ?? undefined;
}
