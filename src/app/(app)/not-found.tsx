import Link from "next/link";
import { Card, buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <Card className="mx-auto max-w-lg p-6 text-center">
      <h1 className="text-base font-semibold text-slate-900">
        Data tidak ditemukan
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Data yang Anda cari tidak ada, atau sudah dipindahkan ke sampah.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <Link href="/dashboard" className={buttonClass("primary")}>
          Ke dashboard
        </Link>
        <Link href="/trash" className={buttonClass("secondary")}>
          Lihat sampah
        </Link>
      </div>
    </Card>
  );
}
