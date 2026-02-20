// src/app/page.js
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default function Home() {
  const token = cookies().get("accessToken")?.value;
  redirect(token ? "/dashboard" : "/auth/login");
}
