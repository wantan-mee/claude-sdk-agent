# Agent Output Directory

This directory contains all files and artifacts created by the Claude Agent during conversations.

## Purpose

- **Working Directory**: The agent operates within this directory for all file operations
- **Artifact Storage**: Any files created, generated, or modified by the agent are stored here
- **Research Results**: Downloaded data, API responses, and research artifacts
- **Code Generation**: Generated code, scripts, and configuration files

## Organization

Files are organized automatically by the agent. The directory structure depends on the tasks performed:
- Research documents
- Code files
- Data files
- Analysis results
- Generated artifacts

## Access

- Files can be viewed through the web UI
- Direct file access via the `/api/artifacts` endpoint
- All files are automatically tracked and streamed to the frontend in real-time

## Cleanup

To clear all artifacts:
- Use the "Clear Artifacts" button in the UI
- Or manually delete files from this directory

## Security Note

**IMPORTANT**: This directory is for agent-generated content only. Do not place sensitive files here as they may be accessible through the API.
