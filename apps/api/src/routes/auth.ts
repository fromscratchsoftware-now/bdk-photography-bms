import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../services/http-error.js";
import { loginWithPassword, signupSalesUser } from "../services/store.js";

export const authRouter = Router();

const loginSchema = z.object({
  mobileNumber: z.string().min(1),
  password: z.string().min(1)
});

const signupSchema = z.object({
  fullName: z.string().min(1),
  mobileNumber: z.string().min(1),
  password: z.string().min(6),
  shopId: z.string().min(1)
});

authRouter.post("/login", (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = loginWithPassword(input);
    if (!result) {
      next(new HttpError(401, "Invalid credentials"));
      return;
    }
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/signup", (req, res, next) => {
  try {
    const input = signupSchema.parse(req.body);
    const result = signupSalesUser(input);
    res.status(201).json({ data: result });
  } catch (error) {
    if (error instanceof Error && error.message === "Mobile number is already registered") {
      next(new HttpError(409, error.message));
      return;
    }
    next(error);
  }
});

authRouter.get("/me", requireAuth, (req, res, next) => {
  try {
    if (!req.authUser) {
      next(new HttpError(401, "Unauthenticated"));
      return;
    }
    const { passwordHash: _secret, ...safeUser } = req.authUser;
    res.json({ data: safeUser });
  } catch (error) {
    next(error);
  }
});

