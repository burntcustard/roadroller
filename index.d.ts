export class ResourcePool {
    constructor();
    /** @deprecated Should not be used externally! */
    allocate(parent: object, size: number): ArrayBuffer;
    /** @deprecated Should not be used externally! */
    release(buf: ArrayBuffer): void;
}

/** @deprecated Use {@link ResourcePool} instead */
export const ArrayBufferPool = ResourcePool;

export type ScaledFreq = number;

export type Bit = 0 | 1;

export interface AnsOptions {
    sse?: boolean;
    outBits: number;
    precision: number;
}

export interface AnsOutput {
    state: number;
    buf: number[];
}

export class AnsEncoder {
    constructor(options: AnsOptions);
    writeBit(bit: Bit, predictedFreq: ScaledFreq): void;
    finish(): AnsOutput;
}

export class AnsDecoder {
    constructor(output: AnsOutput, options: AnsOptions);
    readBit(predictedFreq: ScaledFreq): Bit;
}

export interface Model {
    predict(context?: number): ScaledFreq;
    update(actualBit: Bit, context?: number): void;
    flushByte(currentByte: number, inBits: number): void;
    release?(): void;
}

export interface DirectContextModelOptions {
    inBits: number;
    contextBits: number;
    precision: number;
    modelMaxCount: number;
    modelRecipBaseCount: number;
    resourcePool?: ResourcePool;
    /** @deprecated Use {@link DirectContextModelOptions.resourcePool} instead */
    arrayBufferPool?: ResourcePool;
}

export class DirectContextModel implements Model {
    constructor(options: DirectContextModelOptions);
    predict(context?: number): ScaledFreq;
    update(actualBit: Bit, context?: number): void;
    flushByte(currentByte: number, inBits: number): void;
    release(): void;
}

export interface SparseContextModelOptions extends DirectContextModelOptions {
    sparseSelector: number;
}

export class SparseContextModel implements DirectContextModel {
    constructor(options: SparseContextModelOptions);
    predict(context?: number): ScaledFreq;
    update(actualBit: Bit, context?: number): void;
    flushByte(currentByte: number, inBits: number): void;
    release(): void;
}

export class WordContextModel extends DirectContextModel {
    constructor(options: DirectContextModelOptions);
    word: number;
    sparseContext: number;
}

export interface LogisticMixModelOptions {
    recipLearningRate: number;
    precision: number;
}

export class LogisticMixModel implements Model {
    constructor(models: Model[], options: LogisticMixModelOptions);
    predict(context?: number): ScaledFreq;
    update(actualBit: Bit, context?: number): void;
    flushByte(currentByte: number, inBits: number): void;
    release(): void;
}

export interface DefaultModelOptions extends DirectContextModelOptions, LogisticMixModelOptions {
    /** Opt-in compact secondary symbol estimation. Default: false. */
    sse?: boolean;
    pairRecipLearningRate?: number;
    sparseSelectors: number[];
    modelQuotes: boolean;
}

export class DefaultModel implements LogisticMixModel {
    constructor(options: DefaultModelOptions);
    predict(context?: number): ScaledFreq;
    update(actualBit: Bit, context?: number): void;
    flushByte(currentByte: number, inBits: number): void;
    release(): void;

    readonly quotesSeen: Set<number>;
}

export interface CompressOptions extends AnsOptions {
    inBits: number;
    preset?: number[];
    inputEndsWithByte?: number;
    calculateByteEntropy?: boolean;
}

export interface DefaultModelCompressOptions extends CompressOptions, DefaultModelOptions {
    disableWasm?: boolean;
}

export interface Output {
    inputLength: number;
    state: number;
    buf: number[];
}

export interface OutputExtra extends Output {
    bufLengthInBytes: number;
    byteEntropy?: number[];
}

export interface DefaultModelOutputExtra extends OutputExtra {
    quotesSeen: Set<number>;
}

export function compressWithModel(input: ArrayLike<number>, model: Model, options: CompressOptions): OutputExtra;
export function compressWithDefaultModel(input: ArrayLike<number>, options: DefaultModelCompressOptions): DefaultModelOutputExtra;
export function decompressWithModel(output: Output, model: Model, options: CompressOptions): number[];

