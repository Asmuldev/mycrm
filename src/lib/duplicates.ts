export type DuplicateCandidate = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  createdAt: Date;
};

export type DuplicateGroup = {
  key: string;
  reason: string;
  clients: DuplicateCandidate[];
};

/** Strips punctuation and casing so "PT. Maju Jaya" matches "pt maju jaya". */
export function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(pt|cv|ud|tbk|persero)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/** Keeps only digits so "+62 811-1111" matches "0811 1111". */
export function normalizePhone(value: string) {
  const digits = value.replace(/\D+/g, "");
  if (digits.startsWith("62")) return `0${digits.slice(2)}`;
  return digits;
}

/**
 * Groups clients that look like the same company. Email is the strongest
 * signal, then phone, then a normalized name.
 */
export function findDuplicateGroups(
  clients: DuplicateCandidate[],
): DuplicateGroup[] {
  const groups = new Map<string, DuplicateGroup>();

  function add(key: string, reason: string, client: DuplicateCandidate) {
    const group = groups.get(key) ?? { key, reason, clients: [] };
    if (!group.clients.some((entry) => entry.id === client.id)) {
      group.clients.push(client);
    }
    groups.set(key, group);
  }

  for (const client of clients) {
    if (client.email) {
      add(`email:${client.email.toLowerCase()}`, "Email sama", client);
    }
    if (client.phone) {
      const phone = normalizePhone(client.phone);
      if (phone.length >= 8) add(`phone:${phone}`, "Nomor telepon sama", client);
    }
    const name = normalizeName(client.name);
    if (name.length >= 4) add(`name:${name}`, "Nama mirip", client);
  }

  return [...groups.values()]
    .filter((group) => group.clients.length > 1)
    .sort((a, b) => b.clients.length - a.clients.length);
}
