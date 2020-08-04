import { Handler, Parser, ParserOptions } from 'htmlparser2/lib/Parser';
import { DocumentNode, NodeWithChildren, TagNode, TextNode, CommentNode, CDATANode, ProcessingInstructionNode, MVarNode, MFragmentNode, MSlotNode, MContentNode, MImportNode, MIfNode, MScopeNode, MForNode, MForOfNode, MForInNode, MElseNode, MElseIfNode, MDataNode, ExternalStyleNode, InternalStyleNode, StyleNodeBind, StyleNode, ScriptNode, ExternalScriptNode, InternalScriptNode } from './node';
import { MimeType } from '..';

/**
 * Parses HTML into a dom using htmlparser2
 */
export class DomParser {
    private readonly handler: DomHandler;
    private readonly parser: Parser;

    constructor(userOptions?: ParserOptions) {
        // get parser otions
        const options = createParserOptions(userOptions);

        // set up handler
        this.handler = new DomHandler();

        // create parser
        this.parser = new Parser(this.handler, options);
    }

    /**
     * Parse a string of HTML into a DOM
     * @param html HTML to parse
     * @returns a DocumentNode containing parsed HTML
     */
    parseDom(html: string): DocumentNode {
        // reset parser
        this.parser.reset();

        // process html
        this.parser.write(html);
        this.parser.end();

        // get generated dom
        return this.handler.getDom();
    }
}

function createParserOptions(userOptions?: ParserOptions) {
    // base (default) options
    const options: ParserOptions = {
        recognizeSelfClosing: true,
        lowerCaseTags: true
    };

    // load user-supplied options
    if (userOptions != undefined) {
        Object.assign(options, userOptions);
    }

    return options;
}

/**
 * Implementation of htmlparser2's Handler interface that generates a DOM from the parsed HTML.
 */
export class DomHandler implements Partial<Handler> {
    private dom: DocumentNode;
    private currentParent: NodeWithChildren;

    constructor() {
        this.dom = new DocumentNode();
        this.currentParent = this.dom;
    }

    /**
     * Gets the generated DOM in its current state
     * @returns a DocumentNode containing all parsed HTML
     */
    getDom(): DocumentNode {
        return this.dom;
    }

    onreset(): void {
        this.dom = new DocumentNode();
        this.currentParent = this.dom;
    }

    onerror(error: Error): void {
        throw error;
    }

    onopentag(name: string, attribs: { [s: string]: string }): void {
        // normalize tag name
        const tagName = name.toLowerCase();

        // copy attribs
        const attributes = new Map<string, string | null>();
        for (const key of Object.keys(attribs)) {
            const attrVal = attribs[key];
            const value: string | null = (attrVal != undefined && attrVal.length > 0) ? attrVal : null;
            attributes.set(key, value);
        }

        // create tag
        const tag: TagNode = this.createTagNode(tagName, attributes);

        this.pushParent(tag);
    }

    onclosetag(): void {
        this.popParent();
    }

    ontext(data: string): void {
        // create text node
        const textNode = new TextNode(data);

        // append to parent
        this.currentParent.appendChild(textNode);
    }

    oncomment(data: string): void {
        // create comment node
        const commentNode = new CommentNode(data);

        // append to parent
        this.currentParent.appendChild(commentNode);
    }

    oncdatastart(): void {
        // create cdata node
        const cdataNode = new CDATANode();

        // append to parent
        this.currentParent.appendChild(cdataNode);

        // set as parent
        this.pushParent(cdataNode);
    }

    oncdataend(): void {
        this.popParent();
    }
    
    onprocessinginstruction(name: string, data: string): void {
        // create node
        const piNode = new ProcessingInstructionNode(name, data);

        // append to parent
        this.currentParent.appendChild(piNode);
    }

    private pushParent(node: NodeWithChildren): void {
        // attach to parent
        this.currentParent.appendChild(node);

        // push node
        this.currentParent = node;
    }

    private popParent(): void {
        if (this.currentParent == null) {
            throw new Error('Tried to close too many tags');
        }

        if (this.currentParent === this.dom) {
            throw new Error('Tried to close too many tags: DOM is currentParent');
        }
        
        this.currentParent = this.currentParent.parentNode ?? this.dom;
    }
    
