import { createClient } from "../actions";
import { ClientForm } from "../client-form";
import { Card, PageHeader } from "@/components/ui";

export default function NewClientPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Klien baru" description="Tambahkan klien atau lead" />
      <Card className="p-5">
        <ClientForm
          action={createClient}
          submitLabel="Simpan klien"
          cancelHref="/clients"
        />
      </Card>
    </div>
  );
}
