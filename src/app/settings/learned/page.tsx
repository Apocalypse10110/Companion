import { redirect } from "next/navigation";

/** "Things you can do" is now My Skills. Old links still work. */
export default function Page() {
  redirect("/skills");
}
