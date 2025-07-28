# two-stroke

A minimalist framework for Cloudflare Workers with built-in routing, authentication, and validation.

## Overview

Two-Stroke is a lightweight framework for building APIs with Cloudflare Workers. It provides a structured approach to defining routes, handling authentication, validating requests and responses with Zod, and managing errors with Sentry.

## Features

- **Type-safe routing** with path parameter extraction
- **Schema validation** for request and response bodies using Zod
- **Built-in authentication** methods (JWT, PBKDF)
- **Error handling** with Sentry integration
- **CORS support** out of the box
- **Queue handling** for background processing
- **Cron job support** for scheduled tasks
- **Email handling** capabilities
- **OpenAPI documentation** generation

## Installation

```bash
npm install two-stroke
```

## Quick Start

```typescript
import { twoStroke } from "two-stroke";
import { z } from "zod";

// Define your environment type
type MyEnv = {
  MY_SECRET: string;
  MY_KV: KVNamespace;
};

// Create a Two-Stroke app
const app = twoStroke<MyEnv>("My API", "1.0.0");

// Define routes
app.get(
  app.noAuth,
  "/hello",
  z.object({ message: z.string() }),
  async ({ env }) => {
    return {
      body: { message: "Hello, World!" },
    };
  },
);

// Define a route with path parameters
app.get(
  app.noAuth,
  "/users/{userId}",
  z.object({ user: z.object({ id: z.string(), name: z.string() }) }),
  async ({ params }) => {
    return {
      body: { user: { id: params.userId, name: "John Doe" } },
    };
  },
);

// Define a POST route with request validation
app.post(
  app.noAuth,
  "/messages",
  z.object({ content: z.string().min(1) }),
  z.object({ id: z.string() }),
  async ({ body }) => {
    return {
      body: { id: "msg_123" },
    };
  },
);

// Export the worker handlers
export default app;
```

## Authentication

Two-Stroke provides several authentication methods out of the box:

```typescript
// No authentication
app.get(app.noAuth, "/public", z.object({ message: z.string() }), async () => ({
  body: { message: "Public endpoint" },
}));

// PBKDF authentication
app.get(
  app.pbkdf("API_KEY"),
  "/protected",
  z.object({ message: z.string() }),
  async () => ({ body: { message: "Protected endpoint" } }),
);

// JWT authentication
app.get(
  app.jwt<{ userId: string }>("JWT_SECRET", "JWT_AUDIENCE"),
  "/user-data",
  z.object({ userId: z.string() }),
  async ({ claims }) => ({ body: { userId: claims.userId } }),
);
```

## Queue Handling

```typescript
// Define a queue handler
app.queueHandler(
  z.object({ id: z.string() }),
  async ({ batch, parsedBatch, env }) => {
    for (let i = 0; i < batch.messages.length; i++) {
      if (parsedBatch[i].success) {
        const data = parsedBatch[i].data;
        // Process queue message
        console.log(`Processing message: ${data.id}`);
      }
    }
  },
);

// Add to queue with retry logic
import { addToQueue } from "two-stroke";

await addToQueue(
  env.MY_QUEUE,
  { id: "task_123" },
  {
    retries: 3,
    backoffFactor: 2,
  },
);
```

## Scheduled Tasks

```typescript
// Define a scheduled task
app.schedule("*/15 * * * *", async ({ env }) => {
  // Run every 15 minutes
  console.log("Running scheduled task");
});
```
