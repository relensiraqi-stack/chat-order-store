import { ZodError } from "zod";
import { OrderError } from "./pricing";

/** A JSON error a public route can show: the rule that refused, or a generic one. */
export function errorResponse(error: unknown): Response {
  if (error instanceof OrderError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return Response.json(
      { error: error.issues[0]?.message ?? "Check the form." },
      { status: 400 },
    );
  if (error instanceof SyntaxError)
    return Response.json({ error: "Invalid request." }, { status: 400 });
  console.error(error);
  return Response.json({ error: "Something went wrong." }, { status: 500 });
}

export const notFound = () =>
  Response.json({ error: "Not found" }, { status: 404 });
