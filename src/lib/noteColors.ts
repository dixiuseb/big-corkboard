export const NOTE_COLOR_KEYS = [
  "amber",
  "sky",
  "teal",
  "rose",
  "violet",
  "lime",
] as const;

export type NoteColorKey = (typeof NOTE_COLOR_KEYS)[number];

/** Short labels for the toolbar; a future legend can expand these per board. */
export const NOTE_COLOR_META: Record<
  NoteColorKey,
  { label: string; swatch: string; cardClass: string; selectedRing: string }
> = {
  amber: {
    label: "Amber",
    swatch: "bg-[#FAEEDA]",
    cardClass: "bg-[#FAEEDA] border-[#DFC8A8] text-stone-800 shadow-black/5",
    selectedRing: "ring-[#C8A060]",
  },
  sky: {
    label: "Sky",
    swatch: "bg-[#E6F1FB]",
    cardClass: "bg-[#E6F1FB] border-[#B8D4EE] text-stone-800 shadow-black/5",
    selectedRing: "ring-[#5EA8E0]",
  },
  teal: {
    label: "Teal",
    swatch: "bg-[#E1F5EE]",
    cardClass: "bg-[#E1F5EE] border-[#A8DECA] text-stone-800 shadow-black/5",
    selectedRing: "ring-[#40BF90]",
  },
  rose: {
    label: "Rose",
    swatch: "bg-[#FBEAF0]",
    cardClass: "bg-[#FBEAF0] border-[#ECC0D4] text-stone-800 shadow-black/5",
    selectedRing: "ring-[#E0709A]",
  },
  violet: {
    label: "Violet",
    swatch: "bg-[#F0EAFB]",
    cardClass: "bg-[#F0EAFB] border-[#CCAAF0] text-stone-800 shadow-black/5",
    selectedRing: "ring-[#9060D8]",
  },
  lime: {
    label: "Lime",
    swatch: "bg-[#EDFAE1]",
    cardClass: "bg-[#EDFAE1] border-[#AADCA8] text-stone-800 shadow-black/5",
    selectedRing: "ring-[#70C050]",
  },
};

export const DEFAULT_NOTE_COLOR: NoteColorKey = "amber";
