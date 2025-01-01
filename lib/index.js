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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const pr = __importStar(require("./github"));
const ai = __importStar(require("./ai"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const githubToken = core.getInput("GITHUB_TOKEN", { required: true });
            const openaiApiKey = core.getInput("OPENAI_API_KEY", { required: true });
            const octokit = github.getOctokit(githubToken);
            const prDetails = yield pr.getPRDetails(octokit, github.context);
            const changedFiles = yield pr.getChangedFiles(octokit, github.context);
            // Generate overall PR summary and analyze files in parallel
            const fileAnalyses = yield Promise.all(changedFiles.map((file) => __awaiter(this, void 0, void 0, function* () {
                const fullContent = yield pr.getFileContent(octokit, github.context, file.filename);
                const contextContent = pr.extractContext(fullContent, file.patch);
                const { feedback } = yield ai.analyzeFileChanges(openaiApiKey, file.filename, file.patch, contextContent, prDetails);
                return {
                    feedback,
                    filename: file.filename,
                    patch: file.patch,
                    author: prDetails.author,
                    sha: file.sha,
                };
            })));
            // Update PR description and add comment in parallel
            yield pr.addPRComment(octokit, github.context, fileAnalyses);
        }
        catch (error) {
            if (error instanceof Error)
                core.setFailed(error.message);
        }
    });
}
run();
