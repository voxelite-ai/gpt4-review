import * as github from "@actions/github";

export interface FileDiff {
  filename: string;
  patch: string;
}

export interface FileAnalysis {
  filename: string;
  feedback: string;
  patch: string;
  author: string;
}

export type PRDetails = {
  title: string;
  author: string;
  draft?: boolean;
};

export async function getPRDetails(
  octokit: ReturnType<typeof github.getOctokit>,
  context: typeof github.context,
): Promise<PRDetails> {
  const { data: pr } = await octokit.rest.pulls.get({
    ...context.repo,
    pull_number: context.payload.pull_request!.number,
  });

  return {
    title: pr.title,
    author: pr.user.login,
    draft: pr.draft,
  };
}

export async function getChangedFiles(
  octokit: ReturnType<typeof github.getOctokit>,
  context: typeof github.context,
): Promise<FileDiff[]> {
  const { data: files } = await octokit.rest.pulls.listFiles({
    ...context.repo,
    pull_number: context.payload.pull_request!.number,
  });

  return files.map((file) => ({
    filename: file.filename,
    patch: file.patch || "",
  }));
}

export async function getFileContent(
  octokit: ReturnType<typeof github.getOctokit>,
  context: typeof github.context,
  filename: string,
): Promise<string> {
  const { data } = await octokit.rest.repos.getContent({
    ...context.repo,
    path: filename,
    ref: context.payload.pull_request!.head.sha,
  });
  if ("content" in data) {
    return Buffer.from(data.content, "base64").toString("utf-8");
  }
  throw new Error(`Unable to get content for ${filename}`);
}

export async function updatePRDescription(
  octokit: ReturnType<typeof github.getOctokit>,
  context: typeof github.context,
  summary: string,
) {
  const currentBody = context.payload.pull_request!.body || "";
  const newBody = `${currentBody}\n\n## GPT-4 Summary\n\n${summary}`;
  await octokit.rest.pulls.update({
    ...context.repo,
    pull_number: context.payload.pull_request!.number,
    body: newBody,
  });
}

export function extractContext(
  fullContent: string,
  patch: string,
  contextLines: number = 3,
): string {
  const lines = fullContent.split("\n");
  const patchLines = patch.split("\n");
  let contextContent = "";
  let lineNumber = 0;

  for (const patchLine of patchLines) {
    if (patchLine.startsWith("@@")) {
      const match = patchLine.match(/@@ -(\d+),\d+ \+\d+,\d+ @@/);
      if (match) {
        lineNumber = parseInt(match[1]) - 1;
      }
    } else if (patchLine.startsWith("-")) {
      // Skip removed lines
      lineNumber++;
    } else if (patchLine.startsWith("+")) {
      const start = Math.max(0, lineNumber - contextLines);
      const end = Math.min(lines.length, lineNumber + contextLines + 1);
      contextContent += lines.slice(start, end).join("\n") + "\n\n";
      lineNumber++;
    } else {
      lineNumber++;
    }
  }

  return contextContent.trim();
}

export async function addPRComment(
  octokit: ReturnType<typeof github.getOctokit>,
  context: typeof github.context,
  analyses: FileAnalysis[],
) {
  if (analyses.length === 0) {
    console.log("No feedback to add to the PR.");
    return;
  }

  for (const analysis of analyses) {
    await octokit.rest.issues.createComment({
      ...context.repo,
      issue_number: context.payload.pull_request!.number,
      body: `### ${analysis.filename}\n\n\`\`\`diff\n${analysis.patch}\n\`\`\`\n\n${analysis.feedback}\n\n`,
    });
  }

  // let feedbackContent = "## AI Review\n\n";
  //
  // for (const analysis of analyses) {
  //   feedbackContent += `### ${analysis.filename}\n\n`;
  //   feedbackContent += "```diff\n" + analysis.patch + "\n```\n\n";
  //   feedbackContent += `${analysis.feedback}\n\n`;
  // }
  //
  // await octokit.rest.issues.createComment({
  //   ...context.repo,
  //   issue_number: context.payload.pull_request!.number,
  //   body: feedbackContent,
  // });
}
