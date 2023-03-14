/**
 * Thanks to @charles-allen
 * @see https://github.com/TypeStrong/ts-node/discussions/1450#discussioncomment-1806115
 */

import { pathToFileURL } from "url";
import { resolve as resolveTs, getFormat, transformSource, load } from "ts-node/esm";
import * as tsConfigPaths from 'tsconfig-paths';

export { getFormat, transformSource, load };

const { absoluteBaseUrl, paths } = tsConfigPaths.loadConfig();
const matchPath = tsConfigPaths.createMatchPath(absoluteBaseUrl, paths);

export function resolve(specifier, context, defaultResolver) {
    const lastIndexOfIndex = specifier.lastIndexOf('/index.js');
    if (lastIndexOfIndex !== -1) {
        // Handle index.js
        const trimmed = specifier.substring(0, lastIndexOfIndex);
        const match = matchPath(trimmed);
        if (match) return resolveTs(pathToFileURL(`${match}/index.js`).href, context, defaultResolver);
    } else if (specifier.endsWith('.js')) {
        // Handle *.js
        const trimmed = specifier.substring(0, specifier.length - 3);
        const match = matchPath(trimmed);
        if (match) return resolveTs(pathToFileURL(`${match}.js`).href, context, defaultResolver);
    }
    return resolveTs(specifier, context, defaultResolver);
}
