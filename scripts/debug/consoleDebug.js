const originalWarn = console.warn;
const originalError = console.error;

console.warn = function(...args) {
    process.stderr.write('\x1b[33m');
    originalWarn.apply(console, args);
    process.stderr.write('\x1b[0m');
};

console.error = function(...args) {
    process.stderr.write('\x1b[31m');
    originalError.apply(console, args);
    process.stderr.write('\x1b[0m');
};

console.log('=== DIAGNÓSTICO DE COLORES ===');
console.log('stdout.isTTY:', process.stdout.isTTY);
console.log('stderr.isTTY:', process.stderr.isTTY);
console.log('stdout.hasColors():', process.stdout.hasColors());
console.log('stderr.hasColors():', process.stderr.hasColors());
console.log('stdout.getColorDepth():', process.stdout.getColorDepth());
console.log('stderr.getColorDepth():', process.stderr.getColorDepth());

console.log('\n=== PRUEBA DE COLORES ===');
console.log('\x1b[31mRojo directo\x1b[0m');
console.log('\x1b[33mAmarillo directo\x1b[0m');

console.log("console.log normal");
console.warn("console.warn debería ser amarillo");
console.error("console.error debería ser rojo");

// Intentar escribir directamente a stderr con color
process.stderr.write('\x1b[31mError directo a stderr\x1b[0m\n');