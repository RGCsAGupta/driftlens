import { describe, expect, it, vi } from "vitest";

import type { ScanExecutionError } from "@/server/scans/errors";
import {
  GitHubDesiredStateReader,
  type FetchClient,
} from "@/server/scans/github";

const SHA = "0123456789abcdef0123456789abcdef01234567";

function response(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

describe("GitHubDesiredStateReader", () => {
  it("resolves a ref then reads exactly one configured file at the SHA", async () => {
    const fetchClient = vi
      .fn<FetchClient>()
      .mockResolvedValueOnce(response({ sha: SHA }))
      .mockResolvedValueOnce(
        response({
          content: Buffer.from("apiVersion: apps/v1").toString("base64"),
          encoding: "base64",
          type: "file",
        }),
      );
    const reader = new GitHubDesiredStateReader(
      "owner/repository",
      "demo/deployment.yaml",
      fetchClient,
    );

    await expect(reader.load("feature/test")).resolves.toEqual({
      resolvedSha: SHA,
      yaml: "apiVersion: apps/v1",
    });
    expect(fetchClient).toHaveBeenCalledTimes(2);
    expect(fetchClient.mock.calls[0]?.[0]).toBe(
      "https://api.github.com/repos/owner/repository/commits/feature%2Ftest",
    );
    expect(fetchClient.mock.calls[1]?.[0]).toBe(
      `https://api.github.com/repos/owner/repository/contents/demo/deployment.yaml?ref=${SHA}`,
    );
    expect(fetchClient.mock.calls[0]?.[1]).toMatchObject({ method: "GET" });
  });

  it.each([
    ["missing ref", [response({}, 404)], "GITHUB_REF_NOT_FOUND"],
    [
      "missing file",
      [response({ sha: SHA }), response({}, 404)],
      "GITHUB_FILE_NOT_FOUND",
    ],
    ["unavailable GitHub", [response({}, 503)], "GITHUB_UNAVAILABLE"],
    [
      "invalid response",
      [response({ sha: "branch-not-sha" })],
      "GITHUB_RESPONSE_INVALID",
    ],
    [
      "invalid file encoding",
      [
        response({ sha: SHA }),
        response({ content: "***", encoding: "base64", type: "file" }),
      ],
      "GITHUB_RESPONSE_INVALID",
    ],
  ])("maps %s without retries", async (_name, responses, code) => {
    const fetchClient = vi.fn<FetchClient>();
    for (const item of responses) {
      fetchClient.mockResolvedValueOnce(item);
    }
    const reader = new GitHubDesiredStateReader(
      "owner/repository",
      "deployment.yaml",
      fetchClient,
    );

    await expect(reader.load("main")).rejects.toEqual(
      expect.objectContaining({ code }),
    );
    expect(fetchClient).toHaveBeenCalledTimes(responses.length);
  });

  it("aborts one hung request at the bounded timeout without retrying", async () => {
    const fetchClient = vi.fn<FetchClient>((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
    });
    const reader = new GitHubDesiredStateReader(
      "owner/repository",
      "deployment.yaml",
      fetchClient,
      1,
    );

    await expect(reader.load("main")).rejects.toEqual(
      expect.objectContaining<Partial<ScanExecutionError>>({
        code: "GITHUB_TIMEOUT",
      }),
    );
    expect(fetchClient).toHaveBeenCalledOnce();
  });
});
