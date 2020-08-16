import os from 'os';
import Path from 'path';

import { StandardPipeline } from '../pipeline/standardPipeline';
import * as FsUtils from '../fs/fsUtils';
import { Page, Pipeline, HtmlFormatter, PipelineInterface, MimeType } from '..';
import { StandardHtmlFormatterMode, StandardHtmlFormatter } from '../pipeline/module/standardHtmlFormatter';

/**
 * Called whenever a page is compiled.
 * @param page Compiled Page object
 */
export type PageCompiledCallback = (page: Page) => void;

/**
 * Options recognized by Mooltipage
 * See {@link DefaultMpOptions} for default values
 */
export interface MpOptions {
    /**
     * Optional path to look for input files.
     * Defaults to current working directory.
     */
    readonly inPath?: string;

    /**
     * Optional path to place output files
     * Defaults to current working directory.
     */
    readonly outPath?: string;

    /**
     * Optional name of the HTML formatter to use.
     * Defaults to standard formatter in "pretty" mode.
     * Recommended to switch to "minimized" mode for production builds.
     */
    readonly formatter?: string;

    /**
     * Optional callback for page compilation.
     */
    readonly onPageCompiled?: PageCompiledCallback;
}

/**
 * Default Mooltipage options
 */
export class DefaultMpOptions implements MpOptions {
    readonly formatter: StandardHtmlFormatterMode.PRETTY = StandardHtmlFormatterMode.PRETTY;
}

/**
 * Mooltipage JS API entry point.
 */
export class Mooltipage {
    /**
     * Configuration objects for this Mooltipage instance
     */
    readonly options: MpOptions;

    /**
     * Pipeline instance that will be used for the lifetime of this instance
     */
    readonly pipeline: Pipeline;

    /**
     * Constructs a new Mooltipage instance.
     * An options object can be passed to configure the instance.
     * If no options are provided, then {@ling DefaultMpOptions} will be used.
     * @param options Configuration options
     */
    constructor(options?: MpOptions) {
        if (options) {
            this.options = options;
        } else {
            this.options = new DefaultMpOptions();
        }

        this.pipeline = createPipeline(this.options);
    }

    /**
     * Compiles a list of pages.
     * @param pagePaths List paths to pages to compile
     */
    processPages(pagePaths: string[]): void {
        for (const pagePath of pagePaths) {
            this.processPage(pagePath);
        }
    }

    /**
     * Compiles a single page.
     * @param pagePath Path to page to compile
     */
    processPage(pagePath: string): void {
        // compile page
        const page = this.pipeline.compilePage(pagePath);

        // callback
        if (this.options.onPageCompiled) {
            this.options.onPageCompiled(page);
        }
    }
}

/**
 * Creates a pipeline from an options object
 * @param options Options object to configure pipeline
 */
function createPipeline(options: MpOptions): Pipeline {
    // create the HTML formatter, if specified
    const formatter: HtmlFormatter = createFormatter(options);

    // create interface
    const pi = new NodePipelineInterface(options.inPath, options.outPath);

    // create pipeline
    return new StandardPipeline(pi, formatter);
}

/**
 * Creates an HtmlFormatter from the provided options
 * TODO move elsewhere
 * @internal
 * @returns an HtmlFormatter instance configured from {@link options}
 */
export function createFormatter(options: MpOptions): HtmlFormatter {
    switch (options.formatter) {
        case StandardHtmlFormatterMode.PRETTY:
            return new StandardHtmlFormatter(StandardHtmlFormatterMode.PRETTY, os.EOL);
        case StandardHtmlFormatterMode.MINIMIZED:
            return new StandardHtmlFormatter(StandardHtmlFormatterMode.MINIMIZED);
        case StandardHtmlFormatterMode.NONE:
        case undefined:
            return new StandardHtmlFormatter(StandardHtmlFormatterMode.NONE);
        default:
            throw new Error(`Unknown HTML formatter: ${ options.formatter }`);
    }
}

/**
 * Pipeline interface that uses Node.JS file APIs
 * TODO move elsewhere
 * @internal
 */
export class NodePipelineInterface implements PipelineInterface {
    /**
     * Path to source directory, if not current working directory.
     */
    private readonly sourcePath?: string;

    /**
     * Path to destination directory, if not current working directory.
     */
    private readonly destinationPath?: string;

    /**
     * Next available generated resource ID
     */
    private nextResIndex = 0;

    /**
     * Creates a new NodePipelineInterface
     * @param sourcePath Optional path to source directory
     * @param destinationPath Optional path to destination directory
     */
    constructor(sourcePath?: string, destinationPath?: string) {
        this.sourcePath = sourcePath;
        this.destinationPath = destinationPath;
    }

    getResource(type: MimeType, resPath: string): string {
        const htmlPath = this.resolveSourceResource(resPath);

        return FsUtils.readFile(htmlPath);
    }

    writeResource(type: MimeType, resPath: string, content: string): void {
        const htmlPath = this.resolveDestinationResource(resPath);

        FsUtils.writeFile(htmlPath, content, true);
    }

    // sourceResPath is available as last parameter, if needed
    createResource(type: MimeType, contents: string): string {
        const resPath = this.createResPath(type);

        this.writeResource(type, resPath, contents);

        return resPath;
    }

    /**
     * Gets the real path to a resource, factoring in {@link sourcePath}.
     * @param resPath Raw path to resource
     * @returns Real path to resource
     */
    resolveSourceResource(resPath: string): string {
        return NodePipelineInterface.resolvePath(resPath, this.sourcePath);
    }


    /**
     * Gets the real path to a resource, factoring in {@link destinationPath}.
     * @param resPath Raw path to resource
     * @returns Real path to resource
     */
    resolveDestinationResource(resPath: string): string {
        return NodePipelineInterface.resolvePath(resPath, this.destinationPath);
    }

    /**
     * Creates a unique resource path for a generated resource
     * // TODO better implementation
     * @param type MIME type of the resource to create
     * @returns returns a unique resource path that is acceptable for the specified MIME type
     */
    createResPath(type: MimeType): string {
        const index = this.nextResIndex;
        this.nextResIndex++;

        const extension = getResourceTypeExtension(type);
        const fileName = `${ index }.${ extension }`;

        return Path.join('resources', fileName);
    }

    private static resolvePath(resPath: string, directory?: string): string {
        if (directory != null) {
            return Path.resolve(directory, resPath);
        } else {
            return Path.resolve(resPath);
        }
    }
}

/**
 * Gets the filename extension to use for a specified resource type.
 * Defaults to "dat" for unknown resource types.
 * @param resourceType Resource type to get extension for
 * @returns filename extension, without the dot.
 */
export function getResourceTypeExtension(resourceType: MimeType): string {
    switch (resourceType) {
        case MimeType.HTML: return 'html';
        case MimeType.CSS: return 'css';
        case MimeType.JAVASCRIPT: return 'js';
        case MimeType.JSON: return 'json';
        case MimeType.TEXT: return 'txt';
        default: return 'dat';
    }
}