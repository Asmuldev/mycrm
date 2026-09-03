"use client";

import { useActionState } from "react";
import { Card, CardHeader, EmptyState, Field, Input } from "@/components/ui";
import { ActionButton } from "@/components/action-button";
import { SubmitButton } from "@/components/submit-button";
import {
  createClientUser,
  deleteClientUser,
  toggleClientUser,
  type ClientUserState,
} from "../actions";

const initialState: ClientUserState = {};

export type ClientUserRow = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  lastLoginAt: string | null;
};

export function ClientUsersCard({
  clientId,
  users,
}: {
  clientId: string;
  users: ClientUserRow[];
}) {
  const action = createClientUser.bind(null, clientId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <Card>
      <CardHeader
        title="Akun portal"
        description="Login untuk klien melihat tagihan dan layanannya sendiri"
      />

      {users.length === 0 ? (
        <EmptyState title="Belum ada akun portal" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {users.map((user) => {
            const toggle = toggleClientUser.bind(null, clientId, user.id);
            const remove = deleteClientUser.bind(null, clientId, user.id);

            return (
              <li
                key={user.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {user.name}
                    {user.active ? null : (
                      <span className="ml-2 text-xs text-slate-400">
                        (nonaktif)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {user.email} ·{" "}
                    {user.lastLoginAt
                      ? `terakhir masuk ${new Date(user.lastLoginAt).toLocaleDateString("id-ID")}`
                      : "belum pernah masuk"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <ActionButton
                    action={toggle}
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    pendingLabel="..."
                  >
                    {user.active ? "Nonaktifkan" : "Aktifkan"}
                  </ActionButton>
                  <ActionButton
                    action={remove}
                    message={`Hapus akun portal ${user.email}?`}
                    variant="ghost"
                    className="px-2 py-1 text-xs text-rose-600"
                  >
                    Hapus
                  </ActionButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form
        action={formAction}
        className="space-y-3 border-t border-slate-100 px-5 py-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Nama">
            <Input name="name" required />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" required autoComplete="off" />
          </Field>
          <Field label="Password awal" hint="Minimal 8 karakter">
            <Input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </Field>
        </div>

        {state.error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {state.success} — sampaikan passwordnya lewat kanal yang aman.
          </p>
        ) : null}

        <SubmitButton variant="secondary">+ Buat akun portal</SubmitButton>
      </form>
    </Card>
  );
}
