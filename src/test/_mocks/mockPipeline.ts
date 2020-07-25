import { Pipeline, HtmlFormatter, Fragment, CompiledPage } from "../../lib";
import { MemoryPipelineInterface } from "./memoryPipelineInterface";

export class MockPipeline extends Pipeline {
    readonly mockPi: MemoryPipelineInterface;

    constructor(pi?: MemoryPipelineInterface, htmlFormatter?: HtmlFormatter) {
        super((pi = pi ?? new MemoryPipelineInterface()), htmlFormatter);
        this.mockPi = pi;
    }

    compilePage(): CompiledPage {
        throw new Error('Not implemented');
    }

    compileFragment(): Fragment {
        throw new Error('Not implemented');
    }

    compileComponent(): Fragment {
        throw new Error('Not implemented');
    }

    compileDomText(): unknown {
        throw new Error('Not implemented');
    }

    compileCss(): string {
        throw new Error('Not implemented');
    }

    linkResource(): string {
        throw new Error('Not implemented');
    }

    getRawFragment(): Fragment {
        throw new Error('Not implemented');
    }
}