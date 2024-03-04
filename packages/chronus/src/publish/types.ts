export type PublishSummaryStatus = "success" | "partial" | "failed";

export type PublishPackageResult = PublishedPackageSuccess | PublishedPackageFailure;

export interface PublishedPackageSuccess {
  readonly published: true;
  readonly name: string;
  readonly version: string;
  readonly size: number;
  readonly unpackedSize: number;
}

export interface PublishedPackageFailure {
  readonly published: false;
  readonly name: string;
  readonly version: string;
}

export interface PublishSummary {
  status: PublishSummaryStatus;
  packages: Record<string, PublishPackageResult>;
}
