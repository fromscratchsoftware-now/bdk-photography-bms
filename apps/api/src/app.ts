import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";
import { cashRouter } from "./routes/cash.js";
import { healthRouter } from "./routes/health.js";
import { invoicesRouter } from "./routes/invoices.js";
import { productsRouter } from "./routes/products.js";
import { salesRouter } from "./routes/sales.js";
import { HttpError } from "./services/http-error.js";
import { listSeedData } from "./services/store.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    name: "BDK Photography API",
    version: "0.1.0"
  });
});

app.get("/api/meta/seed", (_req, res) => {
  res.json({ data: listSeedData() });
});

app.use("/api/health", healthRouter);
app.use("/api/products", productsRouter);
app.use("/api/sales", salesRouter);
app.use("/api/cash", cashRouter);
app.use("/api/invoices", invoicesRouter);

app.use((req, _res, next) => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.path}`));
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: "ValidationError",
      issues: error.issues
    });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      error: "HttpError",
      message: error.message
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