    private createTagNode(tagName: string, attributes: Map<string, string | null>): TagNode {
        switch (tagName) {
            case 'm-fragment':
                return this.createMFragmentNode(attributes);
            case 'm-slot':
                return this.createMSlotNode(attributes);
            case 'm-content':
                return this.createMContentNode(attributes);
            case 'm-var':
                return new MVarNode(attributes);
            case 'm-scope':
                return new MScopeNode(attributes);
            case 'm-import':
                return this.createMImportNode(attributes);
            case 'm-if':
                return this.createMIfNode(attributes);
            case 'm-else-if':
                return this.createMElseIfNode(attributes);
            case 'm-else':
                return new MElseNode(attributes);
            case 'm-for':
                return this.createMForNode(attributes);
            case 'm-data':
                return this.createMDataNode(attributes);
            case 'style':
                return this.createStyleNode(attributes);
            case 'script':
                return this.createScriptNode(attributes);
            default:
                return new TagNode(tagName, attributes);
        }
    }

    private createMFragmentNode(attributes: Map<string, string | null>): MFragmentNode {
        const src = attributes.get('src');
        if (src == undefined) throw new Error('Parse error: <m-fragment> is missing required attribute: src');
        return new MFragmentNode(src, attributes);
    }

    private getSlotAttribute(attributes: Map<string, string | null>): string | undefined {
        const slot = attributes.get('slot');
        return slot != undefined ? String(slot) : undefined;
    }

    private createMSlotNode(attributes: Map<string, string | null>): MSlotNode {
        const slot = this.getSlotAttribute(attributes);
        return new MSlotNode(slot, attributes);
    }

    private createMContentNode(attributes: Map<string, string | null>): MContentNode {
        const slot = this.getSlotAttribute(attributes);
        return new MContentNode(slot, attributes);
    }

    private createMImportNode(attributes: Map<string, string | null>): MImportNode {
        const src = attributes.get('src');
        if (src == undefined) throw new Error('Parse error: <m-import> is missing required attribute: src');
        const as = attributes.get('as');
        if (as == undefined) throw new Error('Parse error: <m-import> is missing required attribute: as');
        return new MImportNode(src, as, attributes);
    }

    private createMIfNode(attributes: Map<string, string | null>): MIfNode {
        const expression = attributes.get('?');
        if (expression == undefined) throw new Error('Parse error: <m-if> is missing required attribute: ?');
        return new MIfNode(expression, attributes);
    }

    private createMElseIfNode(attributes: Map<string, string | null>): MElseIfNode {
        const expression = attributes.get('?');
        if (expression == undefined) throw new Error('Parse error: <m-else-if> is missing required attribute: ?');
        return new MElseIfNode(expression, attributes);
    }

    private createMForNode(attributes: Map<string, string | null>): MForNode {
        const varName = attributes.get('var');
        if (varName == undefined) throw new Error('Parse error: <m-for> is missing required attribute: varName');

        const indexName = attributes.get('index') ?? undefined;
        const ofExpression = attributes.get('of') ?? undefined;
        const inExpression = attributes.get('in') ?? undefined;

        if (ofExpression != undefined && inExpression == undefined) {
            return new MForOfNode(ofExpression, varName, indexName, attributes);
        } else if (inExpression != undefined && ofExpression == undefined) {
            return new MForInNode(inExpression, varName, indexName, attributes);
        } else {
            throw new Error('Parse error: <m-for> must have exactly one of these attributes: [of,in]');
        }
    }

    private createMDataNode(attributes: Map<string, string | null>): MDataNode {
        const type = attributes.get('type');
        if (type == undefined || type == null) throw new Error('Parse error: <m-data> is missing required attribute: type');
        if (type !== MimeType.JSON && type !== MimeType.TEXT) throw new Error(`Parse error: <m-data> has invalid value for attribute 'type': '${ type }'`)
        return new MDataNode(type, attributes);
    }

    private createStyleNode(attributes: Map<string, string | null>): StyleNode {
        // "uncompiled" style nodes should be passed on as-is
        if (!attributes.has('compiled')) {
            return new StyleNode(false, attributes);
        }

        // "compiled" stlye nodes need further processing
        const bind = attributes.get('bind') ?? undefined;
        if (bind != undefined && bind != StyleNodeBind.HEAD && bind != StyleNodeBind.LINK) {
            throw new Error(`Parse error: <style> has invalid value for attribute 'bind': '${ bind }'`)
        }
        const src = attributes.get('src');
        if (src != undefined) {
            return new ExternalStyleNode(src, bind, attributes);
        } else {
            return new InternalStyleNode(bind, attributes);
        }
    }

    private createScriptNode(attributes: Map<string, string | null>): ScriptNode {
        // "uncompiled" style nodes should be passed on as-is
        if (!attributes.has('compiled')) {
            return new ScriptNode(false, attributes);
        }

        // "compiled" stlye nodes need further processing
        const src = attributes.get('src');
        if (src != undefined) {
            return new ExternalScriptNode(src, attributes);
        } else {
            return new InternalScriptNode(attributes);
        }
    }
}