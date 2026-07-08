# Voiceover Script

Target length: about 90 seconds.

## 0-8s - Title

This is an AI-powered personalized news desk. It turns trusted feeds and article URLs into one controlled daily briefing.

## 8-22s - Product Concept

The product goal is simple: reduce tab sprawl. A user connects sources, defines interests and language, and receives one source-backed digest instead of checking dozens of pages manually.

## 22-40s - Dashboard

Inside the dashboard, users manage profiles, sources, processing flows, delivery channels, and digest feedback. The system keeps daily processing deterministic and visible.

## 40-55s - Digest And Delivery

The digest can stay in the app, or go to email, Telegram, Slack, or a signed webhook. Feedback is stored for review, while article content and generated digests are deleted after seven days.

## 55-72s - Agentic Build Loop

The important part is how I built it agentically. Human intent became requirements. OpenSpec split the work into slices. A maker implemented each change, but separate verifier and reviewer agents had to check the final diff.

## 72-84s - Evidence

The repo keeps that evidence: durable agent rules, process notes, verification reports, review reports, tests, linting, type checks, Playwright smoke tests, and deployment guardrails.

## 84-90s - Close

So the result is not just generated code. It is a small product built through traceable decisions, repeatable checks, and an agentic engineering loop.

AI disclosure: this voiceover may be generated with AI text-to-speech.
