# Project: AI-Powered Personalized News Aggregator

## 1. Overview
A web-based platform that allows users to aggregate news from custom sources, process the content using AI based on personalized rules (summarization, translation, relevance filtering), and automatically deliver the curated content via preferred channels. The core philosophy is to gather multiple sources into a single, highly digestible summary.

## 2. Core Features

### 2.1 User Management
- **Authentication:** Users can sign up and log in using OAuth providers (Google, GitHub). *Note: Email/Password login should be implemented but disabled in production to prevent system abuse (enabled only for development).*
- **Profile:** Users can define their core interests, language preferences, and manage their connected delivery channels.
- **Quotas & Limitations:** A user can create a maximum of **5 distinct processing flows**.

### 2.2 Data Sources (Ingestion) & Pre-Processing
- Users can add and manage multiple news sources.
- **Supported Source Types:**
  - RSS / Atom Feeds
  - Web URLs (News websites/blogs)
- **Shared Resource Caching:** The system will fetch source data once and cache it globally. Instead of fetching a site multiple times for different users, the cached information will be reused across all user flows that rely on that source.
- **Content Extraction:** For web URLs, the system will strip out menus, ads, and footers (e.g., using Readability) to extract only the main article text before sending it to the AI.
- **Dead Feed Management:** If a source fails to fetch 5 times in a row, the system will automatically pause it and notify the user.

### 2.3 AI Processing Rules Engine
- Users can set up automated rules (flows) to process incoming news.
- **Run Frequency:** Users can configure how often the flow executes (currently restricted to **daily**).
- **Core Processing Logic:**
  - **Batching & Aggregation:** The system will gather all new articles from the user's sources, perform **smart deduplication** to group similar stories, and pass them to the AI in batches to cut costs and produce a single cohesive digest.
  - **Model Selection:** Users can choose the AI model for their tasks (currently restricted to **gpt-5.4-mini**).
  - **Token Management (Truncation):** The system will employ a truncation strategy (e.g., limiting articles to a specific word count) to ensure batched payloads stay within the AI's context window.
- **Summarization & Prompts:** 
  - Users can select from **predefined prompt templates** or write their own **custom prompts** to dictate exactly how the news should be summarized and formatted.
  - *Translation* and *Relevance Filtering* are handled based on the user's defined interests and prompt instructions.
- **User Feedback Loop:** Users can provide a simple "Thumbs Up / Thumbs Down" on delivered content to refine their rules and filtering over time.

### 2.4 Delivery & Integrations
- Users can configure how and where they receive their processed news.
- **Supported Channels:**
  - **In-App:** Save to a personal dashboard for later reading.
  - **Email:** Send periodic digests. *(Security Note: Users can only send emails to their own verified email address).*
  - **Telegram:** Send updates via a connected Telegram bot.
  - **Slack:** Send updates to a specified Slack channel/workspace.

## 3. Data Storage & Retention
- **Processed Data Lifecycle:** Generated and processed news data will be stored for exactly **1 week (7 days)** before being automatically deleted.