import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { Role } from "@prisma/client";

export default async function HomePage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role === Role.CLIENT) {
    redirect("/portal");
  } else {
    redirect("/admin");
  }
}
