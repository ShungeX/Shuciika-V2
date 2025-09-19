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

module.exports = console;
