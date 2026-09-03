"use client";

import { useActionState } from "react";
import { Card, CardHeader, Field, Input, Select } from "@/components/ui";
import { ActionButton } from "@/components/action-button";
import { SubmitButton } from "@/components/submit-button";
import {
  createUser,
  deleteUser,
  setUserRole,
  type UserState,
} from "./actions";

const initialState: UserState = {};

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

export function UsersCard({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const [state, formAction] = useActionState(createUser, initialState);

  return (
    <Card className="mt-4">
      <CardHeader
        title="Pengguna"
        description="Admin dapat mengubah pengaturan dan menghapus data. Member hanya membuat dan mengubah."
      />

      <ul className="divide-y divide-slate-100">
        {users.map((user) => {
          const changeRole = setUserRole.bind(null, user.id);
          const removeUser = deleteUser.bind(null, user.id);
          const isSelf = user.id === currentUserId;

          return (
            <li
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {user.name}
                  {isSelf ? (
                    <span className="ml-2 text-xs text-slate-400">(Anda)</span>
                  ) : null}
                </p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <form action={changeRole}>
                  <Select
                    name="role"
                    defaultValue={user.role}
                    disabled={isSelf}
                    className="px-2 py-1 text-xs"
                    onChange={(event) => event.currentTarget.form?.requestSubmit()}
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="MEMBER">Member</option>
                  </Select>
                </form>
                {isSelf ? null : (
                  <ActionButton
                    action={removeUser}
                    message={`Hapus pengguna ${user.email}?`}
                    variant="ghost"
                    className="px-2 py-1 text-xs text-rose-600"
                  >
                    Hapus
                  </ActionButton>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <form
        action={formAction}
        className="space-y-3 border-t border-slate-100 px-5 py-4"
      >
        <p className="text-xs font-medium text-slate-600">Tambah pengguna</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="Nama">
            <Input name="name" required />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" required />
          </Field>
          <Field label="Password awal">
            <Input name="password" type="password" required minLength={8} />
          </Field>
          <Field label="Peran">
            <Select name="role" defaultValue="MEMBER">
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </Select>
          </Field>
        </div>
        {state.error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {state.success}
          </p>
        ) : null}
        <SubmitButton variant="secondary">+ Tambah pengguna</SubmitButton>
      </form>
    </Card>
  );
}
