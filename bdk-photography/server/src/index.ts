import cors from "cors";
import express from "express";
import helmet from "helmet";
import { ZodError } from "zod";
import { env } from "./env.js";
import { authRouter } from "./routes/auth.routes.js";
import { cashRouter } from "./routes/cash.routes.js";
import { shopsRouter } from "./routes/shops.routes.js";
import { usersRouter } from "./routes/users.routes.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(",").map((s) => s.trim()) : true
  })
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "bdk-photography-server", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/shops", shopsRouter);
app.use("/api/users", usersRouter);
app.use("/api/cash", cashRouter);

app.use((req, res) => {
  res.status(404).json({ error: "NotFound", message: `Route not found: ${req.method} ${req.path}` });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: "ValidationError",
      issues: error.issues
    });
    return;
  }

  if (error instanceof Error) {
    res.status(400).json({
      error: "BadRequest",
      message: error.message
    });
    return;
  }

  res.status(500).json({
    error: "InternalServerError",
    message: "An unexpected error occurred"
  });
});

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${env.PORT}`);
});
