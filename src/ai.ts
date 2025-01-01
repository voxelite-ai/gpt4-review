import {
  SystemMessage,
  HumanMessage,
  MessageContent,
} from "@langchain/core/messages";
import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";
import { ChatAnthropic } from "@langchain/anthropic";
import type { FileDiff, PRDetails } from "./github";

export const getModel = (apiKey: string) =>
  new ChatAnthropic({
    model: "claude-3-5-sonnet-20241022",
    apiKey,
    temperature: 0.1,
  });

export async function generatePRSummary(
  apikey: string,
  files: FileDiff[],
): Promise<string> {
  let allChanges = files
    .map((file) => `File: ${file.filename}\n\n${file.patch}\n\n`)
    .join("---\n\n");

  const messages = [
    new SystemMessage(
      "You are a helpful code reviewer. Provide a concise summary of the overall changes in this pull request. Your output should be structured as bullet points",
    ),
    new HumanMessage(
      `Summarize the following changes in the pull request:\n\n${allChanges}`,
    ),
  ];

  const model = getModel(apikey);
  const response = await model.invoke(messages);

  return contentToString(response.content) || "";
}

export async function analyzeFileChanges(
  apiKey: string,
  filename: string,
  patch: string,
  context: string,
  details: PRDetails,
): Promise<{ feedback: string }> {
  const duckducksearch = new DuckDuckGoSearch({ maxResults: 3 });
  const model = getModel(apiKey);
  const response = await model.invoke(
    [
      {
        role: "system",
        content: `
You are an AI Assistant that’s an expert at reviewing pull requests. Review the below pull request that you receive. 

Input format
- The input format follows Github diff format with addition and subtraction of code.
- The + sign means that code has been added.
- The - sign means that code has been removed.

Instructions
- Take into account that you don’t have access to the full code but only the code diff.
- Only answer on what can be improved and provide the improvement in code. 
- Answer in short form. 
- Include code snippets if necessary.
- Adhere to the languages code conventions.
- Attach useful links if necessary.

Context:
PR Title: ${details.title}
PR Author: ${details.author}
`,
      },
      {
        role: "user",
        content: `Review the following code changes for file ${filename}:\n\nChanged parts:\n${patch}\n\nBroader file context:\n${context}`,
      },
    ],
    {
      tools: [duckducksearch],
    },
  );

  const content = contentToString(response.content) || "";

  return { feedback: content.trim() };
}

function contentToString(content: MessageContent): string {
  if (typeof content === "string") {
    return content;
  } else {
    return content.join("\n");
  }
}
