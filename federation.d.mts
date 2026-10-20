/**
 * Module federation entry filename for a remote, `<name>_entry-<hash>.js`, where the hash covers
 * the installed major version of each shared library. Read from `node_modules` in the working
 * directory, so call it from a Vite config.
 */
export declare function federationEntry(name: string, shared: string[]): string;