export interface OptimizerProgressInfo<Params = number[]> {
    pass: string;
    passRatio?: number;
    current: Params;
    currentSize: number;
    /** Cached Zopfli-100 size, if already calculated; logging does not compute it. */
    currentSize100?: number;
    /** Cached Zopfli-1000 size, if already calculated; logging does not compute it. */
    currentSize1000?: number;
    currentRejected: boolean;
    best: Params;
    bestSize: number[];
    bestUpdated: boolean;
}

export interface OptimizerResult<Params = number[]> {
    elapsedMsecs: number;
    best: Params;
    bestSize: number[];
}

export function defaultSparseSelectors(numContexts?: number): number[];

export const enum InputType {
    JS = 'js',
    GLSL = 'glsl',
    HTML = 'html',
    Text = 'text',
    Binary = 'binary',
}

export const enum InputAction {
    Eval = 'eval',
    JSON = 'json',
    String = 'string',
    Write = 'write',
    Array = 'array',
    Uint8Array = 'u8array',
    Base64 = 'base64',
}

export interface Input {
    data: string | ArrayLike<number>;
    type: InputType;
    action: InputAction;
}

export const enum DynamicModelFlags {
    Quotes = 1 << 0,
}

export interface PackerOptions {
    /** Opt-in compact SSE. May improve the final ZIP; not a universal win. */
    sse?: boolean;
    pairRecipLearningRate?: number;
    sparseSelectors?: number[];
    /**
     * Memory budget for model context tables, in decimal MB
     * (1 MB = 1,000,000 bytes).
     *
     * Higher values may improve compression at the cost of greater
     * decompression memory usage. Context table sizes increase in
     * power-of-two steps, so the actual allocation may be below this value.
     * Auxiliary mixer weights are additional.
     *
     * Default: 500.
     */
    maxMemoryMB?: number;
    contextBits?: number;
    precision?: number;
    modelMaxCount?: number;
    modelRecipBaseCount?: number;
    resourcePool?: ResourcePool;
    /** @deprecated Use {@link PackerOptions.resourcePool} instead */
    arrayBufferPool?: ResourcePool;
    recipLearningRate?: number;
    numAbbreviations?: number;
    dynamicModels?: number; // bit flags out of DynamicModelFlags
    allowFreeVars?: boolean;
    /** Fitness context only; not included in makeDecoder() output or the legacy estimate. */
    optimizePrefix?: string;
    optimizeSuffix?: string;
    /** Receives prefix + firstLine + secondLine + suffix. */
    optimizeScore?: (input: string, packed: Packed, options: PackerOptions) => number | {
        valueOf(): number;
        /** Signed size difference; also used for annealing acceptance probability. */
        compare(other: any): number;
        cachedSizeAt?(iterations: number): number | undefined;
    };
}

export interface OptimizedPackerOptions {
    pairRecipLearningRate?: number;
    sparseSelectors: number[];
    precision?: number;
    modelMaxCount?: number;
    modelRecipBaseCount?: number;
    recipLearningRate?: number;
    numAbbreviations?: number;
    /** @deprecated Replaced by {@link OptimizedPackerOptions.dynamicModels}, no longer used */
    preferTextOverJS?: boolean;
    dynamicModels?: number;
}

export class Packer {
    constructor(inputs: Input[], options: PackerOptions);
    readonly memoryUsageMB: number;
    makeDecoder(): Packed;

    optimize(
        progress?: (info: OptimizerProgressInfo<OptimizedPackerOptions>) => undefined | boolean | Promise<undefined | boolean>,
    ): Promise<OptimizerResult<OptimizedPackerOptions>>;
    optimize(
        level: number,
        progress?: (info: OptimizerProgressInfo<OptimizedPackerOptions>) => undefined | boolean | Promise<undefined | boolean>,
    ): Promise<OptimizerResult<OptimizedPackerOptions>>;
}

export interface Packed {
    readonly firstLine: string;
    readonly firstLineLengthInBytes: number;
    readonly secondLine: string;
    readonly freeVars: string[];
    estimateLength(): number;
}
