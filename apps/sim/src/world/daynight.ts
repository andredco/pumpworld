import type { Season, Weather } from "@pumpworld/protocol";
import type { World } from "./World.js";

/** Days per season — keep the year short so a viewer sees winter. */
const DAYS_PER_SEASON = 7;
const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];

/** Base mean temperature per season (°C). */
const SEASON_BASE: Record<Season, number> = {
  spring: 14, summer: 24, autumn: 12, winter: 2,
};
/** Daily swing magnitude (°C). */
const SEASON_SWING: Record<Season, number> = {
  spring: 8, summer: 10, autumn: 7, winter: 6,
};

export interface TimeState {
  hourOfDay: number;
  dayOfWorld: number;
  newDay: boolean;
  season: Season;
}

export function advanceTime(world: World): TimeState {
  const ticksPerDay = world.meta.ticksPerDay;
  const ticksPerHour = ticksPerDay / 24;
  const hoursAdvanced = 1 / ticksPerHour;
  const newHour = world.meta.hourOfDay + hoursAdvanced;
  const wrapped = newHour >= 24;
  const day = wrapped ? world.meta.dayOfWorld + 1 : world.meta.dayOfWorld;
  const hour = wrapped ? newHour - 24 : newHour;
  const season = SEASONS[Math.floor(day / DAYS_PER_SEASON) % SEASONS.length]!;
  world.meta.hourOfDay = hour;
  world.meta.dayOfWorld = day;
  world.meta.season = season;
  return { hourOfDay: hour, dayOfWorld: day, newDay: wrapped, season };
}

/** Pure function — derives current outside air temp from hour & season. */
export function temperatureAt(hour: number, season: Season, dayJitter: number): number {
  const base = SEASON_BASE[season];
  const swing = SEASON_SWING[season];
  // Peaks at hour 14, lowest at hour 4. Sinusoid centred on hour 9.
  const phase = ((hour - 9) / 24) * Math.PI * 2;
  const t = base + Math.sin(phase) * swing + dayJitter;
  return Math.round(t * 10) / 10;
}

const WEATHER_OPTIONS: Weather[] = ["clear", "clear", "clear", "cloudy", "overcast", "fog", "rain"];

/** Re-roll weather at sunrise. */
export function maybePickWeather(world: World, rngVal: number): Weather {
  const i = Math.floor(rngVal * WEATHER_OPTIONS.length);
  return WEATHER_OPTIONS[i] ?? "clear";
}

export function dayJitterFor(day: number, seed: string): number {
  // tiny deterministic per-day temperature offset
  let h = 2166136261;
  for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  h ^= day; h = Math.imul(h, 16777619);
  const norm = ((h >>> 0) / 4294967296) * 2 - 1; // [-1, 1)
  return norm * 2.5; // ±2.5°C
}

/** Apply day/night updates each tick. Emits events on day-flip and weather change. */
export function tickDayNight(world: World): void {
  const before = world.meta.weather;
  const beforeSeason = world.meta.season;
  const state = advanceTime(world);
  const jitter = dayJitterFor(state.dayOfWorld, world.meta.seed);
  const newTemp = temperatureAt(state.hourOfDay, state.season, jitter);

  // Re-roll weather at the start of each new day.
  if (state.newDay) {
    // simple LCG from (seed, day)
    let h = 2166136261;
    for (const c of world.meta.seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    h ^= state.dayOfWorld * 9301;
    const r = ((h >>> 0) / 4294967296);
    world.meta.weather = maybePickWeather(world, r);
    world.emit({ kind: "new_day", day: state.dayOfWorld, season: state.season });
  }

  // Cold rain feels colder.
  let adjusted = newTemp;
  if (world.meta.weather === "rain") adjusted -= 2;
  if (world.meta.weather === "overcast") adjusted -= 1;
  world.meta.temperatureCelsius = Math.round(adjusted * 10) / 10;

  if (world.meta.weather !== before || beforeSeason !== world.meta.season) {
    world.emit({
      kind: "weather_changed",
      weather: world.meta.weather,
      temperatureCelsius: world.meta.temperatureCelsius,
    });
  }
}
