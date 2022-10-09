export function randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min) + min);
}

export function replaceAt(string: string, index: number, replacement: string): string {
    return `${string.substring(0, index)}${replacement}${string.substring(index + 1)}`;
}

export function generateGameID(): string {
    return Date.now().toString();
}
