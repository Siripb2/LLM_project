
# LLM-Powered DevOps Assistant for CI/CD Automation

This project integrates Large Language Models (LLMs) with Jenkins pipelines (or any CI/CD platform) to automatically analyze build logs and generate actionable failure summaries and troubleshooting suggestions.

## Features
- **Automated Log Analysis**: Takes a massive Jenkins build log and pinpoints the exact failure reason using Google's Gemini Models.
- **Actionable Insights**: Generates a quick summary of what broke, where it broke, and step-by-step suggestions on how to fix it.
- **Easy Integration**: Comes as a simple Python CLI that can be easily plugged into a Jenkins `post { failure { ... } }` block.

## Setup

1. **Install Python** (>= 3.9)
2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
3. **Get an API Key**: Grab a Gemini API key from Google AI Studio.
4. **Environment Variables**: Create a `.env` file in the project root:
   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   ```

## Usage (Locally)
You can test the tool locally against an existing log file:

```bash
python cli.py sample_failed_build.log
```

## Usage (Jenkins)

See the provided `Jenkinsfile.example` for a complete pipeline integration script. In short, add this to your failed build stage:

```groovy
post {
    failure {
        sh 'python path/to/cli.py build.log'
    }
}
```

## Cloud Deployment

This repository includes a GitHub Action (`.github/workflows/docker-publish.yml`) that automatically builds and publishes the DevOps Assistant to the GitHub Container Registry (GHCR) when code is merged to the `main` branch.

To deploy the dashboard on any server (AWS, DigitalOcean, internal network), you simply need Docker installed:

1. Copy your `.env` file to the server containing your API key:
   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   ```
2. Pull and run the publicly built image:
   ```bash
   docker run -d -p 80:5000 --env-file .env ghcr.io/<your-github-username>/devops-llm-assistant:latest
   ```

Replace `<your-github-username>` with the GitHub organization or username hosting this repository.

# LLM_project

