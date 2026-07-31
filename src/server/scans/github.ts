import { z } from "zod";

import { ScanExecutionError } from "@/server/scans/errors";

const commitResponseSchema = z.object({
  sha: z.string().regex(/^[0-9a-f]{40}$/),
});
const contentResponseSchema = z.object({
  content: z.string().max(2_000_000),
  encoding: z.literal("base64"),
  type: z.literal("file"),
});

export interface DesiredState {
  resolvedSha: string;
  yaml: string;
}

export interface DesiredStateReader {
  load(ref: string): Promise<DesiredState>;
}

export type FetchClient = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function apiPath(...parts: string[]): string {
  return parts.map((part) => encodeURIComponent(part)).join("/");
}

export class GitHubDesiredStateReader implements DesiredStateReader {
  constructor(
    private readonly repository: string,
    private readonly manifestPath: string,
    private readonly fetchClient: FetchClient = fetch,
    private readonly timeoutMs = 10_000,
  ) {}

  async load(ref: string): Promise<DesiredState> {
    const [owner, repository] = this.repository.split("/");
    if (!owner || !repository) {
      throw new ScanExecutionError("CONFIGURATION_INVALID");
    }

    const commit = await this.request(
      `https://api.github.com/repos/${apiPath(owner, repository, "commits", ref)}`,
      "ref",
    );
    const commitResult = commitResponseSchema.safeParse(commit);
    if (!commitResult.success) {
      throw new ScanExecutionError("GITHUB_RESPONSE_INVALID");
    }

    const encodedPath = this.manifestPath
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
    const content = await this.request(
      `https://api.github.com/repos/${apiPath(owner, repository, "contents")}/${encodedPath}?ref=${commitResult.data.sha}`,
      "file",
    );
    const contentResult = contentResponseSchema.safeParse(content);
    if (!contentResult.success) {
      throw new ScanExecutionError("GITHUB_RESPONSE_INVALID");
    }

    const encodedContent = contentResult.data.content.replaceAll("\n", "");
    if (
      encodedContent.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(encodedContent)
    ) {
      throw new ScanExecutionError("GITHUB_RESPONSE_INVALID");
    }

    try {
      return {
        resolvedSha: commitResult.data.sha,
        yaml: new TextDecoder("utf-8", { fatal: true }).decode(
          Buffer.from(encodedContent, "base64"),
        ),
      };
    } catch (error) {
      throw new ScanExecutionError("GITHUB_RESPONSE_INVALID", { cause: error });
    }
  }

  private async request(
    url: string,
    resource: "file" | "ref",
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchClient(url, {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        method: "GET",
        signal: controller.signal,
      });
      if (response.status === 404) {
        throw new ScanExecutionError(
          resource === "ref" ? "GITHUB_REF_NOT_FOUND" : "GITHUB_FILE_NOT_FOUND",
        );
      }
      if (!response.ok) {
        throw new ScanExecutionError("GITHUB_UNAVAILABLE");
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ScanExecutionError) {
        throw error;
      }
      if (controller.signal.aborted) {
        throw new ScanExecutionError("GITHUB_TIMEOUT", { cause: error });
      }
      throw new ScanExecutionError("GITHUB_UNAVAILABLE", { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }
}
