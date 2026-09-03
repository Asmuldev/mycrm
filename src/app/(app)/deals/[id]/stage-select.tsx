"use client";

import { useTransition } from "react";
import { dealStageLabel, dealStages } from "@/lib/labels";
import { inputClass, cn } from "@/components/ui";

export function StageSelect({
  dealId,
  stage,
  action,
  className,
}: {
  dealId: string;
  stage: string;
  action: (id: string, formData: FormData) => Promise<void>;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      name="stage"
      defaultValue={stage}
      disabled={pending}
      aria-label="Ubah tahap deal"
      className={cn(inputClass, "px-2 py-1 text-xs", className)}
      onChange={(event) => {
        const formData = new FormData();
        formData.set("stage", event.target.value);
        startTransition(() => {
          void action(dealId, formData);
        });
      }}
    >
      {dealStages.map((value) => (
        <option key={value} value={value}>
          {dealStageLabel[value]}
        </option>
      ))}
    </select>
  );
}
