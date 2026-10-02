import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Lightweight ownership model: each browser gets a random, httpOnly owner id
 * cookie, and every Collection is bound to the owner that created it. All
 * collection-scoped routes verify that binding, so knowing (or guessing) a
 * collectionId is not enough to read someone else's images.
 *
 * This is deliberately NOT user authentication — there are no accounts, and
 * clearing cookies loses access to your collections. It closes the
 * "trust any collectionId" hole without adding a login flow.
 */
const COOKIE = "vizora_owner";

export async function getOwnerId(): Promise<string> {
  const store = await cookies();
  let id = store.get(COOKIE)?.value;
  if (!id) {
    id = crypto.randomUUID();
    store.set(COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return id;
}

type Access =
  | { ok: true; collection: { id: string; name: string }; ownerId: string }
  | { ok: false; response: NextResponse };

/** Loads a collection and confirms the caller owns it (claiming unowned legacy rows). */
export async function requireCollection(collectionId: string | null | undefined): Promise<Access> {
  if (!collectionId) {
    return { ok: false, response: NextResponse.json({ error: "collectionId is required." }, { status: 400 }) };
  }
  const ownerId = await getOwnerId();
  const collection = await db.collection.findUnique({ where: { id: collectionId } });

  // Same response for "missing" and "not yours" so ids can't be probed.
  if (!collection || (collection.ownerId && collection.ownerId !== ownerId)) {
    return { ok: false, response: NextResponse.json({ error: "Collection not found." }, { status: 404 }) };
  }
  if (!collection.ownerId) {
    await db.collection.update({ where: { id: collection.id }, data: { ownerId } });
  }
  return { ok: true, collection: { id: collection.id, name: collection.name }, ownerId };
}

/** Same check, starting from an image id. */
export async function requireImage(imageId: string) {
  const image = await db.image.findUnique({ where: { id: imageId } });
  if (!image) {
    return { ok: false as const, response: NextResponse.json({ error: "Image not found." }, { status: 404 }) };
  }
  const access = await requireCollection(image.collectionId);
  if (!access.ok) {
    return { ok: false as const, response: NextResponse.json({ error: "Image not found." }, { status: 404 }) };
  }
  return { ok: true as const, image };
}
