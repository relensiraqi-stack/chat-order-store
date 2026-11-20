import type { EveryAppUser } from "@every-app/sdk/server";
import { db } from "@/db";
import { users } from "@/db/schema";

/** Records the member the first time they act, and keeps their email current. */
export async function rememberUser(user: Pick<EveryAppUser, "id" | "email">) {
  await db
    .insert(users)
    .values({ id: user.id, email: user.email })
    .onConflictDoUpdate({ target: users.id, set: { email: user.email } });
}
