"use client";

import { useEffect, useState } from "react";
import { loadSkills, subscribeSkills, type Skill } from "@/ai/skills";

/** The skills on this phone, kept up to date. Null until read (after mount). */
export function useSkills(): Skill[] | null {
  const [skills, setSkills] = useState<Skill[] | null>(null);
  useEffect(() => {
    const refresh = () => setSkills(loadSkills());
    refresh();
    return subscribeSkills(refresh);
  }, []);
  return skills;
}

export function titleCase(name: string): string {
  return name ? name[0].toUpperCase() + name.slice(1) : name;
}

/** "today", "yesterday", "on 3 November". */
export function relativeDay(iso: string, language = "en-US", now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  try {
    return `on ${d.toLocaleDateString(language, { day: "numeric", month: "long" })}`;
  } catch {
    return `on ${d.toDateString()}`;
  }
}
