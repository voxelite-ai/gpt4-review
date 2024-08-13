"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const openai_1 = require("openai");
function getChangedFiles(octokit, context) {
    return __awaiter(this, void 0, void 0, function* () {
        const { data: files } = yield octokit.rest.pulls.listFiles(Object.assign(Object.assign({}, context.repo), { pull_number: context.payload.pull_request.number }));
        return files.map((file) => ({
            filename: file.filename,
            patch: file.patch || '',
        }));
    });
}
function getFileContent(octokit, context, filename) {
    return __awaiter(this, void 0, void 0, function* () {
        const { data } = yield octokit.rest.repos.getContent(Object.assign(Object.assign({}, context.repo), { path: filename, ref: context.payload.pull_request.head.sha }));
        if ('content' in data) {
            return Buffer.from(data.content, 'base64').toString('utf-8');
        }
        throw new Error(`Unable to get content for ${filename}`);
    });
}
function extractContext(fullContent, patch, contextLines = 3) {
    const lines = fullContent.split('\n');
    const patchLines = patch.split('\n');
    let contextContent = '';
    let lineNumber = 0;
    for (const patchLine of patchLines) {
        if (patchLine.startsWith('@@')) {
            const match = patchLine.match(/@@ -(\d+),\d+ \+\d+,\d+ @@/);
            if (match) {
                lineNumber = parseInt(match[1]) - 1;
            }
        }
        else if (patchLine.startsWith('-')) {
            // Skip removed lines
            lineNumber++;
        }
        else if (patchLine.startsWith('+')) {
            const start = Math.max(0, lineNumber - contextLines);
            const end = Math.min(lines.length, lineNumber + contextLines + 1);
            contextContent += lines.slice(start, end).join('\n') + '\n\n';
            lineNumber++;
        }
        else {
            lineNumber++;
        }
    }
    return contextContent.trim();
}
function generatePRSummary(openai, files) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        let allChanges = files
            .map((file) => `File: ${file.filename}\n\n${file.patch}\n\n`)
            .join('---\n\n');
        const response = yield openai.createChatCompletion({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful code reviewer. Provide a concise summary of the overall changes in this pull request. Your output should be structured as bullet points',
                },
                {
                    role: 'user',
                    content: `Summarize the following changes in the pull request:\n\n${allChanges}`,
                },
            ],
        });
        return ((_a = response.data.choices[0].message) === null || _a === void 0 ? void 0 : _a.content) || '';
    });
}
function analyzeFileChanges(openai, filename, patch, context) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield openai.createChatCompletion({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: "You are a helpful staff engineer who is reviewing code.\nProvide constructive feedback on the code changes. Each of the feedback should be numbered points. Each of the points should have a title called **Observation:** and **Actionable Feedback**.\nAn example is ```3. **Observation:** Potential Performance Issue\n**Actionable Feedback:** If `setPageTitle` involves any non-trivial computation, or if `useSidebarPageStore` has additional side effects, you may want to optimize the trigger. One way is by checking if the title is already 'Tasks' before calling `setPageTitle`.```\nFocus your feedback on the changed parts of the code (lines starting with '+' or '-'), but use the surrounding context to inform your analysis. At the end of your feedback, add a new line with just 'CRITICAL_FEEDBACK:' followed by 'true' if you have substantial or critical feedback, or 'false' if your feedback is minor or just positive.",
                },
                {
                    role: 'user',
                    content: `Review the following code changes for file ${filename}:\n\nChanged parts:\n${patch}\n\nBroader file context:\n${context}`,
                },
            ],
        });
        const content = ((_a = response.data.choices[0].message) === null || _a === void 0 ? void 0 : _a.content) || '';
        const [feedback, criticalIndicator] = content.split('CRITICAL_FEEDBACK:');
        const hasCriticalFeedback = criticalIndicator.trim().toLowerCase() === 'true';
        return { feedback: feedback.trim(), hasCriticalFeedback };
    });
}
function updatePRDescription(octokit, context, summary) {
    return __awaiter(this, void 0, void 0, function* () {
        const currentBody = context.payload.pull_request.body || '';
        const newBody = `${currentBody}\n\n## GPT-4 Summary\n\n${summary}`;
        yield octokit.rest.pulls.update(Object.assign(Object.assign({}, context.repo), { pull_number: context.payload.pull_request.number, body: newBody }));
    });
}
function addPRComment(octokit, context, analyses) {
    return __awaiter(this, void 0, void 0, function* () {
        const criticalAnalyses = analyses.filter((analysis) => analysis.hasCriticalFeedback);
        if (criticalAnalyses.length === 0) {
            console.log('No critical feedback to add to the PR.');
            return;
        }
        let feedbackContent = '## GPT-4 Feedback\n\n';
        for (const analysis of criticalAnalyses) {
            feedbackContent += `### ${analysis.filename}\n\n`;
            feedbackContent += '```diff\n' + analysis.patch + '\n```\n\n';
            feedbackContent += `${analysis.feedback}\n\n`;
        }
        yield octokit.rest.issues.createComment(Object.assign(Object.assign({}, context.repo), { issue_number: context.payload.pull_request.number, body: feedbackContent }));
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const githubToken = core.getInput('GITHUB_TOKEN', { required: true });
            const openaiApiKey = core.getInput('OPENAI_API_KEY', { required: true });
            const octokit = github.getOctokit(githubToken);
            const openai = new openai_1.OpenAIApi(new openai_1.Configuration({ apiKey: openaiApiKey }));
            const changedFiles = yield getChangedFiles(octokit, github.context);
            // Generate overall PR summary and analyze files in parallel
            const [prSummary, fileAnalyses] = yield Promise.all([
                generatePRSummary(openai, changedFiles),
                Promise.all(changedFiles.map((file) => __awaiter(this, void 0, void 0, function* () {
                    const fullContent = yield getFileContent(octokit, github.context, file.filename);
                    const contextContent = extractContext(fullContent, file.patch);
                    const { feedback, hasCriticalFeedback } = yield analyzeFileChanges(openai, file.filename, file.patch, contextContent);
                    return {
                        filename: file.filename,
                        feedback,
                        patch: file.patch,
                        hasCriticalFeedback,
                    };
                }))),
            ]);
            // Update PR description and add comment in parallel
            yield Promise.all([
                updatePRDescription(octokit, github.context, prSummary),
                addPRComment(octokit, github.context, fileAnalyses),
            ]);
        }
        catch (error) {
            if (error instanceof Error)
                core.setFailed(error.message);
        }
    });
}
run();
