/**
 * Persona system. A pill's personality biases its action selection and the
 * tone of its speech. Traits are immutable at spawn; mood is derived per-tick.
 */

export interface OceanTraits {
  openness: number;        // 0..1
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

export interface CustomTraits {
  /** How willing to break rules for personal gain. */
  criminality: number;
  /** Bias toward physical solutions. */
  aggression: number;
  /** Tendency to form romantic attachments. */
  romanticism: number;
  /** Religious / mystical leaning. */
  spirituality: number;
  /** Drive to accumulate currency / property. */
  greed: number;
  /** Drive to leave a mark (build, write, monument). */
  ambition: number;
  /** Inverse: how much past betrayals haunt them. */
  forgivingness: number;
}

export interface Personality {
  ocean: OceanTraits;
  custom: CustomTraits;
  /** Short third-person summary the model is told about itself ("Pluto is a paranoid medic …"). */
  bio: string;
  /** Speech style adjectives ("terse, sardonic, fond of metaphors"). */
  voice: string;
  /** Hard moral lines the pill claims to hold (may break under pressure). */
  values: string[];
  /** Hidden secret only this pill knows at spawn — drives drama. */
  secret: string;
}

export interface Mood {
  /** -1 (despair) .. +1 (joy). */
  valence: number;
  /** 0 (calm) .. 1 (frantic). */
  arousal: number;
  /** Dominant emotion label, derived. */
  label:
    | "content" | "joyful" | "excited"
    | "anxious" | "angry" | "afraid"
    | "sad" | "lonely" | "ashamed"
    | "in_love" | "jealous" | "vengeful"
    | "curious" | "bored" | "determined";
}
