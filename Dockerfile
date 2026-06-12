# Forward MCP server — zero npm dependencies, stdio transport.
FROM node:22-alpine
WORKDIR /app
COPY mcp-server.js package.json ./
# Talks to the hosted Forward API; override with FORWARD_API_BASE if self-hosting.
ENV FORWARD_API_BASE=https://getforward.xyz
CMD ["node", "mcp-server.js"]
