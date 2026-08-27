// Registry for atTrack Connectors.
// Enables current tools (database, web search) and future extensions
// (email, github, filesystem, shell, custom integrations) to register
// their capabilities and receive automatic autonomy permission staging.

import type { ConnectorDefinition } from "./types";

const BUILTIN_CONNECTORS: ConnectorDefinition[] = [
  {
    id: "database",
    name: "Local SQLite Database",
    description: "Access, query, modify, and manage local career workspace tables and records.",
    category: "data",
    capabilities: [
      { action: "read", description: "Query and inspect database records", mutating: false },
      { action: "write", description: "Insert and update records in database tables", mutating: true },
      { action: "delete", description: "Delete records from database tables", mutating: true, destructive: true },
    ],
    iconName: "Database",
  },
  {
    id: "web_search",
    name: "Web Search Engine",
    description: "Search external web sources for company info, job postings, and industry insights.",
    category: "search",
    capabilities: [
      { action: "read", description: "Perform web search queries and retrieve citations", mutating: false },
    ],
    iconName: "Globe",
  },
  {
    id: "email",
    name: "Email Connector",
    description: "Draft, review, and dispatch application follow-ups, recruiter responses, and networking notes.",
    category: "communication",
    capabilities: [
      { action: "read", description: "Read email threads and contact history", mutating: false },
      { action: "write", description: "Draft email content and templates", mutating: true },
      { action: "execute", description: "Send emails via configured SMTP/email provider", mutating: true },
    ],
    iconName: "Mail",
  },
  {
    id: "github",
    name: "GitHub Developer Connector",
    description: "Inspect repositories, pull requests, issues, and portfolio artifacts.",
    category: "developer",
    capabilities: [
      { action: "read", description: "Read repository code, issues, and PR status", mutating: false },
      { action: "write", description: "Create or update issues and pull request comments", mutating: true },
      { action: "execute", description: "Trigger GitHub actions or webhook events", mutating: true },
    ],
    iconName: "Code2",
  },
  {
    id: "filesystem",
    name: "Local File System & Sandbox",
    description: "Read, write, and manage resume exports, document artifacts, and cached assets.",
    category: "system",
    capabilities: [
      { action: "read", description: "Read local files, PDFs, and exported documents", mutating: false },
      { action: "write", description: "Save or update exported resumes and files", mutating: true },
      { action: "delete", description: "Remove temporary files or cached artifacts", mutating: true, destructive: true },
    ],
    iconName: "FileText",
  },
  {
    id: "shell",
    name: "Terminal Execution Connector",
    description: "Run automated build scripts, verifications, and development tasks.",
    category: "system",
    capabilities: [
      { action: "execute", description: "Execute shell commands in the local workspace", mutating: true },
    ],
    iconName: "Terminal",
  },
  {
    id: "custom_api",
    name: "Custom API & Webhooks",
    description: "Integrate with custom user-configured endpoints, ATS systems, and external services.",
    category: "external",
    capabilities: [
      { action: "read", description: "Fetch data from external REST endpoints", mutating: false },
      { action: "execute", description: "Trigger external webhook actions", mutating: true },
    ],
    iconName: "Zap",
  },
];

const connectorRegistry = new Map<string, ConnectorDefinition>(
  BUILTIN_CONNECTORS.map((c) => [c.id, c])
);

/** Register a new connector definition dynamically. */
export function registerConnector(connector: ConnectorDefinition): void {
  connectorRegistry.set(connector.id, connector);
}

/** Retrieve a connector definition by its unique identifier. */
export function getConnector(id: string): ConnectorDefinition | undefined {
  return connectorRegistry.get(id);
}

/** List all available registered connectors. */
export function listConnectors(): ConnectorDefinition[] {
  return Array.from(connectorRegistry.values());
}
