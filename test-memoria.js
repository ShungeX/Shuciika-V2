function medir(nombre, fn) {
  if (global.gc) global.gc(); // limpia antes de medir
  const antes = process.memoryUsage().rss;
  fn();
  if (global.gc) global.gc(); // limpia después de cargar el módulo
  const despues = process.memoryUsage().rss;
  console.log(`${nombre}: +${((despues - antes) / 1024 / 1024).toFixed(2)} MB`);
}

console.log(`RSS inicial (Node vacío): ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`);
medir('canvas', () => require('canvas'));
medir('discord.js', () => require('discord.js'));
medir('mongodb', () => require('mongodb'));
medir('@discordjs/opus', () => require('@discordjs/opus'));
medir('@discordjs/voice', () => require('@discordjs/voice'));
medir('moment', () => require('moment'));
medir('luxon', () => require('luxon'));
medir('cloudinary', () => require('cloudinary'));
medir('express', () => require('express'));