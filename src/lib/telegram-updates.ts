import "server-only";
import { getDataContext, writeAuditLog } from "./data-access";
import { sendTelegramWelcomeMessage } from "./telegram";
import type {
  IncidentDoc,
  IncidentNotificationDoc,
  VolunteerDoc,
} from "./types";

export interface TelegramUpdate {
  update_id: number;
  message?: {
    text?: string;
    chat?: { id: number; username?: string; first_name?: string };
  };
  callback_query?: {
    id: string;
    data?: string;
    from?: { id: number; username?: string };
    message?: { chat?: { id: number } };
  };
}

declare global {
  var _herShieldTgOffset: number | undefined;
  var _herShieldTgLastSync: number | undefined;
  var _herShieldTgSyncPromise: Promise<void> | undefined;
}

async function callTelegramApi(
  method: string,
  payload: Record<string, unknown>
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

async function applyVolunteerIncidentDecision(params: {
  chatId: string;
  incidentId: string | null;
  decision: "accepted" | "declined";
  source: "telegram_button" | "telegram_text";
}): Promise<{ ok: boolean; incidentId?: string; reason?: string }> {
  const ctx = await getDataContext();
  let volunteer: VolunteerDoc | null = null;

  if (ctx.db) {
    volunteer = await ctx.db
      .collection<VolunteerDoc>("volunteers")
      .findOne({ telegramChatId: params.chatId });
  } else if (ctx.fallback) {
    volunteer =
      ctx.fallback.volunteers.find((v) => v.telegramChatId === params.chatId) ||
      null;
  }

  if (!volunteer) {
    return {
      ok: false,
      reason:
        "Your Telegram account is not linked to a HerShield volunteer profile yet.",
    };
  }
  if (volunteer.verificationStatus !== "Verified") {
    return {
      ok: false,
      reason:
        "Your volunteer application is not Verified yet, so alert responses are disabled.",
    };
  }

  let targetIncidentId = params.incidentId;
  const now = new Date().toISOString();

  if (!targetIncidentId) {
    if (ctx.db) {
      const latest = await ctx.db
        .collection<IncidentNotificationDoc>("incidentNotifications")
        .find({ volunteerId: volunteer._id })
        .sort({ notificationSentAt: -1 })
        .limit(1)
        .toArray();
      targetIncidentId = latest[0]?.incidentId || null;
    } else if (ctx.fallback) {
      const latest = [...ctx.fallback.incidentNotifications]
        .filter((n) => n.volunteerId === volunteer._id)
        .sort(
          (a, b) =>
            new Date(b.notificationSentAt).getTime() -
            new Date(a.notificationSentAt).getTime()
        )[0];
      targetIncidentId = latest?.incidentId || null;
    }
  }

  if (!targetIncidentId) {
    return { ok: false, reason: "No dispatched incident alert found." };
  }
  const resolvedIncidentId: string = targetIncidentId;

  if (ctx.db) {
    const res = await ctx.db
      .collection<IncidentNotificationDoc>("incidentNotifications")
      .updateOne(
        { incidentId: resolvedIncidentId, volunteerId: volunteer._id },
        {
          $set: {
            acknowledgementStatus: params.decision,
            acknowledgedAt: now,
          },
        }
      );

    if (res.matchedCount === 0) {
      return {
        ok: false,
        reason: `No active notification record found for incident ${resolvedIncidentId}.`,
      };
    }

    if (params.decision === "accepted") {
      await ctx.db
        .collection<IncidentDoc>("incidents")
        .updateOne(
          {
            incidentId: resolvedIncidentId,
            incidentStatus: { $in: ["open", "dispatched"] },
          },
          { $set: { incidentStatus: "acknowledged", updatedAt: now } }
        );
    }
  } else if (ctx.fallback) {
    const notif = ctx.fallback.incidentNotifications.find(
      (n) =>
        n.incidentId === resolvedIncidentId && n.volunteerId === volunteer!._id
    );
    if (!notif) {
      return {
        ok: false,
        reason: `No active notification record found for incident ${resolvedIncidentId}.`,
      };
    }
    notif.acknowledgementStatus = params.decision;
    notif.acknowledgedAt = now;

    if (params.decision === "accepted") {
      const inc = ctx.fallback.incidents.find(
        (i) => i.incidentId === resolvedIncidentId
      );
      if (
        inc &&
        (inc.incidentStatus === "open" || inc.incidentStatus === "dispatched")
      ) {
        inc.incidentStatus = "acknowledged";
        inc.updatedAt = now;
      }
    }
  }

  await writeAuditLog({
    actorId: volunteer.userId,
    actorRole: "volunteer",
    action:
      params.decision === "accepted"
        ? "VOLUNTEER_ACCEPTED_VIA_TELEGRAM"
        : "VOLUNTEER_DECLINED_VIA_TELEGRAM",
    resourceType: "incident",
    resourceId: resolvedIncidentId,
    relevantMetadata: {
      volunteerId: volunteer._id,
      source: params.source,
    },
  });

  return { ok: true, incidentId: resolvedIncidentId };
}

export async function processTelegramUpdate(
  update: TelegramUpdate
): Promise<{ linked?: boolean; decisionRecorded?: boolean }> {
  const ctx = await getDataContext();

  // 1. Handle inline button callbacks ("✅ I Can Help" / "✖️ Unable to Respond")
  if (update.callback_query?.data && update.callback_query.from?.id) {
    const chatId = String(
      update.callback_query.message?.chat?.id ?? update.callback_query.from.id
    );
    const [action, incidentId] = update.callback_query.data.split(":");

    if ((action === "accept" || action === "decline") && incidentId) {
      const decision = action === "accept" ? "accepted" : "declined";
      const result = await applyVolunteerIncidentDecision({
        chatId,
        incidentId,
        decision,
        source: "telegram_button",
      });

      await callTelegramApi("answerCallbackQuery", {
        callback_query_id: update.callback_query.id,
        text: result.ok
          ? decision === "accepted"
            ? "Response recorded: I Can Help"
            : "Response recorded: Unable to Respond"
          : result.reason || "Unable to record response",
      });

      await callTelegramApi("sendMessage", {
        chat_id: chatId,
        parse_mode: "HTML",
        text: result.ok
          ? decision === "accepted"
            ? `✅ <b>Response Confirmed</b> for <code>${incidentId}</code>: <b>I Can Help</b>.\n\n⚠️ Observe safely from a distance and dial <b>112</b> if immediate danger exists.`
            : `ℹ️ <b>Response Recorded</b> for <code>${incidentId}</code>: <b>Unable to Respond</b>.`
          : `⚠️ ${result.reason}`,
      });

      return { decisionRecorded: result.ok };
    }
  }

  // 2. Handle incoming messages (/start <CODE>, /id, or text replies)
  const msg = update.message;
  if (msg?.chat?.id && msg.text) {
    const chatId = String(msg.chat.id);
    const username = msg.chat.username || null;
    const text = msg.text.trim();

    const startMatch = text.match(/^\/start\s+([A-Za-z0-9_-]+)/i);
    if (startMatch) {
      const code = startMatch[1].toUpperCase();
      let volunteer: VolunteerDoc | null = null;
      if (ctx.db) {
        volunteer = await ctx.db
          .collection<VolunteerDoc>("volunteers")
          .findOne({ telegramLinkCode: code });
      } else if (ctx.fallback) {
        volunteer =
          ctx.fallback.volunteers.find(
            (v) => v.telegramLinkCode.toUpperCase() === code
          ) || null;
      }

      if (!volunteer) {
        await callTelegramApi("sendMessage", {
          chat_id: chatId,
          parse_mode: "HTML",
          text: `⚠️ Link code <code>${code}</code> was not recognized. Open your Volunteer Portal or paste Chat ID <code>${chatId}</code> directly.`,
        });
        return { linked: false };
      }

      const now = new Date().toISOString();
      if (ctx.db) {
        await ctx.db.collection<VolunteerDoc>("volunteers").updateOne(
          { _id: volunteer._id },
          {
            $set: {
              telegramChatId: chatId,
              telegramUsername: username,
              updatedAt: now,
            },
          }
        );
      } else if (ctx.fallback) {
        volunteer.telegramChatId = chatId;
        volunteer.telegramUsername = username;
        volunteer.updatedAt = now;
      }

      await writeAuditLog({
        actorId: volunteer.userId,
        actorRole: "volunteer",
        action: "TELEGRAM_LINKED",
        resourceType: "volunteer",
        resourceId: volunteer._id,
        relevantMetadata: { telegramUsername: username },
      });

      await sendTelegramWelcomeMessage({
        chatId,
        volunteerName: volunteer.displayName,
        registeredArea: volunteer.registeredArea,
        verificationStatus: volunteer.verificationStatus,
      });
      return { linked: true };
    }

    if (text === "/start" || text.toLowerCase().startsWith("/id")) {
      await callTelegramApi("sendMessage", {
        chat_id: chatId,
        parse_mode: "HTML",
        text: `🛡️ <b>HerShield Bot</b>\n\nYour Telegram Chat ID is:\n<code>${chatId}</code>\n\nPaste this ID in your <b>HerShield Volunteer Portal</b> or open the registration link.`,
      });
      return {};
    }

    const lower = text.toLowerCase();
    if (
      ["help", "yes", "accept", "i can help", "ok", "on my way"].includes(lower)
    ) {
      const res = await applyVolunteerIncidentDecision({
        chatId,
        incidentId: null,
        decision: "accepted",
        source: "telegram_text",
      });
      await callTelegramApi("sendMessage", {
        chat_id: chatId,
        parse_mode: "HTML",
        text: res.ok
          ? `✅ <b>Response Confirmed</b> for <code>${res.incidentId}</code>: <b>I Can Help</b>.`
          : `⚠️ ${res.reason}`,
      });
      return { decisionRecorded: res.ok };
    }

    if (["no", "decline", "unable", "cant", "can't"].includes(lower)) {
      const res = await applyVolunteerIncidentDecision({
        chatId,
        incidentId: null,
        decision: "declined",
        source: "telegram_text",
      });
      await callTelegramApi("sendMessage", {
        chat_id: chatId,
        parse_mode: "HTML",
        text: res.ok
          ? `ℹ️ <b>Response Recorded</b> for <code>${res.incidentId}</code>: <b>Unable to Respond</b>.`
          : `⚠️ ${res.reason}`,
      });
      return { decisionRecorded: res.ok };
    }
  }

  return {};
}

/**
 * Local development / non-webhook synchronization:
 * Pulls pending Telegram messages & inline button callback_queries via getUpdates
 * so volunteer responses work on http://localhost:3000 as well as Vercel webhooks.
 */
export async function syncTelegramUpdatesIfLocal(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return;

  const now = Date.now();
  if (
    globalThis._herShieldTgLastSync &&
    now - globalThis._herShieldTgLastSync < 1200
  ) {
    return;
  }

  if (globalThis._herShieldTgSyncPromise) {
    return globalThis._herShieldTgSyncPromise;
  }

  globalThis._herShieldTgSyncPromise = (async () => {
    try {
      globalThis._herShieldTgLastSync = Date.now();
      const offsetParam = globalThis._herShieldTgOffset
        ? `&offset=${globalThis._herShieldTgOffset}`
        : "";
      const url = `https://api.telegram.org/bot${token}/getUpdates?limit=50${offsetParam}&allowed_updates=${encodeURIComponent(
        JSON.stringify(["message", "callback_query"])
      )}`;

      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json()) as {
        ok: boolean;
        error_code?: number;
        result?: TelegramUpdate[];
      };

      if (!res.ok || !data.ok) {
        // 409 means a Vercel HTTPS webhook is active — nothing for local polling to do
        return;
      }

      for (const upd of data.result || []) {
        await processTelegramUpdate(upd);
        globalThis._herShieldTgOffset = upd.update_id + 1;
      }
      if ((data.result || []).length > 0 && globalThis._herShieldTgOffset) {
        // Confirm processed offset with Telegram so updates are not re-delivered on restart
        await fetch(
          `https://api.telegram.org/bot${token}/getUpdates?limit=1&offset=${globalThis._herShieldTgOffset}`,
          { cache: "no-store" }
        ).catch(() => {});
      }
    } catch {
      // Never break dashboard reads if Telegram API is temporarily unreachable
    } finally {
      globalThis._herShieldTgSyncPromise = undefined;
    }
  })();

  return globalThis._herShieldTgSyncPromise;
}
