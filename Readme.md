# GPT-4 Code Review Action

This GitHub Action automatically reviews code changes in pull requests using OpenAI's GPT-4 model. It provides a summary of the changes and constructive feedback, updating the pull request description and adding a comment with the feedback.

## Features

- Analyzes code changes in pull requests
- Generates a summary of changes using GPT-4
- Provides constructive feedback on the code
- Updates the pull request description with the summary
- Adds a comment to the pull request with the feedback

## Usage

To use this action in your workflow, add the following step:

```yaml
- name: GPT-4 Code Review
  uses: your-username/gpt4-code-review-action@v1
  with:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

Make sure to set up the `OPENAI_API_KEY` secret in your repository settings with your OpenAI API key.

## Inputs

- `GITHUB_TOKEN`: Automatically provided by GitHub (required)
- `OPENAI_API_KEY`: Your OpenAI API key for accessing GPT-4 (required)

## Example Workflow

```yaml
name: Code Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: GPT-4 Code Review
        uses: your-username/gpt4-code-review-action@v1
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## Development

This action is written in TypeScript. To set up the development environment:

1. Clone this repository
2. Run `npm install` to install dependencies
3. Make changes to the code in the `src` directory
4. Run `npm run build` to compile the TypeScript code
5. Commit both the source code and the built code in the `dist` directory

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.