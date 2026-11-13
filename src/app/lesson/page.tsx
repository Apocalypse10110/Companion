import type { Metadata } from "next";
import { Suspense } from "react";
import { LessonCardScreen } from "@/ui/lessons/LessonCardScreen";

export const metadata: Metadata = { title: "Lesson card" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LessonCardScreen />
    </Suspense>
  );
}
