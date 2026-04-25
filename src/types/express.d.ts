import type { JwtUserPayload } from "../modules/auth/token.service.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtUserPayload;
    }
  }
}

export {};
