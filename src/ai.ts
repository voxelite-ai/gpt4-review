import {
  SystemMessage,
  HumanMessage,
  MessageContent,
} from "@langchain/core/messages";
import { ChatAnthropic } from "@langchain/anthropic";
import type { FileDiff } from "./github";
import * as hub from "langchain/hub";

export const getModel = (apiKey: string) =>
  new ChatAnthropic({
    model: "claude-3-5-sonnet",
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
): Promise<{ feedback: string }> {
  const model = getModel(apiKey);
  const response = await model.invoke([
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
- Make it personal and always show gratitude to the author using "@" when tagging.
`,
      // "You are a helpful staff engineer who is reviewing code.\nProvide constructive feedback on the code changes. Each of the feedback should be numbered points. Each of the points should have a title called **Observation:** and **Actionable Feedback**.\nAn example is ```3. **Observation:** Potential Performance Issue\n**Actionable Feedback:** If `setPageTitle` involves any non-trivial computation, or if `useSidebarPageStore` has additional side effects, you may want to optimize the trigger. One way is by checking if the title is already 'Tasks' before calling `setPageTitle`.```\nFocus your feedback on the changed parts of the code (lines starting with '+' or '-'), but use the surrounding context to inform your analysis. At the end of your feedback, add a new line with just 'CRITICAL_FEEDBACK:' followed by 'true' if you have substantial or critical feedback, or 'false' if your feedback is minor or just positive.",
    },
    {
      role: "user",
      content: `Review the following code changes for file ${filename}:\n\nChanged parts:\n${patch}\n\nBroader file context:\n${context}`,
    },
  ]);

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
