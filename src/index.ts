import * as core from "@actions/core";
import * as github from "@actions/github";
import * as pr from "./github";
import * as ai from "./ai";

async function run(): Promise<void> {
	try {
		const githubToken = core.getInput("GITHUB_TOKEN", { required: true });
		const openaiApiKey = core.getInput("OPENAI_API_KEY", { required: true });

		const octokit = github.getOctokit(githubToken);

		const changedFiles = await pr.getChangedFiles(octokit, github.context);

		// Generate overall PR summary and analyze files in parallel
		const fileAnalyses = await Promise.all(
			changedFiles.map(async (file) => {
				const fullContent = await pr.getFileContent(
					octokit,
					github.context,
					file.filename,
				);
				const contextContent = pr.extractContext(fullContent, file.patch);
				const { feedback } = await ai.analyzeFileChanges(
					openaiApiKey,
					file.filename,
					file.patch,
					contextContent,
				);
				return {
					filename: file.filename,
					feedback,
					patch: file.patch,
				};
			}),
		);

		// Update PR description and add comment in parallel
		await pr.addPRComment(octokit, github.context, fileAnalyses);
	} catch (error) {
		if (error instanceof Error) core.setFailed(error.message);
	}
}

run();
