export interface Reporter {
  readonly log: (message: string) => void;
  readonly task: (message: string, action: (task: Task) => Promise<TaskStatus | void>) => Promise<void>;
}

export interface Task {
  readonly update: (message: string) => void;
}

export type TaskStatus = "success" | "failure" | "skipped";
