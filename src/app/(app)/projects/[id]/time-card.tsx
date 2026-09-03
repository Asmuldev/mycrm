"use client";

import { useActionState } from "react";
import { Card, CardHeader, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { logTime, type TimeEntryState } from "../actions";

const initialState: TimeEntryState = {};

export function LogTimeCard({
  projectId,
  tasks,
  defaultRate,
  today,
}: {
  projectId: string;
  tasks: Array<{ id: string; title: string }>;
  defaultRate: number;
  today: string;
}) {
  const action = logTime.bind(null, projectId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <Card>
      <CardHeader
        title="Catat waktu"
        description='Durasi menerima "1:30", "1,5", atau "90m"'
      />
      <form action={formAction} className="space-y-3 px-5 py-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Tanggal">
            <Input name="spentOn" type="date" defaultValue={today} />
          </Field>
          <Field label="Durasi *">
            <Input name="duration" required placeholder="1:30" />
          </Field>
          <Field label="Tarif per jam" hint="Kosong = tarif proyek">
            <Input
              name="hourlyRate"
              type="number"
              step="0.01"
              min="0"
              placeholder={String(defaultRate)}
            />
          </Field>
        </div>

        <Field label="Keterangan *">
          <Input name="description" required placeholder="Revisi desain halaman utama" />
        </Field>

        {tasks.length > 0 ? (
          <Field label="Tugas terkait">
            <Select name="taskId" defaultValue="">
              <option value="">Tanpa tugas</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" name="billable" defaultChecked className="rounded" />
          Bisa ditagihkan ke klien
        </label>

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

        <SubmitButton variant="secondary">+ Catat waktu</SubmitButton>
      </form>
    </Card>
  );
}
