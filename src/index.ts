import * as core from '@actions/core'
import * as github from '@actions/github'
import { Configuration, OpenAIApi } from 'openai'

async function getChangedFiles(
	octokit: ReturnType<typeof github.getOctokit>,
	context: typeof github.context
): Promise<string[]> {
	const { data: files } = await octokit.rest.pulls.listFiles({
		...context.repo,
		pull_number: context.payload.pull_request!.number,
	})
	return files.map((file) => file.filename)
}

async function getFileContent(
	octokit: ReturnType<typeof github.getOctokit>,
	context: typeof github.context,
	filename: string
): Promise<string> {
	const { data } = await octokit.rest.repos.getContent({
		...context.repo,
		path: filename,
		ref: context.payload.pull_request!.head.sha,
	})
	if ('content' in data) {
		return Buffer.from(data.content, 'base64').toString('utf-8')
	}
	throw new Error(`Unable to get content for ${filename}`)
}

async function analyzeWithGPT4(
	openai: OpenAIApi,
	content: string
): Promise<string> {
	const response = await openai.createChatCompletion({
		model: 'gpt-4',
		messages: [
			{
				role: 'system',
				content:
					'You are a helpful code reviewer. Provide a summary of the changes and constructive feedback.',
			},
			{
				role: 'user',
				content: `Review the following code changes:\n\n${content}`,
			},
		],
	})
	return response.data.choices[0].message?.content || ''
}

async function updatePRDescription(
	octokit: ReturnType<typeof github.getOctokit>,
	context: typeof github.context,
	summary: string
) {
	const currentBody = context.payload.pull_request!.body || ''
	const newBody = `${currentBody}\n\n## GPT-4 Summary\n\n${summary}`
	await octokit.rest.pulls.update({
		...context.repo,
		pull_number: context.payload.pull_request!.number,
		body: newBody,
	})
}

async function addPRComment(
	octokit: ReturnType<typeof github.getOctokit>,
	context: typeof github.context,
	feedback: string
) {
	await octokit.rest.issues.createComment({
		...context.repo,
		issue_number: context.payload.pull_request!.number,
		body: `## GPT-4 Feedback\n\n${feedback}`,
	})
}

async function run(): Promise<void> {
	try {
		const githubToken = core.getInput('GITHUB_TOKEN', { required: true })
		const openaiApiKey = core.getInput('OPENAI_API_KEY', { required: true })

		const octokit = github.getOctokit(githubToken)
		const openai = new OpenAIApi(new Configuration({ apiKey: openaiApiKey }))

		const changedFiles = await getChangedFiles(octokit, github.context)
		let changedContent = ''
		for (const file of changedFiles) {
			const content = await getFileContent(octokit, github.context, file)
			changedContent += `File: ${file}\n\n${content}\n\n`
		}

		const analysis = await analyzeWithGPT4(openai, changedContent)
		const [summary, feedback] = analysis.split('\n\nFeedback:')

		await updatePRDescription(octokit, github.context, summary)
		await addPRComment(octokit, github.context, feedback)
	} catch (error) {
		if (error instanceof Error) core.setFailed(error.message)
	}
}

run()
