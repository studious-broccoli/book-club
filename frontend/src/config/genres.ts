export interface Genre {
  name: string;
  emoji: string;
}

export const GENRES: Genre[] = [
  { name: "Romantasy",       emoji: "🦄" },
  { name: "Romance",         emoji: "❤️" },
  { name: "Fantasy",         emoji: "🧙" },
  { name: "Dark Fantasy",    emoji: "🖤" },
  { name: "Science Fiction", emoji: "🚀" },
  { name: "Horror",          emoji: "🕷️" },
  { name: "Mystery Thriller", emoji: "🔍" },
  { name: "Historical Fiction", emoji: "📜" },
  { name: "Literary Fiction",   emoji: "✒️" },
  { name: "Contemporary",    emoji: "☕" },
  { name: "Young Adult",     emoji: "🌟" },
  { name: "New Adult",       emoji: "🎓" },
  { name: "Cozy Mystery",    emoji: "🫖" },
  { name: "Paranormal",      emoji: "👻" },
  { name: "Memoir",          emoji: "📖" },
  { name: "Non-Fiction",     emoji: "📚" },
  { name: "Graphic Novel",   emoji: "🎨" },
  { name: "Poetry",          emoji: "🌸" },
  { name: "Short Stories",   emoji: "📝" },
];

export function genreEmoji(genre: string | null | undefined): string {
  if (!genre) return "📖";
  const match = GENRES.find((g) => g.name.toLowerCase() === genre.toLowerCase());
  return match?.emoji ?? "📖";
}
