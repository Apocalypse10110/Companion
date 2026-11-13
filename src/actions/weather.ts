/**
 * "What's the weather?" Today or tomorrow, where you are or in a named town, read in plain words.
 * Uses Open-Meteo (free, no key, no account). Your location is asked for only when you ask about
 * the weather without naming a place, and is rounded to about 1 km before it leaves the phone.
 * Owner: Developer C.
 */
import type { ActionResult } from "@/contracts";

export interface WeatherAsk {
  /** A town or place, in the person's words. Empty = where they are. */
  place?: string;
  when?: "today" | "tomorrow";
}

export interface WeatherDeps {
  fetch?: typeof fetch;
  /** BCP 47 tag; "en-US" (and a few others) get Fahrenheit and mph. */
  language?: string;
  locate?: () => Promise<{ latitude: number; longitude: number }>;
}

const CODES: Array<[number[], string]> = [
  [[0], "clear skies"],
  [[1], "mostly clear skies"],
  [[2], "partly cloudy"],
  [[3], "cloudy skies"],
  [[45, 48], "fog"],
  [[51, 53, 55], "drizzle"],
  [[56, 57, 66, 67], "freezing rain"],
  [[61], "light rain"],
  [[63], "rain"],
  [[65], "heavy rain"],
  [[71, 73, 75, 77], "snow"],
  [[80, 81, 82], "rain showers"],
  [[85, 86], "snow showers"],
  [[95], "thunderstorms"],
  [[96, 99], "thunderstorms with hail"],
];

export function describeWeather(code: number): string {
  return CODES.find(([codes]) => codes.includes(code))?.[1] ?? "mixed weather";
}

const isWet = (code: number) => (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;

function usesFahrenheit(language: string): boolean {
  return /^en-(US|LR|MM)$/i.test(language) || /-(US|BS|BZ|KY|PW)$/i.test(language);
}

function browserLocate(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      reject,
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 30 * 60_000 },
    );
  });
}

const round2 = (n: number) => Math.round(n * 100) / 100;
/** "an 80% chance", "a 20% chance": numbers said starting with a vowel sound take "an". */
const aOrAn = (n: number) => (n === 8 || n === 11 || n === 18 || (n >= 80 && n <= 89) ? "an" : "a");
const title = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

export async function weatherReport(ask: WeatherAsk, deps: WeatherDeps = {}): Promise<ActionResult> {
  const doFetch = deps.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const language = deps.language ?? ((typeof navigator !== "undefined" && navigator.language) || "en-US");
  const when = ask.when === "tomorrow" ? "tomorrow" : "today";
  let latitude: number;
  let longitude: number;
  let where: string;

  try {
    if (ask.place?.trim()) {
      const g = await doFetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=${encodeURIComponent(ask.place.trim())}`);
      const d = (await g.json()) as { results?: Array<{ name: string; latitude: number; longitude: number }> };
      const hit = d.results?.[0];
      if (!hit) return { ok: false, message: `I couldn't find ${title(ask.place.trim())}. Try saying the town's name another way.` };
      ({ latitude, longitude } = hit);
      where = `in ${hit.name}`;
    } else {
      try {
        ({ latitude, longitude } = await (deps.locate ?? browserLocate)());
      } catch {
        return {
          ok: false,
          message:
            'I need to know where you are to check the weather, and I couldn\'t find your location. You can turn on Location for this site in your phone\'s settings, or just ask me "what\'s the weather in" and the name of your town.',
        };
      }
      where = "where you are";
    }

    const f = usesFahrenheit(language);
    const q = new URLSearchParams({
      latitude: String(round2(latitude)),
      longitude: String(round2(longitude)),
      current: "temperature_2m,weather_code,wind_speed_10m",
      daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code",
      timezone: "auto",
      forecast_days: "2",
      temperature_unit: f ? "fahrenheit" : "celsius",
      wind_speed_unit: f ? "mph" : "kmh",
    });
    const res = await doFetch(`https://api.open-meteo.com/v1/forecast?${q.toString().replace(/%2C/g, ",")}`);
    if (!res.ok) throw new Error(String(res.status));
    const w = (await res.json()) as {
      current: { temperature_2m: number; weather_code: number };
      daily: { temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: number[]; weather_code: number[] };
    };
    const i = when === "tomorrow" ? 1 : 0;
    const hi = Math.round(w.daily.temperature_2m_max[i]);
    const lo = Math.round(w.daily.temperature_2m_min[i]);
    const rain = Math.round(w.daily.precipitation_probability_max[i] ?? 0);
    const dayCode = w.daily.weather_code[i];
    const umbrella = rain >= 60 || isWet(when === "today" ? w.current.weather_code : dayCode) ? " You may want an umbrella." : "";

    if (when === "today") {
      const now = Math.round(w.current.temperature_2m);
      return {
        ok: true,
        message: `Right now ${where} it's ${now} degrees with ${describeWeather(w.current.weather_code)}. Today's high is ${hi} and the low is ${lo}, with ${aOrAn(rain)} ${rain}% chance of rain.${umbrella}`,
      };
    }
    return {
      ok: true,
      message: `Tomorrow ${where}: ${describeWeather(dayCode)}, with a high of ${hi} and a low of ${lo}, and ${aOrAn(rain)} ${rain}% chance of rain.${umbrella}`,
    };
  } catch {
    return { ok: false, message: "I couldn't get the weather just now. Please check your internet connection and try again." };
  }
}
