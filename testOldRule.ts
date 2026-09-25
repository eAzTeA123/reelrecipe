const text = 'Quick Berry Smoothie Ingredients: 1 cup frozen berries 1 banana 1 cup almond milk 1 tbsp chia seeds Instructions: Put all ingredients into a high speed blender. Blend on high for 60 seconds until smooth. Pour into a glass and enjoy!';
let normalized = text.replace(/(Zutaten|Ingredients|Zubereitung|Instructions|Directions|Schritte|Anleitung)[:\s]/gi, '\n$1:\n');
console.log(normalized);
