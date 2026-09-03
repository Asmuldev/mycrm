import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function main() {
  const email = "admin@mycrm.test";
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Admin",
      passwordHash: await bcrypt.hash("password123", 10),
      role: "ADMIN",
    },
  });

  await prisma.companyProfile.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      name: "Studio Kreatif Nusantara",
      email: "halo@studio.test",
      phone: "+62 812 0000 0000",
      address: "Jl. Merdeka No. 10, Bandung",
      taxId: "01.234.567.8-901.000",
      bankName: "Bank Mandiri",
      bankAccount: "1300099887766",
      bankHolder: "PT Studio Kreatif Nusantara",
      invoicePrefix: "INV",
      defaultTaxRate: "11",
      defaultTerms:
        "Pembayaran maksimal 14 hari setelah invoice diterbitkan ke rekening yang tertera.",
      currency: "IDR",
    },
  });

  const clientCount = await prisma.client.count();
  if (clientCount > 0) {
    console.log("Data klien sudah ada, seed contoh dilewati.");
    return;
  }

  const acme = await prisma.client.create({
    data: {
      name: "PT Acme Digital",
      company: "Acme Group",
      email: "finance@acme.test",
      phone: "+62 811 1111 1111",
      city: "Jakarta",
      country: "Indonesia",
      status: "ACTIVE",
      tags: ["retainer", "prioritas"],
      ownerId: user.id,
      contacts: {
        create: [
          {
            name: "Rani Putri",
            email: "rani@acme.test",
            phone: "+62 811 2222 2222",
            position: "Marketing Lead",
            isPrimary: true,
          },
        ],
      },
    },
  });

  const nusa = await prisma.client.create({
    data: {
      name: "CV Nusa Boga",
      email: "owner@nusaboga.test",
      phone: "+62 813 3333 3333",
      city: "Bandung",
      country: "Indonesia",
      status: "LEAD",
      tags: ["inbound"],
      ownerId: user.id,
    },
  });

  await prisma.deal.createMany({
    data: [
      {
        title: "Redesign website korporat",
        clientId: acme.id,
        value: "85000000",
        stage: "NEGOTIATION",
        probability: 70,
        expectedCloseDate: daysFromNow(21),
        ownerId: user.id,
      },
      {
        title: "Paket branding UMKM",
        clientId: nusa.id,
        value: "18500000",
        stage: "PROPOSAL",
        probability: 40,
        expectedCloseDate: daysFromNow(30),
        ownerId: user.id,
      },
    ],
  });

  const year = new Date().getFullYear();
  const invoice = await prisma.invoice.create({
    data: {
      number: `INV/${year}/0001`,
      clientId: acme.id,
      status: "SENT",
      issueDate: daysFromNow(-10),
      dueDate: daysFromNow(4),
      currency: "IDR",
      taxRate: "11",
      terms: "Pembayaran maksimal 14 hari setelah invoice diterbitkan.",
      items: {
        create: [
          {
            description: "Desain UI halaman utama",
            quantity: "1",
            unitPrice: "25000000",
            amount: "25000000",
            position: 0,
          },
          {
            description: "Maintenance bulanan",
            quantity: "3",
            unitPrice: "5000000",
            amount: "15000000",
            position: 1,
          },
        ],
      },
    },
  });

  const subtotal = 40000000;
  const taxAmount = subtotal * 0.11;
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      total: (subtotal + taxAmount).toFixed(2),
    },
  });

  // The app reserves numbers from DocumentCounter. Without this the first
  // invoice created through the UI would try to reuse INV/<year>/0001 and hit
  // the unique constraint.
  await prisma.documentCounter.upsert({
    where: { kind_year: { kind: "invoice", year } },
    create: { kind: "invoice", year, lastNumber: 1 },
    update: { lastNumber: 1 },
  });

  await prisma.task.createMany({
    data: [
      {
        title: "Follow up proposal Acme",
        dueDate: daysFromNow(2),
        priority: "HIGH",
        clientId: acme.id,
        assigneeId: user.id,
      },
      {
        title: "Kirim penawaran ke Nusa Boga",
        dueDate: daysFromNow(5),
        priority: "MEDIUM",
        clientId: nusa.id,
        assigneeId: user.id,
      },
    ],
  });

  await prisma.activity.create({
    data: {
      clientId: acme.id,
      userId: user.id,
      type: "MEETING",
      subject: "Kickoff redesign",
      content: "Diskusi scope dan timeline. Klien minta mockup awal minggu depan.",
    },
  });

  console.log(`Seed selesai. Login: ${email} / password123`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
