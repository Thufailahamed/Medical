type Db = {
  prepare: (sql: string) => {
    bind: (...a: any[]) => any;
    run: () => Promise<any>;
    first: () => Promise<any>;
  };
};

export async function tryRecordWebhook(
  db: Db,
  provider: string,
  eventId: string,
  payload: unknown
): Promise<{ isNew: boolean; id: string }> {
  const id = crypto.randomUUID();
  try {
    await db
      .prepare(
        'INSERT INTO payment_webhook_events (id, provider, event_id, payload, status) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(id, provider, eventId, JSON.stringify(payload), 'processing')
      .run();
    return { isNew: true, id };
  } catch (e: any) {
    if (String(e?.message ?? '').includes('UNIQUE')) {
      const existing = await db
        .prepare(
          'SELECT id FROM payment_webhook_events WHERE provider = ? AND event_id = ?'
        )
        .bind(provider, eventId)
        .first();
      return { isNew: false, id: existing?.id ?? id };
    }
    throw e;
  }
}

export async function markWebhookProcessed(db: Db, id: string, status: string) {
  await db
    .prepare(
      "UPDATE payment_webhook_events SET processed_at = datetime('now'), status = ? WHERE id = ?"
    )
    .bind(status, id)
    .run();
}
