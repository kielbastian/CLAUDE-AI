// Scalanie wpisów między urządzeniami (komputer/telefon).
// Zasada: wygrywa nowszy wpis (updatedAt); usunięcia są zapisywane jako
// "nagrobki" (deleted: true), aby skasowanie na jednym urządzeniu nie
// wróciło z drugiego. Ta sama logika działa w aplikacji mobilnej.

export const VAULT_FORMAT = "sejf-hasel/1";
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dni

export function purgeTombstones(entries, now = Date.now()) {
  return entries.filter(
    (e) => !e.deleted || now - (e.updatedAt || 0) < TOMBSTONE_TTL_MS
  );
}

export function mergeEntries(local, remote) {
  const byId = new Map();
  for (const entry of [...local, ...remote]) {
    const prev = byId.get(entry.id);
    if (!prev || (entry.updatedAt || 0) > (prev.updatedAt || 0)) {
      byId.set(entry.id, { ...entry });
    }
  }

  // Konta utworzone niezależnie na obu urządzeniach (ten sam host+login,
  // różne id) — zostaje nowszy wpis, starszy dostaje nagrobek.
  const byAccount = new Map();
  for (const entry of byId.values()) {
    if (entry.deleted) continue;
    const accountKey = `${entry.host}\n${entry.username || ""}`;
    const prev = byAccount.get(accountKey);
    if (!prev) {
      byAccount.set(accountKey, entry);
    } else if ((entry.updatedAt || 0) > (prev.updatedAt || 0)) {
      prev.deleted = true;
      byAccount.set(accountKey, entry);
    } else {
      entry.deleted = true;
    }
  }

  const merged = purgeTombstones([...byId.values()]).sort(
    (a, b) =>
      (a.host || "").localeCompare(b.host || "") ||
      (a.username || "").localeCompare(b.username || "")
  );

  const fingerprint = (arr) =>
    JSON.stringify(
      [...arr]
        .sort((a, b) => String(a.id).localeCompare(String(b.id)))
        .map((e) => [e.id, e.updatedAt, e.deleted ? 1 : 0, e.password, e.username, e.host])
    );
  const mergedFp = fingerprint(merged);
  return {
    merged,
    localChanged: mergedFp !== fingerprint(local),
    remoteChanged: mergedFp !== fingerprint(remote),
  };
}
