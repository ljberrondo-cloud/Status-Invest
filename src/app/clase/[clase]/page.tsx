import { redirect } from "next/navigation";

/** Ruta anterior: las clases ahora son grupos dentro de /activos. */
export default async function ClaseRedirect({ params }: { params: Promise<{ clase: string }> }) {
  const { clase } = await params;
  redirect(`/activos#${encodeURIComponent(clase)}`);
}
