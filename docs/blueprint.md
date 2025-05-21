# **App Name**: ProfitScout

## Core Features:

- AI-Powered Query Orchestration: Orchestrates Gemini calls based on user queries, leveraging the tool registry for data retrieval.
- Financial Reasoning and Summarization: Generates financial insights grounded in proprietary data from Google Cloud Storage, including ratio analysis, YoY/QoQ comparisons, and plain-language summaries using generative AI. It decides whether or not to incorporate metrics or raw documents with reasoning using available tool hooks.
- Interactive Chat Interface: Chat interface with streaming Gemini replies for interactive financial analysis.
- Secure Authentication: Secure user authentication and role management using JWT/Firebase Auth.
- Financial Dashboard: Dashboard presenting key financial trends in clear charts and tables. Toggleable dark/light theme.

## Style Guidelines:

- Primary Color – Trust Blue #2A6FB5 Deep, professional blue that conveys reliability and intelligence—ideal for top nav, primary buttons, and links.
- Accent Color – Growth Green #2F855A Conservative green symbolizing profit and upward trends. Use for positive deltas, call-to-action hovers, and success states.
- Highlight Color – Prosperity Gold #B58B00 Subtle metallic tone for KPI badges, premium labels, or chart peaks—adds a sense of value without overpowering the UI.
- Background Color – Mist #F2F6FA Very light blue-gray that reduces eye strain on wide surfaces while keeping the interface bright.
- Surface Color – White #FFFFFF Card and modal backgrounds to create clear separation against Mist.
- Body text: Gray 700 #3C4551
- Secondary text / borders: Gray 400 #8A96A3
- Use a clean, modern sans-serif (e.g., Inter, Roboto, or Open Sans).
- Maintain a clear hierarchy with distinct font weights: 700 (headings), 500 (sub-headings), 400 (body).
- Target a minimum 1.5 rem / 24 px line height for dense tables and reports.
- Adopt minimalist, line-style icons (e.g., Lucide or Tabler) that match stroke weight with body text.
- Color icons neutrally by default (Gray 400); apply Growth Green only when indicating positive movement.
- Grid-first: 12-column responsive grid with ≥ 24 px gutters.
- Cards-on-Mist: Place data cards on Mist background; each card uses Surface White for clarity.
- KPIs → bold numeric + Prosperity Gold accent
- Secondary stats → Gray 700
- Explanatory text → Gray 400
- Spacing: 8 px base unit; major sections use 3× (24 px) padding.
- Ensure all text or iconography on Mist or White achieves WCAG AA contrast (≥ 4.5:1).
- Primary Blue on Mist ≈ 4.7:1, Accent Green on Mist ≈ 5.9:1—both compliant.
- Provide keyboard focus rings using Accent Green @ 2 px stroke.