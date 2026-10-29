// Maxima used before v3.0, inherited from the first prototype and not taken from the
// official document. Kept only to convert scores given on that scale.
export const OLD_MAX: Record<number, number> = {
  1: 3, 2: 3, 3: 2, 4: 2, 5: 2, 6: 3, 7: 2, 8: 3, 9: 3, 10: 4, 11: 3, 12: 3, 13: 3, 14: 4, 15: 3,
  16: 4, 17: 3, 18: 4, 19: 3, 20: 2, 21: 3, 22: 4, 23: 3, 24: 2, 25: 3, 26: 3, 27: 2, 28: 3, 29: 3,
  30: 3, 31: 2, 32: 3, 33: 2, 34: 2, 35: 2, 36: 4, 37: 3, 38: 2, 39: 2, 40: 2, 41: 3, 42: 3, 43: 2,
  44: 4,
};

export const rescale = (id: number, score: number, newMax: number) =>
  Math.max(0, Math.min(newMax, Math.round((score / OLD_MAX[id]) * newMax)));
