export function formatTikTokCaption(caption: string): string {
  if (!caption) return caption;
  // Wenn es schon mehrere Zeilenumbrüche gibt, machen wir nichts
  if (caption.split("\n").length > 3) return caption;

  let formatted = caption;
  
  // Zeilenumbruch vor Headings
  const headings = ["Zutaten:", "Zubereitung:", "Gewürze:", "Außerdem:", "Ingredients:", "Instructions:", "Rezept:", "Recipe:"];
  for (const h of headings) {
    formatted = formatted.replace(new RegExp(`(\\s|^)(${h})`, "g"), "\n$2");
  }

  // Zeilenumbruch vor Bullets (•, -, *) wenn davor ein Leerzeichen ist
  formatted = formatted.replace(/(\s)(•|-|\*)\s/g, "\n$2 ");

  // Zeilenumbruch vor Nummerierungen ( 1. , 2. , 3. )
  formatted = formatted.replace(/(\s)(\d+\.)\s/g, "\n$2 ");

  // Zeilenumbruch vor dem ersten Hashtag (oder wenn viele folgen)
  formatted = formatted.replace(/(\s)(#\w+)/g, "\n$2");

  // Bereinigen von mehrfachen Umbrüchen
  return formatted.replace(/\n+/g, "\n").trim();
}
