"use node";

import type { WebhookEvent } from "@clerk/nextjs/server"
import { v } from "convex/values";
import { Webhook } from "svix";

import { internalAction } from "./_generated/server";

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET ?? ``;

export const fulfill = internalAction({
  args: { headers: v.any(), payload: v.string() },
  handler: async (_, args) => {
    const wh = new Webhook(webhookSecret);
    // Safe cast: http.ts passes the three svix headers; verify rejects a
    // request that lacks any of them.
    const headers = args.headers as Record<string, string>;
    // Safe cast: svix only returns a payload whose Clerk signature it verified.
    const payload = wh.verify(args.payload, headers) as WebhookEvent;
    return payload;
  },
});
