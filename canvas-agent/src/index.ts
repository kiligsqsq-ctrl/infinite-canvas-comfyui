#!/usr/bin/env node
import { startHttpServer } from "./server/http.js";
import { startMcpServer } from "./server/mcp.js";

if (process.argv[2] === "mcp") await startMcpServer();
else {
    const server = startHttpServer();
    process.once("SIGTERM", () => server.close(() => process.exit(0)));
}
